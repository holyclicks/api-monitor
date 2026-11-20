import React from "react";
import { ArrowRight, CornerDownRight, ExternalLink } from "lucide-react";

export default function RedirectChainView({ chain }) {
  if (!chain || chain.length <= 1) {
    return null;
  }

  const getCodeColor = (code) => {
    if (code >= 200 && code < 300) return "bg-emerald-950 text-emerald-400 border-emerald-800";
    if (code >= 300 && code < 400) return "bg-blue-950 text-blue-400 border-blue-800";
    if (code >= 400 && code < 500) return "bg-amber-950 text-amber-400 border-amber-800";
    return "bg-red-950 text-red-400 border-red-800";
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="p-1 bg-blue-950 text-blue-400 border border-blue-800 rounded text-xs font-bold font-mono">
            🔀
          </span>
          <h3 className="text-sm font-semibold text-white">
            Redirect Chain Traced ({chain.length - 1} {chain.length - 1 === 1 ? "Hop" : "Hops"})
          </h3>
        </div>
        <span className="text-xs font-mono text-gray-400">
          Total Hops: {chain.length}
        </span>
      </div>

      {/* Visual Sequence of Hops */}
      <div className="space-y-2">
        {chain.map((hop, idx) => {
          const isLast = idx === chain.length - 1;
          return (
            <div
              key={`hop-${hop.hop}-${idx}`}
              className="p-3 bg-gray-900/80 rounded border border-gray-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                <span className="text-gray-500 font-mono text-[11px] font-semibold">
                  #{hop.hop}
                </span>

                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${getCodeColor(
                    hop.statusCode
                  )}`}
                >
                  {hop.statusCode} {hop.statusText || ""}
                </span>

                <div className="truncate min-w-0">
                  <span className="font-mono text-gray-200 text-[11px] truncate block" title={hop.url}>
                    {hop.url}
                  </span>
                  {hop.targetUrl && (
                    <div className="flex items-center gap-1 text-[11px] text-blue-400 font-mono mt-0.5 truncate">
                      <CornerDownRight className="w-3 h-3 shrink-0" />
                      <span className="truncate" title={hop.targetUrl}>
                        Redirects to: {hop.targetUrl}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right font-mono text-[11px] text-gray-400">
                {hop.latency ? `${hop.latency} ms` : "-"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-2.5 bg-blue-950/30 border border-blue-900/50 rounded text-[11px] text-blue-300">
        ℹ️ <strong>Why this API is SLOW:</strong> Traversing multiple cross-domain redirects causes cumulative network round-trips. Each redirect hop adds latency before reaching the final destination.
      </div>
    </div>
  );
}
