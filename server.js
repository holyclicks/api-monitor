import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Services and configs
import { startScheduler } from "./services/schedulerService.js";
import { getMonitors, createMonitor } from "./api/monitors/index.js";
import { getMonitorById, updateMonitor, deleteMonitor } from "./api/monitors/[id].js";
import { getFolders, createFolder, deleteFolder } from "./api/folders.js";
import { handleCheck } from "./api/check.js";
import { getMonitorHistory } from "./api/history.js";
import { getIncidents } from "./api/incidents.js";
import { getAnalytics } from "./api/analytics.js";
import { handleCron } from "./api/cron/monitor.js";
import {
  getPerformanceReport,
  handleGenerateToday,
  handleGetPastReports,
  handleGetReportPdf,
} from "./api/reports.js";
import { getPreferences, updatePreferences, sendTestNotification } from "./api/preferences.js";
import { isUsingRealFirestore } from "./config/firebaseAdmin.js";
import { requireAuth } from "./middleware/auth.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
// CORS: open by default (works with any frontend origin). For production,
// set CORS_ORIGIN on Render, e.g. "https://apiwatch-frontend.vercel.app"
// (comma-separated list is supported).
const corsOptions = process.env.CORS_ORIGIN
  ? { origin: process.env.CORS_ORIGIN.split(",").map((o) => o.trim()) }
  : {};
app.use(cors());
app.use(express.json());

// Request logger for API calls
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`[${req.method}] ${req.path}`);
  }
  next();
});

// ==========================================
// 1. Core API Endpoints (Protected by Firebase Auth)
// ==========================================

// Monitors
app.get("/api/monitors", requireAuth, getMonitors);
app.post("/api/monitors", requireAuth, createMonitor);
app.get("/api/monitors/:id", requireAuth, getMonitorById);
app.patch("/api/monitors/:id", requireAuth, updateMonitor);
app.delete("/api/monitors/:id", requireAuth, deleteMonitor);

// Folders Management
app.get("/api/folders", requireAuth, getFolders);
app.post("/api/folders", requireAuth, createFolder);
app.delete("/api/folders/:folderName", requireAuth, deleteFolder);

// Manual check trigger
app.post("/api/monitors/:id/check", requireAuth, handleCheck);
app.post("/api/check", requireAuth, handleCheck);

// History
app.get("/api/monitors/:id/history", requireAuth, getMonitorHistory);
app.get("/api/history", requireAuth, getMonitorHistory);

// Incidents
app.get("/api/incidents", requireAuth, getIncidents);

// Analytics & Summary
app.get("/api/analytics", requireAuth, getAnalytics);

// Performance Reports & Daily PDFs
app.get("/api/reports", requireAuth, getPerformanceReport);
app.post("/api/reports/generate-today", requireAuth, handleGenerateToday);
app.post("/api/reports/generate-daily", requireAuth, handleGenerateToday);
app.get("/api/reports/past", requireAuth, handleGetPastReports);
app.get("/api/reports/:id/pdf", requireAuth, handleGetReportPdf);
app.get("/api/reports/:id/download", requireAuth, handleGetReportPdf);
app.get("/api/reports/pdf/:id", requireAuth, handleGetReportPdf);
app.get("/api/reports/pdf/:id/download", requireAuth, handleGetReportPdf);

// Notification Preferences
app.get("/api/preferences", requireAuth, getPreferences);
app.post("/api/preferences", requireAuth, updatePreferences);
app.post("/api/preferences/test-alert", requireAuth, sendTestNotification);

// Password Reset Simulation
app.post("/api/auth/reset-password", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: "Email is required" });
  console.log(`🔑 Password reset instructions requested for: ${email}`);
  return res.status(200).json({
    success: true,
    message: `Password reset link has been dispatched to ${email}`,
  });
});

// Cron trigger
app.all("/api/cron/monitor", handleCron);

// Status / Health of APIWatch Platform itself
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    platform: "APIWatch Cloud Monitoring Platform",
    timestamp: new Date().toISOString(),
    database: isUsingRealFirestore() ? "Firebase Cloud Firestore" : "Local Firestore Adapter",
  });
});

// ==========================================
// 2. Built-in Test Targets for Demo & Testing
// (Enables Section 14 Live Demonstration)
// ==========================================
let dynamicTargetState = {
  isHealthy: true,
  statusCode: 200,
  latencyMs: 80,
  lastToggledAt: new Date().toISOString(),
};

