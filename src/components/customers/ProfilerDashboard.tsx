import React from "react";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Users, BarChart3, Target, Zap, Shield, Check, Clock } from "lucide-react";

// Types matching LeadStream
type ICPCategory = "current" | "accepted" | "pending";
interface Lead {
  id: string;
  name: string;
  company: string;
  title: string;
  matchedICP: string;
  icpCategory: ICPCategory;
  fitScore: number;
  intentLevel: "High" | "Medium" | "Low";
  reason: string;
}

interface ProfilerDashboardProps {
  leads: Lead[];
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────
const FitTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">
        Leads: <span className="font-semibold text-foreground">{d.total}</span>
      </p>
      <div className="flex gap-3 text-[11px]">
        <span className="text-emerald-600">High Fit: {d.highFit}</span>
        <span className="text-amber-600">Mid Fit: {d.midFit}</span>
        <span className="text-red-600">Low Fit: {d.lowFit}</span>
      </div>
    </div>
  );
};

const ProfilerDashboard: React.FC<ProfilerDashboardProps> = ({ leads }) => {
  // ─── Category distribution ────────────────────────────────────────────
  const catCounts = leads.reduce(
    (acc, l) => {
      acc[l.icpCategory]++;
      return acc;
    },
    { current: 0, accepted: 0, pending: 0 } as Record<ICPCategory, number>
  );

  const categoryData = [
    { name: "Current", value: catCounts.current, color: "hsl(var(--primary))" },
    { name: "Accepted", value: catCounts.accepted, color: "hsl(var(--chart-1))" },
    { name: "Pending", value: catCounts.pending, color: "hsl(var(--chart-2))" },
  ];

  const categoryIcons: Record<string, React.ReactNode> = {
    Current: <Shield className="h-2.5 w-2.5" />,
    Accepted: <Check className="h-2.5 w-2.5" />,
    Pending: <Clock className="h-2.5 w-2.5" />,
  };

  // ─── Intent breakdown ─────────────────────────────────────────────────
  const intentCounts = leads.reduce(
    (acc, l) => { acc[l.intentLevel]++; return acc; },
    { High: 0, Medium: 0, Low: 0 } as Record<string, number>
  );

  const intentData = [
    { name: "High", value: intentCounts.High, color: "#10b981" },
    { name: "Medium", value: intentCounts.Medium, color: "#f59e0b" },
    { name: "Low", value: intentCounts.Low, color: "#f87171" },
  ];

  // ─── Leads by ICP with fit score breakdown ────────────────────────────
  const icpMap = new Map<string, { highFit: number; midFit: number; lowFit: number; total: number }>();
  leads.forEach((l) => {
    const entry = icpMap.get(l.matchedICP) || { highFit: 0, midFit: 0, lowFit: 0, total: 0 };
    entry.total++;
    if (l.fitScore >= 85) entry.highFit++;
    else if (l.fitScore >= 70) entry.midFit++;
    else entry.lowFit++;
    icpMap.set(l.matchedICP, entry);
  });
  const icpBarData = Array.from(icpMap.entries()).map(([name, data]) => ({ name, ...data }));

  const totalLeads = leads.length;
  const avgFit = totalLeads > 0 ? Math.round(leads.reduce((s, l) => s + l.fitScore, 0) / totalLeads) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground tracking-tight">Lead Stream Dashboard</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Visual overview of {totalLeads} leads across {icpMap.size} ICPs · Avg fit {avgFit}%
        </p>
      </div>

      {/* Row 1: Three summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Total Leads</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalLeads}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Across {icpMap.size} ICPs</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-semibold text-foreground">High Intent</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{intentCounts.High}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {totalLeads > 0 ? Math.round((intentCounts.High / totalLeads) * 100) : 0}% of all leads
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-semibold text-foreground">Pending Review</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{catCounts.pending}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {catCounts.pending > 0 ? `${Math.round((catCounts.pending / totalLeads) * 100)}% need action` : "All reviewed"}
          </p>
        </Card>
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* ICP Category Pie */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">By ICP Status</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={22} outerRadius={36} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 text-xs">
              {categoryData.map((t, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {categoryIcons[t.name]}
                    {t.name}: <span className="font-semibold text-foreground">{t.value}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>


        {/* Leads by ICP — Fit Distribution */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Fit by ICP</h3>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> 85+</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" /> 70-84</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> &lt;70</span>
            </div>
          </div>
          <div style={{ height: Math.max(130, icpBarData.length * 32) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={icpBarData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
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
                  tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                  tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 14) + '…' : v}
                />
                <RechartsTooltip content={<FitTooltip />} />
                <Bar dataKey="highFit" stackId="a" fill="#10b981" barSize={14} name="High Fit" />
                <Bar dataKey="midFit" stackId="a" fill="#f59e0b" barSize={14} name="Mid Fit" />
                <Bar dataKey="lowFit" stackId="a" fill="#f87171" radius={[0, 4, 4, 0]} barSize={14} name="Low Fit" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ProfilerDashboard;
