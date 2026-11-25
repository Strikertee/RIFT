from __future__ import annotations

import os
import tempfile
import uuid
from pathlib import Path

import pytest

_DB_FILE = Path(tempfile.gettempdir()) / f"rift-test-{uuid.uuid4().hex}.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.as_posix()}"
os.environ["RIFT_ISSUER_PRIVATE_KEY_HEX"] = (
    "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"
)
os.environ["ISSUER_KEY_VERSION"] = "v1"
os.environ["RELAY_API_KEY"] = "test-relay-key"
os.environ["ADMIN_SECRET"] = "test-admin-secret"
os.environ["MOCK_STARTING_BALANCE_KOBO"] = "5000000"
os.environ["AUTO_CREATE_SCHEMA"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
    try:
        _DB_FILE.unlink(missing_ok=True)
    except OSError:
        pass
