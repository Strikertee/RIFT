# Integration Guide

## Agreement before coding

- Approve `architecture/API_CONTRACTS.md`.
- Approve `architecture/DATA_MODEL.md`.
- Approve file ownership from `TWO_BUILDER_PLAYBOOK.md`.
- Create integration branch `main` and builder branches.

## Branch setup

```powershell
git switch main
git pull --ff-only
git switch -c buildday/backend
git switch -c buildday/frontend
```

Worktrees:

```powershell
git worktree add ..\buildday-backend -b buildday/backend main
git worktree add ..\buildday-frontend -b buildday/frontend main
```

## Integration steps

1. Backend builder starts Core and runs `pytest`.
2. Frontend builder runs against mock responses matching the contract.
3. Backend exposes health/register; frontend replaces mocks for those calls.
4. Backend exposes allocations; frontend verifies customer lock.
5. Backend exposes relay; frontend verifies merchant/gateway relay and status.
6. Coordinator merges backend first, then frontend:

```powershell
git switch main
git merge --no-ff buildday/backend -m "Integrate backend branch"
git merge --no-ff buildday/frontend -m "Integrate frontend branch"
```

7. Run:

```powershell
cd backend && pytest -q
cd ../frontend && npm test && npm run build
```

8. Run the golden demo loop in demo and live mode.
9. Compare screenshots at 1440x900 and 390x844.
10. Freeze:

```powershell
git commit -am "chore: freeze competition build"
git tag competition-freeze
```

## Interface mismatch checklist

- Check field names: `simulated_clearing_reference` in relay response vs `simulated_clearing_ref` in status response.
- Check timestamps: no fractional seconds.
- Check status strings: `SETTLED (SIMULATED)`.
- Check bearer prefix: `usr_`, `mch_` or bare UUID.
- Check relay key header: `X-Relay-Api-Key`.
- Check transaction ID format: dashed UUID-like `tx_` string.

## Broken merge recovery

```powershell
git merge --abort
git log --oneline -10
```

Identify the failing branch, reset integration branch to last green commit, integrate the green branch, then reapply the other branch in small chunks.
