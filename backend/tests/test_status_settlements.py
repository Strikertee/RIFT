from __future__ import annotations

from httpx import AsyncClient

from tests.helpers import (
    CUSTOMER_SEED_HEX,
    MERCHANT_SEED_HEX,
    STRANGER_SEED_HEX,
    make_transaction,
    register_body,
    relay_body,
)


async def setup_settled_transaction(client: AsyncClient) -> tuple[dict[str, object], dict[str, object], dict[str, object]]:
    customer_response = await client.post(
        "/api/v1/auth/register",
        json=register_body(
            user_type="CUSTOMER",
            display_name="Bayo Commuter",
            phone_number="+2348000000001",
            seed_hex=CUSTOMER_SEED_HEX,
        ),
    )
    merchant_response = await client.post(
        "/api/v1/auth/register",
        json=register_body(
            user_type="MERCHANT",
            display_name="Mama Bose Provisions",
            phone_number="+2348000000003",
            seed_hex=MERCHANT_SEED_HEX,
            business_name="Mama Bose Provisions",
        ),
    )
    customer = customer_response.json()
    merchant = merchant_response.json()
    allocation_response = await client.post(
        "/api/v1/allocations/issue",
        json={"amount_kobo": 1_000_000, "duration_hours": 6},
        headers={"Authorization": f"Bearer {customer['user_id']}"},
    )
    allocation = allocation_response.json()
    transaction = make_transaction(
        oac=allocation,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=250_000,
        seq_no=1,
    )
    result = (
        await client.post("/api/v1/transactions/relay", json=relay_body(transaction))
    ).json()["results"][0]
    assert result["status"] == "SETTLED (SIMULATED)"
    return customer, merchant, transaction


async def test_transaction_status_allowed_for_allocation_owner(client: AsyncClient) -> None:
    customer, _, transaction = await setup_settled_transaction(client)
    response = await client.get(
        f"/api/v1/transactions/{transaction['transaction_id']}/status",
        headers={"Authorization": f"Bearer {customer['user_id']}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["simulated_clearing_ref"].startswith("SIM_SETTLE_")
    assert body["status"] == "SETTLED (SIMULATED)"


async def test_transaction_status_allowed_for_merchant(client: AsyncClient) -> None:
    _, merchant, transaction = await setup_settled_transaction(client)
    response = await client.get(
        f"/api/v1/transactions/{transaction['transaction_id']}/status",
        headers={"Authorization": f"Bearer {merchant['user_id']}"},
    )
    assert response.status_code == 200


async def test_transaction_status_forbids_stranger(client: AsyncClient) -> None:
    _, _, transaction = await setup_settled_transaction(client)
    stranger = await client.post(
        "/api/v1/auth/register",
        json=register_body(
            user_type="CUSTOMER",
            display_name="Stranger",
            phone_number="+2348000000009",
            seed_hex=STRANGER_SEED_HEX,
        ),
    )
    response = await client.get(
        f"/api/v1/transactions/{transaction['transaction_id']}/status",
        headers={"Authorization": f"Bearer {stranger.json()['user_id']}"},
    )
    assert response.status_code == 403


async def test_transaction_status_returns_404_for_unknown_id(client: AsyncClient) -> None:
    customer = await client.post(
        "/api/v1/auth/register",
        json=register_body(
            user_type="CUSTOMER",
            display_name="Bayo Commuter",
            phone_number="+2348000000001",
            seed_hex=CUSTOMER_SEED_HEX,
        ),
    )
    response = await client.get(
        "/api/v1/transactions/tx_unknown/status",
        headers={"Authorization": f"Bearer {customer.json()['user_id']}"},
    )
    assert response.status_code == 404


async def test_settlements_include_only_settled_rows(client: AsyncClient) -> None:
    _, merchant, _ = await setup_settled_transaction(client)
    merchant_id = str(merchant["user_id"])
    response = await client.get(
        f"/api/v1/merchants/{merchant_id}/settlements",
        headers={"Authorization": f"Bearer {merchant_id}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["total_settled_kobo"] == 250_000
    assert body["settlements"][0]["status"] == "SETTLED (SIMULATED)"


async def test_settlements_reject_usr_prefixed_merchant_id(client: AsyncClient) -> None:
    customer = await client.post(
        "/api/v1/auth/register",
        json=register_body(
            user_type="CUSTOMER",
            display_name="Bayo Commuter",
            phone_number="+2348000000001",
            seed_hex=CUSTOMER_SEED_HEX,
        ),
    )
    customer_id = str(customer.json()["user_id"])
    response = await client.get(
        f"/api/v1/merchants/{customer_id}/settlements",
        headers={"Authorization": f"Bearer {customer_id}"},
    )
    assert response.status_code == 404
