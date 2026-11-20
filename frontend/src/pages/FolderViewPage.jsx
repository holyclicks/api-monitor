import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Folder,
  PlusCircle,
  RefreshCw,
  Play,
  Pause,
  Edit2,
  Trash2,
  ExternalLink,
  Search,
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  Plus,
} from "lucide-react";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal.jsx";
import {
  fetchMonitors,
  updateMonitor,
  deleteMonitor,
  triggerCheck,
  deleteFolder,
} from "../services/monitorService.js";

export default function FolderViewPage() {
  const navigate = useNavigate();
  const { folderName: encodedFolderName } = useParams();
  const folderName = decodeURIComponent(encodedFolderName || "General");

  const [monitors, setMonitors] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'monitor'|'folder', id, name, count }
  const [isDeleting, setIsDeleting] = useState(false);

  const loadMonitors = async () => {
    try {
      const data = await fetchMonitors();
      setMonitors(data);
    } catch (err) {
      console.error("Failed to load monitors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitors();
    const interval = setInterval(loadMonitors, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleActive = async (mon) => {
    setActionId(mon.id);
    try {
      await updateMonitor(mon.id, { isActive: !mon.isActive });
      await loadMonitors();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setActionId(null);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === "folder") {
        await deleteFolder(folderName);
        navigate("/monitors");
      } else if (deleteTarget.type === "monitor") {
        await deleteMonitor(deleteTarget.id);
        await loadMonitors();
        setDeleteTarget(null);
      }
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTrigger = async (id) => {
    setActionId(id);
    try {
      await triggerCheck(id);
      await loadMonitors();
    } catch (err) {
      alert("Check failed: " + err.message);
    } finally {
      setActionId(null);
    }
  };

  // Filter monitors belonging to this folder
  const folderMonitors = useMemo(() => {
    return monitors.filter((m) => {
      const f = (m.folder || "General").trim();
      return f.toLowerCase() === folderName.toLowerCase();
    });
  }, [monitors, folderName]);

  // Filter by search query
  const filteredMonitors = useMemo(() => {
    return folderMonitors.filter((m) => {
      const q = search.toLowerCase();
      return (
        m.name?.toLowerCase().includes(q) ||
        m.url?.toLowerCase().includes(q) ||
        m.method?.toLowerCase().includes(q)
      );
    });
  }, [folderMonitors, search]);

  // Folder stats
  const total = folderMonitors.length;
  const upCount = folderMonitors.filter((m) => m.isActive && m.currentStatus === "UP").length;
  const slowCount = folderMonitors.filter((m) => m.isActive && m.currentStatus === "SLOW").length;
  const downCount = folderMonitors.filter((m) => m.isActive && m.currentStatus === "DOWN").length;
  const pausedCount = folderMonitors.filter((m) => !m.isActive).length;

  const avgLatency = useMemo(() => {
    const latencies = folderMonitors
      .map((m) => m.lastResponseTime)
      .filter((t) => typeof t === "number");
    if (!latencies.length) return "-";
    return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) + "ms";
  }, [folderMonitors]);

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div>
        <Link
          to="/monitors"
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 mb-2.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Folders</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-950/60 border border-blue-800/80 rounded-lg text-blue-400">
              <Folder className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span>{folderName}</span>
                <span className="text-xs font-medium text-gray-400 px-2 py-0.5 bg-gray-800 rounded border border-gray-700">
                  Folder
                </span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Managing {total} API {total === 1 ? "monitor" : "monitors"} inside this folder
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadMonitors}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded text-xs"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() =>
                setDeleteTarget({
                  type: "folder",
                  name: folderName,
                  count: total,
                })
              }
              className="px-3 py-1.5 bg-gray-800 hover:bg-red-950/80 text-gray-300 hover:text-red-400 border border-gray-700 hover:border-red-800 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
              title={`Delete folder "${folderName}" and all its APIs`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Folder</span>
            </button>

            <Link
              to={`/monitors/new?folder=${encodeURIComponent(folderName)}`}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add API to this Folder</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Folder Health Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-3">
          <p className="text-[11px] text-gray-400 font-medium">Total Endpoints</p>
          <p className="text-lg font-bold text-white mt-1">{total}</p>
        </div>

        <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-3">
          <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>Operational (UP)</span>
          </p>
          <p className="text-lg font-bold text-emerald-400 mt-1">{upCount}</p>
        </div>

        <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-3">
          <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Slow (&gt;2000ms)</span>
          </p>
          <p className="text-lg font-bold text-amber-400 mt-1">{slowCount}</p>
        </div>

        <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-3">
          <p className="text-[11px] text-red-400 font-medium flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            <span>Failing (DOWN)</span>
          </p>
          <p className="text-lg font-bold text-red-400 mt-1">{downCount}</p>
        </div>

        <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-3">
          <p className="text-[11px] text-gray-400 font-medium">Avg Latency</p>
          <p className="text-lg font-bold text-white mt-1">{avgLatency}</p>
        </div>
      </div>

      {/* Search Bar inside this Folder */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder={`Search ${folderName} APIs by name, method, or URL...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Monitors Card Grid (Multiple Columns & Cards) */}
      {filteredMonitors.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-10 text-center text-xs text-gray-400 space-y-3">
          <Folder className="w-10 h-10 text-gray-600 mx-auto" />
          <p className="text-sm font-semibold text-white">
            {folderMonitors.length === 0
              ? `No APIs in folder "${folderName}" yet`
              : "No APIs match your search filter"}
          </p>
          <p className="text-gray-400 max-w-sm mx-auto">
            Add an API endpoint to start tracking uptime, latency, and status codes inside this folder.
          </p>
          <Link
            to={`/monitors/new?folder=${encodeURIComponent(folderName)}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add First API to {folderName}</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMonitors.map((mon) => {
            const isPaused = !mon.isActive;
            return (
              <div
                key={mon.id}
                className="bg-gray-800/90 border border-gray-700 hover:border-gray-600 rounded-lg p-4 flex flex-col justify-between transition-colors shadow-sm space-y-3"
              >
                {/* Card Top: Method, Name, Status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-900 border border-gray-700 text-gray-300">
                      {mon.method || "GET"}
                    </span>

                    {isPaused ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-700 text-gray-300">
                        PAUSED
                      </span>
                    ) : mon.currentStatus === "UP" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                        ● UP
                      </span>
                    ) : mon.currentStatus === "SLOW" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800/60">
                        ● SLOW
                      </span>
                    ) : mon.currentStatus === "DOWN" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800/60">
                        ● DOWN
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-700 text-gray-300">
                        PENDING
                      </span>
                    )}
                  </div>

                  <div>
                    <Link
                      to={`/monitors/${mon.id}`}
                      className="font-bold text-white text-sm hover:text-emerald-400 flex items-center gap-1.5 transition-colors line-clamp-1"
                      title={mon.name}
                    >
                      <span className="truncate">{mon.name}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
                    </Link>
                    <p
                      className="font-mono text-[11px] text-gray-400 truncate mt-1"
                      title={mon.url}
                    >
                      {mon.url}
                    </p>
                  </div>

                  {mon.authType && mon.authType !== "none" && (
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                      🔒 {mon.authType.toUpperCase()}
                    </span>
                  )}

                  {/* Redirect Chain Indicator */}
                  {mon.lastRedirectChain && mon.lastRedirectChain.length > 1 && (
                    <div className="p-1.5 bg-blue-950/40 border border-blue-800/60 rounded text-[11px] font-mono text-blue-300 flex items-center gap-1">
                      <span>🔀 {mon.lastRedirectChain.length - 1} Redirects</span>
                      <span className="text-gray-500 font-sans">➔</span>
                      <span className="truncate">
                        {mon.lastFinalUrl?.replace(/^https?:\/\//, "")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Middle: Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-gray-700/60 text-center text-xs">
                  <div className="p-1 bg-gray-900/50 rounded">
                    <p className="text-[10px] text-gray-500">Latency</p>
                    <p className="font-semibold text-gray-200 mt-0.5">
                      {mon.lastResponseTime !== undefined ? `${mon.lastResponseTime}ms` : "-"}
                    </p>
                  </div>
                  <div className="p-1 bg-gray-900/50 rounded">
                    <p className="text-[10px] text-gray-500">Interval</p>
                    <p className="font-semibold text-gray-200 mt-0.5">
                      {mon.intervalInSeconds || mon.interval}s
                    </p>
                  </div>
                  <div className="p-1 bg-gray-900/50 rounded">
                    <p className="text-[10px] text-gray-500">Uptime</p>
                    <p className="font-semibold text-emerald-400 mt-0.5">
                      {mon.uptimePercentage ?? 100}%
                    </p>
                  </div>
                </div>

                {/* Card Bottom: Last Checked & Actions */}
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] text-gray-500 truncate">
                    Last check:{" "}
                    <span className="text-gray-400">
                      {mon.lastCheckedAt
                        ? new Date(mon.lastCheckedAt).toLocaleTimeString()
                        : "Pending"}
                    </span>
                  </p>

                  <div className="flex items-center justify-between gap-1.5">
                    <button
                      onClick={() => handleTrigger(mon.id)}
                      disabled={actionId === mon.id}
                      className="flex-1 py-1 px-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-medium disabled:opacity-50 transition-colors"
                    >
                      Check Now
                    </button>

                    <Link
                      to={`/monitors/${mon.id}/edit`}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded text-xs transition-colors"
                      title="Edit Monitor (Open Edit Page)"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      onClick={() => handleToggleActive(mon)}
                      disabled={actionId === mon.id}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded text-xs transition-colors"
                      title={mon.isActive ? "Pause Monitoring" : "Resume Monitoring"}
                    >
                      {mon.isActive ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </button>

                    <button
                      onClick={() =>
                        setDeleteTarget({
                          type: "monitor",
                          id: mon.id,
                          name: mon.name,
                        })
                      }
                      disabled={actionId === mon.id}
                      className="p-1.5 bg-gray-700 hover:bg-red-900/60 text-gray-300 hover:text-red-400 rounded text-xs transition-colors"
                      title="Delete Monitor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Actual Card Overlay Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={
          deleteTarget?.type === "folder"
            ? `Delete Folder: ${deleteTarget?.name}`
            : `Delete Monitor: ${deleteTarget?.name}`
        }
        message={
          deleteTarget?.type === "folder"
            ? `Are you sure you want to permanently delete the folder "${deleteTarget?.name}"?`
            : `Are you sure you want to delete the API monitor "${deleteTarget?.name}"?`
        }
        warning={
          deleteTarget?.type === "folder" && deleteTarget?.count > 0
            ? `WARNING: All ${deleteTarget.count} API monitors inside this folder will also be permanently deleted!`
            : deleteTarget?.type === "monitor"
            ? "All recorded uptime checks, latency history, and incidents for this API will be removed."
            : null
        }
        loading={isDeleting}
        onConfirm={handleExecuteDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
