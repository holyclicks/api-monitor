import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  ExternalLink,
  PlusCircle,
} from "lucide-react";
import StatusCard from "../components/StatusCard.jsx";
import {
  fetchAnalytics,
  fetchMonitors,
  triggerCheck,
} from "../services/monitorService.js";

export default function Dashboard({ onOpenAddModal }) {
  const [analytics, setAnalytics] = useState(null);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState(null);

  const loadData = async () => {
    try {
      const [anData, monData] = await Promise.all([
        fetchAnalytics(),
        fetchMonitors(),
      ]);
      setAnalytics(anData);
      setMonitors(monData);
    } catch (err) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto refresh every 5 seconds to show live scheduler updates
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleManualCheck = async (id, e) => {
    e.stopPropagation();
    setCheckingId(id);
    try {
      await triggerCheck(id);
      await loadData();
    } catch (err) {
      alert("Manual check failed: " + err.message);
    } finally {
      setCheckingId(null);
    }
  };

  const summary = analytics?.summary || {};

  return (
    <div className="space-y-6">
      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatusCard
          title="Monitors"
          value={summary.totalMonitors ?? 0}
          subtitle="Registered APIs"
          color="gray"
          icon={Activity}
        />
        <StatusCard
          title="Healthy (UP)"
          value={summary.upMonitors ?? 0}
          subtitle="Operational"
          color="green"
          icon={CheckCircle}
        />
        <StatusCard
          title="Slow APIs"
          value={summary.slowMonitors ?? 0}
          subtitle="> 2000ms latency"
          color="yellow"
          icon={Clock}
        />
        <StatusCard
          title="Down APIs"
          value={summary.downMonitors ?? 0}
          subtitle="Failing requests"
          color="red"
          icon={XCircle}
        />
        <StatusCard
          title="Avg Latency"
          value={`${summary.avgResponseTime ?? 0} ms`}
          subtitle={`Min: ${summary.minResponseTime ?? 0}ms`}
          color="blue"
          icon={Zap}
        />
        <StatusCard
          title="Uptime %"
          value={`${summary.overallUptime ?? 100}%`}
          subtitle={`${summary.totalChecks ?? 0} checks today (IST)`}
          color={summary.overallUptime < 95 ? "red" : "green"}
          icon={CheckCircle}
        />
      </div>

      {/* Monitors List / Empty State */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-white">Monitored Endpoints</h3>
            <p className="text-xs text-gray-400">Continuous background health checks</p>
          </div>
          <Link
            to="/monitors/new"
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2.5 py-1 rounded inline-flex items-center gap-1 transition-colors"
          >
            + Add New
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400 text-xs">
            Loading your monitored endpoints...
          </div>
        ) : monitors.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="inline-flex p-3 bg-gray-900 border border-gray-700 rounded-full text-emerald-400">
              <Activity className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-white">No Monitored APIs Yet</h4>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              You haven&apos;t registered any APIs to monitor yet. Add your first API endpoint to start tracking real-time health, latency, uptime, and outage alerts.
            </p>
            <div className="pt-2">
              <Link
                to="/monitors/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-sm transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Your First API Monitor</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-900/60 text-gray-400 uppercase text-[10px] border-b border-gray-700">
                <tr>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">API Name</th>
                  <th className="py-2 px-3">Endpoint URL</th>
                  <th className="py-2 px-3">Redirect Chain</th>
                  <th className="py-2 px-3">Interval</th>
                  <th className="py-2 px-3">Latency</th>
                  <th className="py-2 px-3">Uptime</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {monitors.map((mon) => {
                  let statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-700 text-gray-300">
                      UNKNOWN
                    </span>
                  );
                  if (mon.currentStatus === "UP") {
                    statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                        ● UP
                      </span>
                    );
                  } else if (mon.currentStatus === "SLOW") {
                    statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/40">
                        ● SLOW
                      </span>
                    );
                  } else if (mon.currentStatus === "DOWN") {
                    statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-950/80 text-red-400 border border-red-800/40">
                        ● DOWN
                      </span>
                    );
                  }

                  return (
                    <tr key={mon.id} className="hover:bg-gray-750 transition-colors">
                      <td className="py-2.5 px-3">{statusBadge}</td>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        <Link to={`/monitors/${mon.id}`} className="hover:text-emerald-400 flex items-center gap-1">
                          <span>{mon.name}</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-gray-400 truncate max-w-xs">
                        <span className="text-gray-500 font-bold mr-1">[{mon.method || "GET"}]</span>
                        {mon.url}
                      </td>
                      <td className="py-2.5 px-3">
                        {mon.lastRedirectChain && mon.lastRedirectChain.length > 1 ? (
                          <Link
                            to={`/monitors/${mon.id}`}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-950/80 text-blue-400 border border-blue-800/60 hover:bg-blue-900 transition-colors"
                            title={mon.lastRedirectChain.map((h) => `#${h.hop}: ${h.statusCode} (${h.url})`).join("\n")}
                          >
                            <span>🔀 {mon.lastRedirectChain.length - 1} Hops:</span>
                            <span className="text-white font-bold">
                              {mon.lastRedirectChain.map((h) => `${h.statusCode}`).join(" ➔ ")}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-gray-500 font-mono text-[11px]">Direct (0)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-400">{mon.intervalInSeconds || mon.interval}s</td>
                      <td className="py-2.5 px-3 font-mono">
                        <div>{mon.lastResponseTime !== undefined ? `${mon.lastResponseTime} ms` : "-"}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-emerald-400">
                        {mon.uptimePercentage ?? 100}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => handleManualCheck(mon.id, e)}
                          disabled={checkingId === mon.id}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-[11px] font-medium disabled:opacity-50"
                        >
                          {checkingId === mon.id ? "Pinging..." : "Check Now"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Incidents Card */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Incidents & Outages</h3>
            <p className="text-xs text-gray-400">Failures detected and recovery tracking</p>
          </div>
          <Link to="/incidents" className="text-xs text-emerald-400 hover:underline">
            View All →
          </Link>
        </div>

        {(!analytics?.recentIncidents || analytics.recentIncidents.length === 0) ? (
          <div className="text-center py-6 text-gray-400 text-xs">
            🎉 No incidents recorded! All monitored systems are operating smoothly.
          </div>
        ) : (
          <div className="space-y-2">
            {analytics.recentIncidents.slice(0, 5).map((inc) => (
              <div
                key={inc.id}
                className="p-3 bg-gray-900/60 rounded border border-gray-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inc.status === "OPEN"
                          ? "bg-red-950 text-red-400 border border-red-800/60"
                          : "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                      }`}
                    >
                      {inc.status}
                    </span>
                    <span className="font-semibold text-white">{inc.monitorName}</span>
                  </div>
                  <p className="text-gray-400 mt-1 font-mono text-[11px]">Reason: {inc.reason}</p>
                </div>

                <div className="text-right text-[11px] text-gray-400">
                  <div>Started: {new Date(inc.startedAt).toLocaleTimeString()}</div>
                  {inc.durationSeconds && (
                    <div className="text-amber-400 font-mono">Downtime: {inc.durationSeconds}s</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
