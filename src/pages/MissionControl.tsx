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
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  XCircle,
  Search,
  Plus,
  Mail,
  Calendar,
  Zap,
  Github,
  Slack
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
    name: 'X',
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

// Available Connectors Catalog
interface Connector {
  id: string;
  name: string;
  type: DataSource['type'];
  icon: typeof Database;
  platform: string;
  description: string;
  category: string;
  isPopular?: boolean;
  isNew?: boolean;
}

const availableConnectors: Connector[] = [
  // CRM
  { id: 'conn-salesforce', name: 'Salesforce', type: 'crm', icon: Database, platform: 'Salesforce', description: 'Connect your Salesforce CRM to sync contacts, accounts, and opportunities', category: 'CRM', isPopular: true },
  { id: 'conn-hubspot', name: 'HubSpot', type: 'crm', icon: BarChart3, platform: 'HubSpot', description: 'Sync your HubSpot contacts, companies, and deals', category: 'CRM', isPopular: true },
  { id: 'conn-pipedrive', name: 'Pipedrive', type: 'crm', icon: Database, platform: 'Pipedrive', description: 'Import deals and contacts from Pipedrive', category: 'CRM' },
  { id: 'conn-zoho', name: 'Zoho CRM', type: 'crm', icon: Database, platform: 'Zoho', description: 'Connect Zoho CRM to sync your sales data', category: 'CRM' },
  
  // Social
  { id: 'conn-linkedin', name: 'LinkedIn Sales Navigator', type: 'social', icon: Linkedin, platform: 'LinkedIn', description: 'Access LinkedIn company pages and profiles', category: 'Social', isPopular: true },
  { id: 'conn-linkedin-company', name: 'LinkedIn Company', type: 'social', icon: Linkedin, platform: 'LinkedIn', description: 'Connect your LinkedIn company page', category: 'Social' },
  { id: 'conn-twitter', name: 'X', type: 'social', icon: Twitter, platform: 'Twitter', description: 'Import X profiles and engagement data', category: 'Social' },
  
  // Analytics
  { id: 'conn-google-analytics', name: 'Google Analytics', type: 'analytics', icon: Globe, platform: 'Google Analytics', description: 'Sync website analytics and visitor data', category: 'Analytics', isPopular: true },
  { id: 'conn-mixpanel', name: 'Mixpanel', type: 'analytics', icon: BarChart3, platform: 'Mixpanel', description: 'Connect Mixpanel for product analytics', category: 'Analytics' },
  
  // Communication
  { id: 'conn-slack', name: 'Slack', type: 'communication', icon: Slack, platform: 'Slack', description: 'Import Slack conversations and channels', category: 'Communication' },
  { id: 'conn-email', name: 'Email Integration', type: 'communication', icon: Mail, platform: 'Email', description: 'Connect your email to sync conversations', category: 'Communication' },
  
  // Marketing
  { id: 'conn-mailchimp', name: 'Mailchimp', type: 'marketing', icon: Mail, platform: 'Mailchimp', description: 'Sync email campaigns and subscriber data', category: 'Marketing' },
  
  // Development
  { id: 'conn-github', name: 'GitHub', type: 'custom', icon: Github, platform: 'GitHub', description: 'Connect GitHub repositories for technical insights', category: 'Development', isNew: true },
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
  const [isConnectorDialogOpen, setIsConnectorDialogOpen] = useState(false);
  const [connectorSearch, setConnectorSearch] = useState("");
  const [connectorCategoryFilter, setConnectorCategoryFilter] = useState<string>("all");
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<DataSource | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [sourceToConfigure, setSourceToConfigure] = useState<DataSource | null>(null);
  const [configSyncFrequency, setConfigSyncFrequency] = useState<'realtime' | 'hourly' | '4hours' | 'daily' | 'weekly' | 'manual'>('daily');
  const [configObjects, setConfigObjects] = useState<string[]>([]);
  const [configFilters, setConfigFilters] = useState<string[]>([]);
  
  // Salesforce Auth Modal state
  const [isSalesforceAuthModalOpen, setIsSalesforceAuthModalOpen] = useState(false);
  const [salesforceSourceToConnect, setSalesforceSourceToConnect] = useState<DataSource | null>(null);
  const [salesforceEmail, setSalesforceEmail] = useState("");
  const [salesforcePassword, setSalesforcePassword] = useState("");
  const [isSalesforceLoggingIn, setIsSalesforceLoggingIn] = useState(false);
  const [salesforceAuthStep, setSalesforceAuthStep] = useState<'login' | 'permissions'>('login');
  
  // HubSpot Auth Modal state
  const [isHubSpotAuthModalOpen, setIsHubSpotAuthModalOpen] = useState(false);
  const [hubSpotSourceToConnect, setHubSpotSourceToConnect] = useState<DataSource | null>(null);
  const [hubSpotEmail, setHubSpotEmail] = useState("");
  const [hubSpotPassword, setHubSpotPassword] = useState("");
  const [isHubSpotLoggingIn, setIsHubSpotLoggingIn] = useState(false);
  const [hubSpotAuthStep, setHubSpotAuthStep] = useState<'login' | 'permissions'>('login');
  
  // Pipedrive Auth Modal state
  const [isPipedriveAuthModalOpen, setIsPipedriveAuthModalOpen] = useState(false);
  const [pipedriveSourceToConnect, setPipedriveSourceToConnect] = useState<DataSource | null>(null);
  const [pipedriveEmail, setPipedriveEmail] = useState("");
  const [pipedrivePassword, setPipedrivePassword] = useState("");
  const [isPipedriveLoggingIn, setIsPipedriveLoggingIn] = useState(false);
  const [pipedriveAuthStep, setPipedriveAuthStep] = useState<'login' | 'permissions'>('login');
  
  // Zoho Auth Modal state
  const [isZohoAuthModalOpen, setIsZohoAuthModalOpen] = useState(false);
  const [zohoSourceToConnect, setZohoSourceToConnect] = useState<DataSource | null>(null);
  const [zohoEmail, setZohoEmail] = useState("");
  const [zohoPassword, setZohoPassword] = useState("");
  const [isZohoLoggingIn, setIsZohoLoggingIn] = useState(false);
  const [zohoAuthStep, setZohoAuthStep] = useState<'login' | 'permissions'>('login');
  
  // Form states for connector inputs
  const [selectedCrm, setSelectedCrm] = useState<string>("");
  const [linkedInUrls, setLinkedInUrls] = useState<string[]>([""]);
  const [selectedAnalytics, setSelectedAnalytics] = useState<string>("");
  const [competitors, setCompetitors] = useState<Array<{name: string, url: string}>>([{name: "", url: ""}]);
  const [slackConfigs, setSlackConfigs] = useState<Array<{workspace: string, channel: string}>>([{workspace: "", channel: ""}]);
  
  // File Sources state
  const [fileSources, setFileSources] = useState<Record<string, {file: File | null, destinationUrl: string}>>({
    "Call Transcripts": {file: null, destinationUrl: ""},
    "Meeting Notes": {file: null, destinationUrl: ""},
    "Case Studies": {file: null, destinationUrl: ""},
    "Support Tickets": {file: null, destinationUrl: ""},
    "Sales Presentations": {file: null, destinationUrl: ""},
  });
  
  // Product Documentation supports multiple files/destinations
  const [productDocFiles, setProductDocFiles] = useState<Array<{file: File | null, destinationUrl: string}>>([{file: null, destinationUrl: ""}]);
  
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

  const handleConnect = (sourceName: string) => {
    const source = dataSources.find(s => s.name === sourceName);
    if (!source) return;

    // If already connected, show reconnect option
    if (source.status === 'connected' || source.status === 'uploaded') {
      toast({
        title: `${sourceName} is already connected`,
        description: "Use the 'Reconnect' option if you need to refresh the connection.",
      });
      return;
    }

    // If Salesforce, open auth modal instead
    if (source.platform === 'Salesforce' || source.name === 'Salesforce') {
      setSalesforceSourceToConnect(source);
      setIsSalesforceAuthModalOpen(true);
      return;
    }

    // If HubSpot, open auth modal instead
    if (source.platform === 'HubSpot' || source.name === 'HubSpot') {
      setHubSpotSourceToConnect(source);
      setIsHubSpotAuthModalOpen(true);
      return;
    }

    // If Pipedrive, open auth modal instead
    if (source.platform === 'Pipedrive' || source.name === 'Pipedrive') {
      setPipedriveSourceToConnect(source);
      setIsPipedriveAuthModalOpen(true);
      return;
    }

    // If Zoho, open auth modal instead
    if (source.platform === 'Zoho' || source.name === 'Zoho CRM') {
      setZohoSourceToConnect(source);
      setIsZohoAuthModalOpen(true);
      return;
    }

    // Set status to syncing initially
    setDataSources(prev => prev.map(s => 
      s.id === source.id 
        ? { ...s, status: 'syncing' as const }
        : s
    ));

    // First toast: Starting connection
    toast({
      title: `Setting up integration with ${sourceName}`,
      description: "Connection will take a few seconds...",
    });

    // Simulate connection process (in real app, this would be an API call)
    setTimeout(() => {
      setDataSources(prev => prev.map(s => {
        if (s.id === source.id) {
          // Generate mock data for connected source
          const mockData = {
            status: 'connected' as const,
            account: source.type === 'file' ? undefined : `${sourceName.toLowerCase().replace(/\s+/g, '')}@company.com`,
            connectedDate: new Date().toISOString().split('T')[0],
            lastSyncTime: 'Just now',
            lastSyncStatus: 'success' as const,
            totalRecords: Math.floor(Math.random() * 5000) + 100,
            newRecordsThisWeek: Math.floor(Math.random() * 100),
            updatedRecords: Math.floor(Math.random() * 50),
            dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
            objectsSynced: source.type === 'file' 
              ? [source.name] 
              : source.type === 'crm' 
                ? ['Contacts', 'Accounts', 'Opportunities']
                : source.type === 'social'
                  ? ['Company Pages', 'Profiles']
                  : source.type === 'communication'
                  ? ['Messages', 'Channels', 'Conversations']
                  : ['Data'],
            fieldsMapped: Math.floor(Math.random() * 50) + 20,
            filters: source.type === 'crm' ? ['Active records only'] : []
          };
          return { ...s, ...mockData };
        }
        return s;
      }));

      toast({
        title: `${sourceName} connected successfully`,
        description: "Your data source is now syncing. Initial sync may take a few minutes.",
      });
    }, 2000);
  };

  const handleOpenConfigure = (source: DataSource) => {
    console.log('Opening configure dialog for:', source.name);
    // Ensure source has required properties with defaults
    setSourceToConfigure(source);
    setConfigSyncFrequency(source.syncFrequency || 'daily');
    setConfigObjects([...(source.objectsSynced || [])]);
    setConfigFilters([...(source.filters || [])]);
    setConfigDialogOpen(true);
    console.log('Dialog state set to open, configDialogOpen should be true');
  };

  const handleSaveConfiguration = () => {
    if (!sourceToConfigure) return;

    setDataSources(prev => prev.map(s => {
      if (s.id === sourceToConfigure.id) {
        return {
          ...s,
          syncFrequency: configSyncFrequency,
          objectsSynced: configObjects,
          filters: configFilters,
        };
      }
      return s;
    }));

    toast({
      title: "Configuration saved",
      description: `${sourceToConfigure.name} configuration has been updated successfully.`,
    });

    setConfigDialogOpen(false);
    setSourceToConfigure(null);
  };

  const handleSalesforceLogin = async () => {
    if (!salesforceSourceToConnect) return;
    
    if (!salesforceEmail || !salesforcePassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsSalesforceLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsSalesforceLoggingIn(false);
      setSalesforceAuthStep('permissions');
    }, 1500);
  };

  const handleSalesforceApprove = () => {
    if (!salesforceSourceToConnect) return;

    // Update data source to connected
    setDataSources(prev => prev.map(s => {
      if (s.id === salesforceSourceToConnect.id) {
        const mockData = {
          status: 'connected' as const,
          account: salesforceEmail,
          connectedDate: new Date().toISOString().split('T')[0],
          lastSyncTime: 'Just now',
          lastSyncStatus: 'success' as const,
          totalRecords: Math.floor(Math.random() * 5000) + 100,
          newRecordsThisWeek: Math.floor(Math.random() * 100),
          updatedRecords: Math.floor(Math.random() * 50),
          dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
          objectsSynced: ['Contacts', 'Accounts', 'Opportunities'],
          fieldsMapped: Math.floor(Math.random() * 50) + 20,
          filters: ['Active records only']
        };
        return { ...s, ...mockData };
      }
      return s;
    }));

    // Close modal and reset form
    setIsSalesforceAuthModalOpen(false);
    setSalesforceEmail("");
    setSalesforcePassword("");
    setSalesforceSourceToConnect(null);
    setSalesforceAuthStep('login');

    toast({
      title: "Salesforce connected successfully",
      description: "Your Salesforce account is now connected and syncing.",
    });
  };

  const handleSalesforceDeny = () => {
    // Close modal and reset form
    setIsSalesforceAuthModalOpen(false);
    setSalesforceEmail("");
    setSalesforcePassword("");
    setSalesforceSourceToConnect(null);
    setSalesforceAuthStep('login');

    toast({
      title: "Connection not authorized",
      description: "You denied access to your Salesforce account.",
      variant: "default",
    });
  };

  const handleHubSpotLogin = async () => {
    if (!hubSpotSourceToConnect) return;
    
    if (!hubSpotEmail || !hubSpotPassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsHubSpotLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsHubSpotLoggingIn(false);
      setHubSpotAuthStep('permissions');
    }, 1500);
  };

  const handleHubSpotApprove = () => {
    if (!hubSpotSourceToConnect) return;

    // Update data source to connected
    setDataSources(prev => prev.map(s => {
      if (s.id === hubSpotSourceToConnect.id) {
        const mockData = {
          status: 'connected' as const,
          account: hubSpotEmail,
          connectedDate: new Date().toISOString().split('T')[0],
          lastSyncTime: 'Just now',
          lastSyncStatus: 'success' as const,
          totalRecords: Math.floor(Math.random() * 5000) + 100,
          newRecordsThisWeek: Math.floor(Math.random() * 100),
          updatedRecords: Math.floor(Math.random() * 50),
          dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
          objectsSynced: ['Contacts', 'Companies', 'Deals', 'Tickets'],
          fieldsMapped: Math.floor(Math.random() * 50) + 20,
          filters: ['Active records only']
        };
        return { ...s, ...mockData };
      }
      return s;
    }));

    // Close modal and reset form
    setIsHubSpotAuthModalOpen(false);
    setHubSpotEmail("");
    setHubSpotPassword("");
    setHubSpotSourceToConnect(null);
    setHubSpotAuthStep('login');

    toast({
      title: "HubSpot connected successfully",
      description: "Your HubSpot account is now connected and syncing. Records and sync options are now available.",
    });
  };

  const handleHubSpotDeny = () => {
    // Close modal and reset form
    setIsHubSpotAuthModalOpen(false);
    setHubSpotEmail("");
    setHubSpotPassword("");
    setHubSpotSourceToConnect(null);
    setHubSpotAuthStep('login');

    toast({
      title: "Connection not authorized",
      description: "You denied access to your HubSpot account.",
      variant: "default",
    });
  };

  const handlePipedriveLogin = async () => {
    if (!pipedriveSourceToConnect) return;
    
    if (!pipedriveEmail || !pipedrivePassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsPipedriveLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsPipedriveLoggingIn(false);
      setPipedriveAuthStep('permissions');
    }, 1500);
  };

  const handlePipedriveApprove = () => {
    if (!pipedriveSourceToConnect) return;

    // Update data source to connected
    setDataSources(prev => prev.map(s => {
      if (s.id === pipedriveSourceToConnect.id) {
        const mockData = {
          status: 'connected' as const,
          account: pipedriveEmail,
          connectedDate: new Date().toISOString().split('T')[0],
          lastSyncTime: 'Just now',
          lastSyncStatus: 'success' as const,
          totalRecords: Math.floor(Math.random() * 5000) + 100,
          newRecordsThisWeek: Math.floor(Math.random() * 100),
          updatedRecords: Math.floor(Math.random() * 50),
          dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
          objectsSynced: ['Deals', 'Persons', 'Organizations', 'Activities'],
          fieldsMapped: Math.floor(Math.random() * 50) + 20,
          filters: ['Active records only']
        };
        return { ...s, ...mockData };
      }
      return s;
    }));

    // Close modal and reset form
    setIsPipedriveAuthModalOpen(false);
    setPipedriveEmail("");
    setPipedrivePassword("");
    setPipedriveSourceToConnect(null);
    setPipedriveAuthStep('login');

    toast({
      title: "Pipedrive connected successfully",
      description: "Your Pipedrive account is now connected and syncing. Records and sync options are now available.",
    });
  };

  const handlePipedriveDeny = () => {
    // Close modal and reset form
    setIsPipedriveAuthModalOpen(false);
    setPipedriveEmail("");
    setPipedrivePassword("");
    setPipedriveSourceToConnect(null);
    setPipedriveAuthStep('login');

    toast({
      title: "Connection not authorized",
      description: "You denied access to your Pipedrive account.",
      variant: "default",
    });
  };

  const handleZohoLogin = async () => {
    if (!zohoSourceToConnect) return;
    
    if (!zohoEmail || !zohoPassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsZohoLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsZohoLoggingIn(false);
      setZohoAuthStep('permissions');
    }, 1500);
  };

  const handleZohoApprove = () => {
    if (!zohoSourceToConnect) return;

    // Update data source to connected
    setDataSources(prev => prev.map(s => {
      if (s.id === zohoSourceToConnect.id) {
        const mockData = {
          status: 'connected' as const,
          account: zohoEmail,
          connectedDate: new Date().toISOString().split('T')[0],
          lastSyncTime: 'Just now',
          lastSyncStatus: 'success' as const,
          totalRecords: Math.floor(Math.random() * 5000) + 100,
          newRecordsThisWeek: Math.floor(Math.random() * 100),
          updatedRecords: Math.floor(Math.random() * 50),
          dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
          objectsSynced: ['Contacts', 'Accounts', 'Deals', 'Leads'],
          fieldsMapped: Math.floor(Math.random() * 50) + 20,
          filters: ['Active records only']
        };
        return { ...s, ...mockData };
      }
      return s;
    }));

    // Close modal and reset form
    setIsZohoAuthModalOpen(false);
    setZohoEmail("");
    setZohoPassword("");
    setZohoSourceToConnect(null);
    setZohoAuthStep('login');

    toast({
      title: "Zoho CRM connected successfully",
      description: "Your Zoho CRM account is now connected and syncing. Records and sync options are now available.",
    });
  };

  const handleZohoDeny = () => {
    // Close modal and reset form
    setIsZohoAuthModalOpen(false);
    setZohoEmail("");
    setZohoPassword("");
    setZohoSourceToConnect(null);
    setZohoAuthStep('login');

    toast({
      title: "Connection not authorized",
      description: "You denied access to your Zoho CRM account.",
      variant: "default",
    });
  };

  const handleSyncNow = (sourceName: string) => {
    const source = dataSources.find(s => s.name === sourceName);
    if (!source || source.status !== 'connected') return;

    // Set status to syncing
    setDataSources(prev => prev.map(s => 
      s.id === source.id 
        ? { ...s, status: 'syncing' as const, lastSyncTime: 'Syncing...' }
        : s
    ));

    // Determine what type of records are being synced based on source type
    const getRecordType = (type: string) => {
      switch (type) {
        case 'crm': return 'contacts, accounts, and opportunities';
        case 'social': return 'company pages and profiles';
        case 'analytics': return 'events and page views';
        case 'communication': return 'messages and channels';
        case 'file': return 'files';
        default: return 'records';
      }
    };

    const recordType = getRecordType(source.type);

    toast({
      title: `Syncing ${sourceName}`,
      description: `Fetching latest ${recordType} from the source...`,
    });

    // Simulate sync process with contextual record increases
    setTimeout(() => {
      setDataSources(prev => prev.map(s => {
        if (s.id === source.id) {
          // Calculate realistic record increases based on source type
          const newRecords = source.type === 'crm' 
            ? Math.floor(Math.random() * 50) + 10  // CRM: 10-60 new records
            : source.type === 'social'
            ? Math.floor(Math.random() * 20) + 5   // Social: 5-25 new records
            : source.type === 'analytics'
            ? Math.floor(Math.random() * 100) + 20 // Analytics: 20-120 new records
            : source.type === 'communication'
            ? Math.floor(Math.random() * 40) + 10  // Communication: 10-50 new messages
            : Math.floor(Math.random() * 30) + 5;  // Others: 5-35 new records

          const updatedRecords = Math.floor(Math.random() * 10) + 2;

          return {
            ...s,
            status: 'connected' as const,
            lastSyncTime: 'Just now',
            lastSyncStatus: 'success' as const,
            totalRecords: s.totalRecords + newRecords,
            newRecordsThisWeek: s.newRecordsThisWeek + Math.floor(newRecords * 0.3),
            updatedRecords: s.updatedRecords + updatedRecords,
          };
        }
        return s;
      }));

      const updatedSource = dataSources.find(s => s.id === source.id);
      const recordTypeLabel = source.type === 'crm' 
        ? 'contacts, accounts, and opportunities'
        : source.type === 'social'
        ? 'company pages and profiles'
        : source.type === 'analytics'
        ? 'events and page views'
        : source.type === 'communication'
        ? 'messages and channels'
        : 'data';

      toast({
        title: `${sourceName} sync completed`,
        description: `Latest ${recordTypeLabel} have been synchronized successfully.`,
      });
    }, 1500);
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
    setIsConnectorDialogOpen(true);
  };

  const handleConnectSource = (connector: Connector) => {
    // Check if source already exists (regardless of status)
    const existingSource = dataSources.find(s => s.name === connector.name);
    if (existingSource) {
      if (existingSource.status === 'connected' || existingSource.status === 'uploaded') {
        toast({
          title: "Already connected",
          description: `${connector.name} is already connected.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Already added",
          description: `${connector.name} is already in your sources. Click "Connect" to set it up.`,
          variant: "default",
        });
      }
      setIsConnectorDialogOpen(false);
      return;
    }

    // Create new data source
    const newSource: DataSource = {
      id: connector.id,
      name: connector.name,
      type: connector.type,
      icon: connector.icon,
      platform: connector.platform,
      status: 'disconnected',
      syncFrequency: 'daily',
      totalRecords: 0,
      newRecordsThisWeek: 0,
      updatedRecords: 0,
      dataQualityScore: 0,
      objectsSynced: [],
      fieldsMapped: 0,
      filters: [],
      description: connector.description
    };

    // Add to data sources
    setDataSources(prev => {
      // Double-check to prevent duplicates
      const alreadyExists = prev.find(s => s.id === newSource.id || s.name === newSource.name);
      if (alreadyExists) {
        return prev;
      }
      return [...prev, newSource];
    });
    
    // Close dialog
    setIsConnectorDialogOpen(false);
    
    toast({
      title: `${connector.name} added`,
      description: `Click "Connect" to set up the integration.`,
    });
  };

  const filteredSources = dataSources.filter((source) => {
    const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (source.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || source.status === statusFilter;
    const matchesType = typeFilter === "all" || source.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const filteredConnectors = availableConnectors.filter((connector) => {
    const matchesSearch = connector.name.toLowerCase().includes(connectorSearch.toLowerCase()) ||
                         connector.description.toLowerCase().includes(connectorSearch.toLowerCase());
    const matchesCategory = connectorCategoryFilter === "all" || connector.category === connectorCategoryFilter;
    const isNotConnected = !dataSources.some(s => s.name === connector.name && (s.status === 'connected' || s.status === 'uploaded'));
    return matchesSearch && matchesCategory && isNotConnected;
  });

  const connectorCategories = Array.from(new Set(availableConnectors.map(c => c.category)));

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

                {filteredSources.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center space-y-4">
                      {dataSources.length === 0 ? (
                        <>
                          <Database className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-lg font-medium">No data sources yet</p>
                          <p className="text-sm text-muted-foreground">Get started by adding your first data source or file upload.</p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-medium">No sources match these filters</p>
                          <p className="text-sm text-muted-foreground">Try adjusting search or filters to see results.</p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {filteredSources.map((source) => {
                      const SourceIcon = source.icon;
                      const isExpanded = expandedSources.has(source.id);
                      
                      return (
                        <Card key={source.id}>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4 flex-1">
                                <div className="p-3 bg-muted rounded-lg">
                                  <SourceIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="font-semibold text-lg">{source.name}</h3>
                                    <Badge variant="outline" className="text-xs">{getTypeLabel(source.type)}</Badge>
                                    {getStatusBadge(source.status)}
                                    <Badge 
                                      variant="secondary" 
                                      className={`text-xs ${getStatusColor(source.status)}`}
                                    >
                                      {source.status === 'uploaded' ? 'Uploaded' :
                                       source.status === 'processing' ? 'Processing' :
                                       source.status === 'empty' ? 'Empty' :
                                       source.status}
                                    </Badge>
                                  </div>
                                  {source.description && (
                                    <p className="text-sm text-muted-foreground mb-3">{source.description}</p>
                                  )}
                                  {(source.status === 'connected' || source.status === 'uploaded') && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                      <div>
                                        <p className="text-muted-foreground">Records</p>
                                        <p className="font-medium">{source.totalRecords.toLocaleString()}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">Last Sync</p>
                                        <p className="font-medium">{source.lastSyncTime || 'Never'}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">Data Quality</p>
                                        <p className="font-medium">{source.dataQualityScore > 0 ? `${source.dataQualityScore}%` : '-'}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">Sync Frequency</p>
                                        <p className="font-medium capitalize">{source.syncFrequency}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                {source.type === 'file' ? (
                                  <Button
                                    size="sm"
                                    variant={source.status === 'empty' ? 'default' : 'outline'}
                                    onClick={() => handleUpload(source.name)}
                                  >
                                    <UploadIcon className="h-4 w-4 mr-2" />
                                    {source.status === 'uploaded' ? 'Re-upload' : 'Upload'}
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (source.status === 'connected' || source.status === 'uploaded') {
                                        // Reconnect logic
                                        setDataSources(prev => prev.map(s => 
                                          s.id === source.id 
                                            ? { ...s, status: 'syncing' as const, lastSyncTime: 'Syncing...' }
                                            : s
                                        ));
                                        setTimeout(() => {
                                          setDataSources(prev => prev.map(s => 
                                            s.id === source.id 
                                              ? { ...s, status: 'connected' as const, lastSyncTime: 'Just now', lastSyncStatus: 'success' as const }
                                              : s
                                          ));
                                          toast({
                                            title: `${source.name} reconnected`,
                                            description: "Connection refreshed successfully.",
                                          });
                                        }, 1500);
                                      } else {
                                        handleConnect(source.name);
                                      }
                                    }}
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
                                    <DropdownMenuItem onClick={() => toggleExpand(source.id)}>
                                      {isExpanded ? 'Collapse' : 'Expand'} Details
                                    </DropdownMenuItem>
                                    {(source.status === 'connected' || source.status === 'uploaded') && (
                                      <>
                                        {source.type !== 'file' && (
                                          <DropdownMenuItem onClick={() => handleSyncNow(source.name)}>
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Sync Now
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem onClick={() => handleOpenConfigure(source)}>
                                          <Settings className="h-4 w-4 mr-2" />
                                          Configure
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        setSourceToDelete(source);
                                        setDeleteDialogOpen(true);
                                      }}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            
                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                  {(source.status === 'connected' || source.status === 'uploaded') && (
                                    <>
                                      <div className="space-y-2">
                                        <p className="text-sm font-semibold">{source.type === 'file' ? 'Upload Details' : 'Connection Details'}</p>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                          {source.type !== 'file' && source.account && <p>Account: {source.account}</p>}
                                          <p>{source.type === 'file' ? 'Uploaded' : 'Connected'}: {source.connectedDate ? new Date(source.connectedDate).toLocaleDateString() : source.lastSyncTime || 'N/A'}</p>
                                          {source.type !== 'file' && <p>Sync Frequency: {source.syncFrequency}</p>}
                                        </div>
                                      </div>
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
                                    </>
                                  )}
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
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
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

        {/* Connector Catalog Dialog */}
        <Dialog open={isConnectorDialogOpen} onOpenChange={setIsConnectorDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Data Source</DialogTitle>
              <DialogDescription>
                Configure and connect your data sources
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                {/* CRM Section */}
                <AccordionItem value="crm">
                  <AccordionTrigger className="font-semibold">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      CRM
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Select CRM Platform</Label>
                        <Select value={selectedCrm} onValueChange={setSelectedCrm}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a CRM platform" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="salesforce">Salesforce</SelectItem>
                            <SelectItem value="hubspot">HubSpot</SelectItem>
                            <SelectItem value="pipedrive">Pipedrive</SelectItem>
                            <SelectItem value="zoho">Zoho CRM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedCrm && (
                        <Button 
                          onClick={() => {
                            const crmNames: Record<string, string> = {
                              salesforce: 'Salesforce',
                              hubspot: 'HubSpot',
                              pipedrive: 'Pipedrive',
                              zoho: 'Zoho CRM'
                            };
                            const connector: Connector = {
                              id: `conn-${selectedCrm}`,
                              name: crmNames[selectedCrm],
                              type: 'crm',
                              icon: Database,
                              platform: crmNames[selectedCrm],
                              description: `Connect your ${crmNames[selectedCrm]} CRM`,
                              category: 'CRM'
                            };
                            handleConnectSource(connector);
                            toast({
                              title: `${crmNames[selectedCrm]} added`,
                              description: "Click 'Connect' in the table to set up the integration.",
                            });
                            setIsConnectorDialogOpen(false);
                            setSelectedCrm("");
                          }}
                          className="w-full"
                        >
                          Add Source
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Social Section */}
                <AccordionItem value="social">
                  <AccordionTrigger className="font-semibold">
                    <div className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4" />
                      Social
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {/* LinkedIn */}
                      <div className="space-y-3">
                        <Label>LinkedIn</Label>
                        {linkedInUrls.map((url, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              placeholder="Enter LinkedIn URL"
                              value={url}
                              onChange={(e) => {
                                const newUrls = [...linkedInUrls];
                                newUrls[index] = e.target.value;
                                setLinkedInUrls(newUrls);
                              }}
                            />
                            {index === linkedInUrls.length - 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setLinkedInUrls([...linkedInUrls, ""])}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                            {linkedInUrls.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  const newUrls = linkedInUrls.filter((_, i) => i !== index);
                                  setLinkedInUrls(newUrls);
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {linkedInUrls.some(url => url.trim() !== "") && (
                          <Button 
                            onClick={() => {
                              const connector: Connector = {
                                id: 'conn-linkedin',
                                name: 'LinkedIn Sales Navigator',
                                type: 'social',
                                icon: Linkedin,
                                platform: 'LinkedIn',
                                description: `LinkedIn URLs: ${linkedInUrls.filter(u => u.trim()).join(', ')}`,
                                category: 'Social'
                              };
                              handleConnectSource(connector);
                              toast({
                                title: "LinkedIn Sales Navigator added",
                                description: "Click 'Connect' in the table to set up the integration.",
                              });
                              setIsConnectorDialogOpen(false);
                              setLinkedInUrls([""]);
                            }}
                            className="w-full"
                          >
                            Add Source
                          </Button>
                        )}
                      </div>

                      {/* Twitter */}
                      <div className="space-y-3 pt-4 border-t">
                        <Label>X</Label>
                        <Button 
                          onClick={() => {
                            const connector: Connector = {
                              id: 'conn-twitter',
                              name: 'X',
                              type: 'social',
                              icon: Twitter,
                              platform: 'Twitter',
                              description: 'Connect X account',
                              category: 'Social'
                            };
                            handleConnectSource(connector);
                            toast({
                              title: "X added",
                              description: "Click 'Connect' in the table to set up the integration.",
                            });
                            setIsConnectorDialogOpen(false);
                          }}
                          className="w-full"
                        >
                          Add Source
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Analytics Section */}
                <AccordionItem value="analytics">
                  <AccordionTrigger className="font-semibold">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Analytics
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Select Analytics Platform</Label>
                        <Select value={selectedAnalytics} onValueChange={setSelectedAnalytics}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an analytics platform" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="google-analytics">Google Analytics</SelectItem>
                            <SelectItem value="mixpanel">Mixpanel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedAnalytics && (
                        <Button 
                          onClick={() => {
                            const analyticsNames: Record<string, string> = {
                              'google-analytics': 'Google Analytics',
                              'mixpanel': 'Mixpanel'
                            };
                            const connector: Connector = {
                              id: `conn-${selectedAnalytics}`,
                              name: analyticsNames[selectedAnalytics],
                              type: 'analytics',
                              icon: selectedAnalytics === 'google-analytics' ? Globe : BarChart3,
                              platform: analyticsNames[selectedAnalytics],
                              description: `Connect ${analyticsNames[selectedAnalytics]}`,
                              category: 'Analytics'
                            };
                            handleConnectSource(connector);
                            toast({
                              title: `${analyticsNames[selectedAnalytics]} added`,
                              description: "Click 'Connect' in the table to set up the integration.",
                            });
                            setIsConnectorDialogOpen(false);
                            setSelectedAnalytics("");
                          }}
                          className="w-full"
                        >
                          Add Source
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Competitors Section */}
                <AccordionItem value="competitors">
                  <AccordionTrigger className="font-semibold">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Competitors
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {competitors.map((competitor, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="Company Name"
                            value={competitor.name}
                            onChange={(e) => {
                              const newCompetitors = [...competitors];
                              newCompetitors[index].name = e.target.value;
                              setCompetitors(newCompetitors);
                            }}
                            className="flex-1"
                          />
                          <Input
                            placeholder="Company URL"
                            value={competitor.url}
                            onChange={(e) => {
                              const newCompetitors = [...competitors];
                              newCompetitors[index].url = e.target.value;
                              setCompetitors(newCompetitors);
                            }}
                            className="flex-1"
                          />
                          {index === competitors.length - 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => setCompetitors([...competitors, {name: "", url: ""}])}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                          {competitors.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                const newCompetitors = competitors.filter((_, i) => i !== index);
                                setCompetitors(newCompetitors);
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {competitors.some(c => c.name.trim() !== "" || c.url.trim() !== "") && (
                        <Button 
                          onClick={() => {
                            const validCompetitors = competitors.filter(c => c.name.trim() !== "" && c.url.trim() !== "");
                            validCompetitors.forEach((competitor, index) => {
                              const connector: Connector = {
                                id: `conn-competitor-${index}`,
                                name: `Competitor: ${competitor.name}`,
                                type: 'custom',
                                icon: Users,
                                platform: 'Competitor',
                                description: `Competitor: ${competitor.name} - ${competitor.url}`,
                                category: 'Competitors'
                              };
                              handleConnectSource(connector);
                            });
                            toast({
                              title: `${validCompetitors.length} competitor(s) added`,
                              description: "Click 'Connect' in the table to set up the integration.",
                            });
                            setIsConnectorDialogOpen(false);
                            setCompetitors([{name: "", url: ""}]);
                          }}
                          className="w-full"
                        >
                          Add Source
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Slack Section */}
                <AccordionItem value="slack">
                  <AccordionTrigger className="font-semibold">
                    <div className="flex items-center gap-2">
                      <Slack className="h-4 w-4" />
                      Slack
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {slackConfigs.map((config, index) => (
                        <div key={index} className="space-y-3 p-4 border rounded-lg">
                          <div className="space-y-2">
                            <Label>Workspace</Label>
                            <Input
                              placeholder="Enter workspace name"
                              value={config.workspace}
                              onChange={(e) => {
                                const newConfigs = [...slackConfigs];
                                newConfigs[index].workspace = e.target.value;
                                setSlackConfigs(newConfigs);
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Channel</Label>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter channel name"
                                value={config.channel}
                                onChange={(e) => {
                                  const newConfigs = [...slackConfigs];
                                  newConfigs[index].channel = e.target.value;
                                  setSlackConfigs(newConfigs);
                                }}
                                className="flex-1"
                              />
                              {index === slackConfigs.length - 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setSlackConfigs([...slackConfigs, {workspace: "", channel: ""}])}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              )}
                              {slackConfigs.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    const newConfigs = slackConfigs.filter((_, i) => i !== index);
                                    setSlackConfigs(newConfigs);
                                  }}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {slackConfigs.some(c => c.workspace.trim() !== "") && (
                        <Button 
                          onClick={() => {
                            const validConfigs = slackConfigs.filter(c => c.workspace.trim() !== "");
                            validConfigs.forEach((config, index) => {
                              const connector: Connector = {
                                id: `conn-slack-${index}`,
                                name: `Slack: ${config.workspace}`,
                                type: 'communication',
                                icon: Slack,
                                platform: 'Slack',
                                description: `Slack: ${config.workspace} - ${config.channel || 'All channels'}`,
                                category: 'Communication'
                              };
                              handleConnectSource(connector);
                            });
                            toast({
                              title: `${validConfigs.length} Slack workspace(s) added`,
                              description: "Click 'Connect' in the table to set up the integration.",
                            });
                            setIsConnectorDialogOpen(false);
                            setSlackConfigs([{workspace: "", channel: ""}]);
                          }}
                          className="w-full"
                        >
                          Add Source
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* File Sources Section */}
                <AccordionItem value="file-sources">
                  <AccordionTrigger className="font-semibold">
                    <div className="flex items-center gap-2">
                      <UploadIcon className="h-4 w-4" />
                      File Sources
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-2">
                      {/* Product Documentation - Special handling with multiple files */}
                      <div className="space-y-3 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium">Product Documentation</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">Docs, API guides, release notes, and specs</p>
                        
                        {productDocFiles.map((fileData, index) => (
                          <div key={index} className="space-y-3 p-3 border rounded-md bg-muted/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Upload File</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="file"
                                    className="flex-1"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const newFiles = [...productDocFiles];
                                        newFiles[index].file = file;
                                        setProductDocFiles(newFiles);
                                      }
                                    }}
                                  />
                                  {index === productDocFiles.length - 1 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => setProductDocFiles([...productDocFiles, {file: null, destinationUrl: ""}])}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {productDocFiles.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => {
                                        const newFiles = productDocFiles.filter((_, i) => i !== index);
                                        setProductDocFiles(newFiles);
                                      }}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                {fileData.file && (
                                  <p className="text-xs text-muted-foreground">Selected: {fileData.file.name}</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Destination URL</Label>
                                <Input
                                  type="url"
                                  placeholder="https://example.com/destination"
                                  value={fileData.destinationUrl}
                                  onChange={(e) => {
                                    const newFiles = [...productDocFiles];
                                    newFiles[index].destinationUrl = e.target.value;
                                    setProductDocFiles(newFiles);
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {productDocFiles.some(f => f.file || f.destinationUrl.trim() !== "") && (
                          <Button
                            onClick={() => {
                              const validFiles = productDocFiles.filter(f => f.file || f.destinationUrl.trim() !== "");
                              validFiles.forEach((fileData, index) => {
                                const connector: Connector = {
                                  id: `file-product-doc-${index}`,
                                  name: `Product Documentation${validFiles.length > 1 ? ` (${index + 1})` : ''}`,
                                  type: 'file',
                                  icon: FileText,
                                  platform: 'File Upload',
                                  description: `Docs, API guides, release notes, and specs${fileData.file ? ` - ${fileData.file.name}` : ''}`,
                                  category: 'File Sources'
                                };
                                handleConnectSource(connector);
                              });
                              toast({
                                title: `${validFiles.length} Product Documentation file(s) added`,
                                description: "Click 'Connect' in the table to upload files and configure.",
                              });
                              setIsConnectorDialogOpen(false);
                              setProductDocFiles([{file: null, destinationUrl: ""}]);
                            }}
                            className="w-full"
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                      
                      {/* Other File Sources */}
                      {[
                        { name: "Call Transcripts", icon: MessageSquare, description: "Conversation transcripts from discovery and sales calls" },
                        { name: "Meeting Notes", icon: FileText, description: "Structured or freeform notes from meetings" },
                        { name: "Case Studies", icon: Users, description: "Customer stories, wins, and proof points" },
                        { name: "Support Tickets", icon: MessageSquare, description: "Support conversations and resolutions" },
                        { name: "Sales Presentations", icon: BarChart3, description: "Decks and one-pagers used in the sales cycle" },
                      ].map((fileSource) => {
                        const FileIcon = fileSource.icon;
                        const fileData = fileSources[fileSource.name];
                        
                        return (
                          <div key={fileSource.name} className="space-y-3 p-4 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <FileIcon className="h-4 w-4 text-muted-foreground" />
                              <h4 className="font-medium">{fileSource.name}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">{fileSource.description}</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Upload File</Label>
                                <Input
                                  type="file"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setFileSources(prev => ({
                                        ...prev,
                                        [fileSource.name]: {...prev[fileSource.name], file}
                                      }));
                                    }
                                  }}
                                />
                                {fileData.file && (
                                  <p className="text-xs text-muted-foreground">Selected: {fileData.file.name}</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Destination URL</Label>
                                <Input
                                  type="url"
                                  placeholder="https://example.com/destination"
                                  value={fileData.destinationUrl}
                                  onChange={(e) => {
                                    setFileSources(prev => ({
                                      ...prev,
                                      [fileSource.name]: {...prev[fileSource.name], destinationUrl: e.target.value}
                                    }));
                                  }}
                                />
                              </div>
                            </div>
                            
                            {(fileData.file || fileData.destinationUrl.trim() !== "") && (
                              <Button
                                onClick={() => {
                                  const connector: Connector = {
                                    id: `file-${fileSource.name.toLowerCase().replace(/\s+/g, '-')}`,
                                    name: fileSource.name,
                                    type: 'file',
                                    icon: fileSource.icon,
                                    platform: 'File Upload',
                                    description: fileSource.description,
                                    category: 'File Sources'
                                  };
                                  handleConnectSource(connector);
                                  toast({
                                    title: `${fileSource.name} added`,
                                    description: "Click 'Connect' in the table to upload files and configure.",
                                  });
                                  setIsConnectorDialogOpen(false);
                                }}
                                className="w-full"
                              >
                                Connect
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Data Source</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{sourceToDelete?.name}</strong>? This action cannot be undone and all associated data will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setDeleteDialogOpen(false);
                setSourceToDelete(null);
              }}>
                No, Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (sourceToDelete) {
                    setDataSources(prev => prev.filter(s => s.id !== sourceToDelete.id));
                    toast({
                      title: "Data source deleted",
                      description: `${sourceToDelete.name} has been removed.`,
                    });
                    setDeleteDialogOpen(false);
                    setSourceToDelete(null);
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Yes, Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Configuration Dialog */}
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configure {sourceToConfigure?.name}</DialogTitle>
              <DialogDescription>
                Manage sync settings, objects, and filters for this data source
              </DialogDescription>
            </DialogHeader>
            
            {sourceToConfigure && (
              <div className="space-y-6 pt-4">
                {/* Sync Frequency */}
                <div className="space-y-2">
                  <Label>Sync Frequency</Label>
                  <Select value={configSyncFrequency} onValueChange={(value: any) => setConfigSyncFrequency(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="4hours">Every 4 Hours</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="manual">Manual Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How often data should be synchronized from {sourceToConfigure.name}
                  </p>
                </div>

                {/* Objects to Sync */}
                {sourceToConfigure.type === 'crm' && (
                  <div className="space-y-2">
                    <Label>Objects to Sync</Label>
                    <div className="space-y-2 border rounded-md p-4">
                      {['Contacts', 'Accounts', 'Opportunities', 'Leads', 'Deals', 'Activities'].map((obj) => {
                        const isChecked = configObjects.includes(obj);
                        return (
                          <div key={obj} className="flex items-center space-x-2">
                            <Checkbox
                              id={`obj-${obj}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setConfigObjects([...configObjects, obj]);
                                } else {
                                  setConfigObjects(configObjects.filter(o => o !== obj));
                                }
                              }}
                            />
                            <label
                              htmlFor={`obj-${obj}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {obj}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select which CRM objects to synchronize
                    </p>
                  </div>
                )}

                {sourceToConfigure.type === 'social' && (
                  <div className="space-y-2">
                    <Label>Data Types to Sync</Label>
                    <div className="space-y-2 border rounded-md p-4">
                      {['Company Pages', 'Profiles', 'Posts', 'Engagements'].map((obj) => {
                        const isChecked = configObjects.includes(obj);
                        return (
                          <div key={obj} className="flex items-center space-x-2">
                            <Checkbox
                              id={`obj-${obj}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setConfigObjects([...configObjects, obj]);
                                } else {
                                  setConfigObjects(configObjects.filter(o => o !== obj));
                                }
                              }}
                            />
                            <label
                              htmlFor={`obj-${obj}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {obj}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {sourceToConfigure.type === 'analytics' && (
                  <div className="space-y-2">
                    <Label>Events to Sync</Label>
                    <div className="space-y-2 border rounded-md p-4">
                      {['Page Views', 'Events', 'User Actions', 'Conversions'].map((obj) => {
                        const isChecked = configObjects.includes(obj);
                        return (
                          <div key={obj} className="flex items-center space-x-2">
                            <Checkbox
                              id={`obj-${obj}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setConfigObjects([...configObjects, obj]);
                                } else {
                                  setConfigObjects(configObjects.filter(o => o !== obj));
                                }
                              }}
                            />
                            <label
                              htmlFor={`obj-${obj}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {obj}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Filters */}
                {sourceToConfigure.type === 'crm' && (
                  <div className="space-y-2">
                    <Label>Filters</Label>
                    <div className="space-y-2 border rounded-md p-4">
                      {['Active records only', 'Last 90 days', 'Exclude archived', 'High-value accounts only'].map((filter) => {
                        const isChecked = configFilters.includes(filter);
                        return (
                          <div key={filter} className="flex items-center space-x-2">
                            <Checkbox
                              id={`filter-${filter}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setConfigFilters([...configFilters, filter]);
                                } else {
                                  setConfigFilters(configFilters.filter(f => f !== filter));
                                }
                              }}
                            />
                            <label
                              htmlFor={`filter-${filter}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {filter}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Apply filters to limit which records are synchronized
                    </p>
                  </div>
                )}

                {/* Current Configuration Summary */}
                <div className="space-y-2 pt-4 border-t">
                  <Label>Current Configuration</Label>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Objects Synced: {configObjects.length > 0 ? configObjects.join(', ') : 'None'}</p>
                    <p>Filters: {configFilters.length > 0 ? configFilters.join(', ') : 'None'}</p>
                    <p>Fields Mapped: {sourceToConfigure.fieldsMapped}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveConfiguration}>
                    Save Configuration
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Salesforce Auth Modal */}
        <Dialog open={isSalesforceAuthModalOpen} onOpenChange={(open) => {
          if (!open) {
            setIsSalesforceAuthModalOpen(false);
            setSalesforceEmail("");
            setSalesforcePassword("");
            setSalesforceSourceToConnect(null);
            setSalesforceAuthStep('login');
          }
        }}>
          <DialogContent className="max-w-md">
            {salesforceAuthStep === 'login' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to Salesforce</DialogTitle>
                  <DialogDescription>
                    Enter your Salesforce credentials to continue.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="salesforce-email">Email</Label>
                    <Input
                      id="salesforce-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={salesforceEmail}
                      onChange={(e) => setSalesforceEmail(e.target.value)}
                      disabled={isSalesforceLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salesforce-password">Password</Label>
                    <Input
                      id="salesforce-password"
                      type="password"
                      placeholder="Enter your password"
                      value={salesforcePassword}
                      onChange={(e) => setSalesforcePassword(e.target.value)}
                      disabled={isSalesforceLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isSalesforceLoggingIn) {
                          handleSalesforceLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsSalesforceAuthModalOpen(false);
                      setSalesforceEmail("");
                      setSalesforcePassword("");
                      setSalesforceSourceToConnect(null);
                      setSalesforceAuthStep('login');
                    }}
                    disabled={isSalesforceLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSalesforceLogin}
                    disabled={isSalesforceLoggingIn || !salesforceEmail || !salesforcePassword}
                  >
                    {isSalesforceLoggingIn ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Authorize Access</DialogTitle>
                  <DialogDescription>
                    This application would like to access the following data from your Salesforce account:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Requested Permissions:</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Contacts</strong> - Read contact information and details</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Accounts</strong> - Read account information and company data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Opportunities</strong> - Read sales opportunities and pipeline data</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{salesforceEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSalesforceDeny}
                  >
                    Deny
                  </Button>
                  <Button
                    onClick={handleSalesforceApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* HubSpot Auth Modal */}
        <Dialog open={isHubSpotAuthModalOpen} onOpenChange={(open) => {
          if (!open) {
            setIsHubSpotAuthModalOpen(false);
            setHubSpotEmail("");
            setHubSpotPassword("");
            setHubSpotSourceToConnect(null);
            setHubSpotAuthStep('login');
          }
        }}>
          <DialogContent className="max-w-md">
            {hubSpotAuthStep === 'login' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to HubSpot</DialogTitle>
                  <DialogDescription>
                    Enter your HubSpot credentials to continue.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="hubspot-email">Email</Label>
                    <Input
                      id="hubspot-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={hubSpotEmail}
                      onChange={(e) => setHubSpotEmail(e.target.value)}
                      disabled={isHubSpotLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hubspot-password">Password</Label>
                    <Input
                      id="hubspot-password"
                      type="password"
                      placeholder="Enter your password"
                      value={hubSpotPassword}
                      onChange={(e) => setHubSpotPassword(e.target.value)}
                      disabled={isHubSpotLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isHubSpotLoggingIn) {
                          handleHubSpotLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BarChart3 className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsHubSpotAuthModalOpen(false);
                      setHubSpotEmail("");
                      setHubSpotPassword("");
                      setHubSpotSourceToConnect(null);
                      setHubSpotAuthStep('login');
                    }}
                    disabled={isHubSpotLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleHubSpotLogin}
                    disabled={isHubSpotLoggingIn || !hubSpotEmail || !hubSpotPassword}
                  >
                    {isHubSpotLoggingIn ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Authorize Access</DialogTitle>
                  <DialogDescription>
                    This application would like to access the following data from your HubSpot account:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Requested Permissions:</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Contacts</strong> - Read contact information and details</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Companies</strong> - Read company information and organization data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Deals</strong> - Read deal information and pipeline data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Tickets</strong> - Read support ticket information</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{hubSpotEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleHubSpotDeny}
                  >
                    Deny
                  </Button>
                  <Button
                    onClick={handleHubSpotApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Pipedrive Auth Modal */}
        <Dialog open={isPipedriveAuthModalOpen} onOpenChange={(open) => {
          if (!open) {
            setIsPipedriveAuthModalOpen(false);
            setPipedriveEmail("");
            setPipedrivePassword("");
            setPipedriveSourceToConnect(null);
            setPipedriveAuthStep('login');
          }
        }}>
          <DialogContent className="max-w-md">
            {pipedriveAuthStep === 'login' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to Pipedrive</DialogTitle>
                  <DialogDescription>
                    Enter your Pipedrive credentials to continue.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="pipedrive-email">Email</Label>
                    <Input
                      id="pipedrive-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={pipedriveEmail}
                      onChange={(e) => setPipedriveEmail(e.target.value)}
                      disabled={isPipedriveLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pipedrive-password">Password</Label>
                    <Input
                      id="pipedrive-password"
                      type="password"
                      placeholder="Enter your password"
                      value={pipedrivePassword}
                      onChange={(e) => setPipedrivePassword(e.target.value)}
                      disabled={isPipedriveLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isPipedriveLoggingIn) {
                          handlePipedriveLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsPipedriveAuthModalOpen(false);
                      setPipedriveEmail("");
                      setPipedrivePassword("");
                      setPipedriveSourceToConnect(null);
                      setPipedriveAuthStep('login');
                    }}
                    disabled={isPipedriveLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePipedriveLogin}
                    disabled={isPipedriveLoggingIn || !pipedriveEmail || !pipedrivePassword}
                  >
                    {isPipedriveLoggingIn ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Authorize Access</DialogTitle>
                  <DialogDescription>
                    This application would like to access the following data from your Pipedrive account:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Requested Permissions:</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Deals</strong> - Read deal information and pipeline data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Persons</strong> - Read contact information and details</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Organizations</strong> - Read company information and organization data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Activities</strong> - Read activity information and timeline data</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{pipedriveEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handlePipedriveDeny}
                  >
                    Deny
                  </Button>
                  <Button
                    onClick={handlePipedriveApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Zoho Auth Modal */}
        <Dialog open={isZohoAuthModalOpen} onOpenChange={(open) => {
          if (!open) {
            setIsZohoAuthModalOpen(false);
            setZohoEmail("");
            setZohoPassword("");
            setZohoSourceToConnect(null);
            setZohoAuthStep('login');
          }
        }}>
          <DialogContent className="max-w-md">
            {zohoAuthStep === 'login' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to Zoho CRM</DialogTitle>
                  <DialogDescription>
                    Enter your Zoho CRM credentials to continue.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="zoho-email">Email</Label>
                    <Input
                      id="zoho-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={zohoEmail}
                      onChange={(e) => setZohoEmail(e.target.value)}
                      disabled={isZohoLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zoho-password">Password</Label>
                    <Input
                      id="zoho-password"
                      type="password"
                      placeholder="Enter your password"
                      value={zohoPassword}
                      onChange={(e) => setZohoPassword(e.target.value)}
                      disabled={isZohoLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isZohoLoggingIn) {
                          handleZohoLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsZohoAuthModalOpen(false);
                      setZohoEmail("");
                      setZohoPassword("");
                      setZohoSourceToConnect(null);
                      setZohoAuthStep('login');
                    }}
                    disabled={isZohoLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleZohoLogin}
                    disabled={isZohoLoggingIn || !zohoEmail || !zohoPassword}
                  >
                    {isZohoLoggingIn ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Authorize Access</DialogTitle>
                  <DialogDescription>
                    This application would like to access the following data from your Zoho CRM account:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Requested Permissions:</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Contacts</strong> - Read contact information and details</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Accounts</strong> - Read account information and company data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Deals</strong> - Read deal information and pipeline data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Leads</strong> - Read lead information and conversion data</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{zohoEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleZohoDeny}
                  >
                    Deny
                  </Button>
                  <Button
                    onClick={handleZohoApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default MissionControl;
