import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Radio,
  Folder,
  Plus,
  AlertCircle,
  Save,
  CheckCircle,
} from "lucide-react";
import {
  fetchMonitor,
  updateMonitor,
  fetchMonitors,
  fetchFolders,
  createFolder,
} from "../services/monitorService.js";

export default function EditMonitorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    url: "",
    method: "GET",
    folder: "General",
    interval: 10,
    intervalUnit: "s",
    timeout: 10000,
    slowThreshold: 2000,
    expectedStatusCodes: "200",
    headers: "",
    body: "",
    dependsOnMonitorId: "",
    authType: "none",
    authBearerToken: "",
    authBasicUser: "",
    authBasicPass: "",
    authApiKeyHeader: "X-API-Key",
    authApiKeyValue: "",
    authCookie: "",
    authLoginUrl: "",
    authLoginBody: "",
    redirectPolicy: "follow",
    assertionType: "not_contains",
    keywordAssertion: "",
  });

  const [availableMonitors, setAvailableMonitors] = useState([]);
  const [existingFolders, setExistingFolders] = useState(["General"]);
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [monData, allMonitors, foldersList] = await Promise.all([
          fetchMonitor(id),
          fetchMonitors(),
          fetchFolders().catch(() => ["General"]),
        ]);

        if (!monData) {
          setError("Monitor not found");
          return;
        }

        setAvailableMonitors(allMonitors.filter((m) => m.id !== id));

        const curFolder = (monData.folder || "General").trim();
        const combinedFolders = Array.from(new Set([...foldersList, curFolder, "General"]));
        setExistingFolders(combinedFolders);

        setFormData({
          name: monData.name || "",
          url: monData.url || "",
          method: monData.method || "GET",
          folder: curFolder,
          interval: monData.interval || monData.intervalInSeconds || 10,
          intervalUnit: monData.intervalUnit || "s",
          timeout: monData.timeout || 10000,
          slowThreshold: monData.slowThreshold || 2000,
          expectedStatusCodes: Array.isArray(monData.expectedStatusCodes)
            ? monData.expectedStatusCodes.join(", ")
            : monData.expectedStatusCodes || "200",
          headers:
            typeof monData.headers === "object" && monData.headers !== null
              ? JSON.stringify(monData.headers, null, 2)
              : monData.headers || "",
          body:
            typeof monData.body === "object" && monData.body !== null
              ? JSON.stringify(monData.body, null, 2)
              : monData.body || "",
          dependsOnMonitorId: monData.dependsOnMonitorId || "",
          authType: monData.authType || "none",
          authBearerToken: monData.authBearerToken || "",
          authBasicUser: monData.authBasicUser || "",
          authBasicPass: monData.authBasicPass || "",
          authApiKeyHeader: monData.authApiKeyHeader || "X-API-Key",
          authApiKeyValue: monData.authApiKeyValue || "",
          authCookie: monData.authCookie || "",
          authLoginUrl: monData.authLoginUrl || "",
          authLoginBody: monData.authLoginBody || "",
          redirectPolicy: monData.redirectPolicy || "follow",
          assertionType: monData.assertionType || "not_contains",
          keywordAssertion: monData.keywordAssertion || "",
        });
      } catch (err) {
        setError(err.message || "Failed to load monitor");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const handleAddNewFolder = async () => {
    if (newFolderName.trim()) {
      const trimmed = newFolderName.trim();
      try {
        await createFolder(trimmed);
      } catch {
        // ignore
      }
      if (!existingFolders.includes(trimmed)) {
        setExistingFolders([...existingFolders, trimmed]);
      }
      setFormData({ ...formData, folder: trimmed });
      setNewFolderName("");
      setIsCreatingNewFolder(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const expectedCodes = formData.expectedStatusCodes
        .split(",")
        .map((c) => parseInt(c.trim(), 10))
        .filter((c) => !isNaN(c));

      await updateMonitor(id, {
        ...formData,
        folder: formData.folder.trim() || "General",
        interval: Number(formData.interval),
        timeout: Number(formData.timeout),
        slowThreshold: Number(formData.slowThreshold),
        expectedStatusCodes: expectedCodes.length > 0 ? expectedCodes : [200],
      });

      // Redirect immediately to the updated monitor's dashboard!
      navigate(`/monitors/${id}`);
    } catch (err) {
      setError(err.message || "Failed to update monitor");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-gray-400">
        Loading API details for editing...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header & Back Link */}
      <div>
        <Link
          to={`/monitors/${id}`}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to API Dashboard</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-emerald-400" />
              <span>Edit API Monitor: {formData.name}</span>
            </h1>
            <p className="text-xs text-gray-400">
              Update configuration, authentication, redirect rules, or move to a different folder
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 rounded text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-5">
        {/* Basic Details */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
            1. Core Endpoint Settings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                API Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Folder / Organization Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-blue-400" />
                  <span>Folder / Category (Move API)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewFolder(!isCreatingNewFolder)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 underline"
                >
                  {isCreatingNewFolder ? "Select existing" : "+ Create new folder"}
                </button>
              </div>

              {isCreatingNewFolder ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New folder name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="flex-1 bg-gray-900 border border-blue-500 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddNewFolder}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium"
                  >
                    Set
                  </button>
                </div>
              ) : (
                <select
                  value={formData.folder}
                  onChange={(e) => {
                    if (e.target.value === "__NEW__") {
                      setIsCreatingNewFolder(true);
                    } else {
                      setFormData({ ...formData, folder: e.target.value });
                    }
                  }}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {existingFolders.map((f) => (
                    <option key={f} value={f}>
                      📁 {f}
                    </option>
                  ))}
                  <option value="__NEW__">+ Create & Move to New Folder...</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                HTTP Method
              </label>
              <select
                value={formData.method}
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Target Endpoint URL *
              </label>
              <input
                type="url"
                required
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Schedule & Thresholds */}
        <div className="space-y-4 pt-4 border-t border-gray-700">
          <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
            2. Check Interval & Performance Thresholds
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Check Interval
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="5"
                  required
                  value={formData.interval}
                  onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <select
                  value={formData.intervalUnit}
                  onChange={(e) => setFormData({ ...formData, intervalUnit: e.target.value })}
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
                >
                  <option value="s">Seconds</option>
                  <option value="m">Minutes</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Request Timeout (ms)
              </label>
              <input
                type="number"
                min="1000"
                max="60000"
                step="500"
                value={formData.timeout}
                onChange={(e) => setFormData({ ...formData, timeout: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Slow Threshold (ms)
              </label>
              <input
                type="number"
                min="100"
                max="10000"
                step="100"
                value={formData.slowThreshold}
                onChange={(e) => setFormData({ ...formData, slowThreshold: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Expected Status Codes (comma-separated)
            </label>
            <input
              type="text"
              value={formData.expectedStatusCodes}
              onChange={(e) => setFormData({ ...formData, expectedStatusCodes: e.target.value })}
              placeholder="e.g. 200, 201, 204"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        {/* Redirect Policy & Keyword Assertion */}
        <div className="space-y-4 pt-4 border-t border-gray-700">
          <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
            3. Redirects & Content Assertions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Redirect Policy
              </label>
              <select
                value={formData.redirectPolicy}
                onChange={(e) => setFormData({ ...formData, redirectPolicy: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="follow">Follow Redirects (Automatic)</option>
                <option value="manual">Catch Redirect as Down (Do not follow 3xx)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Keyword Assertion
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.assertionType}
                  onChange={(e) => setFormData({ ...formData, assertionType: e.target.value })}
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
                >
                  <option value="not_contains">Must NOT Contain</option>
                  <option value="contains">Must Contain</option>
                </select>
                <input
                  type="text"
                  placeholder="e.g. Sign in, Login, error"
                  value={formData.keywordAssertion}
                  onChange={(e) => setFormData({ ...formData, keywordAssertion: e.target.value })}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Authentication Options */}
        <div className="space-y-4 pt-4 border-t border-gray-700">
          <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
            4. Authentication & Credentials
          </h2>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Authentication Method
            </label>
            <select
              value={formData.authType}
              onChange={(e) => setFormData({ ...formData, authType: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="none">No Authentication (Public)</option>
              <option value="bearer">Bearer Token (JWT / OAuth)</option>
              <option value="basic">Basic Auth (Username & Password)</option>
              <option value="apikey">API Key Header</option>
              <option value="cookie">Session Cookie</option>
              <option value="login_flow">Automated Login Pre-flight Flow</option>
            </select>
          </div>

          {formData.authType === "bearer" && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Bearer Token
              </label>
              <input
                type="text"
                placeholder="ey..."
                value={formData.authBearerToken}
                onChange={(e) => setFormData({ ...formData, authBearerToken: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {formData.authType === "basic" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.authBasicUser}
                  onChange={(e) => setFormData({ ...formData, authBasicUser: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.authBasicPass}
                  onChange={(e) => setFormData({ ...formData, authBasicPass: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {formData.authType === "apikey" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Header Name
                </label>
                <input
                  type="text"
                  value={formData.authApiKeyHeader}
                  onChange={(e) => setFormData({ ...formData, authApiKeyHeader: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Key Value
                </label>
                <input
                  type="password"
                  value={formData.authApiKeyValue}
                  onChange={(e) => setFormData({ ...formData, authApiKeyValue: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>
          )}

          {formData.authType === "cookie" && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Cookie Header
              </label>
              <input
                type="text"
                placeholder="session_id=abc12345; auth_token=..."
                value={formData.authCookie}
                onChange={(e) => setFormData({ ...formData, authCookie: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}
        </div>

        {/* Custom Headers and Body */}
        <div className="space-y-4 pt-4 border-t border-gray-700">
          <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
            5. Headers & Payload
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Custom Headers (JSON format)
              </label>
              <textarea
                rows={3}
                placeholder='{ "X-Custom-Header": "value" }'
                value={formData.headers}
                onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Request Body (for POST/PUT)
              </label>
              <textarea
                rows={3}
                placeholder='{ "query": "status" }'
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="pt-5 border-t border-gray-700 flex items-center justify-between">
          <Link
            to={`/monitors/${id}`}
            className="text-xs text-gray-400 hover:text-white px-3 py-2 rounded transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-xs flex items-center gap-2 transition-colors disabled:opacity-50 shadow-md"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving Changes..." : "Save Changes & Open Dashboard"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
