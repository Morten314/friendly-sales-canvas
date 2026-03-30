import React from "react";
import { Card } from "@/components/ui/card";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid,
} from "recharts";
import { Users, BarChart3, Bot } from "lucide-react";

// ─── Tier distribution data ─────────────────────────────────────────────────

const tierData = [
  { name: "Tier 1", value: 28, color: "hsl(var(--chart-1))" },
  { name: "Tier 2", value: 52, color: "hsl(var(--chart-2))" },
  { name: "Tier 3", value: 40, color: "hsl(var(--chart-3))" },
];
const totalLeads = tierData.reduce((s, d) => s + d.value, 0);

// ─── Report components scored by number of leads ────────────────────────────

const reportComponentData = [
  { name: "Market Size", leads: 98, color: "hsl(var(--chart-1))" },
  { name: "Industry Trends", leads: 84, color: "hsl(var(--chart-2))" },
  { name: "Competitor Landscape", leads: 76, color: "hsl(var(--chart-3))" },
  { name: "Market Entry & Growth", leads: 62, color: "hsl(var(--chart-4))" },
  { name: "Regulatory & Compliance", leads: 45, color: "hsl(var(--chart-5))" },
].sort((a, b) => b.leads - a.leads);

// ─── Custom tooltip ─────────────────────────────────────────────────────────

const ReportTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">{d.leads} leads scored</p>
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

        {/* 2. Report Components — Leads Scored */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Leads by Report Component</h3>
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
                  domain={[0, 120]}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <RechartsTooltip content={<ReportTooltip />} />
                <Bar dataKey="leads" radius={[0, 4, 4, 0]} barSize={14}>
                  {reportComponentData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
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
