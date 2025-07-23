
// import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { 
//   ChartLine, Filter, Bookmark, Send, 
//   ExternalLink, Briefcase, Building, MapPin
// } from "lucide-react";

// interface Lead {
//   company: string;
//   industry: string;
//   size: string;
//   location: string;
//   techStack: string[];
//   contact: {
//     name: string;
//     title: string;
//     department: string;
//     email: string;
//   };
//   status: string;
// }

// interface ConsumerTrendsProps {
//   consumerTrends?: any[];
//   leads?: Lead[];
// }

// export const ConsumerTrends = ({ leads = mockLeads }: ConsumerTrendsProps) => {
//   // Group leads by status
//   const groupedLeads = leads.reduce((acc, lead) => {
//     if (!acc[lead.status]) {
//       acc[lead.status] = [];
//     }
//     acc[lead.status].push(lead);
//     return acc;
//   }, {} as Record<string, Lead[]>);

//   const statusColumns = [
//     { key: 'New', title: 'New Leads', color: 'bg-blue-50 border-blue-200' },
//     { key: 'Contacted', title: 'Contacted', color: 'bg-yellow-50 border-yellow-200' },
//     { key: 'Demo Scheduled', title: 'Demo Scheduled', color: 'bg-green-50 border-green-200' },
//     { key: 'Qualified', title: 'Qualified', color: 'bg-purple-50 border-purple-200' }
//   ];

//   const getStatusBadgeVariant = (status: string) => {
//     switch (status) {
//       case 'New': return 'default';
//       case 'Contacted': return 'secondary';
//       case 'Demo Scheduled': return 'outline';
//       case 'Qualified': return 'outline';
//       default: return 'outline';
//     }
//   };

//   return (
//     <Card className="shadow-md">
//       <CardHeader className="border-b pb-3">
//         <div className="flex justify-between items-center">
//           <div>
//             <CardTitle className="flex items-center gap-2 text-2xl">
//               <ChartLine className="h-6 w-6 text-blue-600" /> Your Lead Stream
//             </CardTitle>
//             <CardDescription className="text-base mt-1">
//               Here are today's high-fit leads curated based on your ICP preferences.
//             </CardDescription>
//             <div className="flex items-center gap-2 mt-2">
//               <Badge variant="outline" className="px-2 py-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
//                 ICP: Mid-Market SaaS in North America
//               </Badge>
//               <Button variant="outline" size="sm" className="h-7 text-xs">
//                 Edit ICP
//               </Button>
//             </div>
//           </div>
//         </div>
//       </CardHeader>

//       <div className="p-4 border-b bg-gray-50">
//         <div className="flex flex-wrap gap-3">
//           <div className="flex items-center gap-2">
//             <Select defaultValue="all">
//               <SelectTrigger className="w-[130px] h-9">
//                 <SelectValue placeholder="Industry" />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="all">All Industries</SelectItem>
//                 <SelectItem value="saas">SaaS</SelectItem>
//                 <SelectItem value="finance">Finance</SelectItem>
//                 <SelectItem value="healthcare">Healthcare</SelectItem>
//               </SelectContent>
//             </Select>
//           </div>
          
//           <div className="flex items-center gap-2">
//             <Select defaultValue="all">
//               <SelectTrigger className="w-[130px] h-9">
//                 <SelectValue placeholder="Company Size" />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="all">All Sizes</SelectItem>
//                 <SelectItem value="smb">SMB</SelectItem>
//                 <SelectItem value="mid">Mid-Market</SelectItem>
//                 <SelectItem value="enterprise">Enterprise</SelectItem>
//               </SelectContent>
//             </Select>
//           </div>
          
//           <div className="flex items-center gap-2">
//             <Select defaultValue="all">
//               <SelectTrigger className="w-[130px] h-9">
//                 <SelectValue placeholder="Region" />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="all">All Regions</SelectItem>
//                 <SelectItem value="na">North America</SelectItem>
//                 <SelectItem value="eu">Europe</SelectItem>
//                 <SelectItem value="apac">APAC</SelectItem>
//               </SelectContent>
//             </Select>
//           </div>
          
