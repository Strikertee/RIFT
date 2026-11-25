from __future__ import annotations

from httpx import AsyncClient

from tests.helpers import MERCHANT_SEED_HEX, CUSTOMER_SEED_HEX, register_body


async def test_register_customer_returns_usr_id_and_mock_balance(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=register_body(
            user_type="CUSTOMER",
            display_name="Bayo Commuter",
            phone_number="+2348000000001",
            seed_hex=CUSTOMER_SEED_HEX,
        ),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user_id"].startswith("usr_")
    assert body["user_type"] == "CUSTOMER"
    assert body["mock_balance_kobo"] == 5_000_000
    assert len(body["mock_account_number"]) == 10
    assert "." not in body["created_at"]


async def test_register_merchant_returns_mch_id(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=register_body(
            user_type="MERCHANT",
            display_name="Mama Bose Provisions",
            phone_number="+2348000000003",
            seed_hex=MERCHANT_SEED_HEX,
            business_name="Mama Bose Provisions",
        ),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user_id"].startswith("mch_")
    assert body["user_type"] == "MERCHANT"


async def test_register_rejects_duplicate_public_key(client: AsyncClient) -> None:
    body = register_body(
        user_type="CUSTOMER",
        display_name="Bayo Commuter",
        phone_number="+2348000000001",
        seed_hex=CUSTOMER_SEED_HEX,
    )
    assert (await client.post("/api/v1/auth/register", json=body)).status_code == 201
    duplicate = dict(body, phone_number="+2348000000099")
    response = await client.post("/api/v1/auth/register", json=duplicate)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "PUBLIC_KEY_ALREADY_REGISTERED"


async def test_register_rejects_duplicate_phone(client: AsyncClient) -> None:
    body = register_body(
        user_type="CUSTOMER",
        display_name="Bayo Commuter",
        phone_number="+2348000000001",
        seed_hex=CUSTOMER_SEED_HEX,
    )
    assert (await client.post("/api/v1/auth/register", json=body)).status_code == 201
    duplicate = dict(body, public_key_hex="a" * 64)
    response = await client.post("/api/v1/auth/register", json=duplicate)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "PHONE_ALREADY_REGISTERED"


async def test_register_rejects_invalid_public_key(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=register_body(
            user_type="CUSTOMER",
            display_name="Bayo Commuter",
            phone_number="+2348000000001",
            seed_hex=CUSTOMER_SEED_HEX,
        )
        | {"public_key_hex": "not-hex"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_register_rejects_invalid_user_type(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=register_body(
            user_type="ADMIN",
            display_name="Bayo Commuter",
            phone_number="+2348000000001",
            seed_hex=CUSTOMER_SEED_HEX,
        ),
    )
    assert response.status_code == 422
