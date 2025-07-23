
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface PipelineStage {
  name: string;
  count: number;
  value: number;
  percentage: number;
  color: string;
}

const pipelineStages: PipelineStage[] = [
  { 
    name: "Qualified Leads", 
    count: 24, 
    value: 125000, 
    percentage: 100, 
    color: "bg-blue-200" 
  },
  { 
    name: "Meeting Scheduled", 
    count: 18, 
    value: 95000, 
    percentage: 75, 
    color: "bg-blue-300" 
  },
  { 
    name: "Proposal Sent", 
    count: 12, 
    value: 78000, 
    percentage: 60, 
    color: "bg-blue-400" 
  },
  { 
    name: "Negotiation", 
    count: 7, 
    value: 45000, 
    percentage: 40, 
    color: "bg-blue-500" 
  },
  { 
    name: "Closed Won", 
    count: 5, 
    value: 32000, 
    percentage: 25, 
    color: "bg-blue-600" 
  }
];

export function DealsPipeline() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deals Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {pipelineStages.map((stage) => (
            <div key={stage.name} className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">{stage.name}</span>
                <span className="text-gray-500">{stage.count} deals</span>
              </div>
              <Progress value={stage.percentage} className="h-2">
                <div className={`h-full ${stage.color}`} style={{ width: `${stage.percentage}%` }}></div>
              </Progress>
              <div className="text-sm text-gray-500">
                ${stage.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
