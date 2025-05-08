
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Insights = () => {
  return (
    <Layout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold mb-6">Reports</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>GTM Performance</CardTitle>
              <CardDescription>Overview of your go-to-market effectiveness</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Performance metrics and reports will be displayed here.</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance</CardTitle>
              <CardDescription>How your agents are performing</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Agent performance metrics will be displayed here.</p>
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Market Expansion Progress</CardTitle>
            <CardDescription>Track your expansion into new markets</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Market expansion progress reports will be displayed here.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Insights;
