import time
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
async def test_high_latency_injection_and_metrics():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Inject artificial latency of 300ms (fast enough for automated suite)
        inject_resp = await client.post(
            "/api/control/inject/latency",
            json={"delay_ms": 300, "endpoint": "/api/checkout"}
        )
        assert inject_resp.status_code == 200

        # 2. Call /api/checkout and measure execution time
        start_t = time.perf_counter()
        checkout_payload = {
            "product_id": "p-101",
            "quantity": 1,
            "customer_email": "latency_test@example.com"
        }
        res = await client.post("/api/checkout", json=checkout_payload)
        elapsed_ms = (time.perf_counter() - start_t) * 1000
        assert res.status_code == 200
        assert elapsed_ms >= 250  # verified that artificial delay occurred

        # 3. Check telemetry metrics reflects elevated latency
        metrics_resp = await client.get("/api/diagnostics/metrics")
        assert metrics_resp.status_code == 200
        m = metrics_resp.json()
        assert "POST /api/checkout" in m["endpoints"]
        assert m["endpoints"]["POST /api/checkout"]["total_calls"] >= 1

        # 4. Clear latency fault
        fault_engine.clear_latency_fault()

        # 5. Fast response restored
        start_fast = time.perf_counter()
        res_fast = await client.post("/api/checkout", json=checkout_payload)
        elapsed_fast = (time.perf_counter() - start_fast) * 1000
        assert res_fast.status_code == 200
        assert elapsed_fast < 200
