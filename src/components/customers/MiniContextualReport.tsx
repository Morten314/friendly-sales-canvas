
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building, Users, Target, TrendingUp, Edit, Download, Clock, MapPin, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

const MiniContextualReport = () => {
  const [showAll, setShowAll] = useState(false);

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
      levelColor: "destructive" as const,
      linkedinUrl: "https://linkedin.com/in/sarah-mitchell-fintech"
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
      levelColor: "default" as const,
      linkedinUrl: "https://linkedin.com/in/james-wilson-healthcare"
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
      levelColor: "outline" as const,
      linkedinUrl: "https://linkedin.com/in/emma-thompson-saas"
    }
  ];

  const prospectsList = [
    {
      id: 1,
      fullName: "Sarah Mitchell",
      email: "sarah.mitchell@techflow.co.uk",
      companyName: "TechFlow Solutions",
      designation: "Operations Director",
      linkedinProfile: "https://linkedin.com/in/sarah-mitchell-fintech",
      linkedinCompany: "https://linkedin.com/company/techflow-solutions"
    },
    {
      id: 2,
      fullName: "James Wilson",
      email: "j.wilson@healthstream.co.uk",
      companyName: "HealthStream Ltd",
      designation: "IT Manager",
      linkedinProfile: "https://linkedin.com/in/james-wilson-healthcare",
      linkedinCompany: "https://linkedin.com/company/healthstream-ltd"
    },
    {
      id: 3,
      fullName: "Emma Thompson",
      email: "emma@datavault.io",
      companyName: "DataVault Systems",
      designation: "Founder & CEO",
      linkedinProfile: "https://linkedin.com/in/emma-thompson-saas",
      linkedinCompany: "https://linkedin.com/company/datavault-systems"
    },
    {
      id: 4,
      fullName: "Michael Chen",
      email: "m.chen@fintech-innovations.com",
      companyName: "FinTech Innovations",
      designation: "CTO",
      linkedinProfile: "https://linkedin.com/in/michael-chen-cto",
      linkedinCompany: "https://linkedin.com/company/fintech-innovations"
    },
    {
      id: 5,
      fullName: "Lisa Rodriguez",
      email: "lisa.r@medtech-solutions.co.uk",
      companyName: "MedTech Solutions",
      designation: "VP of Operations",
      linkedinProfile: "https://linkedin.com/in/lisa-rodriguez-medtech",
      linkedinCompany: "https://linkedin.com/company/medtech-solutions"
    }
  ];

  const handleLinkedInClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const LinkedInIcon = ({ onClick, className = "h-4 w-4" }: { onClick: () => void; className?: string }) => (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center hover:opacity-80 transition-opacity"
      title="View LinkedIn Profile"
    >
      <svg
        className={className}
        fill="#0A66C2"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    </button>
  );

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
                <CardTitle className="text-lg flex-1">{card.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={card.levelColor}>
                    {card.level}
                  </Badge>
                  <LinkedInIcon onClick={() => handleLinkedInClick(card.linkedinUrl)} />
                </div>
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

      {/* View All Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setShowAll(!showAll)}
          className="text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          {showAll ? "Hide List" : "View All"}
          {showAll ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
        </Button>
      </div>

      {/* Expanded Prospect List */}
      {showAll && (
        <Card className="mt-4 bg-gray-50/50">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">All Prospects</CardTitle>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export List
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-white rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead className="text-center">LinkedIn</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospectsList.map((prospect) => (
                    <TableRow key={prospect.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {prospect.fullName}
                          <LinkedInIcon 
                            onClick={() => handleLinkedInClick(prospect.linkedinProfile)}
                            className="h-3 w-3"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">{prospect.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {prospect.companyName}
                          <LinkedInIcon 
                            onClick={() => handleLinkedInClick(prospect.linkedinCompany)}
                            className="h-3 w-3"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">{prospect.designation}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLinkedInClick(prospect.linkedinProfile)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MiniContextualReport;
