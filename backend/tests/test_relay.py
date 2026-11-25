from __future__ import annotations

from datetime import timedelta

from httpx import AsyncClient
from nacl.signing import SigningKey
from sqlalchemy import delete, update

from app.config import get_settings
from app.crypto import oac_payload_from_mapping, sign_payload
from app.models import Allocation
from app.timeutil import format_timestamp, utc_now
from tests.helpers import (
    CUSTOMER_SEED_HEX,
    MERCHANT_SEED_HEX,
    make_transaction,
    register_body,
    relay_body,
)


async def setup_participants(
    client: AsyncClient,
    amount_kobo: int = 1_000_000,
) -> tuple[dict[str, object], dict[str, object], dict[str, object]]:
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
    assert customer_response.status_code == 201
    assert merchant_response.status_code == 201
    customer = customer_response.json()
    merchant = merchant_response.json()
    issue_response = await client.post(
        "/api/v1/allocations/issue",
        json={"amount_kobo": amount_kobo, "duration_hours": 6},
        headers={"Authorization": f"Bearer {customer['user_id']}"},
    )
    assert issue_response.status_code == 201
    return customer, merchant, issue_response.json()


async def relay(client: AsyncClient, payload: dict[str, object], headers: dict[str, str] | None = None):
    return await client.post("/api/v1/transactions/relay", json=payload, headers=headers)


async def test_valid_relay_settles_with_clearing_reference(client: AsyncClient) -> None:
    _, merchant, allocation = await setup_participants(client)
    transaction = make_transaction(
        oac=allocation,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=200_000,
        seq_no=1,
    )
    response = await relay(client, relay_body(transaction))
    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["status"] == "SETTLED (SIMULATED)"
    assert result["validation_result"] == "VALID"
    assert result["simulated_clearing_reference"].startswith("SIM_SETTLE_")
    assert "." not in result["settled_at"]


async def test_relay_rejects_tampered_amount_with_http_200(client: AsyncClient) -> None:
    _, merchant, allocation = await setup_participants(client)
    transaction = make_transaction(
        oac=allocation,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=200_000,
        seq_no=1,
    )
    transaction["amount_kobo"] = 300_000
    response = await relay(client, relay_body(transaction))
    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["status"] == "REJECTED_INVALID_SIG"
    assert result["rejection_reason"] == "INVALID_CUSTOMER_SIGNATURE"


async def test_replayed_transaction_is_idempotent(client: AsyncClient) -> None:
    customer, merchant, allocation = await setup_participants(client)
    transaction = make_transaction(
        oac=allocation,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=200_000,
        seq_no=1,
    )
    first = (await relay(client, relay_body(transaction))).json()["results"][0]
    second = (await relay(client, relay_body(transaction))).json()["results"][0]
    assert first["status"] == "SETTLED (SIMULATED)"
    assert second["validation_result"] == "IDEMPOTENT_REPLAY"
    status = await client.get(
        f"/api/v1/transactions/{transaction['transaction_id']}/status",
        headers={"Authorization": f"Bearer {customer['user_id']}"},
    )
    assert status.json()["status"] == "SETTLED (SIMULATED)"


async def test_transaction_id_mismatch_is_rejected(client: AsyncClient) -> None:
    _, merchant, allocation = await setup_participants(client)
    transaction = make_transaction(
        oac=allocation,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=200_000,
        seq_no=1,
    )
    transaction["transaction_id"] = "tx_00000000-0000-0000-0000-000000000000"
    result = (await relay(client, relay_body(transaction))).json()["results"][0]
    assert result["rejection_reason"] == "TRANSACTION_ID_MISMATCH"


async def test_unknown_oac_is_rejected(client: AsyncClient, db_session) -> None:
    _, merchant, allocation = await setup_participants(client)
    transaction = make_transaction(
        oac=allocation,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=200_000,
        seq_no=1,
    )
    async with db_session.begin():
        await db_session.execute(
            delete(Allocation).where(Allocation.oac_id == allocation["oac_id"])
        )
    result = (await relay(client, relay_body(transaction))).json()["results"][0]
    assert result["rejection_reason"] == "UNKNOWN_OAC"


async def test_expired_oac_is_rejected(client: AsyncClient, db_session) -> None:
    _, merchant, allocation = await setup_participants(client)
    past = utc_now() - timedelta(seconds=1)
    expired_oac = dict(allocation)
    expired_oac["expires_at"] = format_timestamp(past)
    issuer_key = SigningKey(
        bytes.fromhex("1111111111111111111111111111111111111111111111111111111111111111")
    )
    expired_oac["issuer_signature_hex"] = sign_payload(
        issuer_key, oac_payload_from_mapping(expired_oac)
    )
    transaction = make_transaction(
        oac=expired_oac,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=200_000,
        seq_no=1,
    )
    async with db_session.begin():
        await db_session.execute(
            update(Allocation)
            .where(Allocation.oac_id == allocation["oac_id"])
            .values(expires_at=past)
        )
    result = (await relay(client, relay_body(transaction))).json()["results"][0]
    assert result["validation_result"] == "OAC_EXPIRED"


async def test_sequence_collision_is_quarantined(client: AsyncClient) -> None:
    _, merchant, allocation = await setup_participants(client)
    first = make_transaction(
        oac=allocation,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=100_000,
        seq_no=1,
        invoice_nonce="a" * 32,
    )
    second = make_transaction(
        oac=allocation,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=100_000,
        seq_no=1,
        invoice_nonce="b" * 32,
    )
    assert (await relay(client, relay_body(first))).json()["results"][0]["status"] == "SETTLED (SIMULATED)"
    result = (await relay(client, relay_body(second))).json()["results"][0]
    assert result["status"] == "QUARANTINED_COLLISION"
    assert result["rejection_reason"] == "OAC_SEQUENCE_CONFLICT"


async def test_duplicate_invoice_nonce_is_rejected(client: AsyncClient) -> None:
    _, merchant, allocation = await setup_participants(client)
    nonce = "c" * 32
    first = make_transaction(
        oac=allocation,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=100_000,
        seq_no=1,
        invoice_nonce=nonce,
    )
    second = make_transaction(
        oac=allocation,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=100_000,
        seq_no=2,
        invoice_nonce=nonce,
    )
    assert (await relay(client, relay_body(first))).json()["results"][0]["status"] == "SETTLED (SIMULATED)"
    result = (await relay(client, relay_body(second))).json()["results"][0]
    assert result["status"] == "REJECTED_DUPLICATE"


async def test_overspend_is_rejected_and_persisted(client: AsyncClient, db_session) -> None:
    _, merchant, allocation = await setup_participants(client, amount_kobo=500_000)
    transaction = make_transaction(
        oac=allocation,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=600_000,
        seq_no=1,
    )
    result = (await relay(client, relay_body(transaction))).json()["results"][0]
    assert result["status"] == "REJECTED_OVERSPEND"
    from sqlalchemy import select

    from app.models import Transaction

    async with db_session as session:
        stored = await session.scalar(
            select(Transaction).where(Transaction.transaction_id == transaction["transaction_id"])
        )
    assert stored is not None
    assert stored.status == "REJECTED_OVERSPEND"


async def test_relay_requires_configured_key(client: AsyncClient) -> None:
    get_settings().relay_api_key = "test-relay-key"
    _, merchant, allocation = await setup_participants(client)
    transaction = make_transaction(
        oac=allocation,
        merchant_id=str(merchant["user_id"]),
        amount_kobo=100_000,
        seq_no=1,
    )
    response = await relay(client, relay_body(transaction))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED_RELAY"
