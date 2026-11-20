import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Radio, PlusCircle, AlertTriangle, FileText, Settings } from "lucide-react";

export default function Sidebar({ onOpenAddModal }) {
  const location = useLocation();

  const navItems = [
    { label: "Overview", path: "/", icon: LayoutDashboard },
    { label: "Monitors", path: "/monitors", icon: Radio },
    { label: "Incidents", path: "/incidents", icon: AlertTriangle },
    { label: "Alert Log", path: "/alerts", icon: AlertTriangle },
    { label: "Reports", path: "/reports", icon: FileText },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Navigation
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Quick Action
          </p>
          <Link
            to="/monitors/new"
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Monitor</span>
          </Link>
        </div>
      </div>

      <div className="p-3 bg-gray-800/60 rounded-md border border-gray-800 text-[11px] text-gray-400">
        <p className="font-semibold text-gray-300">Background Engine</p>
        <p className="mt-1">Checks run automatically every 5s on due monitors.</p>
      </div>
    </aside>
  );
}
