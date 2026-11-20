import db from "../config/firebaseAdmin.js";
import { validateResourceOwnership } from "../middleware/auth.js";

/**
 * Handler for GET /api/incidents
 * Returns incidents strictly belonging to the authenticated user.
 */
export async function getIncidents(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing user identity" });
    }

    const { monitorId, status } = req.query;

    // If monitorId specified, ensure monitor belongs to this user
    if (monitorId) {
      const monSnap = await db.collection("monitors").doc(monitorId).get();
      if (!monSnap.exists) {
        return res.status(404).json({ success: false, error: "Monitor not found" });
      }
      const monitor = { id: monSnap.id, ...monSnap.data() };
      if (!validateResourceOwnership(monitor, req, res, "monitor")) {
        return;
      }
    }

    // Always constrain query to the authenticated user
    let query = db.collection("incidents").where("userId", "==", userId);

    if (monitorId) {
      query = query.where("monitorId", "==", monitorId);
    }
    if (status) {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.get();
    const incidents = [];
    snapshot.forEach((doc) => {
      incidents.push({ id: doc.id, ...doc.data() });
    });

    incidents.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return res.status(200).json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (err) {
    console.error("GET /api/incidents error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default getIncidents;
