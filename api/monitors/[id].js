import db from "../../config/firebaseAdmin.js";
import { validateUrl } from "../../services/monitoringEngine.js";
import { validateResourceOwnership } from "../../middleware/auth.js";

/**
 * Handlers for /api/monitors/:id
 * All operations require the requesting user to own the monitor.
 */
export async function getMonitorById(req, res) {
  try {
    const { id } = req.params;
    const docSnap = await db.collection("monitors").doc(id).get();

    if (!docSnap.exists) {
      return res.status(404).json({ success: false, error: "Monitor not found" });
    }

    const monitor = { id: docSnap.id, ...docSnap.data() };

    // Validate ownership: user can only view their own monitor
    if (!validateResourceOwnership(monitor, req, res, "monitor")) {
      return;
    }

    return res.status(200).json({ success: true, monitor });
  } catch (err) {
    console.error("GET /api/monitors/:id error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateMonitor(req, res) {
  try {
    const { id } = req.params;
    const docRef = db.collection("monitors").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ success: false, error: "Monitor not found" });
    }

    const existingMonitor = { id: docSnap.id, ...docSnap.data() };

    // Validate ownership: user can only modify their own monitor
    if (!validateResourceOwnership(existingMonitor, req, res, "monitor")) {
      return;
    }

    const updates = { ...req.body };
    delete updates.id; // don't overwrite id
    delete updates.userId; // never allow changing owner UID

    if (updates.url) {
      const allowLocal = process.env.ALLOW_LOCALHOST_MONITORING === "true";
      try {
        await validateUrl(updates.url, allowLocal);
      } catch (valErr) {
        return res.status(400).json({ success: false, error: valErr.message });
      }
    }

    if (updates.interval !== undefined) {
      const unit = updates.intervalUnit || docSnap.data().intervalUnit || "s";
      updates.intervalInSeconds = unit === "m" ? Number(updates.interval) * 60 : Number(updates.interval);
    }

    if (updates.expectedStatusCodes && !Array.isArray(updates.expectedStatusCodes)) {
      updates.expectedStatusCodes = [Number(updates.expectedStatusCodes)];
    }

    if (updates.folder !== undefined) {
      updates.folder = (updates.folder || "General").trim();
    }

    updates.updatedAt = new Date().toISOString();

    await docRef.update(updates);
    const updatedSnap = await docRef.get();

    return res.status(200).json({ success: true, monitor: { id: updatedSnap.id, ...updatedSnap.data() } });
  } catch (err) {
    console.error("PATCH /api/monitors/:id error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteMonitor(req, res) {
  try {
    const { id } = req.params;
    const docRef = db.collection("monitors").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ success: false, error: "Monitor not found" });
    }

    const existingMonitor = { id: docSnap.id, ...docSnap.data() };

    // Validate ownership: user can only delete their own monitor
    if (!validateResourceOwnership(existingMonitor, req, res, "monitor")) {
      return;
    }

    await docRef.delete();

    // Clean up related checks and incidents belonging to this monitor
    try {
      const checksSnap = await db.collection("checks").where("monitorId", "==", id).get();
      checksSnap.forEach((doc) => db.collection("checks").doc(doc.id).delete());

      const incSnap = await db.collection("incidents").where("monitorId", "==", id).get();
      incSnap.forEach((doc) => db.collection("incidents").doc(doc.id).delete());
    } catch {
      // ignore cleanup errors
    }

    return res.status(200).json({ success: true, message: "Monitor deleted successfully" });
  } catch (err) {
    console.error("DELETE /api/monitors/:id error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default {
  getMonitorById,
  updateMonitor,
  deleteMonitor,
};
