import cron from "node-cron";
import db from "../config/firebaseAdmin.js";
import { archiveAllPendingPastReports } from "./reportService.js";

// Concurrency lock to prevent simultaneous compaction runs for the same monitor
const compactionLocks = new Set();
let maintenanceRunning = false;

/**
 * Returns today's boundaries (midnight to midnight) in the Asia/Kolkata (IST) timezone.
 */
export function getISTDayRange(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const istDateStr = formatter.format(date); // Format: "YYYY-MM-DD"
  const startOfDay = new Date(`${istDateStr}T00:00:00.000+05:30`);
  // IST has constant UTC+05:30 offset without DST, so 24 hours is exactly 86,400,000 ms
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  return {
    istDateStr,
    startOfDay,
    endOfDay,
    startOfDayISO: startOfDay.toISOString(),
    endOfDayISO: endOfDay.toISOString(),
  };
}

/**
 * Checks if a given timestamp falls within today's range in Asia/Kolkata (IST).
 */
export function isWithinTodayIST(timestamp, dayRange = getISTDayRange()) {
  if (!timestamp) return false;
  const timeMs = new Date(timestamp).getTime();
  if (isNaN(timeMs)) return false;
  return timeMs >= dayRange.startOfDay.getTime() && timeMs < dayRange.endOfDay.getTime();
}

/**
 * Delete all expired checks from Firestore (outside current day's midnight to midnight in Asia/Kolkata).
 * Applies to ALL monitors, whether active, paused, or inactive.
 */
export async function deleteExpiredChecks(dayRange = getISTDayRange()) {
  const { startOfDay, endOfDay } = dayRange;
  const startMs = startOfDay.getTime();
  const endMs = endOfDay.getTime();

  try {
    // 1. Generate & verify daily reports for all past dates before deleting any historical checks
    const archiveResult = await archiveAllPendingPastReports(dayRange);
    let deletedCount = archiveResult.totalDeletedChecks || 0;

    // 2. Identify any remaining corrupted or invalid timestamp checks outside range
    const checksSnap = await db.collection("checks").get();
    const invalidDocs = [];

    checksSnap.forEach((doc) => {
      const data = doc.data();
      const checkedAtMs = data.checkedAt ? new Date(data.checkedAt).getTime() : 0;
      if (isNaN(checkedAtMs) || checkedAtMs < startMs || checkedAtMs >= endMs) {
        invalidDocs.push(doc);
      }
    });

    if (invalidDocs.length > 0) {
      const batchSize = 400;
      for (let i = 0; i < invalidDocs.length; i += batchSize) {
        const slice = invalidDocs.slice(i, i + batchSize);
        if (typeof db.batch === "function") {
          const batch = db.batch();
          slice.forEach((d) => batch.delete(db.collection("checks").doc(d.id)));
          await batch.commit();
        } else {
          await Promise.all(slice.map((d) => db.collection("checks").doc(d.id).delete()));
        }
        deletedCount += slice.length;
      }
    }

    console.log(`🧹 Deleted ${deletedCount} expired check records (outside IST today: ${dayRange.istDateStr}).`);
    return { deletedCount };
  } catch (err) {
    console.error("Error deleting expired checks:", err.message);
    throw err;
  }
}

/**
 * Computes a hashable signature string for comparable fields.
 * Timestamp (checkedAt) and response latency (responseTime) are explicitly EXCLUDED.
 * Different error messages, statuses, HTTP codes, or redirect properties produce distinct signatures.
 */
export function getRecordSignature(record) {
  const hopSig = Array.isArray(record.redirectChain)
    ? record.redirectChain.map((h) => `${h.hop}:${h.statusCode}:${h.url || ""}:${h.targetUrl || ""}`).join("|")
    : "";

  return JSON.stringify({
    monitorId: record.monitorId || "",
    status: record.status || "",
    statusCode: record.statusCode === undefined ? null : record.statusCode,
    error: record.error || null,
    redirected: !!record.redirected,
    redirectCount: record.redirectCount || 0,
    finalUrl: record.finalUrl || "",
    dependencyWarning: record.dependencyWarning || null,
    hopSig,
  });
}

