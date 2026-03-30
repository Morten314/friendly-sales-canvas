import React from "react";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Users, BarChart3, Bot } from "lucide-react";
import { heatmapLeads, getReportComponentScores } from "./leadData";

// ─── Tier distribution from actual data ──────────────────────────────────────

const tierCounts = heatmapLeads.reduce(
  (acc, lead) => {
    if (lead.priority === "Tier 1") acc.tier1++;
    else if (lead.priority === "Tier 2") acc.tier2++;
    else acc.tier3++;
    return acc;
  },
  { tier1: 0, tier2: 0, tier3: 0 }
);

const tierData = [
  { name: "Tier 1", value: tierCounts.tier1, color: "hsl(var(--chart-1))" },
  { name: "Tier 2", value: tierCounts.tier2, color: "hsl(var(--chart-2))" },
  { name: "Tier 3", value: tierCounts.tier3, color: "hsl(var(--chart-3))" },
];
const totalLeads = heatmapLeads.length;

// ─── Report component scores from actual heatmap ratings ─────────────────────

const reportComponentData = getReportComponentScores();

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

// ─── Custom tooltip ─────────────────────────────────────────────────────────

const ReportTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">
        Score: <span className="font-semibold text-foreground">{d.totalScore}</span>
      </p>
      <div className="flex gap-3 text-[11px]">
        <span className="text-emerald-600">High: {d.high}</span>
        <span className="text-amber-600">Medium: {d.medium}</span>
        <span className="text-red-600">Low: {d.low}</span>
      </div>
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

interface OpportunityDashboardProps {
  onChatAboutCoverage?: () => void;
}

const OpportunityDashboard: React.FC<OpportunityDashboardProps> = ({ onChatAboutCoverage }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">Opportunity Dashboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Visual overview of your lead intelligence across all Scout report sections</p>
        </div>
        <button
          className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
          title="Chat with Scout about leads coverage"
          onClick={onChatAboutCoverage}
        >
          <Bot className="h-4 w-4 text-primary" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 1. Leads Coverage — Tier Breakdown */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Leads Coverage</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={tierData} cx="50%" cy="50%" innerRadius={22} outerRadius={36} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {tierData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="text-muted-foreground">Total Leads: <span className="font-semibold text-foreground">{totalLeads}</span></div>
              {tierData.map((t, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-muted-foreground">{t.name}: <span className="font-semibold text-foreground">{t.value}</span></span>
                </div>
              ))}
              <div className="mt-1 text-[11px] text-primary font-medium">
                {Math.round((tierData[0].value / totalLeads) * 100)}% are Tier 1 — focus your pipeline here
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Report Components — Ranked by Score */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Report Components by Lead Score</h3>
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />High(20)</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Med(12)</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Low(5)</span>
            </div>
          </div>
          <div className="h-[130px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportComponentData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <RechartsTooltip content={<ReportTooltip />} />
                <Bar dataKey="totalScore" radius={[0, 4, 4, 0]} barSize={14}>
                  {reportComponentData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OpportunityDashboard;
