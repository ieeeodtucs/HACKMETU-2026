"""
Denoising Autoencoder for anomaly detection.

Architecture: input_dim -> 48 -> 24 -> 12 (bottleneck) -> 24 -> 48 -> input_dim
Adds Gaussian noise during training for robust normal manifold learning.
Anomaly score = reconstruction error (SmoothL1/Huber), z-score normalized.
"""

import logging
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from config.settings import (
    AE_ENCODER_DIMS,
    AE_LATENT_DIM,
    AE_NOISE_FACTOR,
    AE_LEARNING_RATE,
    AE_EPOCHS,
    AE_BATCH_SIZE,
    AE_MODEL_PATH,
)

logger = logging.getLogger(__name__)


class DenoisingAutoencoder(nn.Module):
    """Denoising AE: noisy input -> clean reconstruction."""

    def __init__(self, input_dim: int, encoder_dims: list[int] = None,
                 latent_dim: int = None, noise_factor: float = AE_NOISE_FACTOR):
        super().__init__()
        encoder_dims = encoder_dims or AE_ENCODER_DIMS
        latent_dim = latent_dim or AE_LATENT_DIM
        self.noise_factor = noise_factor

        # Encoder: first hidden gets dropout, last hidden doesn't
        layers = []
        prev = input_dim
        for i, dim in enumerate(encoder_dims):
            layers.extend([nn.Linear(prev, dim), nn.BatchNorm1d(dim), nn.GELU()])
            if i < len(encoder_dims) - 1:
                layers.append(nn.Dropout(0.1))
            prev = dim
        layers.append(nn.Linear(prev, latent_dim))
        self.encoder = nn.Sequential(*layers)

        # Decoder (mirror)
        reversed_dims = list(reversed(encoder_dims))
        layers = []
        prev = latent_dim
        for i, dim in enumerate(reversed_dims):
            layers.extend([nn.Linear(prev, dim), nn.BatchNorm1d(dim), nn.GELU()])
            if i < len(reversed_dims) - 1:
                layers.append(nn.Dropout(0.1))
            prev = dim
        layers.append(nn.Linear(prev, input_dim))
        self.decoder = nn.Sequential(*layers)

    def add_noise(self, x):
        if self.training:
            return x + torch.randn_like(x) * self.noise_factor
        return x

    def forward(self, x):
        return self.decoder(self.encoder(self.add_noise(x)))

    def encode(self, x):
        return self.encoder(x)


class AutoencoderModel:
    """Training, prediction, and persistence wrapper for Denoising AE."""

    def __init__(self, input_dim: int, learning_rate: float = AE_LEARNING_RATE,
                 epochs: int = AE_EPOCHS, batch_size: int = AE_BATCH_SIZE):
        self.input_dim = input_dim
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.batch_size = batch_size
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        self.model = DenoisingAutoencoder(input_dim).to(self.device)
        self.criterion = nn.SmoothL1Loss(reduction="none")

        self.threshold_mean: float = 0.0
        self.threshold_std: float = 1.0
        self.is_fitted = False

    def train(self, X_normal: np.ndarray) -> dict:
        """Train denoising AE on normal data."""
        logger.info("Training Denoising AE on %d samples (%d features) on %s",
                     X_normal.shape[0], X_normal.shape[1], self.device)

        tensor_data = torch.FloatTensor(X_normal).to(self.device)
        dataset = TensorDataset(tensor_data, tensor_data)
        loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)

        optimizer = torch.optim.AdamW(self.model.parameters(), lr=self.learning_rate, weight_decay=1e-4)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=self.epochs, eta_min=1e-6)

        best_loss, patience, best_state = float('inf'), 0, None

        for epoch in range(self.epochs):
            self.model.train()
            eloss, n = 0, 0
            for bx, target in loader:
                optimizer.zero_grad()
                loss = self.criterion(self.model(bx), target).mean()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                optimizer.step()
                eloss += loss.item()
                n += 1
            avg = eloss / n
            scheduler.step()

            if avg < best_loss:
                best_loss = avg
                best_state = {k: v.cpu().clone() for k, v in self.model.state_dict().items()}
                patience = 0
            else:
                patience += 1
                if patience >= 25:
                    logger.info("Early stop @ epoch %d, loss=%.6f", epoch + 1, best_loss)
                    break

            if (epoch + 1) % 30 == 0:
                logger.info("Epoch %d/%d: loss=%.6f", epoch + 1, self.epochs, avg)

        self.model.load_state_dict(best_state)

        # Calibrate threshold on training data
        train_errors = self._compute_errors(X_normal)
        self.threshold_mean = float(np.mean(train_errors))
        self.threshold_std = float(np.std(train_errors))
        self.is_fitted = True

        logger.info("AE training complete: loss=%.6f, threshold_mean=%.6f", best_loss, self.threshold_mean)
        return {"final_loss": best_loss, "threshold_mean": self.threshold_mean, "threshold_std": self.threshold_std}

    def _compute_errors(self, X: np.ndarray) -> np.ndarray:
        self.model.eval()
        with torch.no_grad():
            t = torch.FloatTensor(X).to(self.device)
            return self.criterion(self.model(t), t).mean(dim=1).cpu().numpy()

    def predict_scores(self, X: np.ndarray) -> np.ndarray:
        """Anomaly scores [0-1] using log-ratio normalization.

        Uses log2(error / baseline) with a gentle sensitivity multiplier.
        At baseline (training mean), score = 0.5. Higher errors → higher score.
        Sensitivity 0.25 keeps the sigmoid in its useful range for OOD inputs.
        """
        if not self.is_fitted:
            raise RuntimeError("Model not trained.")
        errors = self._compute_errors(X)
        baseline = max(self.threshold_mean, 1e-6)
        ratio = errors / baseline
        log_ratio = np.log2(np.maximum(ratio, 1e-6))
        return 1 / (1 + np.exp(-log_ratio * 0.25))

    def predict_single(self, x: np.ndarray) -> float:
        if x.ndim == 1:
            x = x.reshape(1, -1)
        return float(self.predict_scores(x)[0])

    def save(self, path: str | None = None) -> None:
        save_path = path or str(AE_MODEL_PATH)
        torch.save({
            "model_state_dict": self.model.state_dict(),
            "input_dim": self.input_dim,
            "noise_factor": self.model.noise_factor,
            "threshold_mean": self.threshold_mean,
            "threshold_std": self.threshold_std,
        }, save_path)
        logger.info("AE saved to %s", save_path)

    def load(self, path: str | None = None) -> None:
        load_path = path or str(AE_MODEL_PATH)
        checkpoint = torch.load(load_path, map_location=self.device, weights_only=False)
        if checkpoint["input_dim"] != self.input_dim:
            self.input_dim = checkpoint["input_dim"]
            noise = checkpoint.get("noise_factor", AE_NOISE_FACTOR)
            self.model = DenoisingAutoencoder(self.input_dim, noise_factor=noise).to(self.device)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.threshold_mean = checkpoint["threshold_mean"]
        self.threshold_std = checkpoint["threshold_std"]
        self.is_fitted = True
        logger.info("AE loaded from %s", load_path)
