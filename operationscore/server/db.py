"""
server/db.py — SQLAlchemy 2.0 engine, session factory, and declarative Base.

Creates the SQLite engine pointing at server/data/operationscore.db.
Ensures server/data/ exists at import time (idempotent).
"""

from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent   # repo root
DATA_DIR = BASE_DIR / "server" / "data"
DB_PATH  = DATA_DIR / "operationscore.db"

# Ensure the directory exists before the engine is created
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
    future=True,
    echo=False,
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True,
)

# ---------------------------------------------------------------------------
# Declarative Base (shared by all ORM models)
# ---------------------------------------------------------------------------
Base = declarative_base()


# ---------------------------------------------------------------------------
# DB initialisation
# ---------------------------------------------------------------------------
def init_db() -> None:
    """
    Register all ORM models then create every table that does not yet exist.
    Safe to call on every startup (create_all is idempotent).
    """
    from server import db_models  # noqa: F401 — registers models with Base
    Base.metadata.create_all(bind=engine)
