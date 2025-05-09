
import { User, Compass, Zap, Search, Presentation } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Define the agent personas with consistent structure
export interface AgentPersona {
  name: string;
  description: string;
  tagline: string;
  icon: React.ReactNode;
  action: string;
  path: string;
  color: string;
  role: string;
  strengths: string[];
}

// Create detailed agent personas
export const agentPersonas: AgentPersona[] = [
  {
    name: "Scout",
    description: "Market Research Agent",
    tagline: "Find the best markets before your competitors do.",
    icon: <Search className="h-6 w-6" />,
    action: "Start Research",
    path: "/market-research",
    color: "bg-blue-50 text-blue-600",
    role: "Market Intelligence",
    strengths: ["Market analysis", "Trend spotting", "Competitor research"]
  },
  {
    name: "Profiler",
    description: "ICP Builder and Refiner",
    tagline: "Sharpen your targeting with laser precision.",
    icon: <User className="h-6 w-6" />,
    action: "Build ICP",
    path: "/customers",
    color: "bg-purple-50 text-purple-600",
    role: "Customer Analysis",
    strengths: ["Behavioral analysis", "Need identification", "Segmentation"]
  },
  {
    name: "Strategist",
    description: "GTM Strategy Generator",
    tagline: "Launch with a plan, not a gamble.",
    icon: <Compass className="h-6 w-6" />,
    action: "Create Strategy",
    path: "/deals",
    color: "bg-amber-50 text-amber-600",
    role: "Strategy & Planning",
    strengths: ["Market positioning", "Competitive strategy", "Growth planning"]
  },
  {
    name: "Activator",
    description: "Task & Campaign Automation",
    tagline: "Move fast. Book meetings. Fill your pipeline.",
    icon: <Zap className="h-6 w-6" />,
    action: "Start Campaign",
    path: "/calendar",
    color: "bg-green-50 text-green-600",
    role: "Execution & Automation",
    strengths: ["Campaign automation", "Task management", "Follow-up sequences"]
  },
  {
    name: "Presenter",
    description: "Demo & Deck Generator",
    tagline: "Deliver compelling demos that close deals.",
    icon: <Presentation className="h-6 w-6" />,
    action: "Prepare Demo",
    path: "/reports",
    color: "bg-red-50 text-red-600",
    role: "Communication",
    strengths: ["Visual storytelling", "Value articulation", "Objection handling"]
  }
];

// Component to display individual agent persona card
export function AgentPersonaCard({ persona }: { persona: AgentPersona }) {
  return (
    <div className="border rounded-lg p-5 hover:shadow-md transition-all bg-white">
      <div className="flex items-start space-x-4">
        <div className={`p-3 rounded-lg ${persona.color} flex-shrink-0`}>
          {persona.icon}
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{persona.name}</h3>
          <p className="text-sm text-gray-500">{persona.role}</p>
          <p className="text-sm mt-2 italic text-gray-700">"{persona.tagline}"</p>
          
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">Key Strengths:</p>
            <div className="flex flex-wrap gap-1">
              {persona.strengths.map((strength, idx) => (
                <Badge key={idx} variant="outline" className={persona.color.replace('bg-', 'border-').replace(' text-', ' ')}>
                  {strength}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
