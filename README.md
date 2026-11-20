# APIWatch – Cloud API Health Monitoring Platform

APIWatch is a cloud-based API health and uptime monitoring platform designed to continuously track the availability, latency, and reliability of web services, microservices, and external APIs.

The system features an automated background scheduler that sends HTTP health checks at configured intervals, measures round-trip response times, evaluates UP/SLOW/DOWN health statuses, detects outages, manages incident lifecycles (OPEN/RESOLVED), and dispatches alert notifications.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite + Tailwind CSS | Fast, barebones, responsive monitoring dashboard & analytics |
| **Backend** | Node.js (ESM) + Express | REST API, validation, scheduler, and background worker |
| **Database** | Firebase Cloud Firestore | Persistent storage of users, monitors, check logs, and incidents |
| **Charts** | Recharts | Interactive real-time response latency charts |
| **Alerts** | Nodemailer + In-App Event Logger | Instant email alerts on API DOWN and service RECOVERY |
| **Deployment** | Vercel Serverless / Node.js Host | Dual support for standalone server or Vercel serverless |

---

## 🗄️ Firestore Database Design

### 1. `monitors` Collection
```json
{
  "id": "mon_01",
  "userId": "user123",
  "name": "Payment API",
  "url": "https://api.example.com/payment",
  "method": "GET",
  "interval": 10,
  "intervalInSeconds": 10,
  "timeout": 10000,
  "slowThreshold": 2000,
  "expectedStatusCodes": [200],
  "isActive": true,
  "currentStatus": "UP",
  "lastResponseTime": 142,
  "lastCheckedAt": "2026-11-18T00:00:00.000Z",
  "nextCheckAt": "2026-11-18T00:00:10.000Z",
  "uptimePercentage": 99.8
}
```

### 2. `checks` Collection
```json
{
  "id": "chk_01",
  "monitorId": "mon_01",
  "userId": "user123",
  "status": "UP",
  "statusCode": 200,
  "responseTime": 142,
  "checkedAt": "2026-11-18T00:00:00.000Z",
  "error": null
}
```

### 3. `incidents` Collection
```json
{
  "id": "inc_01",
  "monitorId": "mon_01",
  "userId": "user123",
  "monitorName": "Payment API",
  "status": "RESOLVED",
  "reason": "HTTP 500",
  "startedAt": "2026-11-18T00:00:00.000Z",
  "resolvedAt": "2026-11-18T00:00:30.000Z",
  "durationSeconds": 30
}
```

---

## ⚙️ How the Monitoring Engine & Scheduler Work

1. **Background Scheduler (`services/schedulerService.js`)**:
   - Runs automatically on an interval (default: every 5 seconds).
   - Queries Firestore for monitors where `isActive == true` and `nextCheckAt <= currentTime`.
   - Uses an in-memory lock table to prevent duplicate concurrent checks on the same target.

2. **HTTP Worker & Latency Measurement (`services/monitoringEngine.js`)**:
   - Executes HTTP requests using native `fetch` with `AbortSignal.timeout(monitor.timeout)`.
   - Measures precise round-trip response time `Date.now() - startTime`.
   - Enforces **SSRF (Server-Side Request Forgery) protection**, preventing malicious attempts to probe internal cloud metadata (`169.254.169.254`), private IP subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), or unapproved localhost addresses.

3. **Status Classification**:
   - **UP**: Response received with an expected status code and latency within normal range.
   - **SLOW**: Response received with an expected status code, but latency exceeded `slowThreshold` (e.g. > 2000ms).
   - **DOWN**: Unexpected status code (e.g. 500), connection refused, DNS lookup failure, or request timeout.

4. **Incident Lifecycle & Alerts (`services/incidentService.js` & `services/emailService.js`)**:
   - When an API fails, an incident is created in `incidents` with `status: "OPEN"`, and an alert is sent.
   - When the API recovers, the open incident is updated to `status: "RESOLVED"`, exact downtime duration (`durationSeconds`) is computed, and a recovery alert is dispatched.

---

## 🚀 Quick Start & Running Locally

### 1. Install Dependencies
```bash
# Root backend dependencies
npm install

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Environment (`.env`)
A ready-to-use `.env` file is provided:
```env
PORT=5001
ALLOW_LOCALHOST_MONITORING=true
FIREBASE_PROJECT_ID=apiwatch-platform
# Optional real Firebase credentials:
# FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
# FIREBASE_CLIENT_EMAIL=...
# FIREBASE_PRIVATE_KEY="..."
```
> **Zero-Friction Fallback**: If real Firebase credentials are not yet configured, APIWatch automatically initializes a persistent, file-backed Firestore-compatible database (`.data/firestore_db.json`). When credentials are added, it immediately connects to live Cloud Firestore.

### 3. Build & Run
```bash
# 1. Build frontend
npm run build

# 2. Start server & monitoring engine
npm start
```
Open **[http://localhost:5001](http://localhost:5001)** in your browser!

For frontend development with Vite HMR:
```bash
npm run dev:frontend
# Vite dev server runs on http://localhost:5173 (proxies /api to 5001)
```

---

## 🧪 Testing the Platform

Run the comprehensive unit and end-to-end test suite:
```bash
npm test
```
**Test coverage includes:**
- SSRF prevention against localhost and cloud metadata
- Latency measurement & UP status detection
- High-latency detection (> slowThreshold -> SLOW status)
- HTTP 500 & timeout detection (DOWN status)
- Automatic incident creation and resolution lifecycle
- Background scheduler execution and Firestore check logging
- Full REST API endpoints (`/api/monitors`, `/api/check`, `/api/incidents`, `/api/analytics`)

---

## 🎥 Live Demonstration (Section 14 in Document)

To demonstrate the platform live:
1. Open **[http://localhost:5001](http://localhost:5001)**.
2. Click **"Add Monitor"** and select the preset **"Dynamic Outage API"** (`http://localhost:5001/api/test-target/dynamic`).
3. Notice the status shows **UP (200)** with low latency.
4. Click the **"Simulate / Toggle API Outage"** button on the dashboard banner.
5. Within 5 seconds, watch the background scheduler detect the failure:
   - Status changes to **DOWN**.
   - An incident is created in the **Incidents** section with root cause `HTTP 500`.
   - An alert notification is logged in **Settings -> Alerts Log**.
6. Click **"Simulate / Toggle API Outage"** again to restore the service.
7. The scheduler detects the recovery:
   - Status transitions back to **UP**.
   - The incident is marked **RESOLVED** with exact downtime duration recorded.
