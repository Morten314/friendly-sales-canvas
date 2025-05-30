
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ChartLine, Filter, Bookmark, Send, 
  ExternalLink, Briefcase, Building, MapPin
} from "lucide-react";

interface Lead {
  company: string;
  industry: string;
  size: string;
  location: string;
  techStack: string[];
  contact: {
    name: string;
    title: string;
    department: string;
    email: string;
  };
  status: string;
}

interface ConsumerTrendsProps {
  consumerTrends?: any[];
  leads?: Lead[];
}

export const ConsumerTrends = ({ leads = mockLeads }: ConsumerTrendsProps) => {
  // Group leads by status
  const groupedLeads = leads.reduce((acc, lead) => {
    if (!acc[lead.status]) {
      acc[lead.status] = [];
    }
    acc[lead.status].push(lead);
    return acc;
  }, {} as Record<string, Lead[]>);

  const statusColumns = [
    { key: 'New', title: 'New Leads', color: 'bg-blue-50 border-blue-200' },
    { key: 'Contacted', title: 'Contacted', color: 'bg-yellow-50 border-yellow-200' },
    { key: 'Demo Scheduled', title: 'Demo Scheduled', color: 'bg-green-50 border-green-200' },
    { key: 'Qualified', title: 'Qualified', color: 'bg-purple-50 border-purple-200' }
  ];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'New': return 'default';
      case 'Contacted': return 'secondary';
      case 'Demo Scheduled': return 'outline';
      case 'Qualified': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ChartLine className="h-6 w-6 text-blue-600" /> Your Lead Stream
            </CardTitle>
            <CardDescription className="text-base mt-1">
              Here are today's high-fit leads curated based on your ICP preferences.
            </CardDescription>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="px-2 py-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                ICP: Mid-Market SaaS in North America
              </Badge>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                Edit ICP
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <div className="p-4 border-b bg-gray-50">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                <SelectItem value="saas">SaaS</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Company Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                <SelectItem value="smb">SMB</SelectItem>
                <SelectItem value="mid">Mid-Market</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                <SelectItem value="na">North America</SelectItem>
                <SelectItem value="eu">Europe</SelectItem>
                <SelectItem value="apac">APAC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-1 justify-end">
            <Button variant="default" size="sm" className="ml-1">
              Apply Filters
            </Button>
            <Button variant="outline" size="sm" className="ml-2">
              Save as ICP
            </Button>
          </div>
        </div>
      </div>

      <div className="border-b bg-blue-50/60 p-3">
        <div className="text-sm font-medium text-blue-700 mb-1">Suggestions by Scout</div>
        <div className="flex gap-3 overflow-x-auto py-1">
          <Card className="min-w-[240px] bg-white shadow-sm">
            <CardContent className="p-3">
              <div className="text-xs">Scout found 3 similar companies to Acme Corp</div>
            </CardContent>
          </Card>
          <Card className="min-w-[240px] bg-white shadow-sm">
            <CardContent className="p-3">
              <div className="text-xs">Try targeting CTOs in the same industry</div>
            </CardContent>
          </Card>
          <Card className="min-w-[240px] bg-white shadow-sm">
            <CardContent className="p-3">
              <div className="text-xs">New funding alert: 2 ICP-matched startups raised Series A today</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Kanban Board */}
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statusColumns.map((column) => (
            <div key={column.key} className={`rounded-lg border-2 ${column.color} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{column.title}</h3>
                <Badge variant="outline" className="text-xs">
                  {groupedLeads[column.key]?.length || 0}
                </Badge>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {groupedLeads[column.key]?.map((lead, index) => (
                  <Card key={index} className="bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-sm">{lead.company}</h4>
                        <Badge 
                          variant={getStatusBadgeVariant(lead.status)}
                          className="text-xs"
                        >
                          {lead.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 mb-2">
                        <div className="flex items-center text-xs text-gray-500">
                          <Building className="h-3 w-3 mr-1" /> {lead.industry}
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          <Briefcase className="h-3 w-3 mr-1" /> {lead.size}
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          <MapPin className="h-3 w-3 mr-1" /> {lead.location}
                        </div>
                      </div>
                      
                      <div className="border-t pt-2 mb-2">
                        <div className="font-medium text-xs">{lead.contact.name}</div>
                        <div className="text-xs text-gray-500">{lead.contact.title}</div>
                        <div className="text-xs text-gray-500 truncate">{lead.contact.email}</div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mb-3">
                        {lead.techStack.slice(0, 2).map((tech, i) => (
                          <Badge key={i} variant="outline" className="text-xs px-1 py-0">
                            {tech}
                          </Badge>
                        ))}
                        {lead.techStack.length > 2 && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            +{lead.techStack.length - 2}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex justify-between gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6">
                          <Bookmark className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6">
                          <Send className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )) || (
                  <div className="text-center text-gray-500 text-sm py-4">
                    No leads in this stage
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between border-t p-4">
        <div className="flex flex-wrap gap-2">
          <div className="bg-gray-100 px-3 py-1 rounded text-sm">
            <span className="font-medium">22</span> leads scouted
          </div>
          <div className="bg-gray-100 px-3 py-1 rounded text-sm">
            <span className="font-medium">7</span> added to workflow
          </div>
          <div className="bg-gray-100 px-3 py-1 rounded text-sm">
            <span className="font-medium">5</span> contacted
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Export CSV
          </Button>
          <Button variant="default" size="sm">
            Bulk Actions
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

const mockLeads: Lead[] = [
  {
    company: "Acme Solutions",
    industry: "SaaS",
    size: "Mid-Market",
    location: "San Francisco",
    techStack: ["AWS", "Salesforce", "HubSpot"],
    contact: {
      name: "Jane Smith",
      title: "VP of Marketing",
      department: "Marketing",
      email: "jane@acmesolutions.com"
    },
    status: "New"
  },
  {
    company: "TechForward",
    industry: "FinTech",
    size: "Enterprise",
    location: "New York",
    techStack: ["Azure", "Slack", "Stripe"],
    contact: {
      name: "Michael Johnson",
      title: "CTO",
      department: "Engineering",
      email: "michael@techforward.com"
    },
    status: "Contacted"
  },
  {
    company: "Innovate Inc",
    industry: "Healthcare",
    size: "SMB",
    location: "Chicago",
    techStack: ["GCP", "Zendesk", "Intercom"],
    contact: {
      name: "Robert Chen",
      title: "Director of Operations",
      department: "Operations",
      email: "robert@innovate.com"
    },
    status: "Demo Scheduled"
  },
  {
    company: "DataDrive Corp",
    industry: "Analytics",
    size: "Mid-Market",
    location: "Boston",
    techStack: ["AWS", "Tableau", "MongoDB"],
    contact: {
      name: "Sarah Williams",
      title: "Head of Data",
      department: "Data Science",
      email: "sarah@datadrive.com"
    },
    status: "New"
  },
  {
    company: "CloudSync Technologies",
    industry: "SaaS",
    size: "Mid-Market",
    location: "Austin",
    techStack: ["GCP", "Slack", "Zoom"],
    contact: {
      name: "Alex Rodriguez",
      title: "VP of Sales",
      department: "Sales",
      email: "alex@cloudsync.com"
    },
    status: "Qualified"
  },
  {
    company: "FinanceFlow",
    industry: "FinTech",
    size: "Enterprise",
    location: "Miami",
    techStack: ["AWS", "Salesforce", "Stripe"],
    contact: {
      name: "Emily Johnson",
      title: "Chief Revenue Officer",
      department: "Revenue",
      email: "emily@financeflow.com"
    },
    status: "Demo Scheduled"
  }
];
