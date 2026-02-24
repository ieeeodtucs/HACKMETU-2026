"""
server/auth_seed.py — Idempotent seed for auth_accounts.

Seeds 2 accounts (SERVER + CLIENT) on first startup.
If an account already exists, it is left untouched (no password overwrite).
Credentials are read from environment variables with safe defaults.
"""

import os
import bcrypt
from sqlalchemy.orm import Session

from server.db_models import AuthAccount


def _hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain* stored as a UTF-8 string."""
    hashed_bytes = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt())
    return hashed_bytes.decode("utf-8")


def seed_auth_accounts(db: Session) -> None:
    """
    Insert the two bootstrap accounts into auth_accounts if they do not
    already exist.  Reads credentials from environment variables so that
    the defaults can be overridden in production without code changes.

    Environment variables (with defaults):
        OPS_SERVER_USER  — default "ops-server"
        OPS_SERVER_PASS  — default "server123!"
        OPS_CLIENT_USER  — default "ops-client"
        OPS_CLIENT_PASS  — default "client123!"
    """
    accounts = [
        {
            "username": os.environ.get("OPS_SERVER_USER", "ops-server"),
            "password": os.environ.get("OPS_SERVER_PASS", "server123!"),
            "role": "SERVER",
        },
        {
            "username": os.environ.get("OPS_CLIENT_USER", "ops-client"),
            "password": os.environ.get("OPS_CLIENT_PASS", "client123!"),
            "role": "CLIENT",
        },
    ]

    inserted = 0
    for account in accounts:
        existing = (
            db.query(AuthAccount)
            .filter(AuthAccount.username == account["username"])
            .first()
        )
        if existing is not None:
            # Already present — idempotent: leave as-is
            continue

        db.add(
            AuthAccount(
                username=account["username"],
                password_hash=_hash_password(account["password"]),
                role=account["role"],
                can_register=True,
            )
        )
        inserted += 1

    # Single commit covering all inserts (or none if both already existed)
    db.commit()

    if inserted:
        import logging
        logging.getLogger(__name__).info(
            "auth_seed: inserted %d account(s) into auth_accounts", inserted
        )