//           <div className="flex flex-1 justify-end">
//             <Button variant="default" size="sm" className="ml-1">
//               Apply Filters
//             </Button>
//             <Button variant="outline" size="sm" className="ml-2">
//               Save as ICP
//             </Button>
//           </div>
//         </div>
//       </div>

//       <div className="border-b bg-blue-50/60 p-3">
//         <div className="text-sm font-medium text-blue-700 mb-1">Suggestions by Scout</div>
//         <div className="flex gap-3 overflow-x-auto py-1">
//           <Card className="min-w-[240px] bg-white shadow-sm">
//             <CardContent className="p-3">
//               <div className="text-xs">Scout found 3 similar companies to Acme Corp</div>
//             </CardContent>
//           </Card>
//           <Card className="min-w-[240px] bg-white shadow-sm">
//             <CardContent className="p-3">
//               <div className="text-xs">Try targeting CTOs in the same industry</div>
//             </CardContent>
//           </Card>
//           <Card className="min-w-[240px] bg-white shadow-sm">
//             <CardContent className="p-3">
//               <div className="text-xs">New funding alert: 2 ICP-matched startups raised Series A today</div>
//             </CardContent>
//           </Card>
//         </div>
//       </div>

//       {/* Kanban Board */}
//       <CardContent className="p-4">
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//           {statusColumns.map((column) => (
//             <div key={column.key} className={`rounded-lg border-2 ${column.color} p-3`}>
//               <div className="flex items-center justify-between mb-3">
//                 <h3 className="font-semibold text-sm">{column.title}</h3>
//                 <Badge variant="outline" className="text-xs">
//                   {groupedLeads[column.key]?.length || 0}
//                 </Badge>
//               </div>
              
//               <div className="space-y-3 max-h-96 overflow-y-auto">
//                 {groupedLeads[column.key]?.map((lead, index) => (
//                   <Card key={index} className="bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
//                     <CardContent className="p-3">
//                       <div className="flex justify-between items-start mb-2">
//                         <h4 className="font-medium text-sm">{lead.company}</h4>
//                         <Badge 
//                           variant={getStatusBadgeVariant(lead.status)}
//                           className="text-xs"
//                         >
//                           {lead.status}
//                         </Badge>
//                       </div>
                      
//                       <div className="space-y-1 mb-2">
//                         <div className="flex items-center text-xs text-gray-500">
//                           <Building className="h-3 w-3 mr-1" /> {lead.industry}
//                         </div>
//                         <div className="flex items-center text-xs text-gray-500">
//                           <Briefcase className="h-3 w-3 mr-1" /> {lead.size}
//                         </div>
//                         <div className="flex items-center text-xs text-gray-500">
//                           <MapPin className="h-3 w-3 mr-1" /> {lead.location}
//                         </div>
//                       </div>
                      
//                       <div className="border-t pt-2 mb-2">
//                         <div className="font-medium text-xs">{lead.contact.name}</div>
//                         <div className="text-xs text-gray-500">{lead.contact.title}</div>
//                         <div className="text-xs text-gray-500 truncate">{lead.contact.email}</div>
//                       </div>
                      
//                       <div className="flex flex-wrap gap-1 mb-3">
//                         {lead.techStack.slice(0, 2).map((tech, i) => (
//                           <Badge key={i} variant="outline" className="text-xs px-1 py-0">
//                             {tech}
//                           </Badge>
//                         ))}
//                         {lead.techStack.length > 2 && (
//                           <Badge variant="outline" className="text-xs px-1 py-0">
//                             +{lead.techStack.length - 2}
//                           </Badge>
//                         )}
//                       </div>
                      
//                       <div className="flex justify-between gap-1">
//                         <Button size="icon" variant="ghost" className="h-6 w-6">
//                           <Bookmark className="h-3 w-3" />
//                         </Button>
//                         <Button size="icon" variant="ghost" className="h-6 w-6">
//                           <Send className="h-3 w-3" />
//                         </Button>
//                         <Button size="icon" variant="ghost" className="h-6 w-6">
//                           <ExternalLink className="h-3 w-3" />
//                         </Button>
//                       </div>
//                     </CardContent>
//                   </Card>
//                 )) || (
//                   <div className="text-center text-gray-500 text-sm py-4">
//                     No leads in this stage
//                   </div>
//                 )}
//               </div>
//             </div>
//           ))}
//         </div>
//       </CardContent>
      
