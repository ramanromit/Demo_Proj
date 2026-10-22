# OrderFlow Demo Target Application

Controlled fault target application for external **DevOps Incident-Response Agents**.

Exposes real operational telemetry, logs, health checks, runtime configuration, and change history.

---

## Architecture & Ports

- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000) (Vite / React 19 / TypeScript)
- **Backend Service:** [http://127.0.0.1:8080](http://127.0.0.1:8080) (FastAPI / SQLite / Python 3.13)
- **External DevOps Agent:** [http://127.0.0.1:8000](http://127.0.0.1:8000) (Monitors OrderFlow at 8080)

---

## Quick Start

### Option 1: One-Click Launcher (Windows)
Double-click `start.bat` in this folder. It opens both the Backend (8080) and Frontend (3000) dev servers in separate windows.

### Option 2: Manual Start

**1. Start Backend (Port 8080):**
```powershell
cd backend
.\.venv\Scripts\python.exe run.py
```

**2. Start Frontend (Port 3000):**
```powershell
cd frontend
npm run dev
```

---

## Diagnostic Endpoints (Exposed to AI DevOps Agent)

The external DevOps Agent inspects OrderFlow without accessing hidden fault controls:

- `GET /health` - Application and dependency health check (returns 200 or 503)
- `GET /api/diagnostics/health` - Component health breakdown (Database & Payment Gateway)
- `GET /api/diagnostics/logs` - Chronological, structured logs with tracebacks and severity
- `GET /api/diagnostics/metrics` - Real-time metrics (p50/p90/p95 latency, error rates)
- `GET /api/diagnostics/config` - Permitted sanitized runtime configuration
- `GET /api/diagnostics/changes` - Deployment change log and rollback history
- `GET /api/diagnostics/overview` - Aggregated single-call triage overview

---

## Fault Injection Controls (Demo Control Panel)

Controlled from the OrderFlow Frontend ([http://localhost:3000](http://localhost:3000)) or POST endpoints:

1. **Database Failure (`POST /api/control/inject/database`)**: Simulates SQLite pool exhaustion / connection refusal. Degrades `/health` to 503.
2. **High Latency (`POST /api/control/inject/latency`)**: Injects artificial delay on `/api/checkout` with SLA breach logging.
3. **Faulty Release (`POST /api/control/inject/faulty-release`)**: Deploys `v2.4.1-rc2` with unresolvable payment gateway URL and 25ms timeout.
4. **Reset to Healthy (`POST /api/control/reset`)**: Clears all active faults and rolls back to baseline `v2.4.0`.
