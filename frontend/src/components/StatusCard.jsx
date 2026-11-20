import React from "react";

export default function StatusCard({ title, value, subtitle, color = "gray", icon: Icon }) {
  const colorStyles = {
    green: "border-green-600/40 text-green-400 bg-green-950/20",
    red: "border-red-600/40 text-red-400 bg-red-950/20",
    yellow: "border-yellow-600/40 text-yellow-400 bg-yellow-950/20",
    blue: "border-blue-600/40 text-blue-400 bg-blue-950/20",
    gray: "border-gray-700 text-gray-300 bg-gray-800/40",
  };

  return (
    <div className={`p-4 rounded-lg border bg-gray-800/80 ${colorStyles[color] || colorStyles.gray}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">{title}</span>
        {Icon && <Icon className="w-4 h-4 opacity-70" />}
      </div>
      <div className="text-2xl font-bold tracking-tight text-white mt-1">{value}</div>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
