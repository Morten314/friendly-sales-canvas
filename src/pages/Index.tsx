
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { agentPersonas, AgentPersonaCard } from "@/components/agents/AgentPersonas";
import { useState } from "react";
import { Check, MessageSquarePlus, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const [selectedActivity, setSelectedActivity] = useState<{
    id: number;
    agent: string;
    time: string;
    message: string;
    color: string;
  } | null>(null);
  
  const [dialogType, setDialogType] = useState<"approve" | "instruct" | "edit" | null>(null);
  const [inputText, setInputText] = useState("");
  const { toast } = useToast();

  const agentActivities = [
    {
      id: 1,
      agent: "Scout",
      time: "2 hours ago",
      message: "Completed UK fintech market analysis. Found 3 high-potential submarkets.",
      color: "bg-blue-500"
    },
    {
      id: 2,
      agent: "Profiler",
      time: "Yesterday",
      message: "Created 2 ICP profiles for UK fintech segment targeting.",
      color: "bg-purple-500"
    },
    {
      id: 3,
      agent: "Strategist",
      time: "2 days ago",
      message: "Generated GTM strategy for UK market entry. Ready for review.",
      color: "bg-amber-500"
    }
  ];

  const handleActivityClick = (activity: typeof agentActivities[0]) => {
    setSelectedActivity(activity);
  };

  const openDialog = (type: "approve" | "instruct" | "edit") => {
    setDialogType(type);
    if (type === "edit" && selectedActivity) {
      setInputText(selectedActivity.message);
    } else {
      setInputText("");
    }
  };

  const closeDialog = () => {
    setDialogType(null);
    setInputText("");
  };

  const handleSubmit = () => {
    if (!selectedActivity) return;

    switch (dialogType) {
      case "approve":
        toast({
          title: "Task Approved",
          description: `You approved ${selectedActivity.agent}'s task.`,
        });
        break;
      case "instruct":
        toast({
          title: "Instruction Sent",
          description: `New instruction sent to ${selectedActivity.agent}.`,
        });
        break;
      case "edit":
        toast({
          title: "Output Updated",
          description: `${selectedActivity.agent}'s output has been updated.`,
        });
        break;
    }
    
    closeDialog();
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome back, Alex!</h1>
          <p className="text-gray-500 mt-2">Which agent do you want to deploy today?</p>
        </div>

        {/* Agent Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {agentPersonas.map((agent) => (
            <Card key={agent.name} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${agent.color}`}>
                      {agent.icon}
                    </div>
                    <CardTitle className="text-xl">{agent.name}</CardTitle>
                  </div>
                </div>
                <CardDescription className="text-sm font-medium">
                  {agent.description} - <span className="font-normal italic">{agent.role}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-gray-600 italic">"{agent.tagline}"</p>
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">Key Strengths:</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.strengths.map((strength, idx) => (
                      <Badge key={idx} variant="outline" className={agent.color.replace('bg-', 'border-').replace(' text-', ' ')}>
                        {strength}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button 
                  className={`w-full ${agent.color.replace('bg-', 'bg-').replace('50 text-', '600 hover:bg-').replace('600', '700')} text-white`}
                  onClick={() => window.location.href = agent.path}
                >
                  {agent.action}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Agent Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Activity Feed</CardTitle>
            <CardDescription>Latest outputs and actions from your agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agentActivities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="p-3 bg-gray-50 rounded-md border border-gray-100 hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => handleActivityClick(activity)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`h-2 w-2 rounded-full ${activity.color}`}></div>
                    <p className="font-medium">{activity.agent}</p>
                    <p className="text-gray-500 text-sm ml-auto">{activity.time}</p>
                  </div>
                  <p className="text-sm">{activity.message}</p>
                  
                  {selectedActivity?.id === activity.id && (
                    <div className="flex gap-2 mt-3 justify-end">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDialog("approve");
                        }}
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDialog("instruct");
                        }}
                      >
                        <MessageSquarePlus className="h-4 w-4" />
                        Instruct
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="gap-1 text-amber-600 border-amber-200 hover:bg-amber-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDialog("edit");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog for actions */}
      <Dialog open={dialogType !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "approve" && "Approve Task"}
              {dialogType === "instruct" && "Give New Instruction"}
              {dialogType === "edit" && "Edit Output"}
            </DialogTitle>
            <DialogDescription>
              {selectedActivity && (
                <div className="mt-2">
                  <span className="font-medium">{selectedActivity.agent}</span>: {dialogType !== "edit" ? selectedActivity.message : ""}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {dialogType === "approve" && (
            <div className="py-3">
              <p>Are you sure you want to approve this task?</p>
            </div>
          )}
          
          {(dialogType === "instruct" || dialogType === "edit") && (
            <div className="py-3">
              <Textarea
                placeholder={dialogType === "instruct" ? "Type your instruction here..." : "Edit the output..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={5}
                className="w-full"
              />
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {dialogType === "approve" && "Approve"}
              {dialogType === "instruct" && "Send Instruction"}
              {dialogType === "edit" && "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Index;
