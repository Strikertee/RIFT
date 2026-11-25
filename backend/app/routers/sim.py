from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_db
from app.deps import require_admin
from app.models import Allocation, AuditLog, MockBankAccount, Transaction
from app.schemas import SimResetResponse
from app.services.ledger import write_audit
from app.timeutil import format_timestamp, utc_now

router = APIRouter(prefix="/sim", tags=["simulation"])


@router.post("/reset", response_model=SimResetResponse)
async def sim_reset(
    _: None = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SimResetResponse:
    async with db.begin():
        account_count = int(await db.scalar(select(func.count(MockBankAccount.id))) or 0)
        transaction_count = int(await db.scalar(select(func.count(Transaction.id))) or 0)
        allocation_count = int(await db.scalar(select(func.count(Allocation.id))) or 0)

        await db.execute(delete(AuditLog))
        await db.execute(delete(Transaction))
        await db.execute(delete(Allocation))
        await db.execute(
            update(MockBankAccount).values(
                available_balance_kobo=settings.mock_starting_balance_kobo,
                reserved_balance_kobo=0,
            )
        )
        await write_audit(
            db,
            "SIM_RESET",
            "core",
            "admin",
            {
                "transactions_purged": transaction_count,
                "allocations_reset": allocation_count,
                "mock_users_reset": account_count,
            },
        )

    return SimResetResponse(
        status="ledger_reseeded",
        mock_users_reset=account_count,
        transactions_purged=transaction_count,
        allocations_reset=allocation_count,
        timestamp=format_timestamp(utc_now()),
    )
