import type { MarketEntrySwot } from "./types";

/**
 * Display-only 2×2 SWOT grid for the Market Entry section.
 *
 * Normalizes each quadrant to a string[] (coercing missing/non-array values to
 * []) and renders the four colored quadrants in the live order
 * (Strengths, Opportunities, Weaknesses, Threats). The container resolves the
 * `displayData.swotAnalysis || editSwotAnalysis` fallback and passes the result
 * here; this component only normalizes + renders what it receives.
 */
export default function MarketEntrySwotGrid({ swot }: { swot?: MarketEntrySwot }) {
  const strengths = Array.isArray(swot?.strengths) ? swot.strengths : [];
  const weaknesses = Array.isArray(swot?.weaknesses) ? swot.weaknesses : [];
  const opportunities = Array.isArray(swot?.opportunities) ? swot.opportunities : [];
  const threats = Array.isArray(swot?.threats) ? swot.threats : [];

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="bg-green-50 p-2 rounded border">
        <div className="font-semibold text-green-700">Strengths</div>
        {strengths.length > 0 ? (
          strengths.map((strength, index) => (
            <div key={index} className="text-green-600">
              • {strength}
            </div>
          ))
        ) : (
          <div className="text-gray-400 text-xs italic">No data available</div>
        )}
      </div>
      <div className="bg-blue-50 p-2 rounded border">
        <div className="font-semibold text-blue-700">Opportunities</div>
        {opportunities.length > 0 ? (
          opportunities.map((opportunity, index) => (
            <div key={index} className="text-blue-600">
              • {opportunity}
            </div>
          ))
        ) : (
          <div className="text-gray-400 text-xs italic">No data available</div>
        )}
      </div>
      <div className="bg-orange-50 p-2 rounded border">
        <div className="font-semibold text-orange-700">Weaknesses</div>
        {weaknesses.length > 0 ? (
          weaknesses.map((weakness, index) => (
            <div key={index} className="text-orange-600">
              • {weakness}
            </div>
          ))
        ) : (
          <div className="text-gray-400 text-xs italic">No data available</div>
        )}
      </div>
      <div className="bg-red-50 p-2 rounded border">
        <div className="font-semibold text-red-700">Threats</div>
        {threats.length > 0 ? (
          threats.map((threat, index) => (
            <div key={index} className="text-red-600">
              • {threat}
            </div>
          ))
        ) : (
          <div className="text-gray-400 text-xs italic">No data available</div>
        )}
      </div>
    </div>
  );
}
