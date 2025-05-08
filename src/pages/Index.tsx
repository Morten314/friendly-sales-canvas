
import { Layout } from "@/components/layout/Layout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { RecentDeals } from "@/components/dashboard/RecentDeals";
import { DealsPipeline } from "@/components/dashboard/DealsPipeline";
import { UpcomingActivities } from "@/components/dashboard/UpcomingActivities";
import { DollarSign, Users, Target, TrendingUp } from "lucide-react";

const Index = () => {
  return (
    <Layout>
      <div className="animate-fade-in">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatsCard 
            title="Total Revenue" 
            value="$142,500" 
            change="12%" 
            isPositive={true}
            icon={<DollarSign className="h-6 w-6" />}
          />
          <StatsCard 
            title="Active Leads" 
            value="65" 
            change="8%" 
            isPositive={true}
            icon={<Users className="h-6 w-6" />}
          />
          <StatsCard 
            title="Conversion Rate" 
            value="24%" 
            change="2%" 
            isPositive={false}
            icon={<Target className="h-6 w-6" />}
          />
          <StatsCard 
            title="Average Deal Size" 
            value="$8,500" 
            change="5%" 
            isPositive={true}
            icon={<TrendingUp className="h-6 w-6" />}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <SalesChart />
          <DealsPipeline />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentDeals />
          <UpcomingActivities />
        </div>
      </div>
    </Layout>
  );
};

export default Index;
