import React, { useEffect, useState } from "react";
import {
  fetchPreferences,
  getPlatformHealth,
  fetchAnalytics,
} from "../services/monitorService.js";

export default function Settings() {

  const [platform, setPlatform] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  // Notification Preferences State
  const [prefs, setPrefs] = useState({
    alertEmail: "admin@example.com",
    sendOnDown: true,
    sendOnRecovery: true,
  });

  const loadData = async () => {
    try {
      const [plData, prData, anData] = await Promise.all([
        getPlatformHealth(),
        fetchPreferences(),
        fetchAnalytics(),
      ]);
      setPlatform(plData);
      if (prData) setPrefs(prData);
      setAnalytics(anData);
    } catch (err) {
      console.error("Settings load error:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);
  
  const alerts = analytics?.recentAlerts || [];

  return (
    <div className="space-y-6 text-xs text-gray-300">
      <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          {/* Dispatched Alerts Log */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-2 pb-2 border-b border-gray-700 flex items-center justify-between">
              <span>Dispatched Notification History</span>
              <span className="text-xs text-gray-400 font-normal">{alerts.length} logged</span>
            </h3>

            {alerts.length === 0 ? (
              <p className="text-center py-6 text-gray-400">
                No notifications logged yet. Trigger an outage or click &quot;Dispatch Test Email Alert&quot; to test.
              </p>
            ) : (
              <div className="space-y-2 mt-3">
                {alerts.map((al) => (
                  <div key={al.id} className="p-3 bg-gray-900/60 rounded border border-gray-700 font-mono text-[11px]">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            al.type === "DOWN" ? "bg-red-950 text-red-400" : "bg-emerald-950 text-emerald-400"
                          }`}
                        >
                          {al.type}
                        </span>
                        <span className="text-white font-bold">{al.subject}</span>
                      </div>
                      <span className="text-gray-400">{new Date(al.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <pre className="text-gray-300 mt-2 bg-gray-950 p-2 rounded whitespace-pre-wrap">
                      {al.text}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

    </div>
  );
}
