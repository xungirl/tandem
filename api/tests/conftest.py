import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    from fastapi.testclient import TestClient

    from app import db
    db.configure(f"sqlite:///{tmp_path_factory.mktemp('db') / 'test.db'}")
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def demo(client):
    r = client.post("/api/auth/demo")
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}
