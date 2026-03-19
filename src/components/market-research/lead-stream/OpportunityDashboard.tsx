import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { Users, Target, AlertTriangle, ArrowRight, Clock, Zap, Database } from "lucide-react";

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

const sourceData = [
  { name: "HubSpot", value: 74, color: "hsl(var(--primary))" },
  { name: "Prospect List", value: 46, color: "hsl(var(--accent))" },
];

const urgencySignals = [
  { label: "Need outreach today", count: 8, icon: Zap, variant: "destructive" as const },
  { label: "Stale > 7 days", count: 14, icon: Clock, variant: "secondary" as const },
  { label: "Recently engaged", count: 6, icon: ArrowRight, variant: "default" as const },
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
            <h3 className="text-sm font-semibold text-foreground">By Report Section</h3>
          </div>
          <div className="h-[80px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={opportunityData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 3. Lead Source Breakdown */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Lead Sources</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={22} outerRadius={36} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {sourceData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 text-xs">
              {sourceData.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-muted-foreground">{s.name}: <span className="font-semibold text-foreground">{s.value}</span></span>
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
