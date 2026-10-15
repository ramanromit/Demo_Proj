import asyncio
import time
import uuid
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status
from app.database import db
from app.config import settings
from app.logger import app_logger
from app.fault_engine import fault_engine, DatabaseConnectionError, PaymentGatewayConfigError

router = APIRouter(prefix="/api", tags=["Business API"])


class OrderCreateRequest(BaseModel):
    product_id: str
    customer_email: str
    quantity: int = Field(default=1, ge=1, le=100)


class CheckoutRequest(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1)
    customer_email: str
    payment_method: str = "credit_card"


@router.get("/products")
def get_products():
    """Fetches product catalog from demo database."""
    try:
        products = db.list_products()
        return {"items": products, "count": len(products)}
    except DatabaseConnectionError as e:
        app_logger.error(
            f"Failed to query product catalog due to database connection error: {e}",
            service="orderflow-service",
            endpoint="/api/products",
            method="GET",
            status_code=500,
            exc=e
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.get("/products/{product_id}")
def get_product(product_id: str):
    """Fetches product details by ID."""
    try:
        product = db.get_product(product_id)
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        return product
    except DatabaseConnectionError as e:
        app_logger.error(
            f"Failed to query product {product_id} due to database error: {e}",
            service="orderflow-service",
            endpoint=f"/api/products/{product_id}",
            method="GET",
            status_code=500,
            exc=e
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.get("/orders")
def get_orders(limit: int = 20):
    """Retrieves recent customer orders from demo database."""
    try:
        orders = db.list_orders(limit=limit)
        return {"orders": orders, "count": len(orders)}
    except DatabaseConnectionError as e:
        app_logger.error(
            f"Failed to fetch orders: {e}",
            service="orderflow-service",
            endpoint="/api/orders",
            method="GET",
            status_code=500,
            exc=e
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.post("/orders")
def create_order(req: OrderCreateRequest):
    """Creates a simple order in the database."""
    try:
        product = db.get_product(req.product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        total = round(product["price"] * req.quantity, 2)
        order_id = f"ord-{uuid.uuid4().hex[:8]}"
        new_order = db.create_order(
            order_id=order_id,
            product_id=req.product_id,
            email=req.customer_email,
            quantity=req.quantity,
            total_amount=total
        )
        app_logger.info(
            f"Order {order_id} placed successfully for product {req.product_id}",
            service="orderflow-service",
            endpoint="/api/orders",
            method="POST",
            status_code=201,
            details={"order_id": order_id, "total": total}
        )
        return new_order
    except DatabaseConnectionError as e:
        app_logger.error(
            f"Order creation failed due to database connectivity issue: {e}",
            service="orderflow-service",
            endpoint="/api/orders",
            method="POST",
            status_code=500,
            exc=e
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Order processing failed: {str(e)}"
        )


@router.post("/checkout")
async def process_checkout(req: CheckoutRequest):
    """
    Latency-sensitive checkout operation.
    Validates product inventory, charges payment via downstream gateway, and finalizes order.
    """
    start_time = time.perf_counter()

    # 1. Artificial High Latency Injection (if enabled on this endpoint)
    if fault_engine.latency_fault.enabled and fault_engine.latency_fault.endpoint == "/api/checkout":
        delay_seconds = fault_engine.latency_fault.delay_ms / 1000.0
        await asyncio.sleep(delay_seconds)

    # 2. Database validation
    try:
        product = db.get_product(req.product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Selected product does not exist")
        if product["stock_quantity"] < req.quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock for checkout")
    except DatabaseConnectionError as e:
        app_logger.error(
            f"Checkout aborted: unable to verify inventory in database: {e}",
            service="orderflow-service",
            endpoint="/api/checkout",
            method="POST",
            status_code=500,
            exc=e
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inventory database unreachable: {str(e)}"
        )

    # 3. Downstream Payment Gateway call simulation (using runtime configuration)
    total_amount = round(product["price"] * req.quantity, 2)
    gateway_url = settings.payment_gateway_url
    timeout_ms = settings.payment_timeout_ms

    # Check for misconfigured payment gateway from faulty release
    if "invalid-payment-gateway" in gateway_url or timeout_ms < 100:
        err_msg = (
            f"Failed to communicate with payment gateway at '{gateway_url}': "
            f"Connection refused / DNS lookup failed for invalid-payment-gateway.internal:9999 "
            f"(configured timeout: {timeout_ms}ms, attempts: {settings.payment_retry_attempts})"
        )
        exc = PaymentGatewayConfigError(err_msg)
        app_logger.error(
            f"Downstream payment gateway error: {err_msg}",
            service="orderflow-service",
            endpoint="/api/checkout",
            method="POST",
            status_code=502,
            exc=exc,
            details={
                "gateway_url": gateway_url,
                "configured_timeout_ms": timeout_ms,
                "release_version": settings.release_version
            }
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": "PaymentGatewayError",
                "message": err_msg,
                "downstream_endpoint": gateway_url,
                "release_version": settings.release_version
            }
        )

    # 4. Success checkout processing
    order_id = f"ord-{uuid.uuid4().hex[:8]}"
    db.create_order(
        order_id=order_id,
        product_id=req.product_id,
        email=req.customer_email,
        quantity=req.quantity,
        total_amount=total_amount
    )

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
    if elapsed_ms > 1000:
        app_logger.warning(
            f"SLA Warning: /api/checkout completed with high latency: {elapsed_ms}ms (threshold: 1000ms)",
            service="orderflow-service",
            endpoint="/api/checkout",
            method="POST",
            status_code=200,
            details={"duration_ms": elapsed_ms, "order_id": order_id}
        )
    else:
        app_logger.info(
            f"Checkout completed successfully for order {order_id} in {elapsed_ms}ms",
            service="orderflow-service",
            endpoint="/api/checkout",
            method="POST",
            status_code=200,
            details={"order_id": order_id, "duration_ms": elapsed_ms}
        )

    return {
        "status": "success",
        "order_id": order_id,
        "product_id": req.product_id,
        "quantity": req.quantity,
        "total_amount": total_amount,
        "processing_time_ms": elapsed_ms,
        "message": "Checkout and payment authorization completed."
    }
