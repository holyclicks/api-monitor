import { runSchedulerTick } from "../../services/schedulerService.js";

/**
 * Handler for /api/cron/monitor
 * Allows Vercel Cron, external crons (cron-job.org), or automated workers to trigger a monitoring tick.
 */
export async function handleCron(req, res) {
  try {
    // Optional secret check
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.query.secret !== cronSecret) {
      return res.status(401).json({ success: false, error: "Unauthorized cron execution" });
    }

    const result = await runSchedulerTick();

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (err) {
    console.error("Cron monitor trigger error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default handleCron;
