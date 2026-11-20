import db from "../config/firebaseAdmin.js";
import { getISTDayRange } from "../services/checkStorageService.js";
import {
  generateTodayReports,
  getPastReports,
  getReportById,
} from "../services/reportService.js";
import { getReportPdf } from "../services/reportStorageService.js";
import { validateResourceOwnership } from "../middleware/auth.js";

/**
 * Handler for GET /api/reports
 * Generates automated performance report for today (midnight to midnight in Asia/Kolkata timezone)
 * strictly for the authenticated user.
 */
export async function getPerformanceReport(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing user identity" });
    }

    const { timeframe = "today", monitorId } = req.query;

    const dayRange = getISTDayRange();
    const startMs = dayRange.startOfDay.getTime();
    const endMs = dayRange.endOfDay.getTime();

    // 1. Fetch monitors strictly for this user
    let monitorsQuery = db.collection("monitors").where("userId", "==", userId);
    const monitorsSnap = await monitorsQuery.get();
    const monitors = [];
    monitorsSnap.forEach((doc) => monitors.push({ id: doc.id, ...doc.data() }));

    // Determine target monitor
    let targetMonitor = null;
    if (monitorId) {
      targetMonitor = monitors.find((m) => m.id === monitorId) || null;
      if (!targetMonitor) {
        return res.status(404).json({ success: false, error: "Monitor not found or not owned by you" });
      }
    } else if (monitors.length > 0) {
      targetMonitor = monitors[0];
    }

    // 2. Fetch checks in today's IST range strictly for this user
    let checksQuery = db.collection("checks").where("userId", "==", userId);
    const checksSnap = await checksQuery.get();

    const allChecks = [];
    checksSnap.forEach((doc) => {
      const data = doc.data();
      const checkTime = data.checkedAt ? new Date(data.checkedAt).getTime() : 0;
      if (checkTime >= startMs && checkTime < endMs) {
        allChecks.push({ id: doc.id, ...data });
      }
    });

    // 3. Fetch incidents in today's IST range strictly for this user
    let incidentsQuery = db.collection("incidents").where("userId", "==", userId);
    const incidentsSnap = await incidentsQuery.get();

    const periodIncidents = [];
    incidentsSnap.forEach((doc) => {
      const data = doc.data();
      const startTime = data.startedAt ? new Date(data.startedAt).getTime() : 0;
      if (startTime >= startMs && startTime < endMs) {
        periodIncidents.push({ id: doc.id, ...data });
      }
    });

    // 4. Per-monitor breakdown summary (accounting for original check counts)
    const monitorStats = monitors.map((m) => {
      const monChecks = allChecks.filter((c) => c.monitorId === m.id);
      let monTotalChecks = 0;
      let monSuccessChecks = 0;

      monChecks.forEach((c) => {
        const count = Number(c.checkCount) || 1;
        monTotalChecks += count;
        if (c.status === "UP" || c.status === "SLOW") {
          monSuccessChecks += count;
        }
      });

      const monUptime =
        monTotalChecks > 0 ? Math.round((monSuccessChecks / monTotalChecks) * 10000) / 100 : 100;
      const monIncidents = periodIncidents.filter((i) => i.monitorId === m.id);

      return {
        id: m.id,
        name: m.name,
        url: m.url,
        method: m.method || "GET",
        folder: m.folder || "General",
        totalChecks: monTotalChecks,
        uptimePercentage: monUptime,
        incidentsCount: monIncidents.length,
        currentStatus: m.currentStatus,
      };
    });

    // 5. Individual metrics for selected monitor (or overall if no target monitor)
    const targetChecks = targetMonitor
      ? allChecks.filter((c) => c.monitorId === targetMonitor.id)
      : allChecks;

    // Sort newest first
    targetChecks.sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());

    let totalChecks = 0;
    let successfulChecks = 0;
    let failedChecks = 0;
    let totalLatency = 0;
    let minLatency = Infinity;
    let maxLatency = 0;

    targetChecks.forEach((data) => {
      const count = Number(data.checkCount) || 1;
      totalChecks += count;

      if (data.status === "UP" || data.status === "SLOW") {
        successfulChecks += count;
      } else {
        failedChecks += count;
      }

      if (typeof data.responseTime === "number") {
        totalLatency += data.responseTime * count;
        const cMin = typeof data.minResponseTime === "number" ? data.minResponseTime : data.responseTime;
        const cMax = typeof data.maxResponseTime === "number" ? data.maxResponseTime : data.responseTime;
        if (cMin < minLatency) minLatency = cMin;
        if (cMax > maxLatency) maxLatency = cMax;
      }
    });

    const uptimePercentage =
      totalChecks > 0 ? Math.round((successfulChecks / totalChecks) * 10000) / 100 : 100;
    const avgLatency = totalChecks > 0 ? Math.round(totalLatency / totalChecks) : 0;

    const targetIncidents = targetMonitor
      ? periodIncidents.filter((i) => i.monitorId === targetMonitor.id)
      : periodIncidents;

    let totalDowntimeSeconds = 0;
    let resolvedCount = 0;
    targetIncidents.forEach((i) => {
      if (i.durationSeconds) {
        totalDowntimeSeconds += i.durationSeconds;
        resolvedCount++;
      }
    });

    const mttr = resolvedCount > 0 ? Math.round(totalDowntimeSeconds / resolvedCount) : 0;

    // Check if today's summary report doc exists for selected monitor
    let todayReport = null;
    if (targetMonitor) {
      const todayReportId = `${targetMonitor.id}_${dayRange.istDateStr}`;
      const rSnap = await db.collection("reports").doc(todayReportId).get();
      if (rSnap.exists) {
        const rData = rSnap.data();
        if (rData.userId === userId) {
          todayReport = { id: rSnap.id, ...rData };
        }
      }
    }

    return res.status(200).json({
      success: true,
      report: {
        timeframe,
        timezone: "Asia/Kolkata",
        date: dayRange.istDateStr,
        generatedAt: new Date().toISOString(),
        cutoffDate: dayRange.startOfDayISO,
        selectedMonitor: targetMonitor,
        summary: {
          uptimePercentage,
          totalChecks,
          successfulChecks,
          failedChecks,
          avgLatency,
          minLatency: minLatency === Infinity ? 0 : minLatency,
          maxLatency,
          totalIncidents: targetIncidents.length,
          totalDowntimeSeconds,
          mttrSeconds: mttr,
        },
        checks: targetChecks,
        monitors: monitorStats,
        incidents: targetIncidents,
        todayReport,
      },
    });
  } catch (err) {
    console.error("GET /api/reports error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Handler for POST /api/reports/generate-today
 * Generates today's summary reports strictly for the authenticated user's monitors.
 */
export async function handleGenerateToday(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing user identity" });
    }

    const result = await generateTodayReports(userId);
    return res.status(200).json(result);
  } catch (err) {
    console.error("POST /api/reports/generate-today error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Handler for GET /api/reports/past
 * Displays available past dates and reports generated for a selected past date strictly for the authenticated user.
 */
export async function handleGetPastReports(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing user identity" });
    }

    const { date } = req.query;
    const result = await getPastReports(date, userId);
    return res.status(200).json(result);
  } catch (err) {
    console.error("GET /api/reports/past error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Handler for viewing or downloading a report PDF.
 * Validates ownership before returning the PDF file.
 */
export async function handleGetReportPdf(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing user identity" });
    }

    const reportId = req.params.id || req.query.reportId;
    if (!reportId) {
      return res.status(400).json({ success: false, error: "Report ID is required" });
    }

    const report = await getReportById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: `Report not found: ${reportId}` });
    }

    // Validate ownership: user can only view their own report
    if (!validateResourceOwnership(report, req, res, "report")) {
      return;
    }

    const pdfBuffer = await getReportPdf(reportId);
    if (!pdfBuffer) {
      return res.status(404).json({ success: false, error: `Report PDF file not found for ${reportId}` });
    }

    const isDownload = req.path.endsWith("/download") || req.query.download === "true";
    const fileName = report?.pdfFileName || `APIWatch-${reportId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(fileName)}"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Error serving report PDF:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default {
  getPerformanceReport,
  handleGenerateToday,
  handleGetPastReports,
  handleGetReportPdf,
};
