import db from "../config/firebaseAdmin.js";
import { sendDownAlert, sendRecoveryAlert } from "./emailService.js";

/**
 * Handles incident creation and resolution based on check results.
 */
export async function processIncidentState(monitor, check) {
  const monitorRef = db.collection("monitors").doc(monitor.id);
  const consecutiveFailures = (monitor.consecutiveFailures || 0) + (check.status === "DOWN" ? 1 : 0);
  const failureThreshold = Number(monitor.failureThreshold) || 1; // 1 for immediate demo or 2 for consecutive

  // Query for existing open incident for this monitor
  const openIncidentsSnapshot = await db
    .collection("incidents")
    .where("monitorId", "==", monitor.id)
    .where("status", "==", "OPEN")
    .get();

  const hasOpenIncident = !openIncidentsSnapshot.empty;
  let openIncidentDoc = hasOpenIncident ? openIncidentsSnapshot.docs[0] : null;

  if (check.status === "DOWN") {
    // If consecutive failures threshold is reached and no open incident exists, create one
    if (consecutiveFailures >= failureThreshold && !hasOpenIncident) {
      const incidentData = {
        monitorId: monitor.id,
        userId: monitor.userId || "anonymous",
        monitorName: monitor.name || "Unnamed Monitor",
        startedAt: check.checkedAt,
        resolvedAt: null,
        durationSeconds: null,
        status: "OPEN",
        reason: check.error || `HTTP ${check.statusCode}`,
      };

      const docRef = await db.collection("incidents").add(incidentData);
      const createdIncident = { id: docRef.id, ...incidentData };

      console.log(`🚨 Incident created for monitor "${monitor.name}": ${createdIncident.reason}`);

      // Send email alert
      await sendDownAlert({
        monitor,
        check,
        incident: createdIncident,
      });

      return { incident: createdIncident, stateChanged: true };
    }
  } else if (check.status === "UP" || check.status === "SLOW") {
    // API recovered: if there is an open incident, resolve it
    if (hasOpenIncident && openIncidentDoc) {
      const incidentData = openIncidentDoc.data();
      const resolvedAt = check.checkedAt;
      const durationSeconds = Math.max(
        1,
        Math.round((new Date(resolvedAt).getTime() - new Date(incidentData.startedAt).getTime()) / 1000)
      );

      await db.collection("incidents").doc(openIncidentDoc.id).update({
        status: "RESOLVED",
        resolvedAt,
        durationSeconds,
      });

      const resolvedIncident = {
        ...incidentData,
        status: "RESOLVED",
        resolvedAt,
        durationSeconds,
      };

      console.log(`✅ Incident resolved for monitor "${monitor.name}" after ${durationSeconds}s`);

      // Send recovery alert
      await sendRecoveryAlert({
        monitor,
        check,
        incident: resolvedIncident,
      });

      return { incident: resolvedIncident, stateChanged: true };
    }
  }

  return { incident: null, stateChanged: false };
}

export default {
  processIncidentState,
};
