import asyncio
import random
import httpx
from typing import Optional
from app.logger import app_logger


class TrafficSimulator:
    """Background simulator generating realistic traffic to keep telemetry and logs active."""

    def __init__(self, base_url: str = "http://127.0.0.1:8080"):
        self.base_url = base_url
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self.request_count = 0
        self.interval_seconds = 2.0

    async def _traffic_loop(self):
        async with httpx.AsyncClient(timeout=10.0) as client:
            while self.is_running:
                try:
                    # Choose a simulated action
                    choice = random.random()
                    if choice < 0.35:
                        # Health ping
                        await client.get(f"{self.base_url}/health")
                    elif choice < 0.70:
                        # Product catalog browse
                        await client.get(f"{self.base_url}/api/products")
                    else:
                        # Latency-sensitive checkout operation
                        payload = {
                            "product_id": random.choice(["p-101", "p-102", "p-103", "p-104", "p-105"]),
                            "quantity": random.randint(1, 3),
                            "customer_email": f"customer_{random.randint(100, 999)}@example.com",
                            "payment_method": "credit_card"
                        }
                        await client.post(f"{self.base_url}/api/checkout", json=payload)

                    self.request_count += 1
                except Exception as e:
                    # Connection error or timeout during loop (expected if server stopping or fault active)
                    pass

                await asyncio.sleep(self.interval_seconds)

    def start(self, base_url: Optional[str] = None):
        if base_url:
            self.base_url = base_url
        if not self.is_running:
            self.is_running = True
            self._task = asyncio.create_task(self._traffic_loop())
            app_logger.info("Traffic Simulator started.", service="traffic-gen")

    def stop(self):
        if self.is_running:
            self.is_running = False
            if self._task and not self._task.done():
                self._task.cancel()
            app_logger.info("Traffic Simulator stopped.", service="traffic-gen")

    def get_status(self):
        return {
            "running": self.is_running,
            "requests_generated": self.request_count,
            "interval_seconds": self.interval_seconds
        }


# Global traffic simulator
traffic_simulator = TrafficSimulator()
