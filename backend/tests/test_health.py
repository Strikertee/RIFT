from __future__ import annotations

from httpx import AsyncClient

import app.routers.health as health_router


async def test_health_reports_required_fields_when_ready(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "status",
        "environment",
        "version",
        "timestamp",
        "database",
        "issuer_key_loaded",
        "issuer_pubkey_hex",
    }
    assert body["status"] == "healthy"
    assert body["database"] == "connected"
    assert body["issuer_key_loaded"] is True


async def test_health_is_degraded_without_issuer_key(
    client: AsyncClient,
    monkeypatch: object,
) -> None:
    monkeypatch.setattr(health_router, "issuer_pubkey_hex", lambda _: None)  # type: ignore[attr-defined]
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