//       <CardFooter className="flex justify-between border-t p-4">
//         <div className="flex flex-wrap gap-2">
//           <div className="bg-gray-100 px-3 py-1 rounded text-sm">
//             <span className="font-medium">22</span> leads scouted
//           </div>
//           <div className="bg-gray-100 px-3 py-1 rounded text-sm">
//             <span className="font-medium">7</span> added to workflow
//           </div>
//           <div className="bg-gray-100 px-3 py-1 rounded text-sm">
//             <span className="font-medium">5</span> contacted
//           </div>
//         </div>
//         <div className="flex gap-2">
//           <Button variant="outline" size="sm">
//             Export CSV
//           </Button>
//           <Button variant="default" size="sm">
//             Bulk Actions
//           </Button>
//         </div>
//       </CardFooter>
//     </Card>
//   );
// };

// const mockLeads: Lead[] = [
//   {
//     company: "Acme Solutions",
//     industry: "SaaS",
//     size: "Mid-Market",
//     location: "San Francisco",
//     techStack: ["AWS", "Salesforce", "HubSpot"],
//     contact: {
//       name: "Jane Smith",
//       title: "VP of Marketing",
//       department: "Marketing",
//       email: "jane@acmesolutions.com"
//     },
//     status: "New"
//   },
//   {
//     company: "TechForward",
//     industry: "FinTech",
//     size: "Enterprise",
//     location: "New York",
//     techStack: ["Azure", "Slack", "Stripe"],
//     contact: {
//       name: "Michael Johnson",
//       title: "CTO",
//       department: "Engineering",
//       email: "michael@techforward.com"
//     },
//     status: "Contacted"
//   },
//   {
//     company: "Innovate Inc",
//     industry: "Healthcare",
//     size: "SMB",
//     location: "Chicago",
//     techStack: ["GCP", "Zendesk", "Intercom"],
//     contact: {
//       name: "Robert Chen",
//       title: "Director of Operations",
//       department: "Operations",
//       email: "robert@innovate.com"
//     },
//     status: "Demo Scheduled"
//   },
//   {
//     company: "DataDrive Corp",
//     industry: "Analytics",
//     size: "Mid-Market",
//     location: "Boston",
//     techStack: ["AWS", "Tableau", "MongoDB"],
//     contact: {
//       name: "Sarah Williams",
//       title: "Head of Data",
//       department: "Data Science",
//       email: "sarah@datadrive.com"
//     },
//     status: "New"
//   },
//   {
//     company: "CloudSync Technologies",
//     industry: "SaaS",
//     size: "Mid-Market",
//     location: "Austin",
//     techStack: ["GCP", "Slack", "Zoom"],
//     contact: {
//       name: "Alex Rodriguez",
//       title: "VP of Sales",
//       department: "Sales",
//       email: "alex@cloudsync.com"
//     },
//     status: "Qualified"
//   },
//   {
//     company: "FinanceFlow",
//     industry: "FinTech",
//     size: "Enterprise",
//     location: "Miami",
//     techStack: ["AWS", "Salesforce", "Stripe"],
//     contact: {
//       name: "Emily Johnson",
//       title: "Chief Revenue Officer",
//       department: "Revenue",
//       email: "emily@financeflow.com"
//     },
//     status: "Demo Scheduled"
//   }
// ];



import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, Filter, Bookmark, Send, 
  ExternalLink, Briefcase, Building, MapPin, Loader2, RefreshCw
} from "lucide-react";
import { useState, useEffect } from "react";

interface Lead {
  company: string;
  industry: string;
  size: string;
  location: string;
  region: string;
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
  apiEndpoint?: string;
  userId?: string;
  // Props for persistent filter state
  selectedIndustry?: string;
  selectedSize?: string;
  selectedRegion?: string;
  onFiltersChange?: (filters: { selectedIndustry: string; selectedSize: string; selectedRegion: string }) => void;
}

