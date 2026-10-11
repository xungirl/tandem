import os
from pathlib import Path

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

DEFAULT_URL = f"sqlite:///{Path(__file__).resolve().parent.parent / 'tandem.db'}"

engine = None


def configure(url: str | None = None):
    """(Re)create the engine. Tests call this with a temp file URL."""
    global engine
    url = url or os.environ.get("DATABASE_URL", DEFAULT_URL)
    kwargs = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _fk(conn, _):
            conn.execute("PRAGMA foreign_keys=ON")
    return engine


def init_db():
    from . import models  # noqa: F401  register tables
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


configure()
