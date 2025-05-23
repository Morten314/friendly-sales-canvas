
import { Layout } from "@/components/layout/Layout";
import { ScoutDeployment } from "@/components/settings/ScoutDeployment";

const ScoutDeploymentPage = () => {
  return (
    <Layout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold mb-6">Deploy Scout Agent</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <ScoutDeployment />
        </div>
      </div>
    </Layout>
  );
};

export default ScoutDeploymentPage;
