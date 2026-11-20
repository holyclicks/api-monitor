import React, { useState, useEffect } from "react";
import { X, AlertCircle, Folder } from "lucide-react";
import { updateMonitor, fetchMonitors, fetchFolders } from "../services/monitorService.js";

export default function EditMonitorModal({ isOpen, onClose, monitor, onUpdated }) {
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    method: "GET",
    interval: 10,
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
    folder: "General",
  });

  const [availableMonitors, setAvailableMonitors] = useState([]);
  const [foldersList, setFoldersList] = useState(["General"]);
  const [isCustomFolder, setIsCustomFolder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (monitor) {
      setIsCustomFolder(false);
      setFormData({
        name: monitor.name || "",
        url: monitor.url || "",
        method: monitor.method || "GET",
        interval: monitor.intervalInSeconds || monitor.interval || 10,
        timeout: monitor.timeout || 10000,
        slowThreshold: monitor.slowThreshold || 2000,
        expectedStatusCodes: Array.isArray(monitor.expectedStatusCodes)
          ? monitor.expectedStatusCodes.join(", ")
          : monitor.expectedStatusCodes || "200",
        headers: typeof monitor.headers === "object" ? JSON.stringify(monitor.headers, null, 2) : monitor.headers || "",
        body: typeof monitor.body === "object" ? JSON.stringify(monitor.body, null, 2) : monitor.body || "",
        dependsOnMonitorId: monitor.dependsOnMonitorId || "",
        authType: monitor.authType || "none",
        authBearerToken: monitor.authBearerToken || "",
        authBasicUser: monitor.authBasicUser || "",
        authBasicPass: monitor.authBasicPass || "",
        authApiKeyHeader: monitor.authApiKeyHeader || "X-API-Key",
        authApiKeyValue: monitor.authApiKeyValue || "",
        authCookie: monitor.authCookie || "",
        authLoginUrl: monitor.authLoginUrl || "",
        authLoginBody: monitor.authLoginBody || "",
        redirectPolicy: monitor.redirectPolicy || "follow",
        assertionType: monitor.assertionType || "not_contains",
        keywordAssertion: monitor.keywordAssertion || "",
        folder: monitor.folder || "General",
      });

      fetchMonitors()
        .then((list) => setAvailableMonitors(list.filter((m) => m.id !== monitor.id)))
        .catch(() => {});

      fetchFolders()
        .then((list) => {
          const current = (monitor.folder || "General").trim();
          const combined = Array.from(new Set([...list, current, "General"]));
          setFoldersList(combined);
        })
        .catch(() => {});
    }
  }, [monitor]);

  if (!isOpen || !monitor) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const expectedCodes = formData.expectedStatusCodes
        .split(",")
        .map((c) => parseInt(c.trim(), 10))
        .filter((c) => !isNaN(c));

      await updateMonitor(monitor.id, {
        name: formData.name.trim(),
        url: formData.url.trim(),
        method: formData.method,
        interval: Number(formData.interval),
        timeout: Number(formData.timeout),
        slowThreshold: Number(formData.slowThreshold),
        expectedStatusCodes: expectedCodes.length > 0 ? expectedCodes : [200],
        headers: formData.headers ? formData.headers : {},
        body: formData.body ? formData.body : null,
        dependsOnMonitorId: formData.dependsOnMonitorId || null,
        authType: formData.authType,
        authBearerToken: formData.authBearerToken,
        authBasicUser: formData.authBasicUser,
        authBasicPass: formData.authBasicPass,
        authApiKeyHeader: formData.authApiKeyHeader,
        authApiKeyValue: formData.authApiKeyValue,
        authCookie: formData.authCookie,
        authLoginUrl: formData.authLoginUrl,
        authLoginBody: formData.authLoginBody,
        redirectPolicy: formData.redirectPolicy,
        assertionType: formData.assertionType,
        keywordAssertion: formData.keywordAssertion,
        folder: (formData.folder || "General").trim(),
      });

      onUpdated();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update monitor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-xl w-full p-6 text-gray-200">
        <div className="flex items-center justify-between pb-3 border-b border-gray-700">
          <h2 className="text-base font-bold text-white">Edit API Monitor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-red-950/60 border border-red-800 text-red-300 rounded text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              API Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Move to Folder Selection Section */}
          <div className="p-3 bg-gray-900/80 border border-gray-700 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5" />
                <span>Move API to Folder</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomFolder(!isCustomFolder)}
                className="text-[11px] text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                {isCustomFolder ? "← Select existing folder" : "+ Move to new folder"}
              </button>
            </div>

            {isCustomFolder ? (
              <div>
                <input
                  type="text"
                  placeholder="Type new folder name..."
                  value={formData.folder}
                  onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                  className="w-full bg-gray-900 border border-emerald-500 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                  autoFocus
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  This will create a new folder &quot;{formData.folder || "..."}&quot; and move this API into it upon saving.
                </p>
              </div>
            ) : (
              <div>
                <select
                  value={formData.folder}
                  onChange={(e) => {
                    if (e.target.value === "__NEW__") {
                      setIsCustomFolder(true);
                      setFormData({ ...formData, folder: "" });
                    } else {
                      setFormData({ ...formData, folder: e.target.value });
                    }
                  }}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {foldersList.map((f) => (
                    <option key={f} value={f}>
                      📁 {f} {f === (monitor.folder || "General") ? "(Current Folder)" : ""}
                    </option>
                  ))}
                  <option value="__NEW__">+ Create & Move to New Folder...</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  Change the selection above to move this API to a different folder.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Method
              </label>
              <select
                value={formData.method}
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                URL Endpoint *
              </label>
              <input
                type="url"
                required
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Interval (seconds)
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
              Expected Status Code(s)
            </label>
            <input
              type="text"
              value={formData.expectedStatusCodes}
              onChange={(e) => setFormData({ ...formData, expectedStatusCodes: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Authentication Section (If endpoint requires login) */}
          <div className="p-3 bg-gray-900/80 rounded border border-gray-700/80 space-y-2.5">
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
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
            )}

            {formData.authType === "basic" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-gray-300 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="admin"
                    value={formData.authBasicUser}
                    onChange={(e) => setFormData({ ...formData, authBasicUser: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-300 mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formData.authBasicPass}
                    onChange={(e) => setFormData({ ...formData, authBasicPass: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1 text-xs text-white"
                  />
                </div>
              </div>
            )}

            {formData.authType === "apiKey" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-gray-300 mb-1">Header Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="X-API-Key"
                    value={formData.authApiKeyHeader}
                    onChange={(e) => setFormData({ ...formData, authApiKeyHeader: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1 text-xs text-white"
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
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1 text-xs text-white"
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
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
            )}

            {formData.authType === "login_request" && (
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-gray-300 mb-1">Login Auth URL *</label>
                  <input
                    type="url"
                    required
                    placeholder="https://api.example.com/auth/login"
                    value={formData.authLoginUrl}
                    onChange={(e) => setFormData({ ...formData, authLoginUrl: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-300 mb-1">Login JSON Payload</label>
                  <input
                    type="text"
                    placeholder='{"email": "admin@test.com", "password": "pass"}'
                    value={formData.authLoginBody}
                    onChange={(e) => setFormData({ ...formData, authLoginBody: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1 text-xs font-mono text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Redirect Handling & Response Assertion */}
          <div className="p-3 bg-gray-900/80 rounded border border-gray-700/80 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-emerald-400 mb-1">
                Redirect Handling
              </label>
              <select
                value={formData.redirectPolicy}
                onChange={(e) => setFormData({ ...formData, redirectPolicy: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="follow">Follow Redirects (Standard)</option>
                <option value="manual">Stop on Redirect (Report 301/302 Redirect Codes)</option>
                <option value="disallow">Disallow Redirects (Fail if URL redirects to login or another domain)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-gray-800">
              <label className="block text-xs font-semibold text-emerald-400 mb-1">
                Response Content Validation (Optional)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <select
                    value={formData.assertionType}
                    onChange={(e) => setFormData({ ...formData, assertionType: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="contains">Body Must Contain</option>
                    <option value="not_contains">Body Must NOT Contain</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder='e.g. "drive" or "Sign in"'
                    value={formData.keywordAssertion}
                    onChange={(e) => setFormData({ ...formData, keywordAssertion: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Upstream Dependency (Phase 11 enhancement #3) */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              API Dependency (Optional)
            </label>
            <select
              value={formData.dependsOnMonitorId}
              onChange={(e) => setFormData({ ...formData, dependsOnMonitorId: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">None (Independent Service)</option>
              {availableMonitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.url})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 rounded border border-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded disabled:opacity-50"
            >
              {loading ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
