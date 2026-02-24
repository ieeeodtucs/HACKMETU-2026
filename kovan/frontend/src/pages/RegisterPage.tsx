import { useState } from "react";
import { signUp } from "../auth-client";
import { useAuthStore } from "../store";
import { useNavigate } from "react-router";
import {
  EnvelopeSimpleIcon,
  LockIcon,
  UserIcon,
  UserPlusIcon,
  SpinnerGapIcon,
  ShieldCheckIcon,
  TerminalWindowIcon,
  ChartLineUpIcon,
} from "@phosphor-icons/react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fetchSession = useAuthStore((s) => s.fetchSession);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    await signUp.email(
      { name, email, password },
      {
        onSuccess: async () => {
          await fetchSession();
          navigate("/dashboard");
        },
        onError: (ctx) => {
          setError(ctx.error.message || "Kayıt başarısız");
          setLoading(false);
        },
      }
    );
  };

  return (
    <div className="auth-page">
      {/* Left — branding panel */}
      <div className="auth-side">
        <div className="auth-side-bg" />
        <div className="auth-side-content">
          <div className="auth-side-logo" onClick={() => navigate("/")}>
            <img src="/assets/kovan-icon.svg" alt="Kovan" width={40} height={40} />
            <span>KOVAN</span>
          </div>

          <div className="auth-side-text">
            <h1>Siber Güvenlik<br /><span>Kontrol Merkezi</span></h1>
            <p>Ağ cihazlarınızı tek panelden yönetin, güvenlik açıklarını tarayın ve tehditlere anında müdahale edin.</p>
          </div>

          <div className="auth-side-features">
            <div className="auth-side-feature">
              <ShieldCheckIcon size={20} weight="duotone" />
              <span>47K+ CVE Veritabanı</span>
            </div>
            <div className="auth-side-feature">
              <ChartLineUpIcon size={20} weight="duotone" />
              <span>ML Anomali Tespiti</span>
            </div>
            <div className="auth-side-feature">
              <TerminalWindowIcon size={20} weight="duotone" />
              <span>Uzaktan Komut Yönetimi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="auth-form-side">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2 className="auth-title">Kayıt Ol</h2>
          <p className="auth-subtitle">Yeni bir hesap oluşturun</p>

          {error && <div className="auth-error">{error}</div>}

          <label className="auth-label">Ad Soyad</label>
          <div className="auth-field">
            <UserIcon size={18} />
            <input
              type="text"
              placeholder="Adınız Soyadınız"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <label className="auth-label">Email</label>
          <div className="auth-field">
            <EnvelopeSimpleIcon size={18} />
            <input
              type="email"
              placeholder="ornek@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <label className="auth-label">Şifre</label>
          <div className="auth-field">
            <LockIcon size={18} />
            <input
              type="password"
              placeholder="Minimum 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? (
              <SpinnerGapIcon size={16} className="si-run" />
            ) : (
              <UserPlusIcon size={16} />
            )}
            {loading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
          </button>

          <p className="auth-switch">
            Zaten hesabın var mı?{" "}
            <button type="button" onClick={() => navigate("/login")}>
              Giriş Yap
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