/**
 * Compacts older checks for a specific monitor:
 * 1. Always retains latest 10 check records as individual Firestore documents.
 * 2. Older records (index 10+) are physically merged in Firestore when all comparable fields are identical.
 * 3. Never merges different errors or different comparable fields.
 * 4. Preserves original number of checks represented, weighted average latency, and latest timestamp.
 */
export async function compactMonitorChecks(monitorId, dayRange = getISTDayRange()) {
  if (!monitorId) return { compacted: false };

  if (compactionLocks.has(monitorId)) {
    return { skipped: true, reason: "Compaction already in progress for this monitor" };
  }
  compactionLocks.add(monitorId);

  try {
    const checksSnap = await db.collection("checks").where("monitorId", "==", monitorId).get();
    const todayChecks = [];

    const startMs = dayRange.startOfDay.getTime();
    const endMs = dayRange.endOfDay.getTime();

    checksSnap.forEach((doc) => {
      const data = doc.data();
      const timeMs = data.checkedAt ? new Date(data.checkedAt).getTime() : 0;
      if (!isNaN(timeMs) && timeMs >= startMs && timeMs < endMs) {
        todayChecks.push({ id: doc.id, ...data });
      }
    });

    // Sort today's checks descending by checkedAt (newest first)
    todayChecks.sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());

    // Retain latest 10 checks as individual Firestore documents!
    if (todayChecks.length <= 10) {
      return {
        compacted: false,
        totalChecksInDB: todayChecks.length,
        retainedIndividual: todayChecks.length,
      };
    }

    const latest10 = todayChecks.slice(0, 10);
    const olderChecksDesc = todayChecks.slice(10);

    // Sort older checks chronologically ascending (oldest to newest) to determine contiguous sequences
    const olderChecks = [...olderChecksDesc].sort(
      (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
    );

    // Contiguous (consecutive-only) aggregation:
    // Only merge a check with the immediately preceding chronological group if all comparable fields match.
    // Intervening checks with different fields or statuses close the preceding group and start a new one.
    // Older groups separated by intervening different checks are NEVER merged together.
    const contiguousGroups = [];
    let currentGroup = [];

    for (const record of olderChecks) {
      if (currentGroup.length === 0) {
        currentGroup.push(record);
      } else {
        const lastRecord = currentGroup[currentGroup.length - 1];
        if (getRecordSignature(lastRecord) === getRecordSignature(record)) {
          // Immediately adjacent in time with matching comparable fields
          currentGroup.push(record);
        } else {
          // Different status, error, or comparable fields -> close group and start new group
          contiguousGroups.push(currentGroup);
          currentGroup = [record];
        }
      }
    }
    if (currentGroup.length > 0) {
      contiguousGroups.push(currentGroup);
    }

    let mergedGroupsCount = 0;
    let deletedDocsCount = 0;

    const batch = typeof db.batch === "function" ? db.batch() : null;
    const directUpdates = [];
    const directDeletes = [];

    for (const group of contiguousGroups) {
      if (group.length <= 1) {
        // Only 1 document in this contiguous group; nothing to merge
        continue;
      }

      // Merge group into group[0] and delete group[1..N]
      let totalCheckCount = 0;
      let totalResponseTime = 0;
      let latestCheckedAt = group[0].checkedAt;
      let latestCheckedAtMs = new Date(group[0].checkedAt).getTime();
      let earliestCheckedAt = group[0].firstCheckedAt || group[0].checkedAt;
      let earliestCheckedAtMs = new Date(earliestCheckedAt).getTime();
      let minLatency = Infinity;
      let maxLatency = 0;

      for (const item of group) {
        const count = Number(item.checkCount) || 1;
        const resp = Number(item.responseTime) || 0;
        totalCheckCount += count;
        totalResponseTime += resp * count;

        const itemTimeMs = new Date(item.checkedAt).getTime();
        if (itemTimeMs > latestCheckedAtMs) {
          latestCheckedAtMs = itemTimeMs;
          latestCheckedAt = item.checkedAt;
        }

        const itemFirstTimeMs = new Date(item.firstCheckedAt || item.checkedAt).getTime();
        if (itemFirstTimeMs < earliestCheckedAtMs) {
          earliestCheckedAtMs = itemFirstTimeMs;
          earliestCheckedAt = item.firstCheckedAt || item.checkedAt;
        }

        const itemMin = typeof item.minResponseTime === "number" ? item.minResponseTime : resp;
        const itemMax = typeof item.maxResponseTime === "number" ? item.maxResponseTime : resp;
        if (itemMin < minLatency) minLatency = itemMin;
        if (itemMax > maxLatency) maxLatency = itemMax;
      }

      const avgResponseTime = totalCheckCount > 0 ? Math.round(totalResponseTime / totalCheckCount) : 0;
      const primaryDoc = group[0];
      const obsoleteDocs = group.slice(1);

      const mergedPayload = {
        ...primaryDoc,
        responseTime: avgResponseTime,
        checkedAt: latestCheckedAt,
        firstCheckedAt: earliestCheckedAt,
        checkCount: totalCheckCount,
        isAggregated: true,
        minResponseTime: minLatency === Infinity ? avgResponseTime : minLatency,
        maxResponseTime: maxLatency,
        updatedAt: new Date().toISOString(),
      };

      if (batch) {
        batch.set(db.collection("checks").doc(primaryDoc.id), mergedPayload);
        obsoleteDocs.forEach((doc) => batch.delete(db.collection("checks").doc(doc.id)));
      } else {
        directUpdates.push(db.collection("checks").doc(primaryDoc.id).set(mergedPayload));
        obsoleteDocs.forEach((doc) => directDeletes.push(db.collection("checks").doc(doc.id).delete()));
      }

      mergedGroupsCount++;
      deletedDocsCount += obsoleteDocs.length;
    }

    if (batch) {
      await batch.commit();
    } else {
      await Promise.all([...directUpdates, ...directDeletes]);
    }

    return {
      compacted: mergedGroupsCount > 0,
      mergedGroupsCount,
      deletedDocsCount,
      retainedIndividualCount: latest10.length,
    };
  } finally {
    compactionLocks.delete(monitorId);
  }
}

