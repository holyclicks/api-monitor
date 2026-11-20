import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle, Clock, ExternalLink, RefreshCw, GitCommit } from "lucide-react";
import { fetchIncidents } from "../services/monitorService.js";

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const loadIncidents = async () => {
    try {
      const data = await fetchIncidents();
      setIncidents(data);
    } catch (err) {
      console.error("Failed to load incidents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 4000);
    return () => clearInterval(interval);
  }, []);

  const filtered = incidents.filter((inc) => {
    if (filter === "OPEN") return inc.status === "OPEN";
    if (filter === "RESOLVED") return inc.status === "RESOLVED";
    return true;
  });

  const openCount = incidents.filter((i) => i.status === "OPEN").length;
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>Incident Log & Outage History</span>
          </h1>
          <p className="text-xs text-gray-400">
            Detected service failures, root cause reasons, downtime duration, and recovery tracking
          </p>
        </div>

        <button
          onClick={loadIncidents}
          className="p-1.5 self-start sm:self-auto bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded text-xs"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setFilter("ALL")}
          className={`px-3 py-1.5 rounded font-medium ${
            filter === "ALL" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          All ({incidents.length})
        </button>
        <button
          onClick={() => setFilter("OPEN")}
          className={`px-3 py-1.5 rounded font-medium ${
            filter === "OPEN" ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          Active Incidents ({openCount})
        </button>
        <button
          onClick={() => setFilter("RESOLVED")}
          className={`px-3 py-1.5 rounded font-medium ${
            filter === "RESOLVED" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          Resolved ({resolvedCount})
        </button>
      </div>

      {/* Incidents List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center text-xs text-gray-400">
            No {filter !== "ALL" ? filter.toLowerCase() : ""} incidents on record.
          </div>
        ) : (
          filtered.map((inc) => (
            <div
              key={inc.id}
              className={`bg-gray-800 border rounded-lg p-4 text-xs transition-colors ${
                inc.status === "OPEN" ? "border-red-600/50 bg-red-950/10" : "border-gray-700"
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-gray-700/60">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      inc.status === "OPEN"
                        ? "bg-red-950 text-red-400 border border-red-800"
                        : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    }`}
                  >
                    {inc.status}
                  </span>
                  <span className="font-bold text-white text-sm">{inc.monitorName}</span>
                  <Link
                    to={`/monitors/${inc.monitorId}`}
                    className="text-gray-400 hover:text-emerald-400"
                    title="View Monitor"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {inc.durationSeconds && (
                  <span className="text-amber-400 font-mono font-semibold text-[11px] bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                    Downtime: {inc.durationSeconds} seconds
                  </span>
                )}
              </div>

              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-gray-400">Root Cause / Error:</span>
                  <p className="font-mono text-gray-200 mt-0.5">{inc.reason}</p>
                </div>

                <div className="space-y-0.5 sm:text-right text-gray-400">
                  <div>
                    Outage Started: <span className="text-gray-200">{new Date(inc.startedAt).toLocaleString()}</span>
                  </div>
                  {inc.resolvedAt && (
                    <div>
                      Recovered: <span className="text-emerald-400">{new Date(inc.resolvedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
