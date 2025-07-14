
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Bot, 
  Building, 
  MapPin, 
  Users, 
  DollarSign,
  TrendingUp,
  Save,
  Download,
  Share,
  Sparkles
} from "lucide-react";

interface LookalikeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceCompany?: string;
}

const LookalikeModal = ({ 
  isOpen, 
  onClose, 
  sourceCompany = "TechFlow Solutions" 
}: LookalikeModalProps) => {
  
  // Sample lookalike companies
  const lookalikes = [
    {
      name: "DataVault Systems",
      industry: "SaaS - Analytics",
      location: "🇺🇸 Austin, TX",
      size: "200-400",
      revenue: "$20M-40M",
      similarity: 94,
      intentSignals: "High",
      description: "Customer data platform for B2B marketing teams",
      keyFactors: ["Similar tech stack", "Comparable revenue", "Same target market"]
    },
    {
      name: "MetricFlow Inc",
      industry: "SaaS - Business Intelligence",
      location: "🇺🇸 Seattle, WA", 
      size: "150-300",
      revenue: "$15M-35M",
      similarity: 91,
      intentSignals: "Medium",
      description: "Advanced analytics platform for sales teams",
      keyFactors: ["Similar growth stage", "Overlapping customer base", "Competitive landscape"]
    },
    {
      name: "InsightCore Technologies",
      industry: "SaaS - Marketing Tech",
      location: "🇺🇸 Boston, MA",
      size: "300-500",
      revenue: "$30M-60M",
      similarity: 88,
      intentSignals: "High",
      description: "Marketing intelligence platform for enterprise clients",
      keyFactors: ["Similar employee size", "Enterprise focus", "Recent funding"]
    },
    {
      name: "AnalyticsPro Solutions",
      industry: "Data Analytics",
      location: "🇨🇦 Toronto, ON",
      size: "180-350",
      revenue: "$18M-45M",
      similarity: 85,
      intentSignals: "Medium",
      description: "Real-time analytics for SaaS companies",
      keyFactors: ["Similar technology", "Growth trajectory", "Market positioning"]
    },
    {
      name: "DataStream Enterprise",
      industry: "Business Intelligence",
      location: "🇺🇸 Denver, CO",
      size: "250-450",
      revenue: "$25M-50M",
      similarity: 83,
      intentSignals: "High",
      description: "Enterprise data visualization and analytics",
      keyFactors: ["Revenue range match", "Enterprise clients", "Tech stack overlap"]
    },
    {
      name: "FlowMetrics Corp",
      industry: "SaaS - Operations",
      location: "🇺🇸 Chicago, IL",
      size: "120-280",
      revenue: "$12M-30M",
      similarity: 80,
      intentSignals: "Low",
      description: "Operational analytics for mid-market companies",
      keyFactors: ["Similar founding year", "Growth pattern", "Target segment"]
    }
  ];

  const getSimilarityColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 80) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const getIntentColor = (level: string) => {
    switch (level) {
      case "High": return "bg-green-100 text-green-800";
      case "Medium": return "bg-yellow-100 text-yellow-800";
      case "Low": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Lookalike Companies
              </DialogTitle>
              <p className="text-sm text-gray-600">
                I've found similar companies matching your ideal profile based on {sourceCompany}
              </p>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Scout Message */}
          <div className="flex gap-3 p-4 bg-blue-50 rounded-lg">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-purple-100 text-purple-600">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm text-gray-800">
                I've found <strong>{lookalikes.length} companies</strong> that match your ideal profile. 
                These are ranked by similarity score and current intent signals. 
                Would you like me to prioritize by specific criteria?
              </p>
            </div>
          </div>

          {/* Lookalike Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lookalikes.map((company, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{company.name}</h3>
                        <p className="text-sm text-gray-600">{company.industry}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Similarity</div>
                          <div className="font-bold text-lg">{company.similarity}%</div>
                        </div>
                        <div className={`w-3 h-12 rounded-full ${getSimilarityColor(company.similarity)}`}></div>
                      </div>
                    </div>

                    {/* Company Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-500" />
                        <span>{company.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-gray-500" />
                        <span>{company.size}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-gray-500" />
                        <span>{company.revenue}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-gray-500" />
                        <Badge variant="secondary" className={`text-xs ${getIntentColor(company.intentSignals)}`}>
                          {company.intentSignals} Intent
                        </Badge>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-700">{company.description}</p>

                    {/* Key Matching Factors */}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Key Matching Factors:</div>
                      <div className="flex flex-wrap gap-1">
                        {company.keyFactors.map((factor, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1">
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline">
                        <Building className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-2">
            <Button variant="outline">
              <Save className="h-4 w-4 mr-1" />
              Save All Lookalikes
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-1" />
              Export List
            </Button>
            <Button variant="outline">
              <Share className="h-4 w-4 mr-1" />
              Share
            </Button>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LookalikeModal;
