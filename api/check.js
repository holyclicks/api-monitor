import db from "../config/firebaseAdmin.js";
import { executeCheck } from "../services/schedulerService.js";
import { validateResourceOwnership } from "../middleware/auth.js";

/**
 * Handler for POST /api/monitors/:id/check or POST /api/check?id=:id
 * Triggers an immediate health check on the specified monitor after verifying ownership.
 */
export async function handleCheck(req, res) {
  try {
    const monitorId = req.params?.id || req.query?.id || req.body?.monitorId;

    if (!monitorId) {
      return res.status(400).json({ success: false, error: "Monitor ID is required" });
    }

    const docSnap = await db.collection("monitors").doc(monitorId).get();
    if (!docSnap.exists) {
      return res.status(404).json({ success: false, error: "Monitor not found" });
    }

    const monitor = { id: docSnap.id, ...docSnap.data() };

    // Verify requesting user owns this monitor
    if (!validateResourceOwnership(monitor, req, res, "monitor")) {
      return;
    }

    const result = await executeCheck(monitorId);

    if (!result) {
      return res.status(500).json({ success: false, error: "Check failed to execute" });
    }

    return res.status(200).json({
      success: true,
      message: `Checked monitor ${monitorId}`,
      check: result.check,
      monitor: result.monitor,
    });
  } catch (err) {
    console.error("POST /api/check error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default handleCheck;
