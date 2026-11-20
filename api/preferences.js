import db from "../config/firebaseAdmin.js";
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendDownAlert,
} from "../services/emailService.js";

/**
 * GET /api/preferences
 * Returns notification preferences for the authenticated user.
 */
export async function getPreferences(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing user identity" });
    }

    const defaultSettings = {
      alertEmail: req.user?.email || "admin@example.com",
      sendOnDown: true,
      sendOnRecovery: true,
      cooldownMinutes: 5,
    };

    try {
      const docSnap = await db.collection("preferences").doc(userId).get();
      if (docSnap.exists) {
        return res.status(200).json({ success: true, settings: { ...defaultSettings, ...docSnap.data() } });
      }
    } catch (dbErr) {
      console.warn("Could not read preferences from Firestore:", dbErr.message);
    }

    return res.status(200).json({ success: true, settings: defaultSettings });
  } catch (err) {
    console.error("GET /api/preferences error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/preferences
 * Updates notification preferences for the authenticated user.
 */
export async function updatePreferences(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing user identity" });
    }

    const updates = { ...req.body };
    delete updates.userId;
    updates.updatedAt = new Date().toISOString();

    try {
      await db.collection("preferences").doc(userId).set(updates, { merge: true });
      const docSnap = await db.collection("preferences").doc(userId).get();
      const updated = docSnap.exists ? docSnap.data() : updates;
      return res.status(200).json({ success: true, settings: updated });
    } catch (dbErr) {
      console.warn("Could not write preferences to Firestore, updating in-memory:", dbErr.message);
      const updated = updateNotificationSettings(updates);
      return res.status(200).json({ success: true, settings: updated });
    }
  } catch (err) {
    console.error("POST /api/preferences error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/preferences/test-alert
 * Dispatches a simulated test alert for the authenticated user.
 */
export async function sendTestNotification(req, res) {
  try {
    const userId = req.userId || "anonymous";
    const record = await sendDownAlert({
      monitor: {
        id: "test-mon",
        userId,
        name: "Test API Notification",
        url: "https://example.com/test",
        method: "GET",
      },
      check: {
        checkedAt: new Date().toISOString(),
        error: "Simulated Test Outage for Email Verification",
        statusCode: 503,
        responseTime: 180,
      },
      incident: { id: "test-inc-001" },
    });

    return res.status(200).json({
      success: true,
      message: "Test notification dispatched successfully",
      record,
    });
  } catch (err) {
    console.error("sendTestNotification error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default {
  getPreferences,
  updatePreferences,
  sendTestNotification,
};
