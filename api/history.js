import db from "../config/firebaseAdmin.js";
import { getISTDayRange } from "../services/checkStorageService.js";
import { validateResourceOwnership } from "../middleware/auth.js";

/**
 * Handler for GET /api/monitors/:id/history
 * Fetches check logs for a specific monitor for today in Asia/Kolkata (IST) timezone.
 * Validates ownership so User A cannot read User B's monitoring history.
 */
export async function getMonitorHistory(req, res) {
  try {
    const monitorId = req.params?.id || req.query?.id;
    const limitCount = Number(req.query?.limit) || 100;

    if (!monitorId) {
      return res.status(400).json({ success: false, error: "Monitor ID is required" });
    }

    // Verify monitor exists and belongs to the authenticated user
    const monSnap = await db.collection("monitors").doc(monitorId).get();
    if (!monSnap.exists) {
      return res.status(404).json({ success: false, error: "Monitor not found" });
    }

    const monitor = { id: monSnap.id, ...monSnap.data() };
    if (!validateResourceOwnership(monitor, req, res, "monitor")) {
      return;
    }

    const dayRange = getISTDayRange();
    const startMs = dayRange.startOfDay.getTime();
    const endMs = dayRange.endOfDay.getTime();

    const snapshot = await db
      .collection("checks")
      .where("monitorId", "==", monitorId)
      .get();

    const history = [];
    let totalChecksRepresented = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const checkTime = data.checkedAt ? new Date(data.checkedAt).getTime() : 0;
      // Only return current day's checks (midnight to midnight Asia/Kolkata)
      if (checkTime >= startMs && checkTime < endMs) {
        const count = Number(data.checkCount) || 1;
        totalChecksRepresented += count;
        history.push({ id: doc.id, ...data });
      }
    });

    // Sort by checkedAt descending
    history.sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());

    const limited = history.slice(0, limitCount);

    return res.status(200).json({
      success: true,
      count: limited.length,
      totalChecksRepresented,
      timezone: "Asia/Kolkata",
      date: dayRange.istDateStr,
      history: limited,
    });
  } catch (err) {
    console.error("GET /api/history error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default getMonitorHistory;
