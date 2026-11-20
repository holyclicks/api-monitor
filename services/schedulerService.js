import db from "../config/firebaseAdmin.js";
import { checkAPI } from "./monitoringEngine.js";
import { processIncidentState } from "./incidentService.js";
import {
  saveCheck,
  getMonitorStatsForToday,
  runFullMaintenance,
  initScheduledMaintenance,
  getISTDayRange,
} from "./checkStorageService.js";

// In-memory set to prevent duplicate concurrent checks on the same monitor
const activeCheckLocks = new Set();

/**
 * Execute a single health check on a specific monitor, save the check,
 * update incidents, and update monitor status.
 */
export async function executeCheck(monitorId) {
  if (activeCheckLocks.has(monitorId)) {
    console.log(`⏳ Check already in progress for monitor ${monitorId}. Waiting for it to complete...`);
    let attempts = 0;
    while (activeCheckLocks.has(monitorId) && attempts < 30) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }
    // Return latest monitor state from DB
    const docSnap = await db.collection("monitors").doc(monitorId).get();
    if (docSnap.exists) {
      const monitor = { id: docSnap.id, ...docSnap.data() };
      return {
        check: {
          monitorId,
          status: monitor.currentStatus,
          statusCode: monitor.lastStatusCode,
          responseTime: monitor.lastResponseTime,
          redirectChain: monitor.lastRedirectChain || [],
          redirectCount: monitor.lastRedirectCount || 0,
          checkedAt: monitor.lastCheckedAt,
          error: monitor.lastError || null,
        },
        monitor,
      };
    }
  }

  activeCheckLocks.add(monitorId);

  try {
    const docRef = db.collection("monitors").doc(monitorId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.warn(`Monitor ${monitorId} not found.`);
      return null;
    }

    const monitor = { id: docSnap.id, ...docSnap.data() };

    // Dependency check (Phase 11 enhancement #3)
    let dependencyWarning = null;
    if (monitor.dependsOnMonitorId) {
      const depSnap = await db.collection("monitors").doc(monitor.dependsOnMonitorId).get();
      if (depSnap.exists) {
        const depData = depSnap.data();
        if (depData.currentStatus === "DOWN") {
          dependencyWarning = `Upstream dependency "${depData.name || "API"}" is DOWN`;
        }
      }
    }

    // 1. Run HTTP health check
    const checkResult = await checkAPI(monitor);

    // If dependency is down and this check also failed or is affected:
    if (dependencyWarning && checkResult.status === "DOWN") {
      checkResult.error = `${dependencyWarning} | ${checkResult.error || "Failed"}`;
    }

    // 2. Save check to `checks` collection and compact older records
    const checkRecord = {
      monitorId: monitor.id,
      userId: monitor.userId || "anonymous",
      status: checkResult.status,
      statusCode: checkResult.statusCode,
      responseTime: checkResult.responseTime,
      redirected: checkResult.redirected || false,
      redirectCount: checkResult.redirectCount || 0,
      redirectChain: checkResult.redirectChain || [],
      finalUrl: checkResult.finalUrl || monitor.url,
      regions: checkResult.regions || null,
      dependencyWarning,
      checkedAt: checkResult.checkedAt,
      error: checkResult.error || null,
    };

    const savedCheck = await saveCheck(checkRecord);

    // 3. Process incidents and notifications
    await processIncidentState(monitor, savedCheck);

    // 4. Calculate accurate uptime percentage from today's checks in Asia/Kolkata (IST)
    const stats = await getMonitorStatsForToday(monitor.id);
    const uptime = stats.uptimePercentage;

    // 5. Schedule next check
    // Interval can be stored in seconds (e.g., 10, 30, 60) or minutes (1, 5).
    // Let's interpret numbers <= 60 as seconds if under 10 or default to seconds if intervalUnit == 's'.
    // If intervalUnit is explicitly 'm' or undefined with interval >= 1, we can support intervalInSeconds.
    const intervalSec = monitor.intervalInSeconds || (monitor.intervalUnit === "m" ? monitor.interval * 60 : monitor.interval || 30);
    const nextCheckTime = new Date(Date.now() + intervalSec * 1000).toISOString();

    const consecutiveFailures = checkResult.status === "DOWN" ? (monitor.consecutiveFailures || 0) + 1 : 0;

    await docRef.update({
      currentStatus: checkResult.status,
      lastCheckedAt: checkResult.checkedAt,
      nextCheckAt: nextCheckTime,
      lastResponseTime: checkResult.responseTime,
      lastStatusCode: checkResult.statusCode,
      lastRedirected: checkResult.redirected || false,
      lastRedirectCount: checkResult.redirectCount || 0,
      lastRedirectChain: checkResult.redirectChain || [],
      lastFinalUrl: checkResult.finalUrl || monitor.url,
      lastRegions: checkResult.regions || null,
      dependencyWarning: dependencyWarning || null,
      lastError: checkResult.error || null,
      uptimePercentage: uptime,
      consecutiveFailures,
    });

    console.log(
      `📊 Checked [${monitor.name}]: ${checkResult.status} (${checkResult.statusCode || "ERR"}) in ${checkResult.responseTime}ms | Uptime: ${uptime}% | Next: ${nextCheckTime}`
    );

    return {
      check: savedCheck,
      monitor: {
        ...monitor,
        currentStatus: checkResult.status,
        lastCheckedAt: checkResult.checkedAt,
        nextCheckAt: nextCheckTime,
        uptimePercentage: uptime,
      },
    };
  } catch (err) {
    console.error(`Error executing check for monitor ${monitorId}:`, err);
    throw err;
  } finally {
    activeCheckLocks.delete(monitorId);
  }
}

