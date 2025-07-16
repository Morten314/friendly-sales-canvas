
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Globe, TrendingUp, Users, Building, MapPin, Target, Bot, MessageSquare } from "lucide-react";

interface SuggestedICP {
  id: string;
  industry: string;
  segment: string;
  companySize: string;
  decisionMakers: string[];
  regions: string[];
  keyAttributes: string[];
  growthIndicator?: string;
}

interface SuggestedICPsGalleryProps {
  onICPSelect?: (icp: SuggestedICP) => void;
  onProfilerChatOpen?: (context?: string) => void;
}

export const SuggestedICPsGallery = ({ onICPSelect, onProfilerChatOpen }: SuggestedICPsGalleryProps) => {
  const [selectedICP, setSelectedICP] = useState<string | null>(null);

  const suggestedICPs: SuggestedICP[] = [
    {
      id: "fintech-neobanks",
      industry: "Fintech",
      segment: "Neobanks",
      companySize: "50–200 employees",
      decisionMakers: ["CTO", "Head of Digital"],
      regions: ["North America", "DACH"],
      keyAttributes: ["High cloud adoption", "Regulatory compliance focus"],
      growthIndicator: "5.6% CAGR"
    },
    {
      id: "healthcare-saas",
      industry: "Healthcare SaaS",
      segment: "Patient Data Analytics",
      companySize: "100–500 employees",
      decisionMakers: ["Chief Medical Officer", "IT Director"],
      regions: ["North America", "EU"],
      keyAttributes: ["HIPAA compliance", "AI/ML integration"],
      growthIndicator: "8.2% CAGR"
    },
    {
      id: "logistics-tech",
      industry: "Logistics Tech",
      segment: "Last-Mile Delivery",
      companySize: "200–800 employees",
      decisionMakers: ["VP Operations", "CTO"],
      regions: ["SEA", "North America"],
      keyAttributes: ["Real-time tracking", "API-first approach"],
      growthIndicator: "12.1% CAGR"
    },
    {
      id: "edtech-platforms",
      industry: "EdTech",
      segment: "Learning Management",
      companySize: "80–300 employees",
      decisionMakers: ["Chief Academic Officer", "IT Manager"],
      regions: ["Global", "LATAM"],
      keyAttributes: ["Mobile-first", "Analytics-driven"],
      growthIndicator: "9.4% CAGR"
    },
    {
      id: "proptech-crm",
      industry: "PropTech",
      segment: "Real Estate CRM",
      companySize: "150–600 employees",
      decisionMakers: ["VP Sales", "Technology Director"],
      regions: ["North America", "ANZ"],
      keyAttributes: ["Integration capabilities", "Workflow automation"],
      growthIndicator: "6.8% CAGR"
    }
  ];

  const handleCardClick = (icp: SuggestedICP) => {
    setSelectedICP(icp.id);
    if (onICPSelect) {
      onICPSelect(icp);
    }
    if (onProfilerChatOpen) {
      onProfilerChatOpen(`Hi! Would you like to dig deeper into the ${icp.industry} ICP for ${icp.segment}?`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">Suggested ICPs</h2>
        <p className="text-sm text-gray-600">
          Agent-curated ideal customer profiles based on your product and market patterns
        </p>
      </div>

      {/* Carousel Container */}
      <div className="relative px-16">
        <Carousel
          opts={{
            align: "start",
            loop: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {suggestedICPs.map((icp) => (
              <CarouselItem key={icp.id} className="pl-4 basis-80">
                <Card 
                  className={`h-full cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border ${
                    selectedICP === icp.id 
                      ? 'border-blue-500 bg-blue-50/40 shadow-md' 
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => handleCardClick(icp)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg text-gray-900">{icp.industry}</CardTitle>
                        <CardDescription className="font-medium text-blue-600">
                          {icp.segment}
                        </CardDescription>
                      </div>
                      {icp.growthIndicator && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {icp.growthIndicator}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Company Size */}
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-700">{icp.companySize}</span>
                    </div>

                    {/* Decision Makers */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600 font-medium">Key Decision Makers:</span>
                      </div>
                      <div className="flex flex-wrap gap-1 ml-6">
                        {icp.decisionMakers.map((role, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Regions */}
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-700">{icp.regions.join(", ")}</span>
                    </div>

                    {/* Key Attributes */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Target className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600 font-medium">Key Attributes:</span>
                      </div>
                      <div className="space-y-1 ml-6">
                        {icp.keyAttributes.map((attribute, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span className="text-gray-700">{attribute}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* View Details Button */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-4 text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      View ICP Details
                    </Button>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="-left-12 bg-white shadow-md border border-gray-200 hover:bg-gray-50 text-gray-700 h-10 w-10" />
          <CarouselNext className="-right-12 bg-white shadow-md border border-gray-200 hover:bg-gray-50 text-gray-700 h-10 w-10" />
        </Carousel>
      </div>

      {/* Profiler Chat Prompt */}
      {!selectedICP && (
        <div className="flex items-center justify-center py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onProfilerChatOpen && onProfilerChatOpen("Hi! Want me to help pick the right ICP to start with?")}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-2"
          >
            <Bot className="h-4 w-4" />
            Need help choosing? Ask Profiler
          </Button>
        </div>
      )}
    </div>
  );
};