/**
 * Saves a new check record to Firestore and compacts older checks.
 * Ensures the new check is saved with checkCount: 1.
 */
export async function saveCheck(checkRecord) {
  const recordToSave = {
    ...checkRecord,
    checkCount: 1,
    isAggregated: false,
    minResponseTime: checkRecord.responseTime,
    maxResponseTime: checkRecord.responseTime,
  };

  const docRef = await db.collection("checks").add(recordToSave);
  const savedCheck = { id: docRef.id, ...recordToSave };

  // Trigger compaction for this monitor so records beyond the latest 10 are compacted
  try {
    await compactMonitorChecks(checkRecord.monitorId);
  } catch (err) {
    console.warn(`Compaction after check failed for monitor ${checkRecord.monitorId}:`, err.message);
  }

  return savedCheck;
}

/**
 * Calculates accurate statistics for a monitor based on today's checks in IST.
 * Accurately accounts for checkCount on aggregated records.
 */
export async function getMonitorStatsForToday(monitorId, dayRange = getISTDayRange()) {
  const checksSnap = await db.collection("checks").where("monitorId", "==", monitorId).get();
  const startMs = dayRange.startOfDay.getTime();
  const endMs = dayRange.endOfDay.getTime();

  let totalChecks = 0;
  let successfulChecks = 0;
  let failedChecks = 0;
  let totalLatency = 0;
  let minLatency = Infinity;
  let maxLatency = 0;

  checksSnap.forEach((doc) => {
    const data = doc.data();
    const cTime = data.checkedAt ? new Date(data.checkedAt).getTime() : 0;
    if (cTime >= startMs && cTime < endMs) {
      const count = Number(data.checkCount) || 1;
      totalChecks += count;

      if (data.status === "UP" || data.status === "SLOW") {
        successfulChecks += count;
      } else {
        failedChecks += count;
      }

      if (typeof data.responseTime === "number") {
        totalLatency += data.responseTime * count;
        const rMin = typeof data.minResponseTime === "number" ? data.minResponseTime : data.responseTime;
        const rMax = typeof data.maxResponseTime === "number" ? data.maxResponseTime : data.responseTime;
        if (rMin < minLatency) minLatency = rMin;
        if (rMax > maxLatency) maxLatency = rMax;
      }
    }
  });

  const uptimePercentage = totalChecks > 0 ? Math.round((successfulChecks / totalChecks) * 10000) / 100 : 100;
  const avgLatency = totalChecks > 0 ? Math.round(totalLatency / totalChecks) : 0;

  return {
    totalChecks,
    successfulChecks,
    failedChecks,
    uptimePercentage,
    avgLatency,
    minLatency: minLatency === Infinity ? 0 : minLatency,
    maxLatency,
  };
}

