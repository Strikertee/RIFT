from __future__ import annotations

from httpx import AsyncClient

from tests.helpers import (
    CUSTOMER_SEED_HEX,
    MERCHANT_SEED_HEX,
    register_body,
)


async def register_customer(client: AsyncClient, phone: str = "+2348000000001") -> dict[str, object]:
    response = await client.post(
        "/api/v1/auth/register",
        json=register_body(
            user_type="CUSTOMER",
            display_name="Bayo Commuter",
            phone_number=phone,
            seed_hex=CUSTOMER_SEED_HEX,
        ),
    )
    assert response.status_code == 201
    return response.json()


async def issue(
    client: AsyncClient,
    bearer: str,
    amount_kobo: int = 1_000_000,
    customer_id: str | None = None,
) -> dict[str, object]:
    body: dict[str, object] = {"amount_kobo": amount_kobo, "duration_hours": 6}
    if customer_id is not None:
        body["customer_id"] = customer_id
    return (
        await client.post(
            "/api/v1/allocations/issue",
            json=body,
            headers={"Authorization": f"Bearer {bearer}"},
        )
    ).json()


async def test_issue_returns_oac_and_post_lock_balances(client: AsyncClient) -> None:
    customer = await register_customer(client)
    response = await client.post(
        "/api/v1/allocations/issue",
        json={"amount_kobo": 1_000_000, "duration_hours": 6},
        headers={"Authorization": f"Bearer {customer['user_id']}"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["oac_id"].startswith("oac_")
    assert body["allocated_amount_kobo"] == 1_000_000
    assert body["available_balance_kobo"] == 4_000_000
    assert body["reserved_balance_kobo"] == 1_000_000
    assert body["issuer_key_version"] == "v1"
    assert len(body["issuer_signature_hex"]) == 128
    assert "." not in body["issued_at"] and "." not in body["expires_at"]


async def test_issue_rejects_customer_id_mismatch(client: AsyncClient) -> None:
    customer = await register_customer(client)
    response = await client.post(
        "/api/v1/allocations/issue",
        json={
            "amount_kobo": 1_000_000,
            "customer_id": "usr_00000000-0000-4000-8000-000000000000",
        },
        headers={"Authorization": f"Bearer {customer['user_id']}"},
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CUSTOMER_MISMATCH"


async def test_issue_rejects_malformed_customer_id(client: AsyncClient) -> None:
    customer = await register_customer(client)
    response = await client.post(
        "/api/v1/allocations/issue",
        json={"amount_kobo": 1_000_000, "customer_id": "not-an-id"},
        headers={"Authorization": f"Bearer {customer['user_id']}"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_CUSTOMER_ID"


async def test_issue_rejects_insufficient_funds(client: AsyncClient) -> None:
    customer = await register_customer(client)
    response = await client.post(
        "/api/v1/allocations/issue",
        json={"amount_kobo": 5_000_001},
        headers={"Authorization": f"Bearer {customer['user_id']}"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INSUFFICIENT_FUNDS"


async def test_allocation_status_returns_owner_view(client: AsyncClient) -> None:
    customer = await register_customer(client)
    allocation = await issue(client, str(customer["user_id"]), 1_000_000)
    response = await client.get(
        f"/api/v1/allocations/{allocation['oac_id']}",
        headers={"Authorization": f"Bearer {customer['user_id']}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["allocated_amount_kobo"] == 1_000_000
    assert body["spent_amount_kobo"] == 0
    assert body["remaining_amount_kobo"] == 1_000_000
    assert body["status"] == "ACTIVE"


async def test_allocation_status_forbids_other_customer(client: AsyncClient) -> None:
    owner = await register_customer(client)
    allocation = await issue(client, str(owner["user_id"]), 1_000_000)
    stranger = await register_customer(client, "+2348000000002")
    response = await client.get(
        f"/api/v1/allocations/{allocation['oac_id']}",
        headers={"Authorization": f"Bearer {stranger['user_id']}"},
    )
    assert response.status_code == 403
