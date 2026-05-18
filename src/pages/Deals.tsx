import { Layout } from "@/components/layout/Layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import BoardPage from "@/components/strategist/board/BoardPage";
import CohortPage from "@/components/strategist/cohort/CohortPage";
import PackagePage from "@/components/strategist/package/PackagePage";
import { useParams } from "react-router-dom";

type View = "board" | "cohort" | "package";

interface Props {
  view?: View;
}

const Deals = ({ view = "board" }: Props) => {
  usePageTitle("🧭 Strategist - Brewra");
  // tab param may be 'board' or legacy 'workspace'/'leadstream'
  useParams();
  return (
    <Layout>
      <div className="animate-fade-in h-[calc(100vh-4rem)] overflow-auto">
        {view === "board" && <BoardPage />}
        {view === "cohort" && <CohortPage />}
        {view === "package" && <PackagePage />}
      </div>
    </Layout>
  );
};

export default Deals;
