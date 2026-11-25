from __future__ import annotations

from httpx import AsyncClient

from app.models import Merchant, User
from sqlalchemy import select, update
from app.models import MockBankAccount
from tests.helpers import (
    CUSTOMER_SEED_HEX,
    MERCHANT_SEED_HEX,
    make_transaction,
    register_body,
    relay_body,
)


async def test_sim_reset_requires_admin_secret(client: AsyncClient) -> None:
    response = await client.post("/api/v1/sim/reset")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


async def test_sim_reset_clears_ledger_and_keeps_users(client: AsyncClient, db_session) -> None:
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
    transaction = make_transaction(
        oac=allocation_response.json(),
        merchant_id=str(merchant["user_id"]),
        amount_kobo=200_000,
        seq_no=1,
    )
    assert (await client.post("/api/v1/transactions/relay", json=relay_body(transaction))).status_code == 200

    async with db_session.begin():
        await db_session.execute(
            update(MockBankAccount).values(available_balance_kobo=1, reserved_balance_kobo=999)
        )

    response = await client.post(
        "/api/v1/sim/reset",
        headers={"X-Admin-Secret": "test-admin-secret"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ledger_reseeded"
    assert body["mock_users_reset"] == 2
    assert body["transactions_purged"] == 1
    assert body["allocations_reset"] == 1

    async with db_session as session:
        users = (await session.execute(select(User))).scalars().all()
        merchants = (await session.execute(select(Merchant))).scalars().all()
        accounts = (await session.execute(select(MockBankAccount))).scalars().all()
    assert len(users) == 2
    assert len(merchants) == 1
    assert all(account.available_balance_kobo == 5_000_000 for account in accounts)
    assert all(account.reserved_balance_kobo == 0 for account in accounts)
