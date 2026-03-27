import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { Users, Crosshair, DollarSign, Star, Mail, UserPlus, Bot } from "lucide-react";

// ─── Tier distribution data (from the 120-lead dataset) ──────────────────────

const tierData = [
  { name: "Tier 1", value: 28, color: "hsl(var(--chart-1))" },
  { name: "Tier 2", value: 52, color: "hsl(var(--chart-2))" },
  { name: "Tier 3", value: 40, color: "hsl(var(--chart-3))" },
];
const totalLeads = tierData.reduce((s, d) => s + d.value, 0);

// ─── Priority Quadrant data (Strategic Fit × Likelihood to Win) ──────────────

const quadrantLeads = [
  // Top-right: pursue now
  { name: "Sarah Chen", x: 85, y: 90 },
  { name: "James Okoro", x: 78, y: 85 },
  { name: "Amara Johnson", x: 92, y: 88 },
  { name: "Priya Sharma", x: 80, y: 82 },
  // Bottom-right: strategic but hard
  { name: "Marcus Liu", x: 75, y: 40 },
  { name: "Elena Vasquez", x: 82, y: 35 },
  { name: "Tobias Müller", x: 70, y: 30 },
  // Top-left: easier wins, lower value
  { name: "Lily Tran", x: 30, y: 78 },
  { name: "David Park", x: 25, y: 72 },
  { name: "Raj Patel", x: 35, y: 80 },
  // Bottom-left: deprioritise
  { name: "Kevin Lim", x: 20, y: 25 },
  { name: "Nadia Volkov", x: 30, y: 30 },
];

// ─── Pipeline Value by Tier ──────────────────────────────────────────────────

const pipelineByTier = [
  { tier: "Tier 1", value: 380000, color: "hsl(var(--chart-1))" },
  { tier: "Tier 2", value: 245000, color: "hsl(var(--chart-2))" },
  { tier: "Tier 3", value: 92000, color: "hsl(var(--chart-3))" },
];
const totalPipeline = pipelineByTier.reduce((s, d) => s + d.value, 0);

// ─── Top Opportunities (highest scoring leads) ──────────────────────────────

const topOpportunities = [
  { name: "Amara Johnson", company: "RevStack AI", score: 92, tier: "Tier 1" as const },
  { name: "Sarah Chen", company: "Acme Corp", score: 88, tier: "Tier 1" as const },
  { name: "James Okoro", company: "ScaleUp Inc", score: 84, tier: "Tier 1" as const },
];

// ─── Quadrant custom tooltip ─────────────────────────────────────────────────

const QuadrantTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">Strategic Fit: {d.x}</p>
      <p className="text-muted-foreground">Win Likelihood: {d.y}</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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

        {/* 2. Priority Quadrant — Strategic Fit × Likelihood to Win */}
        <Card className="p-4 col-span-1 md:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <Crosshair className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Priority Quadrant</h3>
          </div>
          <div className="h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 4, right: 4, bottom: 14, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  type="number" dataKey="x" domain={[0, 100]}
                  tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false} tickLine={false}
                  label={{ value: "Strategic Fit →", position: "insideBottom", offset: -8, fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  type="number" dataKey="y" domain={[0, 100]}
                  tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false} tickLine={false} width={20}
                  label={{ value: "Win ↑", position: "insideTop", offset: -4, fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                />
                <ReferenceLine x={50} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <ReferenceLine y={50} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <RechartsTooltip content={<QuadrantTooltip />} />
                <Scatter data={quadrantLeads} fill="hsl(var(--primary))" fillOpacity={0.7} r={4} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground mt-1 px-1">
            <span>↗ Top-right: Pursue now</span>
            <span>↙ Bottom-left: Deprioritise</span>
          </div>
        </Card>

        {/* 3. Pipeline Value by Tier */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Pipeline Value</h3>
          </div>
          <div className="space-y-2">
            <div className="text-lg font-bold text-foreground">${(totalPipeline / 1000).toFixed(0)}K</div>
            <div className="space-y-1.5">
              {pipelineByTier.map((seg, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                    <span className="text-muted-foreground">{seg.tier}</span>
                  </div>
                  <span className="font-semibold text-foreground">${(seg.value / 1000).toFixed(0)}K</span>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-primary font-medium mt-1">
              Tier 1 accounts for {Math.round((pipelineByTier[0].value / totalPipeline) * 100)}% of total value
            </div>
          </div>
        </Card>

        {/* 4. Top Opportunities — highest scored leads */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Top Opportunities</h3>
          </div>
          <div className="space-y-2.5">
            {topOpportunities.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground">{item.name}</div>
                  <div className="text-[10px] text-muted-foreground">{item.company} · Score {item.score} · {item.tier}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-5 w-5" title="Bulk email">
                    <Mail className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" title="Add to CRM">
                    <UserPlus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OpportunityDashboard;
