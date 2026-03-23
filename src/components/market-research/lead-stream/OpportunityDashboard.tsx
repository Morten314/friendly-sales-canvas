import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { Users, Target, AlertTriangle, Clock, Zap, ArrowRight, DollarSign } from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const coverageData = [
  { name: "Matched", value: 38, color: "hsl(var(--primary))" },
  { name: "Unmatched", value: 82, color: "hsl(var(--muted))" },
];

const icpMatchData = [
  { name: "Mid-Market SaaS", leads: 18 },
  { name: "Enterprise FinTech", leads: 12 },
  { name: "Growth E-commerce", leads: 8 },
];

const pipelineData = [
  { segment: "Mid-Market SaaS", value: 245000, color: "hsl(var(--primary))" },
  { segment: "Enterprise FinTech", value: 180000, color: "hsl(var(--accent))" },
  { segment: "Growth E-commerce", value: 92000, color: "hsl(var(--muted-foreground))" },
];

const totalPipeline = pipelineData.reduce((sum, d) => sum + d.value, 0);

// Engagement heatmap: last 14 days of lead activity
const today = new Date();
const engagementData = Array.from({ length: 14 }, (_, i) => {
  const date = new Date(today);
  date.setDate(today.getDate() - (13 - i));
  const day = date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
  const dayNum = date.getDate();
  // Simulated activity levels 0-4
  const levels = [2, 0, 3, 1, 4, 2, 0, 3, 1, 2, 4, 1, 3, 2];
  return { day, dayNum, level: levels[i] };
});

const heatColors = [
  "bg-muted",
  "bg-primary/20",
  "bg-primary/40",
  "bg-primary/60",
  "bg-primary",
];

// ─── Component ───────────────────────────────────────────────────────────────

const OpportunityDashboard: React.FC = () => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground tracking-tight">Opportunity Dashboard</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Visual overview of your lead intelligence</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Leads Coverage */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Leads Coverage</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={coverageData} cx="50%" cy="50%" innerRadius={22} outerRadius={36} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {coverageData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="text-muted-foreground">Total: <span className="font-semibold text-foreground">120</span></div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Matched: <span className="font-semibold text-foreground">38</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted" />
                <span className="text-muted-foreground">Unmatched: <span className="font-semibold text-foreground">82</span></span>
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Opportunity Distribution */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">By ICP Match</h3>
          </div>
          <div className="h-[80px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={icpMatchData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 3. Pipeline Value Preview */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Pipeline Value</h3>
          </div>
          <div className="space-y-2">
            <div className="text-lg font-bold text-foreground">${(totalPipeline / 1000).toFixed(0)}K</div>
            <div className="space-y-1.5">
              {pipelineData.map((seg, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                    <span className="text-muted-foreground">{seg.segment}</span>
                  </div>
                  <span className="font-semibold text-foreground">${(seg.value / 1000).toFixed(0)}K</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* 4. Urgency Signals */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Urgency Signals</h3>
          </div>
          <div className="space-y-2.5">
            {urgencySignals.map((signal, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <signal.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{signal.label}</span>
                </div>
                <Badge variant={signal.variant} className="text-[10px] h-5 px-1.5">{signal.count}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OpportunityDashboard;
