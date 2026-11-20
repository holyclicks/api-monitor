import db from "../config/firebaseAdmin.js";
import { sentNotifications } from "../services/emailService.js";
import { getISTDayRange } from "../services/checkStorageService.js";

/**
 * Handler for GET /api/analytics
 * Computes dashboard monitoring statistics strictly for the authenticated user.
 */
export async function getAnalytics(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing user identity" });
    }

    const dayRange = getISTDayRange();
    const startMs = dayRange.startOfDay.getTime();
    const endMs = dayRange.endOfDay.getTime();

    // 1. Fetch monitors strictly belonging to this authenticated user
    const monitorsSnap = await db.collection("monitors").where("userId", "==", userId).get();

    const monitors = [];
    let upCount = 0;
    let downCount = 0;
    let slowCount = 0;
    let pausedCount = 0;

    monitorsSnap.forEach((doc) => {
      const data = doc.data();
      monitors.push({ id: doc.id, ...data });

      if (!data.isActive) {
        pausedCount++;
      } else if (data.currentStatus === "UP") {
        upCount++;
      } else if (data.currentStatus === "SLOW") {
        slowCount++;
      } else if (data.currentStatus === "DOWN") {
        downCount++;
      }
    });

    // 2. Fetch checks for today in Asia/Kolkata strictly for this user
    const checksSnap = await db.collection("checks").where("userId", "==", userId).get();

    const allChecks = [];
    let totalResponseTime = 0;
    let minResponseTime = Infinity;
    let maxResponseTime = 0;
    let successfulChecks = 0;
    let failedChecks = 0;
    let totalChecks = 0;

    checksSnap.forEach((doc) => {
      const data = doc.data();
      const checkTime = data.checkedAt ? new Date(data.checkedAt).getTime() : 0;
      if (checkTime >= startMs && checkTime < endMs) {
        allChecks.push({ id: doc.id, ...data });

        const count = Number(data.checkCount) || 1;
        totalChecks += count;

        if (data.status === "UP" || data.status === "SLOW") {
          successfulChecks += count;
        } else {
          failedChecks += count;
        }

        if (typeof data.responseTime === "number" && data.responseTime >= 0) {
          totalResponseTime += data.responseTime * count;
          const rMin = typeof data.minResponseTime === "number" ? data.minResponseTime : data.responseTime;
          const rMax = typeof data.maxResponseTime === "number" ? data.maxResponseTime : data.responseTime;
          if (rMin < minResponseTime) minResponseTime = rMin;
          if (rMax > maxResponseTime) maxResponseTime = rMax;
        }
      }
    });

    const avgResponseTime = totalChecks > 0 ? Math.round(totalResponseTime / totalChecks) : 0;
    const overallUptime = totalChecks > 0 ? Math.round((successfulChecks / totalChecks) * 10000) / 100 : 100;

    // 3. Fetch incidents for today strictly for this user
    const incidentsSnap = await db.collection("incidents").where("userId", "==", userId).get();

    const incidents = [];
    let openIncidentsCount = 0;

    incidentsSnap.forEach((doc) => {
      const data = doc.data();
      const startTime = data.startedAt ? new Date(data.startedAt).getTime() : 0;
      if (startTime >= startMs && startTime < endMs) {
        incidents.push({ id: doc.id, ...data });
        if (data.status === "OPEN") {
          openIncidentsCount++;
        }
      }
    });

    incidents.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    // 4. Response-time timeline for charts (last 40 checks sorted chronologically)
    allChecks.sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime());
    const recentTimeSeries = allChecks.slice(-40).map((c) => ({
      time: new Date(c.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      timestamp: c.checkedAt,
      responseTime: c.responseTime,
      status: c.status,
      statusCode: c.statusCode,
      monitorId: c.monitorId,
      checkCount: Number(c.checkCount) || 1,
      isAggregated: !!(c.checkCount > 1),
    }));

    // 5. Recent alerts sent strictly for this user's monitors
    const userAlerts = sentNotifications.filter((n) => !n.userId || n.userId === userId).slice(0, 15);

    return res.status(200).json({
      success: true,
      timezone: "Asia/Kolkata",
      date: dayRange.istDateStr,
      summary: {
        totalMonitors: monitors.length,
        upMonitors: upCount,
        slowMonitors: slowCount,
        downMonitors: downCount,
        pausedMonitors: pausedCount,
        totalChecks,
        successfulChecks,
        failedChecks,
        overallUptime,
        avgResponseTime,
        minResponseTime: minResponseTime === Infinity ? 0 : minResponseTime,
        maxResponseTime,
        openIncidentsCount,
        totalIncidentsCount: incidents.length,
      },
      recentIncidents: incidents.slice(0, 10),
      recentTimeSeries,
      recentAlerts: userAlerts,
    });
  } catch (err) {
    console.error("GET /api/analytics error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default getAnalytics;
