
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ChartLine, Search, Filter, Bookmark, Send, X, 
  ExternalLink, Briefcase, Building, MapPin, Check
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
  consumerTrends?: any[]; // Keep for backward compatibility
  leads?: Lead[];
}

export const ConsumerTrends = ({ leads = mockLeads }: ConsumerTrendsProps) => {
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

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="text-right w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="font-medium">{lead.company}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <div className="flex items-center text-xs text-gray-500 mr-2">
                      <Building className="h-3 w-3 mr-1" /> {lead.industry}
                    </div>
                    <div className="flex items-center text-xs text-gray-500 mr-2">
                      <Briefcase className="h-3 w-3 mr-1" /> {lead.size}
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                      <MapPin className="h-3 w-3 mr-1" /> {lead.location}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {lead.techStack.map((tech, i) => (
                      <Badge key={i} variant="outline" className="text-xs px-1 py-0">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{lead.contact.name}</div>
                  <div className="text-sm text-gray-500">{lead.contact.title}</div>
                  <div className="text-xs text-gray-500">{lead.contact.email}</div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={lead.status === "New" ? "default" : 
                           (lead.status === "Contacted" ? "secondary" : "outline")}
                    className="text-xs"
                  >
                    {lead.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <Bookmark className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
  }
];
