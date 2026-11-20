import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Sparkles, Folder, Plus, AlertCircle, Radio } from "lucide-react";
import { createMonitor, fetchMonitors, fetchFolders, createFolder } from "../services/monitorService.js";

export default function AddMonitorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFolder = searchParams.get("folder") || "General";

  const [formData, setFormData] = useState({
    name: "",
    url: "",
    method: "GET",
    folder: initialFolder,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMonitors()
      .then((list) => setAvailableMonitors(list))
      .catch(() => {});

    fetchFolders()
      .then((folders) => {
        setExistingFolders(folders);
      })
      .catch(() => {});
  }, []);

  const handleAddNewFolder = async () => {
    if (newFolderName.trim()) {
      const trimmed = newFolderName.trim();
      try {
        await createFolder(trimmed);
      } catch (err) {
        console.warn("Folder save notice:", err.message);
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
    setLoading(true);

    try {
      const expectedCodes = formData.expectedStatusCodes
        .split(",")
        .map((c) => parseInt(c.trim(), 10))
        .filter((c) => !isNaN(c));

      const created = await createMonitor({
        ...formData,
        folder: formData.folder.trim() || "General",
        interval: Number(formData.interval),
        timeout: Number(formData.timeout),
        slowThreshold: Number(formData.slowThreshold),
        expectedStatusCodes: expectedCodes.length > 0 ? expectedCodes : [200],
      });

      // Redirect immediately to the newly added monitor's dashboard!
      navigate(`/monitors/${created.id}`);
    } catch (err) {
      setError(err.message || "Failed to create monitor");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header & Back Link */}
      <div>
        <Link
          to="/monitors"
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Monitors</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-emerald-400" />
              <span>Add New API Monitor</span>
            </h1>
            <p className="text-xs text-gray-400">
              Register an endpoint, assign it to a folder, and APIWatch will automatically monitor it
            </p>
          </div>
        </div>
      </div>

      {/* Main Add Monitor Form */}
      <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-5 text-gray-200">
        {/* Section 1: Folder Organization */}
        <div className="p-4 bg-gray-900/60 rounded border border-gray-700/80 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <Folder className="w-4 h-4" />
              <span>Organize into Folder / Group *</span>
            </label>
            <button
              type="button"
              onClick={() => setIsCreatingNewFolder(!isCreatingNewFolder)}
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreatingNewFolder ? "Select Existing Folder" : "Create New Folder"}</span>
            </button>
          </div>

          {isCreatingNewFolder ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. Payment Gateways, Authentication Services..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddNewFolder}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
              >
                Set Folder
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={formData.folder}
                onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {existingFolders.map((f) => (
                  <option key={f} value={f}>
                    📁 {f}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-[11px] text-gray-400">
            Folders allow you to group related microservices, APIs, and websites together.
          </p>
        </div>

        {/* Section 2: General API Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              API Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. User Authentication Service"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Method
              </label>
              <select
                value={formData.method}
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                URL Endpoint *
              </label>
              <input
                type="url"
                required
                placeholder="https://api.example.com/v1/health"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Performance & Interval Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Check Interval (sec)
            </label>
            <input
              type="number"
              min="3"
              value={formData.interval}
              onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Timeout (ms)
            </label>
            <input
              type="number"
              min="1000"
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
              value={formData.slowThreshold}
              onChange={(e) => setFormData({ ...formData, slowThreshold: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">
            Expected Status Code(s) (comma separated)
          </label>
          <input
            type="text"
            placeholder="200, 201"
            value={formData.expectedStatusCodes}
            onChange={(e) => setFormData({ ...formData, expectedStatusCodes: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Section 4: Authentication Section */}
        <div className="p-4 bg-gray-900/80 rounded border border-gray-700/80 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-emerald-400">
              Authentication / Login (Optional)
            </label>
            <select
              value={formData.authType}
              onChange={(e) => setFormData({ ...formData, authType: e.target.value })}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white"
            >
              <option value="none">No Auth (Public)</option>
              <option value="bearer">Bearer Token (JWT / OAuth)</option>
              <option value="basic">Basic Auth (Username & Password)</option>
              <option value="apiKey">API Key / Custom Header</option>
              <option value="cookie">Session Cookie</option>
              <option value="login_request">Dynamic Login Pre-Flight</option>
            </select>
          </div>

          {formData.authType === "bearer" && (
            <div>
              <label className="block text-[11px] text-gray-300 mb-1">Bearer Token *</label>
              <input
                type="text"
                required
                placeholder="e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={formData.authBearerToken}
                onChange={(e) => setFormData({ ...formData, authBearerToken: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white"
              />
            </div>
          )}

          {formData.authType === "basic" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="admin"
                  value={formData.authBasicUser}
                  onChange={(e) => setFormData({ ...formData, authBasicUser: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={formData.authBasicPass}
                  onChange={(e) => setFormData({ ...formData, authBasicPass: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}

          {formData.authType === "apiKey" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Header Name *</label>
                <input
                  type="text"
                  required
                  placeholder="X-API-Key"
                  value={formData.authApiKeyHeader}
                  onChange={(e) => setFormData({ ...formData, authApiKeyHeader: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-300 mb-1">API Key Value *</label>
                <input
                  type="text"
                  required
                  placeholder="key_live_..."
                  value={formData.authApiKeyValue}
                  onChange={(e) => setFormData({ ...formData, authApiKeyValue: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}

          {formData.authType === "cookie" && (
            <div>
              <label className="block text-[11px] text-gray-300 mb-1">Session Cookie Value *</label>
              <input
                type="text"
                required
                placeholder="session_id=abc123xyz; Path=/"
                value={formData.authCookie}
                onChange={(e) => setFormData({ ...formData, authCookie: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white"
              />
            </div>
          )}

          {formData.authType === "login_request" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Login Auth URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://api.example.com/auth/login"
                  value={formData.authLoginUrl}
                  onChange={(e) => setFormData({ ...formData, authLoginUrl: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Login JSON Payload</label>
                <input
                  type="text"
                  placeholder='{"email": "admin@test.com", "password": "pass"}'
                  value={formData.authLoginBody}
                  onChange={(e) => setFormData({ ...formData, authLoginBody: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Redirects & Content Verification */}
        <div className="p-4 bg-gray-900/80 rounded border border-gray-700/80 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-emerald-400 mb-1">
              Redirect Handling
            </label>
            <select
              value={formData.redirectPolicy}
              onChange={(e) => setFormData({ ...formData, redirectPolicy: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-xs text-white"
            >
              <option value="follow">Follow Redirects (Standard)</option>
              <option value="manual">Stop on Redirect (Report 301/302 Redirect Codes)</option>
              <option value="disallow">Disallow Redirects (Fail if URL redirects)</option>
            </select>
          </div>

        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
          <Link
            to="/monitors"
            className="px-4 py-2 text-xs text-gray-300 hover:bg-gray-700 rounded border border-gray-600 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded disabled:opacity-50 transition-colors"
          >
            {loading ? "Registering & Pinging..." : "Save & Open Dashboard →"}
          </button>
        </div>
      </form>
    </div>
  );
}
