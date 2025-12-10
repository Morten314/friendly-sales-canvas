
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Copy, Trash, Download, Star } from "lucide-react";

// Sample ICP data
const icpProfiles = [
  {
    id: 1,
    name: "UK Fintech Operations Director",
    description: "Mid-market fintech companies in the UK with 50-200 employees focused on payment processing",
    industry: "Fintech",
    region: "United Kingdom",
    companySize: "50-200 employees",
    keyTraits: ["Budget authority", "Technical background", "Growth-focused"],
    painPoints: ["Compliance overhead", "Legacy system integration", "Scaling challenges"],
    createdAt: "2 days ago",
    priority: "High",
  },
  {
    id: 2,
    name: "UK Healthcare IT Manager",
    description: "NHS-affiliated healthcare providers looking to modernize patient management systems",
    industry: "Healthcare",
    region: "United Kingdom",
    companySize: "200-500 employees",
    keyTraits: ["IT decision maker", "Risk-averse", "Process-oriented"],
    painPoints: ["Data security", "Integration complexity", "Budget constraints"],
    createdAt: "1 week ago",
    priority: "Medium",
  },
  {
    id: 3,
    name: "UK SaaS Startup Founder",
    description: "Early-stage SaaS founders in the UK seeking operational efficiency and rapid scaling",
    industry: "SaaS",
    region: "United Kingdom", 
    companySize: "10-50 employees",
    keyTraits: ["Visionary", "Fast decision-making", "Tech-savvy"],
    painPoints: ["Limited resources", "Need for quick ROI", "Competitive market"],
    createdAt: "2 weeks ago",
    priority: "Low",
  },
];

export function ICPProfilesList() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {icpProfiles.map((profile) => (
        <Card key={profile.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <CardTitle className="text-xl">{profile.name}</CardTitle>
              <Badge 
                variant={profile.priority === "High" ? "destructive" : 
                       profile.priority === "Medium" ? "default" : "outline"}
              >
                {profile.priority}
              </Badge>
            </div>
            <CardDescription className="text-sm line-clamp-2">
              {profile.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-500">Industry</p>
                  <p className="font-medium">{profile.industry}</p>
                </div>
                <div>
                  <p className="text-gray-500">Region</p>
                  <p className="font-medium">{profile.region}</p>
                </div>
                <div>
                  <p className="text-gray-500">Company Size</p>
                  <p className="font-medium">{profile.companySize}</p>
                </div>
                <div>
                  <p className="text-gray-500">Created</p>
                  <p className="font-medium">{profile.createdAt}</p>
                </div>
              </div>
              
              <div>
                <p className="text-gray-500 mb-1">Key Traits</p>
                <div className="flex flex-wrap gap-1">
                  {profile.keyTraits.map((trait) => (
                    <Badge key={trait} variant="secondary" className="text-xs">
                      {trait}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-gray-500 mb-1">Pain Points</p>
                <div className="flex flex-wrap gap-1">
                  {profile.painPoints.map((point) => (
                    <Badge key={point} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                      {point}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between pt-2 border-t">
            <div className="flex space-x-2">
              <Button variant="ghost" size="icon">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Trash className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              Export
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
