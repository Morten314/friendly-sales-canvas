import React from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { AgentPersona, agentPersonas } from "@/components/agents/AgentPersonas";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AgentTeamOverview() {
  const navigate = useNavigate();

  const handleAgentClick = (path: string) => {
    navigate(path);
  };
  
  return (
    <>
      {agentPersonas.map((persona) => (
        <Card key={persona.name} className="overflow-hidden hover:shadow-md transition-all">
          <div className="flex flex-col h-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${persona.color} flex-shrink-0`}>
                  {persona.icon}
                </div>
                <div>
                  <CardTitle>{persona.name}</CardTitle>
                  <CardDescription>{persona.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm mb-3 italic">"{persona.tagline}"</p>
              
              <h4 className="text-sm font-semibold mb-2">Key Strengths:</h4>
              <ul className="text-sm space-y-1 mb-6">
                {persona.strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${persona.color.replace('bg-', 'bg-').replace(' text-', ' ')}`} />
                    {strength}
                  </li>
                ))}
              </ul>
              
              {/* <Button 
                variant="outline"
                className={`mt-auto ${persona.color.replace('bg-', 'border-').replace(' text-', ' ')}`}
                onClick={() => handleAgentClick(persona.path)}
              >
                {persona.action}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button> */}
            </CardContent>
          </div>
        </Card>
      ))}
    </>
  );
}
