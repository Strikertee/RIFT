from __future__ import annotations

import hashlib
import json
import secrets
import time
import uuid

from nacl.signing import SigningKey

RELAY_HEADERS = {"X-Relay-Api-Key": "test-relay-key"}


def canonical(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def new_identity():
    signing = SigningKey.generate()
    return bytes(signing.verify_key).hex(), bytes(signing).hex()


def sign(payload: dict, private_hex: str) -> str:
    return SigningKey(bytes.fromhex(private_hex)).sign(canonical(payload).encode()).signature.hex()


def tx_id(oac_id: str, seq_no: int, nonce: str) -> str:
    digest = hashlib.sha256(f"{oac_id}{seq_no}{nonce}".encode()).hexdigest()[:32]
    return "tx_" + "-".join(
        [digest[0:8], digest[8:12], digest[12:16], digest[16:20], digest[20:32]]
    )


def register(client, role: str, name: str | None = None):
    pub, priv = new_identity()
    phone = f"+2348{uuid.uuid4().int % 10_000_000_000:010d}"
    body = {
        "user_type": role,
        "display_name": name or f"Test {role.title()}",
        "phone_number": phone,
        "public_key_hex": pub,
    }
    if role == "MERCHANT":
        body["business_name"] = name or "Test Merchant"
    response = client.post("/api/v1/auth/register", json=body)
    assert response.status_code == 201, response.text
    return response.json(), priv


def issue(client, customer_id: str, amount: int = 100_000):
    response = client.post(
        "/api/v1/allocations/issue",
        json={"amount_kobo": amount, "duration_hours": 6, "customer_id": customer_id},
        headers={"Authorization": f"Bearer {customer_id}"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    token = {
        "oac_id": body["oac_id"],
        "customer_id": body["customer_id"],
        "customer_pubkey_hex": body["customer_pubkey_hex"],
        "allocated_amount_kobo": body["allocated_amount_kobo"],
        "currency": body["currency"],
        "issued_at": body["issued_at"],
        "expires_at": body["expires_at"],
        "issuer_key_version": body["issuer_key_version"],
        "issuer_signature_hex": body["issuer_signature_hex"],
    }
    return body, token


def make_tx(token, customer_priv, merchant_id, amount, seq, nonce):
    tx = {
        "amount_kobo": amount,
        "currency": "NGN",
        "customer_timestamp": int(time.time()),
        "invoice_nonce": nonce,
        "merchant_id": merchant_id,
        "oac_id": token["oac_id"],
        "seq_no": seq,
    }
    return {
        "transaction_id": tx_id(token["oac_id"], seq, nonce),
        "oac_id": token["oac_id"],
        "seq_no": seq,
        "merchant_id": merchant_id,
        "amount_kobo": amount,
        "currency": "NGN",
        "invoice_nonce": nonce,
        "customer_timestamp": tx["customer_timestamp"],
        "customer_pubkey_hex": token["customer_pubkey_hex"],
        "customer_signature_hex": sign(tx, customer_priv),
        "oac_token": token,
    }


def relay(client, transactions):
    response = client.post(
        "/api/v1/transactions/relay",
        json={"relay_node_id": "test-gateway", "transactions": transactions},
        headers=RELAY_HEADERS,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["database"] == "connected"
    assert body["issuer_key_loaded"] is True
    assert len(body["issuer_pubkey_hex"]) == 64


def test_registration_conflicts(client):
    body, _ = register(client, "CUSTOMER")
    duplicate = client.post(
        "/api/v1/auth/register",
        json={
            "user_type": "CUSTOMER",
            "display_name": "Duplicate",
            "phone_number": body["phone_number"],
            "public_key_hex": body["public_key_hex"],
        },
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "PUBLIC_KEY_ALREADY_REGISTERED"


def test_validation_envelope(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"user_type": "CUSTOMER", "display_name": "x", "phone_number": "1", "public_key_hex": "zz"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_golden_loop_and_rejections(client):
    customer, customer_priv = register(client, "CUSTOMER", "Golden Customer")
    merchant, _ = register(client, "MERCHANT", "Golden Merchant")
    customer_id = customer["user_id"]
    merchant_id = merchant["user_id"]

    issue_body, token = issue(client, customer_id, 100_000)
    assert issue_body["available_balance_kobo"] == 4_900_000
    assert issue_body["reserved_balance_kobo"] == 100_000

    tx1 = make_tx(token, customer_priv, merchant_id, 40_000, 1, "inv_golden_1")
    first = relay(client, [tx1])
    result = first["results"][0]
    assert result["status"] == "SETTLED (SIMULATED)"
    assert result["validation_result"] == "VALID"
    assert result["simulated_clearing_reference"].startswith("SIM-")

    replay = relay(client, [tx1])["results"][0]
    assert replay["status"] == "IDEMPOTENT_REPLAY"
    assert replay["validation_result"] == "IDEMPOTENT_REPLAY"

    tx2 = make_tx(token, customer_priv, merchant_id, 20_000, 2, "inv_golden_2")
    assert relay(client, [tx2])["results"][0]["status"] == "SETTLED (SIMULATED)"

    status = client.get(
        f"/api/v1/allocations/{token['oac_id']}",
        headers={"Authorization": f"Bearer {customer_id}"},
    )
    assert status.status_code == 200
    assert status.json()["spent_amount_kobo"] == 60_000
    assert status.json()["remaining_amount_kobo"] == 40_000
    assert status.json()["reserved_balance_kobo"] == 40_000

    collision = make_tx(token, customer_priv, merchant_id, 10_000, 1, "inv_golden_3")
    collision_result = relay(client, [collision])["results"][0]
    assert collision_result["status"] == "QUARANTINED_COLLISION"
    assert collision_result["validation_result"] == "DUPLICATE_SEQUENCE"

    duplicate_nonce = make_tx(token, customer_priv, merchant_id, 10_000, 3, "inv_golden_1")
    duplicate_result = relay(client, [duplicate_nonce])["results"][0]
    assert duplicate_result["status"] == "REJECTED_DUPLICATE"
    assert duplicate_result["validation_result"] == "DUPLICATE"

    overspend = make_tx(token, customer_priv, merchant_id, 50_000, 3, "inv_golden_4")
    overspend_result = relay(client, [overspend])["results"][0]
    assert overspend_result["status"] == "REJECTED_OVERSPEND"
    assert overspend_result["validation_result"] == "OVERSPEND"

    persisted = client.get(
        f"/api/v1/transactions/{overspend['transaction_id']}/status",
        headers={"Authorization": f"Bearer {customer_id}"},
    )
    assert persisted.status_code == 200
    assert persisted.json()["status"] == "REJECTED_OVERSPEND"

    settlements = client.get(
        f"/api/v1/merchants/{merchant_id}/settlements",
        headers={"Authorization": f"Bearer {merchant_id}"},
    )
    assert settlements.status_code == 200
    body = settlements.json()
    assert body["count"] == 2
    assert body["total_settled_kobo"] == 60_000

    tx_status = client.get(
        f"/api/v1/transactions/{tx1['transaction_id']}/status",
        headers={"Authorization": f"Bearer {customer_id}"},
    )
    assert tx_status.status_code == 200
    assert tx_status.json()["status"] == "SETTLED (SIMULATED)"
    assert tx_status.json()["simulated_clearing_ref"] is not None


def test_tampered_signature_and_wrong_relay_key(client):
    customer, customer_priv = register(client, "CUSTOMER")
    merchant, _ = register(client, "MERCHANT")
    _, token = issue(client, customer["user_id"], 50_000)
    tx = make_tx(token, customer_priv, merchant["user_id"], 10_000, 1, "inv_tamper_1")
    tx["amount_kobo"] = 20_000

    response = client.post(
        "/api/v1/transactions/relay",
        json={"transactions": [tx]},
        headers={"X-Relay-Api-Key": "wrong"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED_RELAY"

    result = relay(client, [tx])["results"][0]
    assert result["status"] == "REJECTED_INVALID_SIG"
    assert result["validation_result"] == "INVALID_CUSTOMER_SIGNATURE"


def test_issue_rejects_insufficient_funds_and_other_roles(client):
    customer, _ = register(client, "CUSTOMER")
    merchant, _ = register(client, "MERCHANT")

    too_much = client.post(
        "/api/v1/allocations/issue",
        json={"amount_kobo": 5_000_001},
        headers={"Authorization": f"Bearer {customer['user_id']}"},
    )
    assert too_much.status_code == 400
    assert too_much.json()["error"]["code"] == "INSUFFICIENT_FUNDS"

    wrong_role = client.post(
        "/api/v1/allocations/issue",
        json={"amount_kobo": 10_000},
        headers={"Authorization": f"Bearer {merchant['user_id']}"},
    )
    assert wrong_role.status_code == 403

    missing_auth = client.post("/api/v1/allocations/issue", json={"amount_kobo": 10_000})
    assert missing_auth.status_code == 401


def test_sim_reset(client):
    response = client.post(
        "/api/v1/sim/reset",
        headers={"X-Admin-Secret": "test-admin-secret"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ledger_reseeded"
    assert body["transactions_purged"] >= 2
    assert body["allocations_reset"] >= 2

    unauthorized = client.post(
        "/api/v1/sim/reset",
        headers={"X-Admin-Secret": "nope"},
    )
    assert unauthorized.status_code == 401
