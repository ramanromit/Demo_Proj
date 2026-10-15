import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.fault_engine import fault_engine


@pytest.fixture(autouse=True)
def clean_state():
    fault_engine.reset_all_to_healthy()
    yield
    fault_engine.reset_all_to_healthy()


@pytest.mark.asyncio
async def test_faulty_release_injection_and_rollback():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Deploy faulty release v2.4.1-rc2
        inject_resp = await client.post("/api/control/inject/faulty-release")
        assert inject_resp.status_code == 200
        assert inject_resp.json()["version"] == "v2.4.1-rc2"

        # 2. Check diagnostic config shows bad release and unresolvable gateway
        config_resp = await client.get("/api/diagnostics/config")
        assert config_resp.status_code == 200
        cfg = config_resp.json()
        assert cfg["application"]["release_version"] == "v2.4.1-rc2"
        assert "invalid-payment-gateway" in cfg["downstream_services"]["payment_gateway"]["endpoint_url"]

        # 3. Check diagnostic change history records this deployment
        changes_resp = await client.get("/api/diagnostics/changes")
        assert changes_resp.status_code == 200
        history = changes_resp.json()["recent_changes"]
        assert len(history) > 0
        assert history[0]["version"] == "v2.4.1-rc2"

        # 4. Attempt checkout - must fail with 502 Bad Gateway
        checkout_payload = {
            "product_id": "p-101",
            "quantity": 1,
            "customer_email": "bad_release@example.com"
        }
        res = await client.post("/api/checkout", json=checkout_payload)
        assert res.status_code == 502

        # 5. Diagnostic logs should capture PaymentGatewayConfigError
        logs_resp = await client.get("/api/diagnostics/logs?level=ERROR")
        assert logs_resp.status_code == 200
        logs = logs_resp.json()["logs"]
        assert any("payment" in l["message"].lower() or "502" in str(l.get("status_code")) for l in logs)

        # 6. Execute rollback via reset endpoint
        reset_resp = await client.post("/api/control/reset")
        assert reset_resp.status_code == 200

        # 7. Verify rollback in config and history
        config_recovered = await client.get("/api/diagnostics/config")
        assert config_recovered.json()["application"]["release_version"] == "v2.4.0"

        # 8. Checkout works again
        res_ok = await client.post("/api/checkout", json=checkout_payload)
        assert res_ok.status_code == 200
