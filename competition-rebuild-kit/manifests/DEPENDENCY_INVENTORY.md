# Dependency Inventory

## Runtime versions observed

| Component | Version / source |
| --- | --- |
| Node.js | v24.19.0 in capture environment; Node 20+ recommended |
| npm | bundled with Node 24 |
| Python (venv) | 3.12.0 observed; Docker uses 3.11-slim |
| Playwright used for capture | 1.65.1 from temporary installation outside repository |
| Chrome | installed at `C:/Program Files/Google/Chrome/Application/chrome.exe` |

## bank/package.json

| Dependency | Declared range |
| --- | --- |
| @fontsource-variable/manrope | ^5.3.0 |
| @fontsource-variable/space-grotesk | ^5.3.0 |
| @noble/ed25519 | ^2.3.0 |
| @noble/hashes | ^1.8.0 |
| html5-qrcode | ^2.3.8 |
| idb | ^8.0.4 |
| lucide-react | ^0.468.0 |
| qrcode.react | ^4.2.0 |
| react | ^18.3.1 |
| react-dom | ^18.3.1 |
| @types/react | ^18.3.18 |
| @types/react-dom | ^18.3.5 |
| @vitejs/plugin-react | ^4.3.4 |
| autoprefixer | ^10.4.20 |
| fake-indexeddb | ^6.0.0 |
| postcss | ^8.4.49 |
| tailwindcss | ^3.4.17 |
| typescript | ~5.6.3 |
| vite | ^6.0.5 |
| vite-plugin-pwa | ^0.21.1 |
| vitest | ^2.1.9 |

Observed installed Vite during builds: 6.4.6.

## rehearsal/client/package.json

| Dependency | Declared range |
| --- | --- |
| @noble/ed25519 | ^2.1.0 |
| @noble/hashes | ^1.5.0 |
| html5-qrcode | ^2.3.8 |
| idb | ^8.0.0 |
| qrcode.react | ^4.1.0 |
| react | ^18.3.1 |
| react-dom | ^18.3.1 |
| typescript | ~5.6.0 |
| vite | ^6.0.0 |
| vite-plugin-mkcert | ^1.17.12 |
| vite-plugin-pwa | ^0.21.0 |
| vitest | ^2.1.0 |
| fake-indexeddb | ^6.0.0 |

## backend/requirements.txt

| Requirement | Declared range | Observed in venv |
| --- | --- | --- |
| fastapi | >=0.115,<1.0 | 0.165.0 |
| uvicorn[standard] | >=0.32,<1.0 | 0.54.0 |
| sqlalchemy[asyncio] | >=2.0.36,<2.1 | 2.1.9 (outside declared range) |
| asyncpg | >=0.30,<1.0 | 0.32.0 |
| aiosqlite | >=0.20,<1.0 | 0.22.1 |
| alembic | >=1.14,<2.0 | 1.20.1 |
| pynacl | >=1.5,<2.0 | 1.6.2 |
| pydantic-settings | >=2.6,<3.0 | 2.16.3 |
| python-multipart | >=0.0.12,<1.0 | not installed; no endpoint uses it |
| pytest | >=8.3,<9.0 | 9.2.0 (outside declared range) |
| pytest-asyncio | >=0.24,<1.0 | 1.5.0 |
| httpx | >=0.28,<1.0 | 0.28.1 |

Transitive observed: pydantic 2.14.4, starlette 1.10.0, anyio 4.16.0, greenlet 3.5.6. `pip check` reported no broken requirements.

## Lockfiles

- `bank/package-lock.json` and `rehearsal/client/package-lock.json` exist and should be used for reproducible installs.
- Backend has no lockfile beyond `requirements.txt`.
