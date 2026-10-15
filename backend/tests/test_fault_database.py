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
async def test_database_fault_injection_and_recovery():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Start healthy
        init_health = await client.get("/health")
        assert init_health.status_code == 200

        # 2. Inject database fault
        inject_resp = await client.post("/api/control/inject/database")
        assert inject_resp.status_code == 200
        assert inject_resp.json()["status"] == "success"

        # 3. Health should report degraded / 503
        degraded_health = await client.get("/health")
        assert degraded_health.status_code == 503
        data = degraded_health.json()
        assert data["status"] in ("degraded", "unhealthy")
        assert data["dependencies"]["database"]["status"] == "unhealthy"

        # 4. Product queries should fail with 500
        prod_fail = await client.get("/api/products")
        assert prod_fail.status_code == 500

        # 5. Diagnostic logs should capture DatabaseConnectionError
        logs_resp = await client.get("/api/diagnostics/logs?level=ERROR")
        assert logs_resp.status_code == 200
        logs = logs_resp.json()["logs"]
        assert any(
            "database" in l["message"].lower()
            or "sqlite3" in (l.get("error_type") or "").lower()
            or "databaseconnectionerror" in str(l).lower()
            for l in logs
        )

        # 6. Reset to healthy
        reset_resp = await client.post("/api/control/reset")
        assert reset_resp.status_code == 200
        reset_data = reset_resp.json()
        assert reset_data["verification"]["database_healthy"] is True

        # 7. Verify normal operations restored
        recovered_health = await client.get("/health")
        assert recovered_health.status_code == 200
        assert recovered_health.json()["status"] == "healthy"

        recovered_prods = await client.get("/api/products")
        assert recovered_prods.status_code == 200
