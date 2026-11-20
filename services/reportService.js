import db from "../config/firebaseAdmin.js";
import { generateDailyPdfReport } from "./pdfReportService.js";
import { saveReportPdf, hasReportPdf, getReportPdf } from "./reportStorageService.js";

// Concurrency locks to prevent duplicate simultaneous report generation
const reportLocks = new Set();
let isTodayGenerationInProgress = false;
let isArchiveInProgress = false;

/**
 * Returns a date string formatted as "YYYY-MM-DD" in Asia/Kolkata (IST).
 */
export function getISTDateStr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

/**
 * Formats a date into a professional human-readable string: e.g. "November 18, 2026" in Asia/Kolkata.
 */
export function formatISTReportDate(dateOrStr = new Date()) {
  let dateObj;
  if (typeof dateOrStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateOrStr)) {
    dateObj = new Date(`${dateOrStr}T12:00:00.000+05:30`);
  } else {
    dateObj = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dateObj);
}

/**
 * Returns yesterday's date string "YYYY-MM-DD" in Asia/Kolkata.
 */
export function getISTYesterdayDateStr(baseDate = new Date()) {
  const boundaries = getISTDayBoundaries(getISTDateStr(baseDate));
  // 12 hours before today's start in IST
  const yesterdayMs = boundaries.startMs - 12 * 60 * 60 * 1000;
  return getISTDateStr(new Date(yesterdayMs));
}

/**
 * Returns exact start (00:00:00.000) and end (24 hours later) boundaries for a given IST date string.
 */
export function getISTDayBoundaries(dateStr) {
  const validStr = dateStr || getISTDateStr();
  const startOfDay = new Date(`${validStr}T00:00:00.000+05:30`);
  // Asia/Kolkata is fixed UTC+05:30 with no daylight saving time, so exactly 86,400,000 ms in a day
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  return {
    dateStr: validStr,
    startOfDay,
    endOfDay,
    startMs: startOfDay.getTime(),
    endMs: endOfDay.getTime(),
    startOfDayISO: startOfDay.toISOString(),
    endOfDayISO: endOfDay.toISOString(),
  };
}

/**
 * Returns the hour of the day (0 to 23) in Asia/Kolkata for a given timestamp.
 */
export function getISTHour(timestamp) {
  const date = new Date(timestamp);
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  return parseInt(hourStr, 10);
}

/**
 * Computes complete statistics and hourly breakdown from actual monitoring check records.
 * Accurately accounts for compacted Firestore records using checkCount, minResponseTime, maxResponseTime.
 */
export function computeDailyMetricsForMonitor(monitor, checks = [], targetDateStr = getISTDateStr()) {
  const boundaries = getISTDayBoundaries(targetDateStr);
  const { startMs, endMs } = boundaries;

  // Filter checks strictly within the target calendar day in IST
  const dayChecks = checks.filter((c) => {
    if (!c.checkedAt) return false;
    const timeMs = new Date(c.checkedAt).getTime();
    return !isNaN(timeMs) && timeMs >= startMs && timeMs < endMs;
  });

  // Initialize 24 hourly buckets (00:00 to 23:00)
  const hourlyStats = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    count: 0,
    totalLatency: 0,
    avgLatency: 0,
    failedCount: 0,
    successCount: 0,
  }));

  let totalChecks = 0;
  let successfulChecks = 0;
  let failedChecks = 0;
  let totalLatency = 0;
  let minLatency = Infinity;
  let maxLatency = 0;

  dayChecks.forEach((c) => {
    const count = Number(c.checkCount) || 1;
    totalChecks += count;

    const isSuccess = c.status === "UP" || c.status === "SLOW";
    if (isSuccess) {
      successfulChecks += count;
    } else {
      failedChecks += count;
    }

    const resp = typeof c.responseTime === "number" ? c.responseTime : 0;
    if (typeof c.responseTime === "number") {
      totalLatency += resp * count;
      const cMin = typeof c.minResponseTime === "number" ? c.minResponseTime : resp;
      const cMax = typeof c.maxResponseTime === "number" ? c.maxResponseTime : resp;
      if (cMin < minLatency) minLatency = cMin;
      if (cMax > maxLatency) maxLatency = cMax;
    }

    // Determine hour in Asia/Kolkata
    const hour = getISTHour(c.checkedAt);
    if (hour >= 0 && hour < 24) {
      hourlyStats[hour].count += count;
      hourlyStats[hour].totalLatency += resp * count;
      if (isSuccess) {
        hourlyStats[hour].successCount += count;
      } else {
        hourlyStats[hour].failedCount += count;
      }
    }
  });

  // Finalize hourly averages
  hourlyStats.forEach((h) => {
    h.avgLatency = h.count > 0 ? Math.round(h.totalLatency / h.count) : 0;
  });

  const availabilityPercentage = totalChecks > 0 ? Math.round((successfulChecks / totalChecks) * 10000) / 100 : 100;
  const avgLatency = totalChecks > 0 ? Math.round(totalLatency / totalChecks) : 0;

  // Determine overall health status
  let healthStatus = "UP";
  if (totalChecks === 0) {
    healthStatus = monitor.currentStatus || "PENDING";
  } else if (failedChecks > 0 && successfulChecks === 0) {
    healthStatus = "DOWN";
  } else if (failedChecks > 0 || avgLatency > 2000) {
    healthStatus = "SLOW";
  } else {
    healthStatus = "UP";
  }

  return {
    totalChecks,
    successfulChecks,
    failedChecks,
    availabilityPercentage,
    avgLatency,
    minLatency: minLatency === Infinity ? 0 : minLatency,
    maxLatency,
    healthStatus,
    hourlyStats,
    dayChecks,
  };
}

