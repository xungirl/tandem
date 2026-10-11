import os
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlmodel import Session, SQLModel, select

from . import db
from .routers import activities, auth, chats, friends, me, people, reference, suggestions
from .models import Activity, utcnow
from .seed import seed
from .ws import router as ws_router

WEB_DIST = Path(__file__).resolve().parent.parent.parent / "web" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    with Session(db.engine) as session:
        if stale(session):
            # Demo data is relative to "now"; refresh it when the upcoming week has run dry.
            session.close()
            SQLModel.metadata.drop_all(db.engine)
            db.init_db()
        seed(session)
    yield


def stale(session: Session) -> bool:
    if os.environ.get("TANDEM_ENV", "dev") == "prod" and not os.environ.get("TANDEM_RESEED"):
        return False
    latest = session.exec(select(func.max(Activity.starts_at))).one()
    return latest is not None and latest < utcnow() + timedelta(days=5)


app = FastAPI(title="Tandem API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

for r in (auth, me, reference, people, friends, activities, suggestions, chats):
    app.include_router(r.router)
app.include_router(ws_router)


@app.get("/api/health")
def health():
    return {"ok": True}


if WEB_DIST.exists():
    if (WEB_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        f = (WEB_DIST / path).resolve()
        if path and f.is_file() and WEB_DIST in f.parents:
            return FileResponse(f)
        return FileResponse(WEB_DIST / "index.html")
