import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Folder,
  FolderPlus,
  PlusCircle,
  RefreshCw,
  Search,
  ArrowRight,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  fetchMonitors,
  fetchFolders,
  createFolder,
  deleteFolder,
} from "../services/monitorService.js";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal.jsx";

export default function Monitors() {
  const navigate = useNavigate();
  const [monitors, setMonitors] = useState([]);
  const [persistentFolders, setPersistentFolders] = useState(["General"]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New folder dialog
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const loadData = async () => {
    try {
      const [monData, foldersList] = await Promise.all([
        fetchMonitors(),
        fetchFolders().catch(() => ["General"]),
      ]);
      setMonitors(monData);
      setPersistentFolders(foldersList);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    try {
      await createFolder(trimmed);
      setPersistentFolders((prev) => Array.from(new Set([...prev, trimmed])));
      setNewFolderName("");
      setIsCreatingFolder(false);
      // Navigate straight to the newly created folder page
      navigate(`/monitors/folder/${encodeURIComponent(trimmed)}`);
    } catch (err) {
      alert("Failed to create folder: " + err.message);
    }
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    setIsDeleting(true);
    try {
      await deleteFolder(folderToDelete.name);
      setFolderToDelete(null);
      await loadData();
    } catch (err) {
      alert("Error deleting folder: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Extract all unique folders (combining persistent folders + monitors)
  const allFolderNames = useMemo(() => {
    const set = new Set(persistentFolders);
    set.add("General");
    monitors.forEach((m) => {
      const f = (m.folder || "General").trim();
      if (f) set.add(f);
    });
    return Array.from(set).sort((a, b) => {
      if (a === "General") return -1;
      if (b === "General") return 1;
      return a.localeCompare(b);
    });
  }, [persistentFolders, monitors]);

  // Group monitors by folder
  const folderData = useMemo(() => {
    const map = {};
    allFolderNames.forEach((name) => {
      map[name] = [];
    });

    monitors.forEach((m) => {
      const folderName = (m.folder || "General").trim() || "General";
      if (!map[folderName]) map[folderName] = [];
      map[folderName].push(m);
    });

    return map;
  }, [allFolderNames, monitors]);

  // Filter folders by search query (matches folder name OR any API name inside it)
  const filteredFolders = useMemo(() => {
    if (!search.trim()) return allFolderNames;
    const q = search.toLowerCase();
    return allFolderNames.filter((folderName) => {
      if (folderName.toLowerCase().includes(q)) return true;
      const apis = folderData[folderName] || [];
      return apis.some(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.url?.toLowerCase().includes(q)
      );
    });
  }, [allFolderNames, search, folderData]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Folder className="w-5 h-5 text-blue-400" />
            <span>API Folders</span>
          </h1>
          <p className="text-xs text-gray-400">
            Select a folder to view, monitor, and configure its API endpoints
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded text-xs"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsCreatingFolder(true)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
            <span>New Folder</span>
          </button>

          <Link
            to="/monitors/new"
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add API Monitor</span>
          </Link>
        </div>
      </div>

      {/* New Folder Modal / Inline Form */}
      {isCreatingFolder && (
        <form
          onSubmit={handleCreateFolder}
          className="p-4 bg-gray-800 border border-blue-600/60 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs shadow-lg"
        >
          <div className="flex items-center gap-2 shrink-0">
            <Folder className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-white">Create New Folder:</span>
          </div>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. Production APIs, Auth Services, Payments..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
            >
              Create Folder
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingFolder(false);
                setNewFolderName("");
              }}
              className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Search folders or APIs by name or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Multi-Column Folder Cards Grid */}
      {filteredFolders.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-10 text-center text-xs text-gray-400 space-y-3">
          <Folder className="w-10 h-10 text-gray-600 mx-auto" />
          <p className="text-sm font-semibold text-white">No folders found</p>
          <p className="text-gray-400">
            No folders match your search query &quot;{search}&quot;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredFolders.map((folderName) => {
            const apis = folderData[folderName] || [];
            const total = apis.length;
            const upCount = apis.filter((m) => m.isActive && m.currentStatus === "UP").length;
            const slowCount = apis.filter((m) => m.isActive && m.currentStatus === "SLOW").length;
            const downCount = apis.filter((m) => m.isActive && m.currentStatus === "DOWN").length;
            const pausedCount = apis.filter((m) => !m.isActive).length;

            // Calculate overall folder uptime %
            const avgUptime =
              total > 0
                ? Math.round(
                    apis.reduce((acc, m) => acc + (m.uptimePercentage ?? 100), 0) / total
                  )
                : 100;

            const isThisFolderDeleting = isDeleting && folderToDelete?.name === folderName;

            return (
              <div
                key={folderName}
                onClick={() => navigate(`/monitors/folder/${encodeURIComponent(folderName)}`)}
                className={`bg-gray-800/90 border border-gray-700 hover:border-blue-500/80 rounded-lg p-5 flex flex-col justify-between cursor-pointer group transition-all duration-150 hover:bg-gray-800 shadow-sm ${
                  isThisFolderDeleting ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                {/* Folder Card Top */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-blue-950/60 border border-blue-800/80 group-hover:border-blue-500 rounded-lg text-blue-400 transition-colors shrink-0">
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors truncate">
                          {folderName}
                        </h2>
                        <p className="text-[11px] text-gray-400">
                          {total} {total === 1 ? "API Monitor" : "API Monitors"}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-900 border border-gray-700 text-gray-300 shrink-0">
                      {avgUptime}% Uptime
                    </span>
                  </div>

                  {/* Status Metrics Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    {upCount > 0 && (
                      <span className="px-2 py-0.5 rounded font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                        ● {upCount} UP
                      </span>
                    )}

                    {slowCount > 0 && (
                      <span className="px-2 py-0.5 rounded font-bold bg-amber-950 text-amber-400 border border-amber-800/60">
                        ● {slowCount} SLOW
                      </span>
                    )}

                    {downCount > 0 && (
                      <span className="px-2 py-0.5 rounded font-bold bg-red-950 text-red-400 border border-red-800/60">
                        ● {downCount} DOWN
                      </span>
                    )}

                    {pausedCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded font-medium bg-gray-700 text-gray-300">
                        {pausedCount} Paused
                      </span>
                    )}

                    {total === 0 && (
                      <span className="text-gray-500 italic text-[11px]">Empty folder</span>
                    )}
                  </div>

                  {/* Preview of APIs inside folder */}
                  <div className="bg-gray-900/60 border border-gray-700/60 rounded-md p-2.5 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                      Endpoints Preview:
                    </p>
                    {total === 0 ? (
                      <p className="text-xs text-gray-500 italic">No APIs in this folder yet</p>
                    ) : (
                      apis.slice(0, 3).map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between text-xs text-gray-300 gap-2"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                !m.isActive
                                  ? "bg-gray-500"
                                  : m.currentStatus === "UP"
                                  ? "bg-emerald-400"
                                  : m.currentStatus === "SLOW"
                                  ? "bg-amber-400"
                                  : "bg-red-400"
                              }`}
                            />
                            <span className="truncate font-medium">{m.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-gray-500 shrink-0">
                            {m.method || "GET"}
                          </span>
                        </div>
                      ))
                    )}
                    {total > 3 && (
                      <p className="text-[10px] text-gray-500 pt-0.5">
                        +{total - 3} more endpoints...
                      </p>
                    )}
                  </div>
                </div>

                {/* Folder Card Footer */}
                <div className="flex items-center justify-between pt-4 mt-3 border-t border-gray-700/60 text-xs">
                  <span className="text-blue-400 font-medium group-hover:text-blue-300 flex items-center gap-1">
                    <span>Open Folder</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/monitors/new?folder=${encodeURIComponent(folderName)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 bg-gray-700 hover:bg-emerald-600 text-gray-200 hover:text-white rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                      title={`Add API directly into "${folderName}"`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add API</span>
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderToDelete({ name: folderName, count: total });
                      }}
                      className="p-1 bg-gray-700/60 hover:bg-red-900/60 text-gray-400 hover:text-red-400 rounded text-xs transition-colors"
                      title={`Delete folder "${folderName}" and all its APIs`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Quick "Create New Folder" Card */}
          <div
            onClick={() => setIsCreatingFolder(true)}
            className="bg-gray-900/40 border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer min-h-[220px] transition-colors group"
          >
            <div className="p-3 bg-gray-800 rounded-full text-gray-400 group-hover:text-white group-hover:bg-gray-700 mb-2 transition-colors">
              <FolderPlus className="w-6 h-6" />
            </div>
            <p className="font-semibold text-gray-300 group-hover:text-white text-sm">
              Create New Folder
            </p>
            <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
              Add a persistent folder to categorize and organize your APIs
            </p>
          </div>
        </div>
      )}

      {/* Actual Card Overlay Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!folderToDelete}
        title={`Delete Folder: ${folderToDelete?.name}`}
        message={`Are you sure you want to permanently delete the folder "${folderToDelete?.name}"?`}
        warning={
          folderToDelete?.count > 0
            ? `WARNING: All ${folderToDelete.count} API monitors inside this folder will also be permanently deleted!`
            : null
        }
        loading={isDeleting}
        onConfirm={handleConfirmDeleteFolder}
        onClose={() => setFolderToDelete(null)}
      />
    </div>
  );
}