/**
 * Generates and persistently saves a single daily report for a given monitor and date.
 * Uses a stable unique identifier: `${monitor.id}_${dateStr}`.
 * If a report already exists for that monitor and date, updates/replaces it cleanly.
 * Verifies that the report metadata and PDF are safely stored before returning.
 */
export async function generateDailyReportForMonitor(monitor, dateStr, existingChecks = null) {
  const reportId = `${monitor.id}_${dateStr}`;

  if (reportLocks.has(reportId)) {
    // Wait briefly for in-progress generation for this report
    let waits = 0;
    while (reportLocks.has(reportId) && waits < 30) {
      await new Promise((r) => setTimeout(r, 100));
      waits++;
    }
  }
  reportLocks.add(reportId);

  try {
    // Fetch checks for this monitor if not supplied
    let checks = existingChecks;
    if (!checks) {
      const checksSnap = await db.collection("checks").where("monitorId", "==", monitor.id).get();
      checks = [];
      checksSnap.forEach((d) => checks.push({ id: d.id, ...d.data() }));
    }

    // Compute metrics
    const metrics = computeDailyMetricsForMonitor(monitor, checks, dateStr);
    const formattedDate = formatISTReportDate(dateStr);

    // Generate PDF Buffer
    const pdfBuffer = await generateDailyPdfReport({
      monitor,
      dateStr,
      formattedDate,
      stats: {
        availabilityPercentage: metrics.availabilityPercentage,
        avgLatency: metrics.avgLatency,
        minLatency: metrics.minLatency,
        maxLatency: metrics.maxLatency,
        totalChecks: metrics.totalChecks,
        successfulChecks: metrics.successfulChecks,
        failedChecks: metrics.failedChecks,
        healthStatus: metrics.healthStatus,
      },
      hourlyStats: metrics.hourlyStats,
    });

    // Save PDF to persistent storage (disk / Firebase Storage)
    const storageResult = await saveReportPdf(reportId, pdfBuffer);

    // Safe sanitized file name for download
    const safeName = (monitor.name || "api").replace(/[^a-zA-Z0-9-_]/g, "_");
    const pdfFileName = `APIWatch-${safeName}-${dateStr}.pdf`;

    // Metadata payload stored in Firestore collection "reports"
    const reportData = {
      id: reportId,
      reportId,
      monitorId: monitor.id,
      monitorName: monitor.name || "API Monitor",
      monitorUrl: monitor.url || "",
      monitorMethod: monitor.method || "GET",
      monitorFolder: monitor.folder || "General",
      userId: monitor.userId || "anonymous",
      date: dateStr,
      formattedDate,
      timezone: "Asia/Kolkata",
      stats: {
        availabilityPercentage: metrics.availabilityPercentage,
        avgLatency: metrics.avgLatency,
        minLatency: metrics.minLatency,
        maxLatency: metrics.maxLatency,
        totalChecks: metrics.totalChecks,
        successfulChecks: metrics.successfulChecks,
        failedChecks: metrics.failedChecks,
        healthStatus: metrics.healthStatus,
      },
      hourlyStats: metrics.hourlyStats,
      pdfFileName,
      pdfPath: storageResult.localPath,
      pdfUrl: `/api/reports/${reportId}/pdf`,
      downloadUrl: `/api/reports/${reportId}/download`,
      fileSize: pdfBuffer.length,
      status: "COMPLETED",
      verified: true,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Set doc in Firestore (merges/updates existing if already present -> no duplicates)
    await db.collection("reports").doc(reportId).set(reportData, { merge: true });

    // VERIFICATION STEP: verify that both Firestore doc and PDF file exist & are valid
    const verifyDoc = await db.collection("reports").doc(reportId).get();
    const pdfExists = await hasReportPdf(reportId);

    if (!verifyDoc.exists || !pdfExists) {
      throw new Error(`Verification failed for report ${reportId}: DocExists=${verifyDoc.exists}, PdfExists=${pdfExists}`);
    }

    return {
      success: true,
      reportId,
      report: reportData,
      dayChecks: metrics.dayChecks,
    };
  } finally {
    reportLocks.delete(reportId);
  }
}

/**
 * Manual generation of today's summary.
 * Triggered by the "Generate Today's Summary" button.
 * - Generates reports using currently available data for today.
 * - Generates one PDF per monitored API.
 * - Saves PDFs persistently.
 * - Replaces existing reports for the same API and today's date instead of creating duplicates.
 * - NEVER deletes today's monitoring data.
 */
export async function generateTodayReports(userId = null) {
  if (isTodayGenerationInProgress) {
    return { success: false, message: "Today's report generation is already in progress. Please wait." };
  }

  isTodayGenerationInProgress = true;
  const todayStr = getISTDateStr();

  try {
    // 1. Fetch all monitors
    let monitorsQuery = db.collection("monitors");
    if (userId) monitorsQuery = monitorsQuery.where("userId", "==", userId);
    const monitorsSnap = await monitorsQuery.get();
    const monitors = [];
    monitorsSnap.forEach((d) => monitors.push({ id: d.id, ...d.data() }));

    // 2. Fetch all checks for today
    const boundaries = getISTDayBoundaries(todayStr);
    let checksQuery = db.collection("checks");
    if (userId) checksQuery = checksQuery.where("userId", "==", userId);
    const checksSnap = await checksQuery.get();
    const todayChecks = [];
    checksSnap.forEach((d) => {
      const data = d.data();
      const timeMs = data.checkedAt ? new Date(data.checkedAt).getTime() : 0;
      if (timeMs >= boundaries.startMs && timeMs < boundaries.endMs) {
        todayChecks.push({ id: d.id, ...data });
      }
    });

    const generatedReports = [];
    const errors = [];

    for (const monitor of monitors) {
      try {
        const monChecks = todayChecks.filter((c) => c.monitorId === monitor.id);
        const result = await generateDailyReportForMonitor(monitor, todayStr, monChecks);
        generatedReports.push(result.report);
      } catch (err) {
        console.error(`Failed to generate today's summary for monitor ${monitor.id}:`, err);
        errors.push({ monitorId: monitor.id, error: err.message });
      }
    }

    return {
      success: errors.length === 0,
      date: todayStr,
      formattedDate: formatISTReportDate(todayStr),
      generatedCount: generatedReports.length,
      totalMonitors: monitors.length,
      reports: generatedReports,
      errors: errors.length > 0 ? errors : undefined,
    };
  } finally {
    isTodayGenerationInProgress = false;
  }
}

/**
 * Automatic generation and archiving process.
 * Runs at midnight or during maintenance for previous day(s).
 *
 * Requirements:
 * 1. Identify the previous day's monitoring data.
 * 2. Generate a separate PDF report for every monitored API using that day's data.
 * 3. Save the PDFs and their metadata in persistent storage.
 * 4. Verify that every API's report was successfully generated and saved.
 * 5. ONLY after successful verification, delete the previous day's raw check data from Firestore.
 * Critical: Never delete historical check data before its corresponding reports have been successfully generated and persisted.
 */
export async function generateAndArchiveDailyReports(targetDateStr = null) {
  if (isArchiveInProgress) {
    console.log("⏳ Archiving process is already in progress. Skipping concurrent run.");
    return { skipped: true };
  }

  isArchiveInProgress = true;
  const dateStr = targetDateStr || getISTYesterdayDateStr();
  const boundaries = getISTDayBoundaries(dateStr);

  console.log(`\n📦 [Archiving] Starting daily report generation & archiving for IST Date: ${dateStr}...`);

  try {
    // 1. Fetch all monitors
    const monitorsSnap = await db.collection("monitors").get();
    const monitors = [];
    monitorsSnap.forEach((d) => monitors.push({ id: d.id, ...d.data() }));

    // 2. Fetch all checks in this target day's range
    const checksSnap = await db.collection("checks").get();
    const targetDayChecks = [];
    checksSnap.forEach((d) => {
      const data = d.data();
      const timeMs = data.checkedAt ? new Date(data.checkedAt).getTime() : 0;
      if (timeMs >= boundaries.startMs && timeMs < boundaries.endMs) {
        targetDayChecks.push({ id: d.id, ...data });
      }
    });

    const verifiedCheckIdsToDelete = [];
    const generatedReports = [];
    const failedMonitors = [];

    // 3 & 4. Generate report for every monitored API and verify
    for (const monitor of monitors) {
      const monChecks = targetDayChecks.filter((c) => c.monitorId === monitor.id);
      try {
        const result = await generateDailyReportForMonitor(monitor, dateStr, monChecks);
        if (result.success) {
          generatedReports.push(result.report);
          // Only checks belonging to this successfully verified monitor report are queued for deletion
          monChecks.forEach((c) => verifiedCheckIdsToDelete.push(c.id));
        }
      } catch (err) {
        console.error(`❌ [Archiving] Failed to generate/verify report for monitor "${monitor.name}" (${monitor.id}):`, err.message);
        failedMonitors.push({ monitorId: monitor.id, error: err.message });
      }
    }

    // Also handle checks that might belong to deleted monitors
    const knownMonitorIds = new Set(monitors.map((m) => m.id));
    const orphanChecks = targetDayChecks.filter((c) => !knownMonitorIds.has(c.monitorId));
    if (orphanChecks.length > 0) {
      // Group orphan checks by monitorId
      const orphanGroups = {};
      orphanChecks.forEach((c) => {
        if (!orphanGroups[c.monitorId]) orphanGroups[c.monitorId] = [];
        orphanGroups[c.monitorId].push(c);
      });

      for (const [orphanId, oChecks] of Object.entries(orphanGroups)) {
        try {
          const fakeMon = { id: orphanId, name: `Archived API (${orphanId})`, url: oChecks[0]?.finalUrl || "N/A" };
          const result = await generateDailyReportForMonitor(fakeMon, dateStr, oChecks);
          if (result.success) {
            generatedReports.push(result.report);
            oChecks.forEach((c) => verifiedCheckIdsToDelete.push(c.id));
          }
        } catch (err) {
          console.error(`❌ [Archiving] Failed to archive orphan checks for ${orphanId}:`, err.message);
        }
      }
    }

    // 5. ONLY after successful verification, delete verified raw checks from Firestore
    let deletedCount = 0;
    if (verifiedCheckIdsToDelete.length > 0) {
      const batchSize = 400;
      for (let i = 0; i < verifiedCheckIdsToDelete.length; i += batchSize) {
        const slice = verifiedCheckIdsToDelete.slice(i, i + batchSize);
        if (typeof db.batch === "function") {
          const batch = db.batch();
          slice.forEach((id) => batch.delete(db.collection("checks").doc(id)));
          await batch.commit();
        } else {
          await Promise.all(slice.map((id) => db.collection("checks").doc(id).delete()));
        }
        deletedCount += slice.length;
      }
    }

    console.log(
      `✅ [Archiving] Completed for ${dateStr}! Generated ${generatedReports.length} reports, Verified & Deleted ${deletedCount} raw checks. Failures: ${failedMonitors.length}.\n`
    );

    return {
      success: failedMonitors.length === 0,
      date: dateStr,
      generatedCount: generatedReports.length,
      deletedChecksCount: deletedCount,
      failedMonitorsCount: failedMonitors.length,
      reports: generatedReports,
    };
  } finally {
    isArchiveInProgress = false;
  }
}

/**
 * Scans all raw checks in Firestore older than today's IST start.
 * Identifies all past dates that have raw data, generates verified daily reports for each past date,
 * and only then deletes the raw checks.
 * Ensures data is NEVER lost across server restarts or missed cron runs.
 */
export async function archiveAllPendingPastReports(currentDayBoundaries) {
  const boundaries = currentDayBoundaries || getISTDayBoundaries(getISTDateStr());
  const checksSnap = await db.collection("checks").get();

  const pastDatesSet = new Set();
  checksSnap.forEach((d) => {
    const data = d.data();
    const timeMs = data.checkedAt ? new Date(data.checkedAt).getTime() : 0;
    if (timeMs > 0 && timeMs < boundaries.startMs) {
      const dateStr = getISTDateStr(new Date(timeMs));
      pastDatesSet.add(dateStr);
    }
  });

  const sortedPastDates = Array.from(pastDatesSet).sort();
  let totalDeletedChecks = 0;
  let totalReportsGenerated = 0;

  for (const pastDateStr of sortedPastDates) {
    try {
      const res = await generateAndArchiveDailyReports(pastDateStr);
      if (res && res.deletedChecksCount) totalDeletedChecks += res.deletedChecksCount;
      if (res && res.generatedCount) totalReportsGenerated += res.generatedCount;
    } catch (err) {
      console.error(`Error archiving past date ${pastDateStr}:`, err.message);
    }
  }

  return {
    pastDatesProcessed: sortedPastDates,
    totalReportsGenerated,
    totalDeletedChecks,
  };
}

/**
 * Retrieves historical reports for Past Data section.
 * - If dateStr is provided: returns all API reports for that specific date.
 * - If dateStr is omitted: returns all available past dates and reports for the most recent past date.
 */
export async function getPastReports(dateStr = null, userId = null) {
  const reportsSnap = await db.collection("reports").get();
  const allReports = [];

  reportsSnap.forEach((d) => {
    const data = d.data();
    if (!userId || data.userId === userId) {
      allReports.push({ id: d.id, ...data });
    }
  });

  // Collect all available dates sorted descending (newest first)
  const availableDatesSet = new Set();
  allReports.forEach((r) => {
    if (r.date) availableDatesSet.add(r.date);
  });
  const availableDates = Array.from(availableDatesSet).sort().reverse();

  // Selected date: either the requested dateStr or the latest available past date
  const todayStr = getISTDateStr();
  let selectedDate = dateStr;
  if (!selectedDate) {
    // Pick the most recent date that is NOT today, or the first available date
    const pastOnly = availableDates.filter((d) => d < todayStr);
    selectedDate = pastOnly.length > 0 ? pastOnly[0] : (availableDates[0] || getISTYesterdayDateStr());
  }

  const reportsForDate = allReports.filter((r) => r.date === selectedDate);

  // Sort reports alphabetically by monitor name
  reportsForDate.sort((a, b) => (a.monitorName || "").localeCompare(b.monitorName || ""));

  return {
    success: true,
    availableDates,
    selectedDate,
    formattedSelectedDate: formatISTReportDate(selectedDate),
    reports: reportsForDate,
  };
}

/**
 * Retrieves a single report by reportId (`${monitorId}_${dateStr}`).
 */
export async function getReportById(reportId) {
  const snap = await db.collection("reports").doc(reportId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

export default {
  getISTDateStr,
  formatISTReportDate,
  getISTYesterdayDateStr,
  getISTDayBoundaries,
  getISTHour,
  computeDailyMetricsForMonitor,
  generateDailyReportForMonitor,
  generateTodayReports,
  generateAndArchiveDailyReports,
  archiveAllPendingPastReports,
  getPastReports,
  getReportById,
};