app.get("/api/test-target/ok", (req, res) => {
  setTimeout(() => {
    res.status(200).json({ status: 200, message: "OK - Service running smoothly", timestamp: new Date().toISOString() });
  }, 60);
});

app.get("/api/test-target/slow", (req, res) => {
  const delay = Number(req.query.delay) || 2400; // > 2000ms triggers SLOW status
  setTimeout(() => {
    res.status(200).json({ status: 200, message: "SLOW - Service responded but latency is high", delayMs: delay });
  }, delay);
});

app.get("/api/test-target/error", (req, res) => {
  res.status(500).json({ status: 500, error: "Internal Server Error: Database connection lost" });
});

// Redirect Target (Simulates Google Drive -> Login redirect behavior)
app.get("/api/test-target/redirect-to-login", (req, res) => {
  res.redirect(302, "/api/test-target/fake-login");
});

app.get("/api/test-target/multi-hop-start", (req, res) => {
  res.redirect(301, "/api/test-target/multi-hop-mid");
});

app.get("/api/test-target/multi-hop-mid", (req, res) => {
  res.redirect(302, "/api/test-target/fake-login");
});

app.get("/api/test-target/fake-login", (req, res) => {
  res.status(200).send("<html><head><title>Sign in - Google Accounts</title></head><body>Please log in</body></html>");
});

// Protected Endpoint requiring Authentication (Login required)
app.post("/api/test-target/login", (req, res) => {
  const { username, email, password } = req.body || {};
  if (password === "secret123" || password === "password" || !password) {
    return res.status(200).json({
      success: true,
      token: "demo-jwt-token-12345",
      user: { username: username || email || "admin" },
    });
  }
  return res.status(401).json({ success: false, error: "Invalid credentials" });
});

app.get("/api/test-target/protected", (req, res) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers["x-api-key"];

  const hasBearer = authHeader && authHeader === "Bearer demo-jwt-token-12345";
  const hasBasic = authHeader && authHeader.startsWith("Basic ");
  const hasApiKey = apiKey === "secret-api-key";

  if (hasBearer || hasBasic || hasApiKey) {
    return res.status(200).json({
      status: 200,
      message: "Authenticated successfully! Access granted to protected resource.",
      authMethod: hasBearer ? "Bearer Token" : hasBasic ? "Basic Auth" : "API Key",
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(401).json({
    status: 401,
    error: "Unauthorized: Endpoint requires valid authentication (Bearer token, Basic Auth, or X-API-Key).",
  });
});

// Controllable live demo target
app.get("/api/test-target/dynamic", (req, res) => {
  setTimeout(() => {
    if (dynamicTargetState.isHealthy) {
      res.status(200).json({
        status: 200,
        message: "Dynamic Target is currently HEALTHY",
        lastToggled: dynamicTargetState.lastToggledAt,
      });
    } else {
      res.status(500).json({
        status: 500,
        error: "Dynamic Target SIMULATED OUTAGE (HTTP 500)",
        lastToggled: dynamicTargetState.lastToggledAt,
      });
    }
  }, dynamicTargetState.latencyMs);
});

app.post("/api/test-target/toggle", (req, res) => {
  dynamicTargetState.isHealthy = !dynamicTargetState.isHealthy;
  dynamicTargetState.statusCode = dynamicTargetState.isHealthy ? 200 : 500;
  dynamicTargetState.lastToggledAt = new Date().toISOString();

  console.log(`🔀 Dynamic target toggled! Now: ${dynamicTargetState.isHealthy ? "HEALTHY (200)" : "OUTAGE (500)"}`);
  res.status(200).json({
    success: true,
    dynamicTargetState,
  });
});

// Serve frontend production build if available
const frontendDist = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendDist));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const indexHtml = path.join(frontendDist, "index.html");
  res.sendFile(indexHtml, (err) => {
    if (err) {
      res.status(404).send("APIWatch Backend Server is running. Please start the frontend dev server or build the frontend.");
    }
  });
});

// Start Server and Background Monitoring Scheduler
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 APIWatch Platform Server running on http://localhost:${PORT}`);
    console.log(`📦 Database: ${isUsingRealFirestore() ? "Firebase Cloud Firestore" : "Local Firestore Adapter (.data/firestore_db.json)"}`);
    console.log(`==================================================\n`);

    // Start automated background scheduler (checks due monitors every 5 seconds)
    startScheduler(5000);
  });
}

export default app;
