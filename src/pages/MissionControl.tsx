import React, { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Building2, 
  Upload, 
  Database, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Upload as UploadIcon,
  FileText,
  Users,
  MessageSquare,
  BarChart3,
  Globe,
  Linkedin,
  Twitter,
  Youtube,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Trash2,
  Edit,
  MoreVertical,
  Clock,
  TrendingUp,
  Activity,
  XCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// Data Source Interface
interface DataSource {
  id: string;
  name: string;
  type: 'crm' | 'marketing' | 'social' | 'analytics' | 'communication' | 'file' | 'custom';
  icon: typeof Database;
  platform: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing' | 'warning' | 'uploaded' | 'processing' | 'empty';
  account?: string;
  connectedDate?: string;
  syncFrequency: 'realtime' | 'hourly' | '4hours' | 'daily' | 'weekly' | 'manual';
  lastSyncTime?: string;
  lastSyncStatus?: 'success' | 'failed' | 'partial';
  totalRecords: number;
  newRecordsThisWeek: number;
  updatedRecords: number;
  dataQualityScore: number;
  objectsSynced: string[];
  fieldsMapped: number;
  filters: string[];
  description?: string; // For file uploads
  error?: {
    message: string;
    code: string;
    occurredAt: string;
  };
}

// Mock Data Sources
const mockDataSources: DataSource[] = [
  {
    id: '1',
    name: 'Salesforce',
    type: 'crm',
    icon: Database,
    platform: 'Salesforce',
    status: 'connected',
    account: 'salesforce@company.com',
    connectedDate: '2024-01-15',
    syncFrequency: '4hours',
    lastSyncTime: '2 hours ago',
    lastSyncStatus: 'success',
    totalRecords: 1234,
    newRecordsThisWeek: 45,
    updatedRecords: 12,
    dataQualityScore: 92,
    objectsSynced: ['Contacts', 'Accounts', 'Opportunities'],
    fieldsMapped: 45,
    filters: ['Active accounts only']
  },
  {
    id: '2',
    name: 'HubSpot',
    type: 'crm',
    icon: BarChart3,
    platform: 'HubSpot',
    status: 'disconnected',
    syncFrequency: 'daily',
    totalRecords: 0,
    newRecordsThisWeek: 0,
    updatedRecords: 0,
    dataQualityScore: 0,
    objectsSynced: [],
    fieldsMapped: 0,
    filters: []
  },
  {
    id: '3',
    name: 'LinkedIn Sales Navigator',
    type: 'social',
    icon: Linkedin,
    platform: 'LinkedIn',
    status: 'connected',
    account: 'linkedin@company.com',
    connectedDate: '2024-02-01',
    syncFrequency: 'daily',
    lastSyncTime: '1 day ago',
    lastSyncStatus: 'success',
    totalRecords: 567,
    newRecordsThisWeek: 23,
    updatedRecords: 8,
    dataQualityScore: 88,
    objectsSynced: ['Company Pages', 'Profiles'],
    fieldsMapped: 32,
    filters: ['Last 90 days']
  },
  {
    id: '4',
    name: 'Website Analytics',
    type: 'analytics',
    icon: Globe,
    platform: 'Google Analytics',
    status: 'error',
    account: 'analytics@company.com',
    connectedDate: '2024-01-20',
    syncFrequency: 'hourly',
    lastSyncTime: '3 days ago',
    lastSyncStatus: 'failed',
    totalRecords: 890,
    newRecordsThisWeek: 0,
    updatedRecords: 0,
    dataQualityScore: 75,
    objectsSynced: ['Page Views', 'Events'],
    fieldsMapped: 28,
    filters: [],
    error: {
      message: 'API rate limit exceeded',
      code: '429',
      occurredAt: '3 days ago'
    }
  },
  {
    id: '5',
    name: 'LinkedIn Company',
    type: 'social',
    icon: Linkedin,
    platform: 'LinkedIn',
    status: 'disconnected',
    syncFrequency: 'weekly',
    totalRecords: 0,
    newRecordsThisWeek: 0,
    updatedRecords: 0,
    dataQualityScore: 0,
    objectsSynced: [],
    fieldsMapped: 0,
    filters: []
  },
  {
    id: '6',
    name: 'Twitter/X',
    type: 'social',
    icon: Twitter,
    platform: 'Twitter',
    status: 'disconnected',
    syncFrequency: 'manual',
    totalRecords: 0,
    newRecordsThisWeek: 0,
    updatedRecords: 0,
    dataQualityScore: 0,
    objectsSynced: [],
    fieldsMapped: 0,
    filters: []
  },
  // File Upload Sources
  {
    id: 'file-1',
    name: 'Call Transcripts',
    type: 'file',
    icon: MessageSquare,
    platform: 'File Upload',
    status: 'uploaded',
    syncFrequency: 'manual',
    lastSyncTime: 'Yesterday',
    totalRecords: 45,
    newRecordsThisWeek: 5,
    updatedRecords: 2,
    dataQualityScore: 95,
    objectsSynced: ['Transcripts'],
    fieldsMapped: 12,
    filters: [],
    description: 'Conversation transcripts from discovery and sales calls.'
  },
  {
    id: 'file-2',
    name: 'Meeting Notes',
    type: 'file',
    icon: FileText,
    platform: 'File Upload',
    status: 'processing',
    syncFrequency: 'manual',
    lastSyncTime: 'Just now',
    totalRecords: 0,
    newRecordsThisWeek: 0,
    updatedRecords: 0,
    dataQualityScore: 0,
    objectsSynced: [],
    fieldsMapped: 0,
    filters: [],
    description: 'Structured or freeform notes from meetings.'
  },
  {
    id: 'file-3',
    name: 'Product Documentation',
    type: 'file',
    icon: FileText,
    platform: 'File Upload',
    status: 'empty',
    syncFrequency: 'manual',
    totalRecords: 0,
    newRecordsThisWeek: 0,
    updatedRecords: 0,
    dataQualityScore: 0,
    objectsSynced: [],
    fieldsMapped: 0,
    filters: [],
    description: 'Docs, API guides, release notes, and specs.'
  },
  {
    id: 'file-4',
    name: 'Case Studies',
    type: 'file',
    icon: Users,
    platform: 'File Upload',
    status: 'uploaded',
    syncFrequency: 'manual',
    lastSyncTime: '3 days ago',
    totalRecords: 12,
    newRecordsThisWeek: 1,
    updatedRecords: 0,
    dataQualityScore: 90,
    objectsSynced: ['Case Studies'],
    fieldsMapped: 8,
    filters: [],
    description: 'Customer stories, wins, and proof points.'
  },
  {
    id: 'file-5',
    name: 'Support Tickets',
    type: 'file',
    icon: MessageSquare,
    platform: 'File Upload',
    status: 'empty',
    syncFrequency: 'manual',
    totalRecords: 0,
    newRecordsThisWeek: 0,
    updatedRecords: 0,
    dataQualityScore: 0,
    objectsSynced: [],
    fieldsMapped: 0,
    filters: [],
    description: 'Support conversations and resolutions.'
  },
  {
    id: 'file-6',
    name: 'Sales Presentations',
    type: 'file',
    icon: BarChart3,
    platform: 'File Upload',
    status: 'uploaded',
    syncFrequency: 'manual',
    lastSyncTime: '1 week ago',
    totalRecords: 28,
    newRecordsThisWeek: 0,
    updatedRecords: 3,
    dataQualityScore: 88,
    objectsSynced: ['Presentations'],
    fieldsMapped: 10,
    filters: [],
    description: 'Decks and one-pagers used in the sales cycle.'
  }
];

const MissionControl = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const [completeness, setCompleteness] = useState(65);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [expandedTableRows, setExpandedTableRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { toast } = useToast();
  const { currentUser } = useAuth();

  // Form state for company profile
  const [companyProfile, setCompanyProfile] = useState({
    companyName: "",
    headquarters: "",
    employeeSize: "",
    industry: "",
    revenue: "",
    gtmModel: "",
    regionFocus: "",
    dealSize: "",
    companyUrl: "",
    keyBuyerPersona: "",
  });

  const handleSave = async () => {
    if (!currentUser?.uid) {
      toast({
        title: "Authentication required",
        description: "Please log in to save your profile.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      // Prepare payload with profile_type as required by the API
      const payload = {
        profile_type: "company",
        company_name: companyProfile.companyName,
        headquarters: companyProfile.headquarters,
        employee_size: companyProfile.employeeSize,
        industry: companyProfile.industry,
        revenue_band: companyProfile.revenue,
        gtm_model: companyProfile.gtmModel,
        region_focus: companyProfile.regionFocus,
        typical_deal_size: companyProfile.dealSize,
        company_url: companyProfile.companyUrl,
        key_buyer_persona: companyProfile.keyBuyerPersona,
      };

      console.log("=== MISSION CONTROL: Saving company profile ===");
      console.log("Payload:", payload);

      const apiUrl = `/api/profile/company?user_id=${currentUser.uid}`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to save profile: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Company profile saved successfully:", data);

      toast({
        title: "Profile saved",
        description: "Your company profile has been saved successfully and will be reflected in Scout.",
      });

      // Update completeness based on filled fields
      const filledFields = Object.values(companyProfile).filter(value => value !== "").length;
      const totalFields = Object.keys(companyProfile).length;
      const newCompleteness = Math.round((filledFields / totalFields) * 100);
      setCompleteness(newCompleteness);

    } catch (error) {
      console.error("Error saving company profile:", error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Load existing profile data on mount
  useEffect(() => {
    const loadProfileData = async () => {
      if (!currentUser?.uid) return;

      try {
        const response = await fetch(`/api/profile/company?user_id=${currentUser.uid}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Loaded company profile data:", data);
          
          // Map API response to form state
          setCompanyProfile({
            companyName: data.company_name || data.companyName || "",
            headquarters: data.headquarters || "",
            employeeSize: data.employee_size || data.employeeSize || "",
            industry: data.industry || "",
            revenue: data.revenue_band || data.revenue || "",
            gtmModel: data.gtm_model || data.gtmModel || "",
            regionFocus: data.region_focus || data.regionFocus || "",
            dealSize: data.typical_deal_size || data.dealSize || "",
            companyUrl: data.company_url || data.companyUrl || "",
            keyBuyerPersona: data.key_buyer_persona || data.keyBuyerPersona || "",
          });

          // Update completeness
          const filledFields = Object.values({
            companyName: data.company_name || data.companyName || "",
            headquarters: data.headquarters || "",
            employeeSize: data.employee_size || data.employeeSize || "",
            industry: data.industry || "",
            revenue: data.revenue_band || data.revenue || "",
            gtmModel: data.gtm_model || data.gtmModel || "",
            regionFocus: data.region_focus || data.regionFocus || "",
            dealSize: data.typical_deal_size || data.dealSize || "",
            companyUrl: data.company_url || data.companyUrl || "",
            keyBuyerPersona: data.key_buyer_persona || data.keyBuyerPersona || "",
          }).filter(value => value !== "").length;
          const totalFields = 10;
          const newCompleteness = Math.round((filledFields / totalFields) * 100);
          setCompleteness(newCompleteness);
        }
      } catch (error) {
        console.error("Error loading company profile:", error);
      }
    };

    loadProfileData();
  }, [currentUser?.uid]);

  const handleConnect = (source: string) => {
    toast({
      title: `Connecting to ${source}`,
      description: `Setting up integration with ${source}...`,
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleTableRow = (id: string) => {
    setExpandedTableRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: DataSource['status']) => {
    switch (status) {
      case 'connected':
      case 'uploaded': return 'text-green-600 bg-green-50';
      case 'syncing':
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'disconnected':
      case 'empty': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusBadge = (status: DataSource['status']) => {
    switch (status) {
      case 'connected':
      case 'uploaded': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'syncing':
      case 'processing': return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'disconnected':
      case 'empty': return <XCircle className="h-4 w-4 text-gray-400" />;
      default: return null;
    }
  };

  const getTypeLabel = (type: DataSource['type']) => {
    const labels: Record<DataSource['type'], string> = {
      crm: 'CRM',
      marketing: 'Marketing',
      social: 'Social',
      analytics: 'Analytics',
      communication: 'Communication',
      file: 'File',
      custom: 'Custom'
    };
    return labels[type] || type;
  };

  const handleUpload = (type: string) => {
    toast({
      title: `Uploading ${type}`,
      description: `Processing your ${type} files...`,
    });
  };

  const handleAddSource = () => {
    toast({
      title: "Add new data source",
      description: "Opening the connector catalog (placeholder).",
    });
  };

  const filteredSources = mockDataSources.filter((source) => {
    const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (source.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || source.status === statusFilter;
    const matchesType = typeFilter === "all" || source.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const summary = {
    total: filteredSources.length,
    connected: filteredSources.filter((s) => s.status === "connected" || s.status === "uploaded").length,
    totalRecords: filteredSources.reduce((sum, s) => sum + s.totalRecords, 0),
    avgQuality:
      filteredSources.filter((s) => s.status === "connected" || s.status === "uploaded").length === 0
        ? 0
        : Math.round(
            filteredSources
              .filter((s) => (s.status === "connected" || s.status === "uploaded") && s.dataQualityScore > 0)
              .reduce((sum, s) => sum + s.dataQualityScore, 0) /
              (filteredSources.filter((s) => (s.status === "connected" || s.status === "uploaded") && s.dataQualityScore > 0).length || 1)
          ),
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 gap-1 md:gap-0">
            <TabsTrigger value="profile" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4">
              <Building2 className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Company Profile</span>
              <span className="sm:hidden">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="sources" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4">
              <Database className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Data Sources</span>
              <span className="sm:hidden">Sources</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4">
              <Settings className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Advanced Inputs</span>
              <span className="sm:hidden">Advanced</span>
            </TabsTrigger>
          </TabsList>

          {/* Company Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                <CardTitle>Company Information</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Completeness:</span>
                  <Progress value={completeness} className="w-16 sm:w-20" />
                  <span className="text-xs sm:text-sm font-medium">{completeness}%</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Company Name *</Label>
                    <Input 
                      id="company-name" 
                      placeholder="Enter company name"
                      value={companyProfile.companyName}
                      onChange={(e) => setCompanyProfile(prev => ({ ...prev, companyName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headquarters">Headquarters</Label>
                    <Input 
                      id="headquarters" 
                      placeholder="City, Country"
                      value={companyProfile.headquarters}
                      onChange={(e) => setCompanyProfile(prev => ({ ...prev, headquarters: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-size">Employee Size</Label>
                    <Select 
                      value={companyProfile.employeeSize}
                      onValueChange={(value) => setCompanyProfile(prev => ({ ...prev, employeeSize: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10</SelectItem>
                        <SelectItem value="11-50">11-50</SelectItem>
                        <SelectItem value="51-200">51-200</SelectItem>
                        <SelectItem value="201-500">201-500</SelectItem>
                        <SelectItem value="501-1000">501-1000</SelectItem>
                        <SelectItem value="1000+">1000+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Select 
                      value={companyProfile.industry}
                      onValueChange={(value) => setCompanyProfile(prev => ({ ...prev, industry: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="saas">SaaS</SelectItem>
                        <SelectItem value="fintech">FinTech</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                        <SelectItem value="ecommerce">E-commerce</SelectItem>
                        <SelectItem value="enterprise">Enterprise Software</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revenue">Revenue Band</Label>
                    <Select 
                      value={companyProfile.revenue}
                      onValueChange={(value) => setCompanyProfile(prev => ({ ...prev, revenue: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select revenue range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-1m">$0 - $1M</SelectItem>
                        <SelectItem value="1-5m">$1M - $5M</SelectItem>
                        <SelectItem value="5-10m">$5M - $10M</SelectItem>
                        <SelectItem value="10-50m">$10M - $50M</SelectItem>
                        <SelectItem value="50m+">$50M+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gtm-model">GTM Model</Label>
                    <Select 
                      value={companyProfile.gtmModel}
                      onValueChange={(value) => setCompanyProfile(prev => ({ ...prev, gtmModel: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select GTM model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product-led">Product-Led Growth</SelectItem>
                        <SelectItem value="sales-led">Sales-Led Growth</SelectItem>
                        <SelectItem value="marketing-led">Marketing-Led Growth</SelectItem>
                        <SelectItem value="hybrid">Hybrid Model</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-url">Company URL</Label>
                    <Input 
                      id="company-url" 
                      type="url"
                      placeholder="https://example.com"
                      value={companyProfile.companyUrl}
                      onChange={(e) => setCompanyProfile(prev => ({ ...prev, companyUrl: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-medium">ICP Basics (Optional)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="region-focus">Region Focus</Label>
                      <Input 
                        id="region-focus" 
                        placeholder="e.g., North America, EMEA"
                        value={companyProfile.regionFocus}
                        onChange={(e) => setCompanyProfile(prev => ({ ...prev, regionFocus: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deal-size">Typical Deal Size</Label>
                      <Input 
                        id="deal-size" 
                        placeholder="e.g., $10K - $50K"
                        value={companyProfile.dealSize}
                        onChange={(e) => setCompanyProfile(prev => ({ ...prev, dealSize: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-medium">Buyer Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="key-buyer-persona">Key Buyer Persona</Label>
                    <Textarea 
                      id="key-buyer-persona" 
                      placeholder="Describe your key buyer persona (e.g., VP of Sales at mid-market SaaS companies, CTO at fintech startups...)"
                      value={companyProfile.keyBuyerPersona}
                      onChange={(e) => setCompanyProfile(prev => ({ ...prev, keyBuyerPersona: e.target.value }))}
                      rows={4}
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleSave} 
                  className="w-full md:w-auto"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Sources Tab */}
          <TabsContent value="sources">
            <div className="space-y-6">
              {/* Data Sources Table */}
              <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Data Sources</h2>
                    <p className="text-sm text-muted-foreground">Manage integrations and file uploads in one place</p>
                  </div>
                  <Button onClick={handleAddSource} className="w-full md:w-auto">
                    <Database className="h-4 w-4 mr-2" />
                    Add Source
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Sources</p>
                      <p className="text-2xl font-bold">{summary.total}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Connected</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold">{summary.connected}</p>
                        <Badge variant="outline" className="text-xs">{Math.round(summary.connected / (summary.total || 1) * 100)}%</Badge>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Records</p>
                      <p className="text-2xl font-bold">{summary.totalRecords.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Avg Quality</p>
                      <p className="text-2xl font-bold">{summary.avgQuality}%</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-1 flex-col sm:flex-row gap-3">
                    <Input
                      placeholder="Search sources"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="sm:max-w-xs"
                    />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="sm:max-w-[180px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="connected">Connected</SelectItem>
                        <SelectItem value="uploaded">Uploaded</SelectItem>
                        <SelectItem value="syncing">Syncing</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="disconnected">Disconnected</SelectItem>
                        <SelectItem value="empty">Empty</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="sm:max-w-[180px]">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="crm">CRM</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="social">Social</SelectItem>
                        <SelectItem value="analytics">Analytics</SelectItem>
                        <SelectItem value="communication">Communication</SelectItem>
                        <SelectItem value="file">File</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {filteredSources.length === 0 && (
                  <Card>
                    <CardContent className="p-8 text-center space-y-3">
                      <p className="text-lg font-medium">No sources match these filters</p>
                      <p className="text-sm text-muted-foreground">Try adjusting search or filters to see results.</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[20%]">Source</TableHead>
                            <TableHead className="w-[10%]">Type</TableHead>
                            <TableHead className="w-[10%]">Status</TableHead>
                            <TableHead className="w-[10%]">Records</TableHead>
                            <TableHead className="w-[15%]">Last Sync</TableHead>
                            <TableHead className="w-[10%]">Data Quality</TableHead>
                            <TableHead className="w-[10%]">Sync Frequency</TableHead>
                            <TableHead className="w-[15%]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSources.map((source) => {
                            const isExpanded = expandedTableRows.has(source.id);
                            const SourceIcon = source.icon;
                            
                            return (
                              <React.Fragment key={source.id}>
                                <TableRow 
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => toggleTableRow(source.id)}
                                >
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <SourceIcon className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <span className="font-medium">{source.name}</span>
                                        {source.description && (
                                          <p className="text-xs text-muted-foreground mt-0.5">{source.description}</p>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">{getTypeLabel(source.type)}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {getStatusBadge(source.status)}
                                      <span className="text-sm capitalize">
                                        {source.status === 'uploaded' ? 'Uploaded' :
                                         source.status === 'processing' ? 'Processing' :
                                         source.status === 'empty' ? 'Empty' :
                                         source.status}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-medium">{source.totalRecords.toLocaleString()}</span>
                                  </TableCell>
                                  <TableCell>
                                    {source.lastSyncTime ? (
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>{source.lastSyncTime}</span>
                                      </div>
                                    ) : source.type === 'file' && source.status === 'empty' ? (
                                      <span className="text-sm text-muted-foreground">-</span>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">Never</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {(source.status === 'connected' || source.status === 'uploaded') && source.dataQualityScore > 0 ? (
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 bg-muted rounded-full h-2">
                                          <div 
                                            className={`h-2 rounded-full ${
                                              source.dataQualityScore >= 90 ? 'bg-green-500' :
                                              source.dataQualityScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}
                                            style={{ width: `${source.dataQualityScore}%` }}
                                          />
                                        </div>
                                        <span className="text-sm font-medium">{source.dataQualityScore}%</span>
                                      </div>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm capitalize">{source.syncFrequency}</span>
                                  </TableCell>
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1">
                                      {source.type === 'file' ? (
                                        <Button
                                          size="sm"
                                          variant={source.status === 'empty' ? 'default' : 'outline'}
                                          onClick={() => handleUpload(source.name)}
                                          className="h-8 px-2"
                                        >
                                          <UploadIcon className="h-3 w-3 mr-1" />
                                          {source.status === 'uploaded' ? 'Re-upload' : 'Upload'}
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleConnect(source.name)}
                                          className="h-8 px-2"
                                        >
                                          {source.status === 'connected' ? 'Reconnect' : source.status === 'error' ? 'Retry' : 'Connect'}
                                        </Button>
                                      )}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => toggleTableRow(source.id)}>
                                            {isExpanded ? 'Collapse' : 'Expand'} Details
                                          </DropdownMenuItem>
                                          {(source.status === 'connected' || source.status === 'uploaded') && (
                                            <>
                                              {source.type !== 'file' && (
                                                <DropdownMenuItem onClick={() => toast({ title: "Manual sync triggered" })}>
                                                  <RefreshCw className="h-4 w-4 mr-2" />
                                                  Sync Now
                                                </DropdownMenuItem>
                                              )}
                                              <DropdownMenuItem onClick={() => toast({ title: "Opening configuration" })}>
                                                <Settings className="h-4 w-4 mr-2" />
                                                Configure
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                          <DropdownMenuItem 
                                            onClick={() => toast({ title: "Delete source", description: `Are you sure you want to delete ${source.name}?` })}
                                            className="text-red-600"
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                
                                {/* Expanded Row Details */}
                                {isExpanded && (
                                  <TableRow>
                                    <TableCell colSpan={8} className="bg-muted/30">
                                      <div className="p-4 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                          {/* Connection Details */}
                                          {(source.status === 'connected' || source.status === 'uploaded') && (
                                            <div className="space-y-2">
                                              <p className="text-sm font-semibold">{source.type === 'file' ? 'Upload Details' : 'Connection Details'}</p>
                                              <div className="text-sm text-muted-foreground space-y-1">
                                                {source.type !== 'file' && source.account && <p>Account: {source.account}</p>}
                                                <p>{source.type === 'file' ? 'Uploaded' : 'Connected'}: {source.connectedDate ? new Date(source.connectedDate).toLocaleDateString() : source.lastSyncTime || 'N/A'}</p>
                                                {source.type !== 'file' && <p>Sync Frequency: {source.syncFrequency}</p>}
                                              </div>
                                            </div>
                                          )}

                                          {/* Data Metrics */}
                                          {(source.status === 'connected' || source.status === 'uploaded') && (
                                            <div className="space-y-2">
                                              <p className="text-sm font-semibold">Data Metrics</p>
                                              <div className="text-sm text-muted-foreground space-y-1">
                                                <p>Total: {source.totalRecords.toLocaleString()}</p>
                                                {source.type !== 'file' && (
                                                  <>
                                                    <p>New This Week: {source.newRecordsThisWeek}</p>
                                                    <p>Updated: {source.updatedRecords}</p>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          )}

                                          {/* Configuration */}
                                          {(source.status === 'connected' || source.status === 'uploaded') && (
                                            <div className="space-y-2">
                                              <p className="text-sm font-semibold">Configuration</p>
                                              <div className="text-sm text-muted-foreground space-y-1">
                                                {source.type === 'file' ? (
                                                  <>
                                                    <p>Files: {source.objectsSynced.length}</p>
                                                    <p>Fields: {source.fieldsMapped}</p>
                                                  </>
                                                ) : (
                                                  <>
                                                    <p>Objects: {source.objectsSynced.length}</p>
                                                    <p>Fields: {source.fieldsMapped}</p>
                                                    <p>Filters: {source.filters.length}</p>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          )}

                                          {/* Error Details */}
                                          {source.status === 'error' && source.error && (
                                            <div className="space-y-2">
                                              <p className="text-sm font-semibold text-red-600">Error Details</p>
                                              <div className="text-sm text-muted-foreground space-y-1">
                                                <p>{source.error.message}</p>
                                                <p>Code: {source.error.code}</p>
                                                <p>Occurred: {source.error.occurredAt}</p>
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* Quick Actions */}
                                        <div className="flex items-center gap-2 pt-2 border-t">
                                          {source.type === 'file' ? (
                                            <>
                                              <Button size="sm" variant="outline" onClick={() => handleUpload(source.name)}>
                                                <UploadIcon className="h-4 w-4 mr-2" />
                                                {source.status === 'uploaded' ? 'Re-upload Files' : 'Upload Files'}
                                              </Button>
                                              {source.status === 'uploaded' && (
                                                <Button size="sm" variant="outline" onClick={() => toast({ title: "Viewing files" })}>
                                                  <FileText className="h-4 w-4 mr-2" />
                                                  View Files
                                                </Button>
                                              )}
                                            </>
                                          ) : (
                                            <>
                                              {source.status === 'connected' && (
                                                <>
                                                  <Button size="sm" variant="outline" onClick={() => toast({ title: "Manual sync triggered" })}>
                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                    Sync Now
                                                  </Button>
                                                  <Button size="sm" variant="outline" onClick={() => toast({ title: "Opening configuration" })}>
                                                    <Settings className="h-4 w-4 mr-2" />
                                                    Configure
                                                  </Button>
                                                  <Button size="sm" variant="outline" onClick={() => toast({ title: "Viewing logs" })}>
                                                    <FileText className="h-4 w-4 mr-2" />
                                                    View Logs
                                                  </Button>
                                                </>
                                              )}
                                              {source.status === 'error' && (
                                                <Button size="sm" onClick={() => handleConnect(source.name)}>
                                                  <RefreshCw className="h-4 w-4 mr-2" />
                                                  Retry Connection
                                                </Button>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
              </div>
            </div>
          </TabsContent>

          {/* Advanced Inputs Tab */}
          <TabsContent value="advanced">
            <Accordion type="multiple" className="space-y-4">
              <AccordionItem value="buying-committee">
                <AccordionTrigger className="text-lg font-medium">
                  Buying Committee Mapping
                </AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <Label>Select typical roles in your buying process</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {["Decision Maker", "Influencer", "Blocker", "Champion", "Budget Holder", "Technical Evaluator"].map((role) => (
                          <Label key={role} className="flex items-center gap-2 cursor-pointer p-2 rounded border hover:bg-muted">
                            <input type="checkbox" className="rounded" />
                            {role}
                          </Label>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="priorities">
                <AccordionTrigger className="text-lg font-medium">
                  Strategic Priorities
                </AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="business-goals">Primary Business Goals</Label>
                        <Textarea id="business-goals" placeholder="e.g., Increase revenue by 40%, expand into new markets..." />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pain-points">Key Pain Points We Solve</Label>
                        <Textarea id="pain-points" placeholder="e.g., Manual processes, data silos, compliance challenges..." />
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="positioning">
                <AccordionTrigger className="text-lg font-medium">
                  Market Positioning
                </AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="target-segments">Target Segments (Include)</Label>
                          <Textarea id="target-segments" placeholder="e.g., Mid-market SaaS companies, Financial services..." />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="exclude-segments">Exclude Segments</Label>
                          <Textarea id="exclude-segments" placeholder="e.g., Startups under 50 employees, Government..." />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="compliance">
                <AccordionTrigger className="text-lg font-medium">
                  Compliance & Constraints
                </AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="compliance-reqs">Compliance Requirements</Label>
                        <Textarea id="compliance-reqs" placeholder="e.g., GDPR, HIPAA, SOC2..." />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="messaging-constraints">Messaging Constraints</Label>
                        <Textarea id="messaging-constraints" placeholder="e.g., Avoid certain terms, required disclaimers..." />
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="sticky bottom-0 bg-background border-t pt-4 pb-4">
              <Button className="w-full md:w-auto" onClick={handleSave}>
                Save & Apply Configuration
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default MissionControl;
