import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { Users, Target, DollarSign, Star, Mail, UserPlus } from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const coverageData = [
  { name: "Matched", value: 74, color: "hsl(var(--primary))" },
  { name: "Unmatched", value: 46, color: "hsl(var(--muted))" },
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

const topICPOpportunities = [
  { icp: "Mid-Market SaaS", leads: 18, avgScore: 91 },
  { icp: "Enterprise FinTech", leads: 12, avgScore: 88 },
  { icp: "Growth E-commerce", leads: 8, avgScore: 84 },
];

// ─── Component ───────────────────────────────────────────────────────────────

const OpportunityDashboard: React.FC = () => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground tracking-tight">Opportunity Dashboard</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Visual overview of your lead intelligence across all Scout report sections</p>
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
                <span className="text-muted-foreground">Matched: <span className="font-semibold text-foreground">74</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted" />
                <span className="text-muted-foreground">Unmatched: <span className="font-semibold text-foreground">46</span></span>
              </div>
              <div className="mt-1 text-[11px] text-primary font-medium">
                62% should comprise of your active pipeline
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

        {/* 4. Top Opportunities by ICP */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Top Opportunities</h3>
          </div>
          <div className="space-y-2.5">
            {topICPOpportunities.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground">{item.icp}</div>
                  <div className="text-[10px] text-muted-foreground">{item.leads} leads · Avg score {item.avgScore}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-5 w-5" title="Bulk email">
                    <Mail className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" title="Add all to CRM">
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
