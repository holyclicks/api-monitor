import { getAuthToken } from "./auth.js";

// Backend base URL. In production (frontend on Vercel, backend on Render)
// set VITE_API_URL, e.g. "https://apiwatch-backend.onrender.com/api".
// When unset (local dev) it falls back to "/api", which the Vite dev proxy
// forwards to http://localhost:5001.
export const API_BASE = import.meta.env.VITE_API_URL || "/api";

/**
 * Authenticated fetch helper.
 * Automatically injects the Firebase Authentication ID token in Authorization header.
 */
async function authFetch(url, options = {}) {
  const token = await getAuthToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  return res;
}

export async function fetchMonitors() {
  const res = await authFetch(`${API_BASE}/monitors`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch monitors");
  return data.monitors || [];
}

export async function fetchMonitor(id) {
  const res = await authFetch(`${API_BASE}/monitors/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch monitor details");
  return data.monitor;
}

export async function createMonitor(monitorData) {
  const res = await authFetch(`${API_BASE}/monitors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(monitorData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create monitor");
  return data.monitor;
}

export async function updateMonitor(id, updates) {
  const res = await authFetch(`${API_BASE}/monitors/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update monitor");
  return data.monitor;
}

export async function deleteMonitor(id) {
  const res = await authFetch(`${API_BASE}/monitors/${id}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete monitor");
  return data;
}

export async function triggerCheck(id) {
  const res = await authFetch(`${API_BASE}/monitors/${id}/check`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to trigger check");
  return data;
}

export async function fetchHistory(id, limit = 50) {
  const res = await authFetch(`${API_BASE}/monitors/${id}/history?limit=${limit}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch history");
  return data.history || [];
}

export async function fetchIncidents(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE}/incidents${query ? `?${query}` : ""}`;
  const res = await authFetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch incidents");
  return data.incidents || [];
}

export async function fetchAnalytics() {
  const res = await authFetch(`${API_BASE}/analytics`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch analytics");
  return data;
}

export async function fetchReports(timeframe = "today", userId, monitorId) {
  const params = new URLSearchParams({ timeframe });
  if (monitorId) params.append("monitorId", monitorId);
  const res = await authFetch(`${API_BASE}/reports?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch reports");
  return data.report;
}

export async function generateTodaySummary() {
  const res = await authFetch(`${API_BASE}/reports/generate-today`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to generate today's summary");
  return data;
}

export async function fetchPastReports(date) {
  const params = new URLSearchParams();
  if (date) params.append("date", date);
  const url = `${API_BASE}/reports/past${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await authFetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch past reports");
  return data;
}

export async function downloadReportPdf(reportId, fileName, isView = false) {
  const token = await getAuthToken();
  const url = `${API_BASE}/reports/${reportId}/${isView ? "pdf" : "download"}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch report PDF");
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  if (isView) {
    window.open(blobUrl, "_blank");
  } else {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || `APIWatch-${reportId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

export async function fetchPreferences() {
  const res = await authFetch(`${API_BASE}/preferences`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch preferences");
  return data.settings;
}

export async function updatePreferences(settings) {
  const res = await authFetch(`${API_BASE}/preferences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update preferences");
  return data.settings;
}

export async function sendTestAlert() {
  const res = await authFetch(`${API_BASE}/preferences/test-alert`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send test alert");
  return data;
}

export async function requestPasswordReset(email) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send password reset");
  return data;
}

export async function toggleTestTarget() {
  const res = await fetch(`${API_BASE}/test-target/toggle`, {
    method: "POST",
  });
  return res.json();
}

export async function getPlatformHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return await res.json();
  } catch {
    return { status: "OFFLINE" };
  }
}

export async function fetchFolders() {
  const res = await authFetch(`${API_BASE}/folders`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch folders");
  return data.folders || ["General"];
}

export async function createFolder(name) {
  const res = await authFetch(`${API_BASE}/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create folder");
  return data.folder;
}

export async function deleteFolder(folderName) {
  const res = await authFetch(`${API_BASE}/folders/${encodeURIComponent(folderName)}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete folder");
  return data;
}
