import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  FileText,
  Download,
  Printer,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Radio,
  ExternalLink,
  Search,
  Folder,
  Sparkles,
  Eye,
  RefreshCw,
  Archive,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import StatusCard from "../components/StatusCard.jsx";
import ResponseChart from "../components/ResponseChart.jsx";
import {
  fetchReports,
  fetchMonitors,
  generateTodaySummary,
  fetchPastReports,
  downloadReportPdf,
} from "../services/monitorService.js";

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMonitorId = searchParams.get("monitorId") || "";
  const initialTab = searchParams.get("tab") === "past" ? "past" : "today";

  // Tab navigation: "today" (default) or "past"
  const [activeTab, setActiveTab] = useState(initialTab);

  // Monitors state
  const [monitors, setMonitors] = useState([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState(initialMonitorId);

  // Today's report state
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Generating Today's Summary state
  const [isGeneratingToday, setIsGeneratingToday] = useState(false);
  const [todaySuccessMessage, setTodaySuccessMessage] = useState(null);

  // Past Data state
  const [pastDates, setPastDates] = useState([]);
  const [selectedPastDate, setSelectedPastDate] = useState(searchParams.get("date") || "");
  const [formattedPastDate, setFormattedPastDate] = useState("");
  const [pastReports, setPastReports] = useState([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [pastSearchQuery, setPastSearchQuery] = useState("");

  // Load monitors list
  useEffect(() => {
    fetchMonitors()
      .then((list) => {
        setMonitors(list);
        if (!selectedMonitorId && list.length > 0) {
          const firstId = list[0].id;
          setSelectedMonitorId(firstId);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (!next.get("monitorId")) next.set("monitorId", firstId);
            return next;
          });
        }
      })
      .catch((err) => console.error("Failed to load monitors:", err));
  }, []);

  // Sync selectedMonitorId if URL searchParam changes
  useEffect(() => {
    const paramId = searchParams.get("monitorId");
    if (paramId && paramId !== selectedMonitorId) {
      setSelectedMonitorId(paramId);
    }
    const tabParam = searchParams.get("tab");
    if (tabParam === "past" && activeTab !== "past") {
      setActiveTab("past");
    } else if (tabParam === "today" && activeTab !== "today") {
      setActiveTab("today");
    }
  }, [searchParams]);

  // Load Today report data for the selected monitor
  const loadTodayReportData = async () => {
    if (!selectedMonitorId && monitors.length === 0) return;
    setLoading(true);
    try {
      const data = await fetchReports("today", null, selectedMonitorId || undefined);
      setReport(data);
    } catch (err) {
      console.error("Failed to load today report data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "today" && selectedMonitorId) {
      loadTodayReportData();
    }
  }, [selectedMonitorId, activeTab]);

  // Load Past Reports data
  const loadPastData = async (dateToLoad = selectedPastDate) => {
    setLoadingPast(true);
    try {
      const data = await fetchPastReports(dateToLoad || undefined);
      if (data.availableDates) {
        setPastDates(data.availableDates);
      }
      setSelectedPastDate(data.selectedDate || dateToLoad || "");
      setFormattedPastDate(data.formattedSelectedDate || data.selectedDate || "");
      setPastReports(data.reports || []);
    } catch (err) {
      console.error("Failed to load past reports:", err);
    } finally {
      setLoadingPast(false);
    }
  };

  useEffect(() => {
    if (activeTab === "past") {
      loadPastData(selectedPastDate);
    }
  }, [activeTab, selectedPastDate]);

  // Tab switcher
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  // Select Monitor in Today tab
  const handleSelectMonitor = (e) => {
    const id = e.target.value;
    setSelectedMonitorId(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("monitorId", id);
      return next;
    });
  };

  // Select Date in Past Data tab
  const handleSelectPastDate = (date) => {
    setSelectedPastDate(date);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "past");
      next.set("date", date);
      return next;
    });
    loadPastData(date);
  };

  // Trigger Generate Today's Summary
  const handleGenerateTodaySummary = async () => {
    setIsGeneratingToday(true);
    setTodaySuccessMessage(null);
    try {
      const result = await generateTodaySummary();
      if (result.success) {
        setTodaySuccessMessage(
          `Today's summary reports generated successfully for ${result.generatedCount} API(s)!`
        );
        // Reload today's report data
        await loadTodayReportData();
        // Clear success message after 5 seconds
        setTimeout(() => setTodaySuccessMessage(null), 5000);
      } else {
        alert(result.message || "Could not generate today's summary.");
      }
    } catch (err) {
      console.error("Error generating today summary:", err);
      alert(err.message || "Failed to generate today's summary.");
    } finally {
      setIsGeneratingToday(false);
    }
  };

  // View or Download PDF with authentication
  const handlePdfAction = async (reportId, fileName = "report.pdf", isView = false) => {
    try {
      await downloadReportPdf(reportId, fileName, isView);
    } catch (err) {
      console.error("Failed to load PDF:", err);
      alert(err.message || "Failed to load PDF report.");
    }
  };

  // Currently selected monitor object for Today tab
  const currentMonitor = useMemo(() => {
    if (report?.selectedMonitor) return report.selectedMonitor;
    return monitors.find((m) => m.id === selectedMonitorId) || monitors[0] || null;
  }, [report, monitors, selectedMonitorId]);

  // Export CSV for this individual API
  const handleExportCSV = () => {
    if (!currentMonitor) return;
    const checks = report?.checks || [];
    const summary = report?.summary || {};

    const csvLines = [
      `"APIWatch Individual Performance Report"`,
      `"API Name","${currentMonitor.name}"`,
      `"Target URL","${currentMonitor.url}"`,
      `"HTTP Method","${currentMonitor.method || "GET"}"`,
      `"Folder","${currentMonitor.folder || "General"}"`,
      `"Report Timeframe","TODAY"`,
      `"Generated At","${new Date().toISOString()}"`,
      `"Period Uptime","${summary.uptimePercentage ?? 100}%"`,
      `"Total Recorded Checks","${summary.totalChecks ?? checks.length}"`,
      `"Successful Checks","${summary.successfulChecks ?? 0}"`,
      `"Failed Checks","${summary.failedChecks ?? 0}"`,
      `"Average Latency (ms)","${summary.avgLatency ?? 0}"`,
      `"Min Latency (ms)","${summary.minLatency ?? 0}"`,
      `"Max Latency (ms)","${summary.maxLatency ?? 0}"`,
      `"Total Outages","${summary.totalIncidents ?? 0}"`,
      `"Total Downtime (s)","${summary.totalDowntimeSeconds ?? 0}"`,
      `"MTTR (s)","${summary.mttrSeconds ?? 0}"`,
      "",
      `"--- ALL RECORDED HEALTH CHECKS ---"`,
      `"Timestamp","Checked At","Status","HTTP Code","Latency (ms)","Check Count","Redirect Count","Final URL","Error / Details"`,
    ];

    checks.forEach((c) => {
      csvLines.push(
        [
          `"${c.checkedAt}"`,
          `"${new Date(c.checkedAt).toLocaleString()}"`,
          `"${c.status}"`,
          `"${c.statusCode || "N/A"}"`,
          c.responseTime ?? 0,
          c.checkCount || 1,
          c.redirectCount || (c.redirectChain ? c.redirectChain.length - 1 : 0),
          `"${c.finalUrl || currentMonitor.url}"`,
          `"${(c.error || "OK").replace(/"/g, '""')}"`,
        ].join(",")
      );
    });

    const csvContent = csvLines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (currentMonitor.name || "api").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.download = `apiwatch-report-${safeName}-today-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export JSON for this individual API
  const handleExportJSON = () => {
    if (!report) return;
    const payload = {
      api: currentMonitor,
      timeframe: "today",
      generatedAt: new Date().toISOString(),
      summary: report.summary,
      checks: report.checks || [],
      incidents: report.incidents || [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (currentMonitor?.name || "api").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.download = `apiwatch-report-${safeName}-today.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter checks list by search query (Today tab)
  const allChecks = report?.checks || [];
  const filteredChecks = useMemo(() => {
    if (!searchQuery.trim()) return allChecks;
    const q = searchQuery.toLowerCase();
    return allChecks.filter((c) => {
      return (
        c.status?.toLowerCase().includes(q) ||
        String(c.statusCode).includes(q) ||
        c.error?.toLowerCase().includes(q) ||
        new Date(c.checkedAt).toLocaleString().toLowerCase().includes(q)
      );
    });
  }, [allChecks, searchQuery]);

  // Chart data for response latency over time (Today tab)
  const chartData = useMemo(() => {
    return [...allChecks]
      .reverse()
      .map((c) => ({
        time: new Date(c.checkedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        responseTime: c.responseTime,
        status: c.status,
      }));
  }, [allChecks]);

  // Filter past reports by search query (Past Data tab)
  const filteredPastReports = useMemo(() => {
    if (!pastSearchQuery.trim()) return pastReports;
    const q = pastSearchQuery.toLowerCase();
    return pastReports.filter((r) => {
      return (
        r.monitorName?.toLowerCase().includes(q) ||
        r.monitorUrl?.toLowerCase().includes(q) ||
        r.monitorFolder?.toLowerCase().includes(q) ||
        r.stats?.healthStatus?.toLowerCase().includes(q)
      );
    });
  }, [pastReports, pastSearchQuery]);

  const summary = report?.summary || {};
  const todayReportDoc = report?.todayReport;
  const todayReportId = currentMonitor && report?.date ? `${currentMonitor.id}_${report.date}` : null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <span>Reports</span>
          </h1>
          <p className="text-xs text-gray-400">
            Daily API health summaries, professional PDF audit reports, and historical past data
          </p>
        </div>

        {/* Navigation Tabs (Today vs Past Data) & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Two Tabs: Today & Past Data */}
          <div className="flex bg-gray-800 rounded p-0.5 border border-gray-700 text-xs">
            <button
              onClick={() => handleTabSwitch("today")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeTab === "today"
                  ? "bg-emerald-600 text-white font-semibold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleTabSwitch("past")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeTab === "past"
                  ? "bg-emerald-600 text-white font-semibold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Past Data
            </button>
          </div>

          {/* If on Today tab, show "Generate Today's Summary" button */}
          {activeTab === "today" && (
            <button
              onClick={handleGenerateTodaySummary}
              disabled={isGeneratingToday || monitors.length === 0}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1.5 font-semibold transition-all shadow-sm shadow-emerald-950"
              title="Generate one professional daily PDF report per monitored API for today"
            >
              {isGeneratingToday ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Generating Summary...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Generate Today's Summary</span>
                </>
              )}
            </button>
          )}

          {/* Export Actions (Today tab) */}
          {activeTab === "today" && (
            <>
              {/* CSV Export */}
              <button
                onClick={handleExportCSV}
                disabled={!currentMonitor}
                className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 hover:text-white rounded text-xs flex items-center gap-1.5 font-medium transition-colors disabled:opacity-50"
                title="Download Full CSV Report for this API"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>

              {/* JSON Export */}
              <button
                onClick={handleExportJSON}
                disabled={!currentMonitor}
                className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded text-xs flex items-center gap-1 font-medium transition-colors disabled:opacity-50"
                title="Download JSON Report"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>

              {/* Print Report */}
              <button
                onClick={() => window.print()}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded text-xs transition-colors"
                title="Print Report"
              >
                <Printer className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success Banner if Today's summary was generated */}
      {todaySuccessMessage && (
        <div className="bg-emerald-950/80 border border-emerald-600/60 rounded-lg p-3 text-xs text-emerald-200 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{todaySuccessMessage}</span>
          </div>
          {todayReportId && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePdfAction(todayReportId, `apiwatch-daily-${todayReportId}.pdf`, true)}
                className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded font-medium flex items-center gap-1 transition-colors"
              >
                <Eye className="w-3 h-3" />
                <span>View PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handlePdfAction(todayReportId, `apiwatch-daily-${todayReportId}.pdf`, false)}
                className="px-2.5 py-1 bg-emerald-900 hover:bg-emerald-800 text-emerald-100 rounded font-medium flex items-center gap-1 transition-colors"
              >
                <Download className="w-3 h-3" />
                <span>Download PDF</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION A: TODAY TAB (Keep existing design & functionality) */}
      {/* ======================================================== */}
      {activeTab === "today" && (
        <>
          {/* API Selector & Header Banner */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <span>Select API for Report:</span>
                </span>

                {monitors.length === 0 ? (
                  <span className="text-xs text-gray-400 italic">No APIs registered</span>
                ) : (
                  <select
                    value={selectedMonitorId}
                    onChange={handleSelectMonitor}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    {monitors.map((m) => (
                      <option key={m.id} value={m.id}>
                        [{m.folder || "General"}] {m.name} — {m.currentStatus || "PENDING"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {currentMonitor && (
                <div className="flex items-center gap-3">
                  {todayReportDoc && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePdfAction(todayReportDoc.id, `apiwatch-daily-${todayReportDoc.id}.pdf`, true)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium bg-gray-900 border border-gray-700 px-2.5 py-1 rounded transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        <span>View Daily PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePdfAction(todayReportDoc.id, `apiwatch-daily-${todayReportDoc.id}.pdf`, false)}
                        className="text-xs text-gray-300 hover:text-white flex items-center gap-1 font-medium bg-gray-900 border border-gray-700 px-2.5 py-1 rounded transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download PDF</span>
                      </button>
                    </div>
                  )}

                  <Link
                    to={`/monitors/${currentMonitor.id}`}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                  >
                    <span>Open Live Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>

            {currentMonitor && (
              <div className="pt-3 border-t border-gray-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-white">{currentMonitor.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-gray-900 border border-gray-700 text-gray-300">
                      {currentMonitor.method || "GET"}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-700/80 text-gray-300 border border-gray-600 flex items-center gap-1">
                      <Folder className="w-3 h-3 text-blue-400" />
                      <span>{currentMonitor.folder || "General"}</span>
                    </span>
                    {currentMonitor.currentStatus === "UP" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                        ● UP
                      </span>
                    ) : currentMonitor.currentStatus === "SLOW" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800/60">
                        ● SLOW
                      </span>
                    ) : currentMonitor.currentStatus === "DOWN" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800/60">
                        ● DOWN
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-700 text-gray-300">
                        PENDING
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-gray-400 text-[11px]">{currentMonitor.url}</p>
                </div>

                <div className="text-right text-[11px] text-gray-400">
                  <p>
                    Timeframe: <span className="font-semibold text-white">Today (Asia/Kolkata)</span>
                  </p>
                  <p className="mt-0.5">
                    Total Checks: <span className="font-semibold text-emerald-400">{allChecks.length}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {monitors.length === 0 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-10 text-center text-xs text-gray-400 space-y-3">
              <FileText className="w-10 h-10 text-gray-600 mx-auto" />
              <p className="text-sm font-semibold text-white">No Monitored APIs Yet</p>
              <p className="text-gray-400">Add an API to view its individual health reports and SLA records.</p>
              <Link
                to="/monitors/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-xs"
              >
                <span>Add API Monitor</span>
              </Link>
            </div>
          ) : (
            <>
              {/* SLA Performance Summary Cards for this API */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatusCard
                  title="Period Uptime"
                  value={`${summary.uptimePercentage ?? 100}%`}
                  subtitle={`${summary.successfulChecks ?? 0} / ${summary.totalChecks ?? 0} checks`}
                  color="green"
                  icon={CheckCircle}
                />
                <StatusCard
                  title="Average Latency"
                  value={`${summary.avgLatency ?? 0} ms`}
                  subtitle={`Min: ${summary.minLatency ?? 0}ms | Max: ${summary.maxLatency ?? 0}ms`}
                  color="blue"
                  icon={Clock}
                />
                <StatusCard
                  title="Total Outages"
                  value={summary.totalIncidents ?? 0}
                  subtitle={`Downtime: ${summary.totalDowntimeSeconds ?? 0}s`}
                  color={summary.totalIncidents > 0 ? "red" : "gray"}
                  icon={AlertTriangle}
                />
                <StatusCard
                  title="MTTR (Recovery Time)"
                  value={`${summary.mttrSeconds ?? 0}s`}
                  subtitle="Mean time to recovery"
                  color="yellow"
                  icon={Calendar}
                />
              </div>

              {/* Latency History Chart for this API */}
              {chartData.length > 0 && (
                <ResponseChart
                  data={chartData}
                  title={`Response Latency History (TODAY) for ${currentMonitor?.name || "API"}`}
                />
              )}

              {/* All Recorded Health Checks Table */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-700">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      All Recorded Health Checks ({summary.totalChecks ?? allChecks.length} Total Checks Represented)
                    </h3>
                    <p className="text-xs text-gray-400">
                      Full log of checks recorded for {currentMonitor?.name} today (Asia/Kolkata; latest 10 individual, older checks compacted)
                    </p>
                  </div>

                  {/* Filter search inside checks */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Filter checks by status or code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded pl-8 pr-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 w-56"
                    />
                  </div>
                </div>

                {filteredChecks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">
                    {allChecks.length === 0
                      ? `No checks recorded for this API today.`
                      : "No check records match your search filter."}
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-gray-900/90 sticky top-0 text-gray-400 uppercase text-[10px] border-b border-gray-700 z-10">
                        <tr>
                          <th className="py-2 px-3">Checked At</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">HTTP Code</th>
                          <th className="py-2 px-3">Latency</th>
                          <th className="py-2 px-3">Checks Count</th>
                          <th className="py-2 px-3">Redirects</th>
                          <th className="py-2 px-3">Details / Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/60 font-mono text-[11px]">
                        {filteredChecks.map((c) => (
                          <tr key={c.id || Math.random()} className="hover:bg-gray-750 transition-colors">
                            <td className="py-2 px-3 text-gray-400 whitespace-nowrap">
                              <div>{new Date(c.checkedAt).toLocaleString()}</div>
                              {c.firstCheckedAt && c.firstCheckedAt !== c.checkedAt && (
                                <div className="text-[9px] text-gray-500">From {new Date(c.firstCheckedAt).toLocaleTimeString()}</div>
                              )}
                            </td>

                            <td className="py-2 px-3 whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  c.status === "UP"
                                    ? "text-emerald-400 bg-emerald-950/80 border border-emerald-800/40"
                                    : c.status === "SLOW"
                                    ? "text-amber-400 bg-amber-950/80 border border-amber-800/40"
                                    : "text-red-400 bg-red-950/80 border border-red-800/40"
                                }`}
                              >
                                ● {c.status}
                              </span>
                            </td>

                            <td className="py-2 px-3 font-semibold text-white whitespace-nowrap">
                              {c.statusCode || "N/A"}
                            </td>

                            <td className="py-2 px-3 text-gray-200 whitespace-nowrap">
                              <span>{c.responseTime !== undefined ? `${c.responseTime} ms` : "-"}</span>
                              {c.checkCount > 1 && (
                                <span className="text-[10px] text-indigo-400 font-sans ml-1">(avg)</span>
                              )}
                            </td>

                            <td className="py-2 px-3 whitespace-nowrap">
                              {c.checkCount > 1 ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                                  Merged ({c.checkCount})
                                </span>
                              ) : (
                                <span className="text-gray-500 text-[10px]">1 check</span>
                              )}
                            </td>

                            <td className="py-2 px-3 whitespace-nowrap">
                              {c.redirectChain && c.redirectChain.length > 1 ? (
                                <span className="text-[10px] text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-900">
                                  🔀 {c.redirectChain.length - 1} hops ({c.redirectChain.map((h) => h.statusCode).join("➔")})
                                </span>
                              ) : (
                                <span className="text-gray-500 text-[10px]">Direct</span>
                              )}
                            </td>

                            <td className="py-2 px-3 text-gray-300 font-sans truncate max-w-md">
                              {c.error ? (
                                <span className="text-red-300">{c.error}</span>
                              ) : (
                                <span className="text-gray-500">Normal check</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Incident Log for this API */}
              {report?.incidents && report.incidents.length > 0 && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-white pb-2 border-b border-gray-700">
                    Incidents Recorded Today
                  </h3>
                  <div className="space-y-2">
                    {report.incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="p-3 bg-gray-900/60 rounded border border-gray-700 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                inc.status === "RESOLVED"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                                  : "bg-red-950 text-red-400 border border-red-800/60"
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
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* SECTION B: PAST DATA TAB (Historical daily reports section) */}
      {/* ======================================================== */}
      {activeTab === "past" && (
        <div className="space-y-4">
          {/* Historical Date Selector Header */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Archive className="w-4 h-4 text-emerald-400" />
                  <span>Historical Report Date:</span>
                </span>

                {pastDates.length > 0 ? (
                  <select
                    value={selectedPastDate}
                    onChange={(e) => handleSelectPastDate(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    {pastDates.map((dateStr) => (
                      <option key={dateStr} value={dateStr}>
                        {dateStr}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    value={selectedPastDate}
                    onChange={(e) => handleSelectPastDate(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                )}

                <button
                  onClick={() => loadPastData(selectedPastDate)}
                  disabled={loadingPast}
                  className="p-1.5 bg-gray-900 hover:bg-gray-700 border border-gray-700 rounded text-gray-300 transition-colors"
                  title="Refresh Reports"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingPast ? "animate-spin text-emerald-400" : ""}`} />
                </button>
              </div>

              {/* Search filter for past APIs */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter APIs for this date..."
                  value={pastSearchQuery}
                  onChange={(e) => setPastSearchQuery(e.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded pl-8 pr-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 w-56"
                />
              </div>
            </div>

            {/* Selected Date Summary Banner */}
            <div className="mt-3 pt-3 border-t border-gray-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span className="text-white font-semibold text-sm">
                  {formattedPastDate || selectedPastDate || "Historical Daily Archive"}
                </span>
                <span className="text-gray-400 text-[11px] font-mono">
                  ({selectedPastDate})
                </span>
              </div>
              <div className="text-gray-400 text-[11px]">
                Monitored APIs Archived:{" "}
                <span className="font-semibold text-emerald-400">{pastReports.length}</span>
              </div>
            </div>
          </div>

          {/* Past Reports List */}
          {loadingPast ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center text-xs text-gray-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
              <p className="text-white font-medium">Loading historical daily reports...</p>
            </div>
          ) : pastReports.length === 0 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-10 text-center text-xs text-gray-400 space-y-3">
              <Archive className="w-10 h-10 text-gray-600 mx-auto" />
              <p className="text-sm font-semibold text-white">No Historical Reports Found for {selectedPastDate || "this date"}</p>
              <p className="text-gray-400 max-w-md mx-auto">
                Daily reports are automatically archived every midnight in Asia/Kolkata timezone before raw check data is cleaned up.
                You can also generate today's summary using the button on the Today tab.
              </p>
              {pastDates.length > 0 && (
                <div className="pt-2">
                  <span className="text-gray-400 mr-2">Available past dates:</span>
                  <div className="inline-flex gap-1.5 flex-wrap justify-center mt-2">
                    {pastDates.map((d) => (
                      <button
                        key={d}
                        onClick={() => handleSelectPastDate(d)}
                        className="px-2.5 py-1 bg-gray-900 hover:bg-emerald-600 border border-gray-700 text-gray-300 hover:text-white rounded text-xs transition-colors"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Daily PDF Reports for {formattedPastDate || selectedPastDate}
                  </h3>
                  <p className="text-xs text-gray-400">
                    One separate, verified daily PDF report per monitored API for this calendar day
                  </p>
                </div>
                <div className="text-xs text-gray-400 font-mono">
                  {filteredPastReports.length} API(s)
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-gray-900/90 text-gray-400 uppercase text-[10px] border-b border-gray-700">
                    <tr>
                      <th className="py-2.5 px-3">API Name & URL</th>
                      <th className="py-2.5 px-3">Health Status</th>
                      <th className="py-2.5 px-3">Availability</th>
                      <th className="py-2.5 px-3">Avg Latency</th>
                      <th className="py-2.5 px-3">Total Checks</th>
                      <th className="py-2.5 px-3">Failed Checks</th>
                      <th className="py-2.5 px-3 text-right">PDF Report Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/60">
                    {filteredPastReports.map((r) => {
                      const stats = r.stats || {};
                      const status = stats.healthStatus || "UP";
                      return (
                        <tr key={r.id || r.reportId} className="hover:bg-gray-750 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{r.monitorName}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-gray-900 border border-gray-700 text-gray-400">
                                {r.monitorMethod || "GET"}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-gray-700/80 text-gray-300">
                                {r.monitorFolder || "General"}
                              </span>
                            </div>
                            <div className="font-mono text-gray-400 text-[11px] truncate max-w-sm mt-0.5">
                              {r.monitorUrl}
                            </div>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                status === "UP"
                                  ? "text-emerald-400 bg-emerald-950/80 border border-emerald-800/40"
                                  : status === "SLOW"
                                  ? "text-amber-400 bg-amber-950/80 border border-amber-800/40"
                                  : "text-red-400 bg-red-950/80 border border-red-800/40"
                              }`}
                            >
                              ● {status}
                            </span>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap font-mono font-semibold">
                            <span
                              className={
                                (stats.availabilityPercentage ?? 100) >= 99
                                  ? "text-emerald-400"
                                  : "text-red-400"
                              }
                            >
                              {stats.availabilityPercentage ?? 100}%
                            </span>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap font-mono text-gray-200">
                            {stats.avgLatency ?? 0} ms
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap font-mono text-gray-300">
                            {Number(stats.totalChecks ?? 0).toLocaleString()}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap font-mono">
                            <span
                              className={
                                (stats.failedChecks ?? 0) > 0 ? "text-red-400 font-bold" : "text-gray-400"
                              }
                            >
                              {stats.failedChecks ?? 0}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handlePdfAction(r.id, `apiwatch-daily-${r.id}.pdf`, true)}
                                className="px-2.5 py-1 bg-gray-900 hover:bg-emerald-600 border border-gray-700 hover:border-emerald-500 text-gray-200 hover:text-white rounded text-xs flex items-center gap-1 font-medium transition-colors"
                                title="View PDF report in new browser tab"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View PDF</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handlePdfAction(r.id, `apiwatch-daily-${r.id}.pdf`, false)}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs flex items-center gap-1 font-semibold transition-colors"
                                title="Download PDF report"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
