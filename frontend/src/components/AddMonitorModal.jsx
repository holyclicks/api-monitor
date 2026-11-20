import React, { useState, useEffect } from "react";
import { X, Sparkles, AlertCircle } from "lucide-react";
import { createMonitor, fetchMonitors } from "../services/monitorService.js";

export default function AddMonitorModal({ isOpen, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    method: "GET",
    interval: 10,
    intervalUnit: "s",
    timeout: 10000,
    slowThreshold: 2000,
    expectedStatusCodes: "200",
    headers: "",
    body: "",
    dependsOnMonitorId: "",
    authType: "none", // "none" | "bearer" | "basic" | "apiKey" | "cookie" | "login_request"
    authBearerToken: "",
    authBasicUser: "",
    authBasicPass: "",
    authApiKeyHeader: "X-API-Key",
    authApiKeyValue: "",
    authCookie: "",
    authLoginUrl: "",
    authLoginBody: "",
    redirectPolicy: "follow", // "follow" | "manual" | "disallow"
    assertionType: "not_contains", // "contains" | "not_contains"
    keywordAssertion: "",
  });

  const [availableMonitors, setAvailableMonitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchMonitors()
        .then(setAvailableMonitors)
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const applyPreset = (preset) => {
    setFormData((prev) => ({
      ...prev,
      name: preset.name,
      url: preset.url,
      method: preset.method,
      interval: preset.interval,
      authType: preset.authType || "none",
      authBearerToken: preset.authBearerToken || "",
      redirectPolicy: preset.redirectPolicy || "follow",
      assertionType: preset.assertionType || "not_contains",
      keywordAssertion: preset.keywordAssertion || "",
    }));
    setError("");
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

      await createMonitor({
        ...formData,
        interval: Number(formData.interval),
        timeout: Number(formData.timeout),
        slowThreshold: Number(formData.slowThreshold),
        expectedStatusCodes: expectedCodes.length > 0 ? expectedCodes : [200],
      });

      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create monitor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-xl w-full p-6 text-gray-200">
        <div className="flex items-center justify-between pb-3 border-b border-gray-700">
          <h2 className="text-base font-bold text-white">Add New API Monitor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="mt-3">
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium mb-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quick 1-Click Test Presets:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-xs bg-gray-900 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-1 rounded"
              >
                {p.label}
              </button>
            ))}
          </div>
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
              placeholder="e.g. Products API"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
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
                placeholder="https://api.example.com/v1/health"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Check Interval (sec)
              </label>
              <input
                type="number"
                min="3"
                max="86400"
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
              <p className="text-[10px] text-gray-400 mt-1">
                Tip: If an endpoint redirects to a sign-in page without a token (like Google Drive), choose &quot;Stop on Redirect&quot; or &quot;Disallow Redirects&quot; to prevent false 200 OKs.
              </p>
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

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Upstream Dependency (Optional)
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
              {loading ? "Saving & Monitoring..." : "Save Monitor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
