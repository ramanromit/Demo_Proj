import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.fault_engine import fault_engine


@pytest.fixture(autouse=True)
def ensure_healthy_baseline():
    fault_engine.reset_all_to_healthy()
    yield
    fault_engine.reset_all_to_healthy()


@pytest.mark.asyncio
async def test_healthy_baseline():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Check health
        health_resp = await client.get("/health")
        assert health_resp.status_code == 200
        health_data = health_resp.json()
        assert health_data["status"] == "healthy"
        assert health_data["dependencies"]["database"]["status"] == "healthy"

        # Check products
        prod_resp = await client.get("/api/products")
        assert prod_resp.status_code == 200
        prod_data = prod_resp.json()
        assert prod_data["count"] > 0
        assert "items" in prod_data

        # Check checkout
        checkout_payload = {
            "product_id": "p-101",
            "quantity": 1,
            "customer_email": "test@example.com",
            "payment_method": "credit_card"
        }
        checkout_resp = await client.post("/api/checkout", json=checkout_payload)
        assert checkout_resp.status_code == 200
        checkout_data = checkout_resp.json()
        assert checkout_data["status"] == "success"
        assert "order_id" in checkout_data
