import type { MarketEntryResult } from "./types";

interface MarketEntryKpiCardsProps {
  recommendedChannel?: MarketEntryResult["recommendedChannel"];
  timeToMarket?: string | null;
  topBarrier?: string | null;
}

/**
 * Display-only three-KPI summary row for the Market Entry section
 * (Top Entry Channel, Time to Market, Top Barrier).
 *
 * `recommendedChannel` may arrive as a string OR an object (the backend union
 * tolerated by `MarketEntryResultSchema`). The object-vs-string render logic is
 * kept here verbatim: an object with a `.channel` key renders that value, an
 * object without one falls back to `JSON.stringify`, and a string (or empty)
 * renders directly with an "N/A" fallback.
 */
export default function MarketEntryKpiCards({
  recommendedChannel,
  timeToMarket,
  topBarrier,
}: MarketEntryKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
        <div className="text-xs font-medium text-purple-700 mb-1">Top Entry Channel</div>
        <div className="text-sm font-semibold text-purple-900">
          {typeof recommendedChannel === "object" && recommendedChannel !== null
            ? (recommendedChannel.channel as string) || JSON.stringify(recommendedChannel)
            : recommendedChannel || "N/A"}
        </div>
      </div>
      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
        <div className="text-xs font-medium text-blue-700 mb-1">Time to Market</div>
        <div className="text-sm font-semibold text-blue-900">{timeToMarket}</div>
      </div>
      <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
        <div className="text-xs font-medium text-orange-700 mb-1">Top Barrier</div>
        <div className="text-sm font-semibold text-orange-900">{topBarrier}</div>
      </div>
    </div>
  );
}
