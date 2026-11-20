import db from "../../config/firebaseAdmin.js";
import { executeCheck } from "../../services/schedulerService.js";
import { validateUrl } from "../../services/monitoringEngine.js";

/**
 * Handler for /api/monitors
 * GET: List all monitors for the authenticated user
 * POST: Create a new monitor owned by the authenticated user
 */
export async function getMonitors(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: User identification missing" });
    }

    const query = db.collection("monitors").where("userId", "==", userId);
    const snapshot = await query.get();
    const monitors = [];
    snapshot.forEach((doc) => {
      monitors.push({ id: doc.id, ...doc.data() });
    });

    // Sort by createdAt descending
    monitors.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return res.status(200).json({ success: true, monitors });
  } catch (err) {
    console.error("GET /api/monitors error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function createMonitor(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: User identification missing" });
    }

    const {
      name,
      url,
      method = "GET",
      interval = 30, // seconds
      intervalUnit = "s", // "s" or "m"
      timeout = 10000, // ms
      slowThreshold = 2000, // ms
      expectedStatusCodes = [200],
      headers = {},
      body = null,
      isActive = true,
      failureThreshold = 1,
      dependsOnMonitorId = null,
      authType = "none",
      authBearerToken = "",
      authBasicUser = "",
      authBasicPass = "",
      authApiKeyHeader = "X-API-Key",
      authApiKeyValue = "",
      authCookie = "",
      authLoginUrl = "",
      authLoginBody = null,
      redirectPolicy = "follow", // "follow" | "manual" | "disallow"
      assertionType = "contains", // "contains" | "not_contains"
      keywordAssertion = "",
      folder = "General",
    } = req.body;

    if (!name || !url) {
      return res.status(400).json({ success: false, error: "Monitor name and URL are required" });
    }

    // SSRF & URL validation
    const allowLocal = process.env.ALLOW_LOCALHOST_MONITORING === "true";
    try {
      await validateUrl(url, allowLocal);
    } catch (valErr) {
      return res.status(400).json({ success: false, error: valErr.message });
    }

    const intervalSec = intervalUnit === "m" ? Number(interval) * 60 : Number(interval);

    // Enforce authenticated user UID as owner (never trust body.userId)
    const monitorData = {
      name: name.trim(),
      url: url.trim(),
      method: (method || "GET").toUpperCase(),
      interval: Number(interval),
      intervalUnit,
      intervalInSeconds: intervalSec,
      timeout: Number(timeout) || 10000,
      slowThreshold: Number(slowThreshold) || 2000,
      expectedStatusCodes: Array.isArray(expectedStatusCodes) ? expectedStatusCodes.map(Number) : [200],
      headers,
      body,
      userId, // Strictly derived from verified Firebase token
      isActive: Boolean(isActive),
      failureThreshold: Number(failureThreshold) || 1,
      dependsOnMonitorId: dependsOnMonitorId || null,
      authType,
      authBearerToken,
      authBasicUser,
      authBasicPass,
      authApiKeyHeader,
      authApiKeyValue,
      authCookie,
      authLoginUrl,
      authLoginBody,
      redirectPolicy,
      assertionType,
      keywordAssertion,
      folder: (folder || "General").trim(),
      currentStatus: "UNKNOWN",
      lastCheckedAt: null,
      nextCheckAt: new Date().toISOString(), // check immediately
      uptimePercentage: 100,
      consecutiveFailures: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await db.collection("monitors").add(monitorData);
    const createdMonitor = { id: docRef.id, ...monitorData };

    console.log(` Created monitor: "${createdMonitor.name}" for user ${userId}`);

    // Trigger immediate first check in background for production/dev
    if (process.env.NODE_ENV !== "test") {
      executeCheck(docRef.id).catch((err) => console.error("Initial check error:", err.message));
    }

    return res.status(201).json({ success: true, monitor: createdMonitor });
  } catch (err) {
    console.error("POST /api/monitors error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default {
  getMonitors,
  createMonitor,
};
