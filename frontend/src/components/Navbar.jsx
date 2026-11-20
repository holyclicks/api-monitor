import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Bell, LogOut, CheckCircle2, AlertCircle } from "lucide-react";
import { getCurrentUser, logoutUser, subscribeToAuthChanges } from "../services/auth.js";
import { getPlatformHealth } from "../services/monitorService.js";

export default function Navbar({ currentUser }) {
  const [user, setUser] = useState(currentUser || getCurrentUser());
  const [platformHealth, setPlatformHealth] = useState({ status: "CHECKING" });
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser !== undefined) {
      setUser(currentUser);
    } else {
      const unsub = subscribeToAuthChanges(setUser);
      return () => unsub();
    }
  }, [currentUser]);

  useEffect(() => {
    getPlatformHealth().then(setPlatformHealth).catch(() => setPlatformHealth({ status: "DOWN" }));
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  return (
    <header className="bg-gray-850 border-b border-gray-800 bg-gray-900 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to="/" className="flex items-center space-x-2 text-white font-bold text-lg tracking-tight">
            <span className="p-1.5 bg-emerald-600 rounded text-white flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </span>
            <span>API<span className="text-emerald-400">Watch</span></span>
          </Link>

        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/alerts"
            className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1 px-2.5 py-1 rounded border border-gray-800 hover:bg-gray-800"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Alerts Log</span>
          </Link>

          {user ? (
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-gray-300 font-medium px-2 py-1 bg-gray-800 rounded border border-gray-700">
                {user.email || user.name}
              </span>
              <button
                onClick={handleLogout}
                title="Logout"
                className="text-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-gray-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1.5 rounded"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
