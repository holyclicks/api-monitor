import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Radio,
  Clock,
  CheckCircle,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Edit2,
  Trash2,
  Globe,
  GitBranch,
  Folder,
  ArrowRight,
} from "lucide-react";
import ResponseChart from "../components/ResponseChart.jsx";
import StatusCard from "../components/StatusCard.jsx";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal.jsx";
import RedirectChainView from "../components/RedirectChainView.jsx";
import {
  fetchMonitor,
  fetchHistory,
  fetchIncidents,
  triggerCheck,
  updateMonitor,
  deleteMonitor,
} from "../services/monitorService.js";

export default function MonitorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState(null);
  const [history, setHistory] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    try {
      const [monData, histData, incData] = await Promise.all([
        fetchMonitor(id),
        fetchHistory(id, 40),
        fetchIncidents({ monitorId: id }),
      ]);
      setMonitor(monData);
      setHistory(histData);
      setIncidents(incData);
    } catch (err) {
      console.error("Failed to load monitor details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [id]);

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      await triggerCheck(id);
      await loadData();
    } catch (err) {
      alert("Check error: " + err.message);
    } finally {
      setChecking(false);
    }
  };

  const handleTogglePause = async () => {
    if (!monitor) return;
    try {
      await updateMonitor(monitor.id, { isActive: !monitor.isActive });
      await loadData();
    } catch (err) {
      alert("Update error: " + err.message);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteMonitor(id);
      const targetFolder = monitor?.folder || "General";
      navigate(`/monitors/folder/${encodeURIComponent(targetFolder)}`);
    } catch (err) {
      alert("Delete failed: " + err.message);
      setDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  if (loading && !monitor) {
    return <div className="p-8 text-center text-xs text-gray-400">Loading monitor data...</div>;
  }

  if (!monitor) {
    return (
      <div className="p-8 text-center text-xs text-red-400">
        Monitor not found. <Link to="/monitors" className="underline">Back to monitors</Link>
      </div>
    );
  }

  // Format history for chart (oldest to newest)
  const chartData = [...history]
    .reverse()
    .map((c) => ({
      time: new Date(c.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      responseTime: c.responseTime,
      status: c.status,
    }));

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div>
        <Link
          to={monitor.folder ? `/monitors/folder/${encodeURIComponent(monitor.folder)}` : "/monitors"}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to {monitor.folder || "Monitors"} folder</span>
        </Link>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">{monitor.name}</h1>
              {monitor.currentStatus === "UP" ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                  ● UP
                </span>
              ) : monitor.currentStatus === "SLOW" ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-400 border border-amber-800/60">
                  ● SLOW
                </span>
              ) : monitor.currentStatus === "DOWN" ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-950 text-red-400 border border-red-800/60">
                  ● DOWN
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-700 text-gray-300">
                  PENDING
                </span>
              )}

              <Link
                to={`/monitors/folder/${encodeURIComponent(monitor.folder || "General")}`}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-700/80 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-600 flex items-center gap-1 transition-colors"
                title={`Open folder "${monitor.folder || "General"}"`}
              >
                <Folder className="w-3 h-3 text-blue-400" />
                <span>{monitor.folder || "General"}</span>
              </Link>
            </div>

            <p className="font-mono text-xs text-gray-400">
              <span className="text-gray-500 font-bold mr-1">[{monitor.method || "GET"}]</span>
              {monitor.url}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/monitors/${id}/edit`}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit API</span>
            </Link>

            <button
              onClick={handleTogglePause}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              {monitor.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{monitor.isActive ? "Pause" : "Resume"}</span>
            </button>

            <button
              onClick={handleManualCheck}
              disabled={checking}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
              <span>{checking ? "Checking..." : "Trigger Check Now"}</span>
            </button>

            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="p-1.5 bg-gray-700 hover:bg-red-900/60 text-gray-300 hover:text-red-400 border border-transparent hover:border-red-800 rounded text-xs transition-colors"
              title="Delete API Monitor"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatusCard
          title="Uptime"
          value={`${monitor.uptimePercentage ?? 100}%`}
          subtitle="Today's checks (Asia/Kolkata)"
          color="green"
          icon={CheckCircle}
        />
        <StatusCard
          title="Last Latency"
          value={monitor.lastResponseTime !== undefined ? `${monitor.lastResponseTime} ms` : "-"}
          subtitle="Latest HTTP roundtrip"
          color="blue"
          icon={Clock}
        />
        <StatusCard
          title="Interval"
          value={`${monitor.intervalInSeconds || monitor.interval}s`}
          subtitle="Scheduled frequency"
          color="gray"
          icon={Radio}
        />
        <StatusCard
          title="Incidents"
          value={incidents.length}
          subtitle={`${incidents.filter((i) => i.status === "OPEN").length} currently open`}
          color={incidents.filter((i) => i.status === "OPEN").length > 0 ? "red" : "gray"}
          icon={AlertTriangle}
        />
      </div>

      {/* Redirect Chain Breakdown (Shows all redirect codes and hops) */}
      <RedirectChainView chain={monitor.lastRedirectChain || history[0]?.redirectChain} />

      {/* Response Chart */}
      <ResponseChart data={chartData} title={`Response Latency History for ${monitor.name}`} />

      {/* Recent Checks Table - Only 10 latest checks with 'See All' button */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Recent Health Checks Log (Today - Asia/Kolkata)
            </h3>
            <p className="text-[11px] text-gray-400">
              Displaying latest {Math.min(10, history.length)} checks (latest 10 individual, older checks compacted)
            </p>
          </div>

          <Link
            to={`/reports?monitorId=${id}`}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>See All Checks &amp; Reports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No checks recorded for today yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-900/60 text-gray-400 uppercase text-[10px] border-b border-gray-700">
                <tr>
                  <th className="py-2 px-3">Checked At</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">HTTP Code</th>
                  <th className="py-2 px-3">Latency</th>
                  <th className="py-2 px-3">Checks Count</th>
                  <th className="py-2 px-3">Details / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {history.slice(0, 10).map((c) => (
                  <tr key={c.id} className="hover:bg-gray-750 font-mono text-[11px]">
                    <td className="py-2 px-3 text-gray-400">
                      <div>{new Date(c.checkedAt).toLocaleString()}</div>
                      {c.firstCheckedAt && c.firstCheckedAt !== c.checkedAt && (
                        <div className="text-[9px] text-gray-500">From {new Date(c.firstCheckedAt).toLocaleTimeString()}</div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          c.status === "UP"
                            ? "text-emerald-400 bg-emerald-950/80"
                            : c.status === "SLOW"
                            ? "text-amber-400 bg-amber-950/80"
                            : "text-red-400 bg-red-950/80"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold">
                      <div className="flex flex-col">
                        <span>{c.statusCode || "N/A"}</span>
                        {c.redirectChain && c.redirectChain.length > 1 && (
                          <span className="text-[10px] text-blue-400 font-mono">
                            {c.redirectChain.map((h) => `${h.statusCode}`).join(" ➔ ")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span>{c.responseTime} ms</span>
                      {c.checkCount > 1 && (
                        <span className="text-[10px] text-indigo-400 font-sans ml-1">(avg)</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {c.checkCount > 1 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                          Merged ({c.checkCount})
                        </span>
                      ) : (
                        <span className="text-gray-500 text-[10px]">1 check</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-400 truncate max-w-sm">
                      {c.error || "Success"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {history.length > 10 && (
              <div className="mt-3 pt-2.5 border-t border-gray-700/60 flex items-center justify-between text-xs text-gray-400">
                <span>Showing 10 latest checks. To view all {history.length} records for today, download CSV, or view SLA analytics, click &quot;See All&quot;.</span>
                <Link
                  to={`/reports?monitorId=${id}`}
                  className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 shrink-0 ml-2"
                >
                  <span>See all records →</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Incident History Table for this monitor */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-2 pb-2 border-b border-gray-700">
          Incident History
        </h3>

        {incidents.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No incidents recorded for this monitor.</p>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="p-3 bg-gray-900/60 rounded border border-gray-700 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        inc.status === "OPEN" ? "bg-red-950 text-red-400" : "bg-emerald-950 text-emerald-400"
                      }`}
                    >
                      {inc.status}
                    </span>
                    <span className="font-semibold text-white font-mono">{inc.reason}</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Started: {new Date(inc.startedAt).toLocaleString()}
                    {inc.resolvedAt && ` • Resolved: ${new Date(inc.resolvedAt).toLocaleString()}`}
                  </div>
                </div>

                {inc.durationSeconds && (
                  <div className="text-amber-400 font-mono text-[11px]">
                    Downtime: {inc.durationSeconds}s
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        title="Delete API Monitor"
        message={`Are you sure you want to delete "${monitor.name}" (${monitor.url})?`}
        warning="All recorded uptime logs, latency history, and incident reports for this API will be permanently deleted."
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
