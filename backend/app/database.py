import os
import sqlite3
import time
from typing import List, Dict, Any, Optional
from app.config import settings
from app.logger import app_logger
from app.metrics import telemetry
from app.fault_engine import fault_engine, DatabaseConnectionError


class DemoDatabase:
    """Isolated SQLite database manager with simulated fault hook."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or os.path.join(os.path.dirname(__file__), "demo_data.db")
        self._init_db()

    def _get_raw_connection(self) -> sqlite3.Connection:
        if fault_engine.db_fault.enabled:
            # Simulate real connection failure
            err_msg = fault_engine.db_fault.error_message
            raise DatabaseConnectionError(err_msg)

        conn = sqlite3.connect(self.db_path, timeout=settings.db_timeout_seconds)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Create products table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    id TEXT PRIMARY KEY,
                    sku TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    price REAL NOT NULL,
                    stock_quantity INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Create orders table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id TEXT PRIMARY KEY,
                    product_id TEXT NOT NULL,
                    customer_email TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    total_amount REAL NOT NULL,
                    status TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(product_id) REFERENCES products(id)
                )
            """)

            # Seed demo catalog if empty
            cursor.execute("SELECT COUNT(*) FROM products")
            if cursor.fetchone()[0] == 0:
                demo_products = [
                    ("p-101", "SKU-SENS-01", "Cloud Sentinel Sensor Node", "Hardware", 249.99, 45),
                    ("p-102", "SKU-K8S-02", "Kubernetes Controller Unit", "Infrastructure", 1299.00, 15),
                    ("p-103", "SKU-GW-03", "Telemetry Gateway Hub v3", "Networking", 450.00, 80),
                    ("p-104", "SKU-ROUT-04", "Failover Routing Appliance", "Networking", 890.00, 22),
                    ("p-105", "SKU-PRB-05", "Edge Observability Probe", "Hardware", 175.50, 130),
                ]
                cursor.executemany(
                    "INSERT INTO products (id, sku, name, category, price, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)",
                    demo_products
                )
                conn.commit()

            conn.close()
        except Exception as e:
            app_logger.error(
                f"Failed to initialize SQLite database: {e}",
                service="database-layer",
                exc=e
            )

    def check_health(self) -> Dict[str, Any]:
        """Performs a real database ping and query test."""
        start = time.perf_counter()
        try:
            conn = self._get_raw_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            conn.close()
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            telemetry.record_db_operation(elapsed_ms, success=True)
            return {
                "status": "healthy",
                "connected": True,
                "latency_ms": elapsed_ms,
                "driver": "sqlite3",
                "database": os.path.basename(self.db_path)
            }
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            telemetry.record_db_operation(elapsed_ms, success=False)
            app_logger.error(
                f"Database health check failed: {e}",
                service="database-layer",
                endpoint="/health",
                exc=e
            )
            return {
                "status": "unhealthy",
                "connected": False,
                "latency_ms": elapsed_ms,
                "error": str(e)
            }

    def list_products(self) -> List[Dict[str, Any]]:
        start = time.perf_counter()
        try:
            conn = self._get_raw_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, sku, name, category, price, stock_quantity, created_at FROM products")
            rows = cursor.fetchall()
            conn.close()
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            telemetry.record_db_operation(elapsed_ms, success=True)
            return [dict(r) for r in rows]
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            telemetry.record_db_operation(elapsed_ms, success=False)
            app_logger.error(
                f"Database query failed on list_products: {e}",
                service="database-layer",
                endpoint="/api/products",
                exc=e
            )
            raise

    def get_product(self, product_id: str) -> Optional[Dict[str, Any]]:
        start = time.perf_counter()
        try:
            conn = self._get_raw_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, sku, name, category, price, stock_quantity, created_at FROM products WHERE id = ?", (product_id,))
            row = cursor.fetchone()
            conn.close()
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            telemetry.record_db_operation(elapsed_ms, success=True)
            return dict(row) if row else None
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            telemetry.record_db_operation(elapsed_ms, success=False)
            app_logger.error(
                f"Database query failed on get_product({product_id}): {e}",
                service="database-layer",
                endpoint=f"/api/products/{product_id}",
                exc=e
            )
            raise

    def create_order(self, order_id: str, product_id: str, email: str, quantity: int, total_amount: float) -> Dict[str, Any]:
        start = time.perf_counter()
        try:
            conn = self._get_raw_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO orders (id, product_id, customer_email, quantity, total_amount, status) VALUES (?, ?, ?, ?, ?, ?)",
                (order_id, product_id, email, quantity, total_amount, "CONFIRMED")
            )
            # Update stock
            cursor.execute("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?", (quantity, product_id))
            conn.commit()
            conn.close()
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            telemetry.record_db_operation(elapsed_ms, success=True)
            return {
                "id": order_id,
                "product_id": product_id,
                "customer_email": email,
                "quantity": quantity,
                "total_amount": total_amount,
                "status": "CONFIRMED"
            }
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            telemetry.record_db_operation(elapsed_ms, success=False)
            app_logger.error(
                f"Database write failed on create_order: {e}",
                service="database-layer",
                endpoint="/api/orders",
                exc=e
            )
            raise

    def list_orders(self, limit: int = 20) -> List[Dict[str, Any]]:
        start = time.perf_counter()
        try:
            conn = self._get_raw_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, product_id, customer_email, quantity, total_amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            conn.close()
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            telemetry.record_db_operation(elapsed_ms, success=True)
            return [dict(r) for r in rows]
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            telemetry.record_db_operation(elapsed_ms, success=False)
            app_logger.error(
                f"Database query failed on list_orders: {e}",
                service="database-layer",
                endpoint="/api/orders",
                exc=e
            )
            raise


# Global db instance
db = DemoDatabase()
