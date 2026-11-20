import React, { useEffect, useState } from "react";
import {
  Bell,
  User,
  Shield,
  Database,
  Mail,
  Send,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  LogOut,
  Download,
} from "lucide-react";
import {
  fetchPreferences,
  updatePreferences,
  sendTestAlert,
  getPlatformHealth,
  fetchAnalytics,
} from "../services/monitorService.js";
import { getCurrentUser, logoutUser } from "../services/auth.js";

export default function Settings({ currentUser }) {
  const [activeTab, setActiveTab] = useState("profile");
  const [user, setUser] = useState(currentUser || getCurrentUser());
  const [platform, setPlatform] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  // Notification Preferences State
  const [prefs, setPrefs] = useState({
    alertEmail: currentUser?.email || "admin@example.com",
    sendOnDown: true,
    sendOnRecovery: true,
  });

  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
      setPrefs((prev) => ({
        ...prev,
        alertEmail: prev.alertEmail || currentUser.email,
      }));
    }
  }, [currentUser]);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [message, setMessage] = useState("");

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

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    setMessage("");
    try {
      const updated = await updatePreferences(prefs);
      setPrefs(updated);
      setMessage("Preferences saved successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Failed to save: " + err.message);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSendTestNotification = async () => {
    setMessage("");
    try {
      await sendTestAlert();
      setTestSent(true);
      setMessage("Test alert sent! Check the log below.");
      await loadData();
      setTimeout(() => setTestSent(false), 4000);
    } catch (err) {
      setMessage("Test failed: " + err.message);
    }
  };

  const handleExportData = () => {
    const data = {
      user,
      preferences: prefs,
      platform,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apiwatch-user-profile-${user.uid}.json`;
    a.click();
  };

  return (
    <div className="space-y-6 text-xs text-gray-300">
      <div className="flex items-center justify-between pb-3 border-b border-gray-800">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Settings & Preferences</span>
          </h1>
          <p className="text-xs text-gray-400">Configure profile, alert dispatches, and system credentials</p>
        </div>

        <button
          onClick={loadData}
          className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded text-xs"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Navigation Tabs (PDF page 28: Profile, Notifications, Account) */}
      <div className="flex border-b border-gray-800 space-x-4">
        {[
          { id: "profile", label: "Profile", icon: User },
          { id: "notifications", label: "Notifications", icon: Bell },
          { id: "account", label: "Account & System", icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 -mb-px ${
                isActive
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {message && (
        <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Tab 1: Profile */}
      {activeTab === "profile" && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-4 max-w-xl">
          <h2 className="text-sm font-bold text-white pb-2 border-b border-gray-700">
            User Profile Information
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">Display Name</label>
              <input
                type="text"
                disabled
                value={user?.name || "APIWatch User"}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">Account Email</label>
              <input
                type="text"
                disabled
                value={user?.email || "—"}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">User ID (Firebase Auth UID)</label>
              <input
                type="text"
                disabled
                value={user?.uid || "—"}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs font-mono text-gray-400"
              />
            </div>

            <div className="pt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                ● Authenticated & Active
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Notifications */}
      {activeTab === "notifications" && (
        <div className="space-y-5">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 max-w-xl">
            <h2 className="text-sm font-bold text-white pb-2 border-b border-gray-700 flex items-center justify-between">
              <span>Notification Preferences (Module 6)</span>
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-[11px] flex items-center gap-1 font-medium"
              >
                <Send className="w-3 h-3 text-emerald-400" />
                <span>Dispatch Test Email Alert</span>
              </button>
            </h2>

            <form onSubmit={handleSavePreferences} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Alert Recipient Email *
                </label>
                <input
                  type="email"
                  required
                  value={prefs.alertEmail}
                  onChange={(e) => setPrefs({ ...prefs, alertEmail: e.target.value })}
                  placeholder="alerts@yourdomain.com"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.sendOnDown}
                    onChange={(e) => setPrefs({ ...prefs, sendOnDown: e.target.checked })}
                    className="rounded bg-gray-900 border-gray-700 text-emerald-500 focus:ring-0"
                  />
                  <span className="text-xs text-gray-300">
                    Send alert email immediately when an API goes <strong>DOWN</strong>
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.sendOnRecovery}
                    onChange={(e) => setPrefs({ ...prefs, sendOnRecovery: e.target.checked })}
                    className="rounded bg-gray-900 border-gray-700 text-emerald-500 focus:ring-0"
                  />
                  <span className="text-xs text-gray-300">
                    Send notification email when a service <strong>RECOVERS</strong>
                  </span>
                </label>
              </div>

              <div className="pt-3 border-t border-gray-700 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPrefs}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-xs disabled:opacity-50"
                >
                  {savingPrefs ? "Saving..." : "Save Preferences"}
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* Tab 3: Account & System */}
      {activeTab === "account" && (
        <div className="space-y-4 max-w-xl">

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-bold text-white pb-2 border-b border-gray-700">
              Account Management
            </h2>

            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="font-semibold text-white">Export Account Configuration</p>
                <p className="text-[11px] text-gray-400">Download your settings and user profile data in JSON format</p>
              </div>
              <button
                onClick={handleExportData}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
            </div>

            <div className="pt-3 border-t border-gray-700 flex items-center justify-between">
              <div>
                <p className="font-semibold text-red-400">Sign Out</p>
                <p className="text-[11px] text-gray-400">End your current session on this machine</p>
              </div>
              <button
                onClick={async () => {
                  await logoutUser();
                  window.location.href = "/login";
                }}
                className="px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 rounded text-xs flex items-center gap-1.5 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
