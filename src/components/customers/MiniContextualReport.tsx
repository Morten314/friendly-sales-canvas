
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, Users, Target, TrendingUp, Edit, Download, Clock, MapPin } from "lucide-react";

const MiniContextualReport = () => {
  const reportCards = [
    {
      id: 1,
      title: "UK Fintech Operations Director",
      level: "High",
      description: "Mid-market fintech firms in the UK prioritize compliance and growth. High adoption of new tech solutions expected in next 6 months.",
      keyTraits: ["Budget authority", "Technical background"],
      painPoints: ["Compliance overhead", "Legacy integration"],
      region: "United Kingdom",
      companySize: "50-200 employees",
      createdAt: "2 days ago",
      levelColor: "destructive" as const
    },
    {
      id: 2,
      title: "UK Healthcare IT Manager", 
      level: "Medium",
      description: "Healthcare IT managers seek process improvements and data security. Moderate investment trends in mid-market hospitals.",
      keyTraits: ["IT decision maker", "Process-oriented"],
      painPoints: ["Data security", "Budget constraints"],
      region: "United Kingdom",
      companySize: "200-500 employees",
      createdAt: "1 week ago",
      levelColor: "default" as const
    },
    {
      id: 3,
      title: "UK SaaS Startup Founder",
      level: "Low", 
      description: "Early-stage SaaS founders demand rapid ROI and lean solutions due to limited resources and fast-changing markets.",
      keyTraits: ["Visionary", "Fast decision-making"],
      painPoints: ["Limited resources", "Need for quick ROI"],
      region: "United Kingdom",
      companySize: "10-50 employees",
      createdAt: "2 weeks ago",
      levelColor: "outline" as const
    }
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">Market Insights</h3>
        <Badge variant="secondary" className="ml-2">Based on your ICP settings</Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportCards.map((card) => (
          <Card key={card.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start mb-2">
                <CardTitle className="text-lg">{card.title}</CardTitle>
                <Badge variant={card.levelColor}>
                  {card.level}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {card.region}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {card.companySize}
                </div>
              </div>
              <CardDescription className="text-sm line-clamp-3">
                {card.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-gray-500 mb-1 text-sm">Key Traits</p>
                <div className="flex flex-wrap gap-1">
                  {card.keyTraits.map((trait, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {trait}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-gray-500 mb-1 text-sm">Pain Points</p>
                <div className="flex flex-wrap gap-1">
                  {card.painPoints.map((point, index) => (
                    <Badge key={index} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                      {point}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  Created {card.createdAt}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MiniContextualReport;
