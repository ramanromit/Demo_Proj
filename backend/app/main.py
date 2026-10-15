import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings, get_current_utc_iso
from app.logger import app_logger
from app.metrics import telemetry
from app.database import db
from app.routers import health, api, diagnostics, control


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app_logger.info(
        f"OrderFlow Demo Service starting up. Environment: {settings.environment}, Release: {settings.release_version}",
        service="service-lifecycle",
        details={"version": settings.release_version, "port": settings.port}
    )
    yield
    # Shutdown
    app_logger.info("OrderFlow Demo Service shutting down.", service="service-lifecycle")


app = FastAPI(
    title="OrderFlow Incident Demo Service",
    description=(
        "Controlled fault target application for external DevOps Incident-Response Agents. "
        "Exposes real telemetry, logs, health checks, runtime configuration, and change history."
    ),
    version=settings.release_version,
    lifespan=lifespan
)

# CORS configuration for dashboard integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Real request telemetry & latency tracking middleware
@app.middleware("http")
async def telemetry_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    path = request.url.path
    method = request.method

    try:
        response = await call_next(request)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Record metric
        telemetry.record_request(path, method, response.status_code, elapsed_ms)

        # Log request (ignore heavy noise on polling if needed, but keep structured log)
        # Avoid flood from metrics poll by logging info for business endpoints and errors for all
        if path.startswith("/api/") and not path.startswith("/api/diagnostics/logs"):
            if response.status_code >= 500:
                app_logger.error(
                    f"{method} {path} failed with HTTP {response.status_code} ({elapsed_ms}ms)",
                    service="http-server",
                    endpoint=path,
                    method=method,
                    status_code=response.status_code,
                    details={"latency_ms": elapsed_ms}
                )
            elif response.status_code >= 400:
                app_logger.warning(
                    f"{method} {path} returned HTTP {response.status_code} ({elapsed_ms}ms)",
                    service="http-server",
                    endpoint=path,
                    method=method,
                    status_code=response.status_code,
                    details={"latency_ms": elapsed_ms}
                )
            else:
                app_logger.info(
                    f"{method} {path} completed ({elapsed_ms}ms)",
                    service="http-server",
                    endpoint=path,
                    method=method,
                    status_code=response.status_code,
                    details={"latency_ms": elapsed_ms}
                )

        response.headers["X-Response-Time-Ms"] = str(elapsed_ms)
        response.headers["X-Release-Version"] = settings.release_version
        return response

    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        telemetry.record_request(path, method, 500, elapsed_ms)
        app_logger.critical(
            f"Unhandled exception during {method} {path}: {exc}",
            service="http-server",
            endpoint=path,
            method=method,
            status_code=500,
            exc=exc
        )
        return JSONResponse(
            status_code=500,
            content={"error": "InternalServerError", "message": str(exc)},
            headers={
                "X-Response-Time-Ms": str(elapsed_ms),
                "X-Release-Version": settings.release_version
            }
        )


# Register Routers
app.include_router(health.router)
app.include_router(api.router)
app.include_router(diagnostics.router)
app.include_router(control.router)


@app.get("/")
def root():
    return {
        "service": "OrderFlow Incident Demo Service",
        "status": "running",
        "release_version": settings.release_version,
        "environment": settings.environment,
        "links": {
            "health": "/health",
            "documentation": "/docs",
            "diagnostics_overview": "/api/diagnostics/overview",
            "diagnostics_logs": "/api/diagnostics/logs",
            "diagnostics_metrics": "/api/diagnostics/metrics",
            "diagnostics_config": "/api/diagnostics/config",
            "diagnostics_changes": "/api/diagnostics/changes",
            "control_status": "/api/control/status"
        }
    }