let lastCheckedISTDate = null;

/**
 * Scan for all monitors that are active and whose nextCheckAt <= currentTime
 */
export async function runSchedulerTick() {
  const currentDayRange = getISTDayRange();
  // Automatically run maintenance if day has rolled over in IST
  if (lastCheckedISTDate && lastCheckedISTDate !== currentDayRange.istDateStr) {
    console.log(`🌅 Date changed in IST from ${lastCheckedISTDate} to ${currentDayRange.istDateStr}. Running maintenance...`);
    runFullMaintenance(currentDayRange).catch((err) => console.error("Day rollover maintenance error:", err.message));
  }
  lastCheckedISTDate = currentDayRange.istDateStr;

  try {
    const monitorsSnap = await db.collection("monitors").where("isActive", "==", true).get();

    if (monitorsSnap.empty) {
      return { checkedCount: 0 };
    }

    const dueMonitors = [];

    monitorsSnap.forEach((doc) => {
      const data = doc.data();
      const nextCheckAt = data.nextCheckAt;

      // If nextCheckAt is not set or <= now, it is due
      if (!nextCheckAt || new Date(nextCheckAt).getTime() <= Date.now()) {
        dueMonitors.push({ id: doc.id, ...data });
      }
    });

    if (dueMonitors.length > 0) {
      console.log(`⏱️ Scheduler tick: Found ${dueMonitors.length} due monitors out of ${monitorsSnap.docs.length} active.`);
    }

    // Execute checks in parallel (batched)
    const results = await Promise.allSettled(
      dueMonitors.map((mon) => executeCheck(mon.id))
    );

    const successful = results.filter((r) => r.status === "fulfilled" && r.value !== null).length;
    return { checkedCount: successful, totalDue: dueMonitors.length };
  } catch (err) {
    console.error("Scheduler tick error:", err.message);
    return { error: err.message };
  }
}

let schedulerTimer = null;

export function startScheduler(intervalMs = 5000) {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }
  console.log(`🚀 Background Monitoring Scheduler started (polling every ${intervalMs / 1000}s).`);

  // Initialize midnight IST scheduled maintenance
  initScheduledMaintenance();

  // Run startup maintenance to remove expired records across all monitors
  runFullMaintenance().catch((err) => {
    console.error("Startup maintenance error:", err.message);
  });

  // Run immediate tick on start
  runSchedulerTick();
  schedulerTimer = setInterval(runSchedulerTick, intervalMs);
}

export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("🛑 Background Monitoring Scheduler stopped.");
  }
}

export default {
  executeCheck,
  runSchedulerTick,
  startScheduler,
  stopScheduler,
};