/**
 * Runs full maintenance across the entire application:
 * 1. Purges all expired checks (< today's midnight IST or >= next day's midnight IST).
 * 2. Compacts older checks for each monitor (active or paused/inactive).
 * 3. Recalculates monitor uptimePercentage from today's checks.
 */
export async function runFullMaintenance(dayRange = getISTDayRange()) {
  if (maintenanceRunning) {
    console.log("⏳ Maintenance is already in progress. Skipping redundant run.");
    return { skipped: true };
  }

  maintenanceRunning = true;
  console.log(`\n🧹 [Maintenance] Running cleanup and compaction for IST Date: ${dayRange.istDateStr}...`);

  try {
    // 1. Delete all expired checks across all monitors (including paused/inactive)
    const { deletedCount } = await deleteExpiredChecks(dayRange);

    // 2. Fetch all monitors (active, paused, and inactive)
    const monitorsSnap = await db.collection("monitors").get();
    let compactedMonitorsCount = 0;

    for (const monDoc of monitorsSnap.docs) {
      const monId = monDoc.id;
      // Compact older checks for this monitor
      await compactMonitorChecks(monId, dayRange);

      // Recalculate accurate stats for today and update monitor document
      const stats = await getMonitorStatsForToday(monId, dayRange);
      await db.collection("monitors").doc(monId).update({
        uptimePercentage: stats.uptimePercentage,
      });

      compactedMonitorsCount++;
    }

    console.log(
      `✅ [Maintenance] Completed! Purged ${deletedCount} expired records. Maintained ${compactedMonitorsCount} monitors.\n`
    );

    return {
      success: true,
      deletedExpiredChecksCount: deletedCount,
      monitorsCount: compactedMonitorsCount,
    };
  } catch (err) {
    console.error("❌ [Maintenance] Error during maintenance run:", err);
    throw err;
  } finally {
    maintenanceRunning = false;
  }
}

let cronJob = null;

/**
 * Schedules automatic maintenance at midnight Asia/Kolkata (IST).
 */
export function initScheduledMaintenance() {
  if (cronJob) {
    cronJob.stop();
  }

  // At 00:00 (midnight) every day in Asia/Kolkata timezone
  cronJob = cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("⏰ Midnight IST Cron triggered! Running automatic cleanup and compaction...");
      try {
        await runFullMaintenance();
      } catch (err) {
        console.error("Error in scheduled midnight IST maintenance:", err.message);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  console.log("🕒 Scheduled automatic maintenance initialized for 00:00 Asia/Kolkata (IST).");
  return cronJob;
}

export default {
  getISTDayRange,
  isWithinTodayIST,
  deleteExpiredChecks,
  getRecordSignature,
  compactMonitorChecks,
  saveCheck,
  getMonitorStatsForToday,
  runFullMaintenance,
  initScheduledMaintenance,
};
