import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function ResponseChart({ data, title = "Response Time History (ms)" }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center text-sm text-gray-400 py-12">
        No latency data recorded yet. Checks will populate this chart automatically.
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        <span className="text-xs text-gray-400">Last {data.length} checks</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} unit="ms" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                borderColor: "#374151",
                borderRadius: "6px",
                color: "#F3F4F6",
                fontSize: "12px",
              }}
            />
            <Line
              type="monotone"
              dataKey="responseTime"
              name="Latency"
              stroke="#10B981"
              strokeWidth={2}
              dot={{ r: 3, fill: "#10B981" }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