export const ConsumerTrends = ({ 
  apiEndpoint = "https://backend-11kr.onrender.com/leads",
  userId = "brewra",
  selectedIndustry = "all",
  selectedSize = "all", 
  selectedRegion = "all",
  onFiltersChange
}: ConsumerTrendsProps) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Helper function to handle filter changes
  const handleFilterChange = (filterType: 'industry' | 'size' | 'region', value: string) => {
    if (onFiltersChange) {
      const newFilters = {
        selectedIndustry: filterType === 'industry' ? value : selectedIndustry,
        selectedSize: filterType === 'size' ? value : selectedSize,
        selectedRegion: filterType === 'region' ? value : selectedRegion
      };
      onFiltersChange(newFilters);
    }
  };

  // Dynamic status columns based on actual data
  const getStatusColumns = (leadsData: Lead[]) => {
    const uniqueStatuses = [...new Set(leadsData.map(lead => lead.status))];
    
    // Define colors for different statuses
    const statusColorMap: Record<string, string> = {
      'New': 'bg-blue-50 border-blue-200',
      'Contacted': 'bg-yellow-50 border-yellow-200',
      'Demo Scheduled': 'bg-green-50 border-green-200',
      'Qualified': 'bg-purple-50 border-purple-200',
      'Discovery': 'bg-orange-50 border-orange-200',
      'Prospecting': 'bg-teal-50 border-teal-200',
      'Technical Fit': 'bg-indigo-50 border-indigo-200',
      'Demo': 'bg-pink-50 border-pink-200',
      'Qualification': 'bg-cyan-50 border-cyan-200'
    };

    // Default color for unknown statuses
    const defaultColor = 'bg-gray-50 border-gray-200';

    return uniqueStatuses.map(status => ({
      key: status,
      title: status,
      color: statusColorMap[status] || defaultColor
    }));
  };

  // Fetch leads from API
  const fetchLeads = async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Construct the full URL
      const fullUrl = `${apiEndpoint}/${userId}`;
      console.log('Fetching from:', fullUrl);

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Add any additional headers your API requires
          // 'Authorization': 'Bearer your-token', // if needed
        },
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      // Handle different response structures
      const leadsArray = Array.isArray(data) ? data : (data.leads || data.data || []);
      
      if (!Array.isArray(leadsArray)) {
        throw new Error('Invalid API response format: expected array of leads');
      }
      
      // Transform the API data to match our Lead interface
      const transformedLeads: Lead[] = leadsArray.map((item: any, index: number) => ({
        company: item.company || item.companyName || `Company ${index + 1}`,
        industry: item.industry || item.sector || 'Technology',
        size: item.size || item.companySize || item.employees || 'Mid-Market',
        location: item.location || item.city || item.address || 'Unknown Location',
        region: item.region || item.country || item.area || 'North America',
        techStack: Array.isArray(item.techStack) 
          ? item.techStack 
          : Array.isArray(item.technologies)
          ? item.technologies
          : typeof item.techStack === 'string'
          ? item.techStack.split(',').map((t: string) => t.trim())
          : ['React', 'Node.js'], // default tech stack
        contact: {
          name: item.contact?.name || item.contactName || item.name || 'John Doe',
          title: item.contact?.title || item.contactTitle || item.title || item.position || 'Software Engineer',
          department: item.contact?.department || item.department || 'Engineering',
          email: item.contact?.email || item.contactEmail || item.email || `contact@${(item.company || 'company').toLowerCase().replace(/\s+/g, '')}.com`
        },
        status: item.status || item.stage || item.leadStatus || 'New'
      }));
      
      setLeads(transformedLeads);
      console.log('Transformed leads:', transformedLeads);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch leads from API';
      setError(errorMessage);
      console.error('Error fetching leads:', err);
      
      // For demonstration, add some mock data if API fails
      const mockLeads: Lead[] = [
        {
          company: "TechCorp Solutions",
          industry: "SaaS",
          size: "Mid-Market",
          location: "San Francisco, CA",
          region: "North America",
          techStack: ["React", "Node.js", "AWS"],
          contact: {
            name: "Sarah Johnson",
            title: "VP of Engineering",
            department: "Engineering",
            email: "sarah.johnson@techcorp.com"
          },
          status: "Discovery"
        },
        {
          company: "DataFlow Inc",
          industry: "Analytics",
          size: "Enterprise",
          location: "New York, NY",
          region: "North America",
          techStack: ["Python", "PostgreSQL", "Docker"],
          contact: {
            name: "Mike Chen",
            title: "CTO",
            department: "Technology",
            email: "mike.chen@dataflow.com"
          },
          status: "Prospecting"
        },
        {
          company: "CloudScale Systems",
          industry: "Infrastructure",
          size: "Mid-Market",
          location: "Austin, TX",
          region: "North America",
          techStack: ["Kubernetes", "Go", "GCP"],
          contact: {
            name: "Jessica Rodriguez",
            title: "Engineering Director",
            department: "Engineering",
            email: "jessica.r@cloudscale.com"
          },
          status: "Qualification"
        },
        {
          company: "AI Innovations",
          industry: "Machine Learning",
          size: "Startup",
          location: "Seattle, WA",
          region: "North America",
          techStack: ["Python", "TensorFlow", "AWS"],
          contact: {
            name: "David Kim",
            title: "Lead AI Engineer",
            department: "Research",
            email: "david.kim@aiinnovations.com"
          },
          status: "New"
        },
        {
          company: "FinTech Solutions",
          industry: "Financial Services",
          size: "Enterprise",
          location: "London, UK",
          region: "Europe",
          techStack: ["Java", "Spring", "Oracle"],
          contact: {
            name: "Emma Thompson",
            title: "Head of Technology",
            department: "Engineering",
            email: "emma.thompson@fintech.com"
          },
          status: "Contacted"
        },
        {
          company: "Healthcare Tech",
          industry: "Healthcare",
          size: "Mid-Market",
          location: "Boston, MA",
          region: "North America",
          techStack: ["React", "Python", "Azure"],
          contact: {
            name: "Dr. James Wilson",
            title: "Chief Technology Officer",
            department: "Technology",
            email: "james.wilson@healthtech.com"
          },
          status: "Demo Scheduled"
        }
      ];
      setLeads(mockLeads);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLeads();
  }, [apiEndpoint, userId]);

  // Handle refresh
  const handleRefresh = () => {
    fetchLeads(true);
  };

  const getStatusBadgeVariant = (status: string) => {
    const variantMap: Record<string, string> = {
      'New': 'default',
      'Contacted': 'secondary',
      'Demo Scheduled': 'outline',
      'Qualified': 'outline',
      'Discovery': 'secondary',
      'Prospecting': 'default',
      'Technical Fit': 'outline',
      'Demo': 'secondary',
      'Qualification': 'outline'
    };
    return variantMap[status] || 'outline';
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesIndustry = selectedIndustry === "all" || lead.industry === selectedIndustry;
    const matchesSize = selectedSize === "all" || lead.size === selectedSize;
    const matchesRegion = selectedRegion === "all" || lead.region === selectedRegion;
    return matchesIndustry && matchesSize && matchesRegion;
  });

  const groupedLeads = filteredLeads.reduce((acc, lead) => {
    if (!acc[lead.status]) {
      acc[lead.status] = [];
    }
    acc[lead.status].push(lead);
    return acc;
  }, {} as Record<string, Lead[]>);

  // Get unique values for filters
  const uniqueIndustries = [...new Set(leads.map(lead => lead.industry))];
  const uniqueSizes = [...new Set(leads.map(lead => lead.size))];
  const uniqueRegions = [...new Set(leads.map(lead => lead.region))];

  // Calculate stats
  const totalLeads = leads.length;
  const addedToWorkflow = leads.filter(lead => ['Contacted', 'Demo Scheduled', 'Qualified', 'Discovery'].includes(lead.status)).length;
  const contacted = leads.filter(lead => ['Contacted', 'Demo Scheduled', 'Qualified'].includes(lead.status)).length;

  // Get dynamic status columns
  const statusColumns = getStatusColumns(leads);

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardContent className="flex items-center justify-center p-8">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading your Leads...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-md">
        <CardContent className="p-8">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <strong>API Error:</strong> {error}
            </div>
            <div className="text-sm text-gray-600 mb-4">
              Endpoint: {apiEndpoint}/{userId}
            </div>
            <div className="text-sm text-blue-600 mb-4">
              Showing demo data for testing purposes
            </div>
            <Button onClick={() => fetchLeads()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry API Call
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <TrendingUp className="h-6 w-6 text-blue-600" /> Your Lead Stream
            </CardTitle>
            <CardDescription className="text-base mt-1">
              Here are today's high-fit leads curated based on your ICP preferences.
            </CardDescription>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="px-2 py-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                ICP: Mid-Market SaaS in North America
              </Badge>
              <Badge variant="outline" className="px-2 py-1 text-xs bg-green-50 text-green-700 border-green-200">
                User: {userId}
              </Badge>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                Edit ICP
              </Button>
            </div>
          </div>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>

      <div className="p-4 border-b bg-gray-50">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Select value={selectedIndustry} onValueChange={(value) => handleFilterChange('industry', value)}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {uniqueIndustries.map(industry => (
                  <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={selectedSize} onValueChange={(value) => handleFilterChange('size', value)}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Company Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                {uniqueSizes.map(size => (
                  <SelectItem key={size} value={size}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={selectedRegion} onValueChange={(value) => handleFilterChange('region', value)}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {uniqueRegions.map(region => (
                  <SelectItem key={region} value={region}>{region}</SelectItem>
                ))}
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
              <div className="text-xs">Scout found {Math.floor(totalLeads * 0.3)} similar companies to your top prospects</div>
            </CardContent>
          </Card>
          <Card className="min-w-[240px] bg-white shadow-sm">
            <CardContent className="p-3">
              <div className="text-xs">Try targeting CTOs in the same industry</div>
            </CardContent>
          </Card>
          <Card className="min-w-[240px] bg-white shadow-sm">
            <CardContent className="p-3">
              <div className="text-xs">New funding alert: {Math.floor(totalLeads * 0.1)} ICP-matched startups raised Series A today</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dynamic Kanban Board with Horizontal Scroll */}
      <CardContent className="p-4">
        <style dangerouslySetInnerHTML={{__html: `
          .horizontal-scroll::-webkit-scrollbar {
            height: 12px;
          }
          .horizontal-scroll::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 6px;
          }
          .horizontal-scroll::-webkit-scrollbar-thumb {
            background: #94a3b8;
            border-radius: 6px;
            border: 2px solid #f1f5f9;
          }
          .horizontal-scroll::-webkit-scrollbar-thumb:hover {
            background: #64748b;
          }
          .horizontal-scroll {
            scrollbar-width: thin;
            scrollbar-color: #94a3b8 #f1f5f9;
          }
        `}} />
        <div 
          className="horizontal-scroll flex gap-4 overflow-x-scroll pb-4" 
          style={{
            width: '100%',
            minHeight: '500px'
          }}
        >
          {statusColumns.map((column) => (
            <div key={column.key} className={`flex-shrink-0 w-80 rounded-lg border-2 ${column.color} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{column.title}</h3>
                <Badge variant="outline" className="text-xs">
                  {groupedLeads[column.key]?.length || 0}
                </Badge>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {groupedLeads[column.key]?.map((lead, index) => (
                  <Card key={`${lead.company}-${index}`} className="bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-sm">{lead.company}</h4>
                        <Badge 
                          variant={getStatusBadgeVariant(lead.status) as any}
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
                )) || null}
                {(!groupedLeads[column.key] || groupedLeads[column.key].length === 0) && (
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
            <span className="font-medium">{totalLeads}</span> leads scouted
          </div>
          <div className="bg-gray-100 px-3 py-1 rounded text-sm">
            <span className="font-medium">{addedToWorkflow}</span> added to workflow
          </div>
          <div className="bg-gray-100 px-3 py-1 rounded text-sm">
            <span className="font-medium">{contacted}</span> contacted
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

export default ConsumerTrends;