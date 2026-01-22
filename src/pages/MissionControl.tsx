import React, { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import DataSourcesManager from "@/components/mission-control/DataSourcesManager";
import ICPManager from "@/components/mission-control/ICPManager";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Slack,
  Link,
  X,
  Info,
  Lock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ApiService from "@/services/api";

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
  const [isCompanyProfileSaved, setIsCompanyProfileSaved] = useState(false);
  const [isCustomerProfileSaved, setIsCustomerProfileSaved] = useState(false);
  const [hasDataSources, setHasDataSources] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCustomCompanyName, setIsCustomCompanyName] = useState(false);
  const [isCustomIndustryPopoverOpen, setIsCustomIndustryPopoverOpen] = useState(false);
  const [customIndustryInput, setCustomIndustryInput] = useState("");

  // Tab locking logic
  const isCustomerProfileLocked = !isCompanyProfileSaved;
  const isDataSourcesLocked = !isCustomerProfileSaved;
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [expandedTableRows, setExpandedTableRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isConnectorDialogOpen, setIsConnectorDialogOpen] = useState(false);
  const [isAddResourcePopoverOpen, setIsAddResourcePopoverOpen] = useState(false);
  const [connectorSearch, setConnectorSearch] = useState("");
  const [connectorCategoryFilter, setConnectorCategoryFilter] = useState<string>("all");
  const [customResourceName, setCustomResourceName] = useState("");
  const [customResourceType, setCustomResourceType] = useState<'crm' | 'marketing' | 'social' | 'analytics' | 'communication' | 'file' | 'custom'>('custom');
  // New Add Source state
  const [addSourceMode, setAddSourceMode] = useState<'link' | 'file' | 'system'>('link');
  const [activeSections, setActiveSections] = useState<{link: boolean, file: boolean, system: boolean}>({link: true, file: false, system: false});
  const [sourceUrls, setSourceUrls] = useState<Array<{id: string, url: string, status: 'pending' | 'success' | 'error'}>>([{id: Date.now().toString(), url: '', status: 'pending'}]);
  const [sourceFiles, setSourceFiles] = useState<Array<{id: string, file: File | null, status: 'pending' | 'success' | 'error'}>>([{id: Date.now().toString(), file: null, status: 'pending'}]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Legacy state (to be removed)
  const [customFileUploadName, setCustomFileUploadName] = useState("");
  const [customFileUploadFile, setCustomFileUploadFile] = useState<File | null>(null);
  const [customFileUploadUrl, setCustomFileUploadUrl] = useState("");
  const [addResourceMode, setAddResourceMode] = useState<'quick' | 'custom' | 'file' | 'api'>('file');
  // API Integration state
  const [apiResourceName, setApiResourceName] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH'>('GET');
  const [apiKey, setApiKey] = useState("");
  const [apiHeaders, setApiHeaders] = useState("");
  const [apiBody, setApiBody] = useState("");
  const [apiResourceType, setApiResourceType] = useState<'crm' | 'marketing' | 'social' | 'analytics' | 'communication' | 'custom'>('custom');
  const [isTestingApi, setIsTestingApi] = useState(false);
  // OAuth2 and Authentication fields
  const [authType, setAuthType] = useState<'none' | 'api_key' | 'bearer' | 'oauth2' | 'basic'>('api_key');
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [oauthScopes, setOauthScopes] = useState<string[]>([]);
  const [availableScopes, setAvailableScopes] = useState<string[]>(['read', 'write', 'read:data', 'write:data', 'admin']);
  const [permissionsApproved, setPermissionsApproved] = useState(false);
  const [isAddingApiResource, setIsAddingApiResource] = useState(false);
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
  
  // LinkedIn Auth Modal state
  const [isLinkedInAuthModalOpen, setIsLinkedInAuthModalOpen] = useState(false);
  const [linkedInSourceToConnect, setLinkedInSourceToConnect] = useState<DataSource | null>(null);
  const [linkedInEmail, setLinkedInEmail] = useState("");
  const [linkedInPassword, setLinkedInPassword] = useState("");
  const [isLinkedInLoggingIn, setIsLinkedInLoggingIn] = useState(false);
  const [linkedInAuthStep, setLinkedInAuthStep] = useState<'login' | 'permissions'>('login');
  
  // X (Twitter) Auth Modal state
  const [isXAuthModalOpen, setIsXAuthModalOpen] = useState(false);
  const [xSourceToConnect, setXSourceToConnect] = useState<DataSource | null>(null);
  const [xEmail, setXEmail] = useState("");
  const [xPassword, setXPassword] = useState("");
  const [isXLoggingIn, setIsXLoggingIn] = useState(false);
  const [xAuthStep, setXAuthStep] = useState<'login' | 'permissions'>('login');
  
  // Google Analytics Auth Modal state
  const [isGoogleAnalyticsAuthModalOpen, setIsGoogleAnalyticsAuthModalOpen] = useState(false);
  const [googleAnalyticsSourceToConnect, setGoogleAnalyticsSourceToConnect] = useState<DataSource | null>(null);
  const [googleAnalyticsEmail, setGoogleAnalyticsEmail] = useState("");
  const [isGoogleAnalyticsSigningIn, setIsGoogleAnalyticsSigningIn] = useState(false);
  const [googleAnalyticsAuthStep, setGoogleAnalyticsAuthStep] = useState<'signin' | 'permissions' | 'success'>('signin');
  
  // Mixpanel Auth Modal state
  const [isMixpanelAuthModalOpen, setIsMixpanelAuthModalOpen] = useState(false);
  const [mixpanelSourceToConnect, setMixpanelSourceToConnect] = useState<DataSource | null>(null);
  const [mixpanelEmail, setMixpanelEmail] = useState("");
  const [mixpanelPassword, setMixpanelPassword] = useState("");
  const [isMixpanelLoggingIn, setIsMixpanelLoggingIn] = useState(false);
  const [mixpanelAuthStep, setMixpanelAuthStep] = useState<'login' | 'permissions'>('login');
  
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
    businessGoals: "",
    painPoints: "",
    targetSegments: "",
    excludeSegments: "",
    complianceReqs: "",
    messagingConstraints: "",
  });

  // Initialize custom company name state based on existing value
  useEffect(() => {
    if (companyProfile.companyName && companyProfile.companyName.trim() !== "") {
      setIsCustomCompanyName(true);
    }
  }, [companyProfile.companyName]);

  const handleSave = async () => {
    if (!currentUser?.uid) {
      toast({
        title: "Authentication required",
        description: "Please log in to save your profile.",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields before saving
    const trimmedCompanyName = companyProfile.companyName.trim();
    if (!trimmedCompanyName) {
      toast({
        title: "Validation failed",
        description: "Please complete all required fields to proceed.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      // Prepare payload with profile_type as required by the API
      const payload = {
        user_id: currentUser.uid,
        profile_type: "company",
        company_name: trimmedCompanyName,
        headquarters: companyProfile.headquarters.trim(),
        employee_size: companyProfile.employeeSize.trim(),
        industry: companyProfile.industry.trim(),
        revenue_band: companyProfile.revenue.trim(),
        gtm_model: companyProfile.gtmModel.trim(),
        region_focus: companyProfile.regionFocus.trim(),
        typical_deal_size: companyProfile.dealSize.trim(),
        company_url: companyProfile.companyUrl.trim(),
        key_buyer_persona: companyProfile.keyBuyerPersona.trim(),
        business_goals: companyProfile.businessGoals.trim(),
        pain_points: companyProfile.painPoints.trim(),
        target_segments: companyProfile.targetSegments.trim(),
        exclude_segments: companyProfile.excludeSegments.trim(),
        compliance_reqs: companyProfile.complianceReqs.trim(),
        messaging_constraints: companyProfile.messagingConstraints.trim(),
      };

      console.log("=== MISSION CONTROL: Saving company profile ===");
      console.log("Payload:", payload);

      const apiUrl = `/api/profile/company?user_id=${currentUser.uid}`;
      console.log("MissionControl: POST request URL:", apiUrl);
      console.log("MissionControl: POST request payload:", payload);
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("MissionControl: POST response status:", response.status);
      console.log("MissionControl: POST response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("MissionControl: API Error:", response.status, errorText);
        console.error("MissionControl: This could indicate database connection issues or backend problems");
        throw new Error(`Failed to save profile: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("MissionControl: Company profile saved successfully:", data);
      console.log("MissionControl: Saved data verification:", {
        'saved_user_id': data?.user_id,
        'expected_user_id': currentUser.uid,
        'user_id_match': data?.user_id === currentUser.uid,
        'saved_company_name': data?.company_name,
        'payload_company_name': payload.company_name,
        'has_data': data && Object.keys(data).length > 0
      });

      // Use the payload company_name since we already validated it before sending
      // The API may not return the saved data in the response, so we trust what we sent
      const savedCompanyName = (data?.company_name || data?.companyName || payload.company_name || "").trim();
      
      // Double-check: if somehow both response and payload are empty (shouldn't happen due to validation)
      if (!savedCompanyName) {
        console.error("MissionControl: Unexpected - company_name is empty in both response and payload!");
        toast({
          title: "Save failed",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      // Save to localStorage for offline access and refresh persistence
      try {
        const { setUserLocalStorage } = await import("@/utils/cacheUtils");
        const dataToSave = {
          ...data,
          user_id: currentUser.uid,
          company_name: payload.company_name,
          headquarters: payload.headquarters,
          employee_size: payload.employee_size,
          industry: payload.industry,
          revenue_band: payload.revenue_band,
          gtm_model: payload.gtm_model,
          region_focus: payload.region_focus,
          typical_deal_size: payload.typical_deal_size,
          company_url: payload.company_url,
          key_buyer_persona: payload.key_buyer_persona,
        };
        setUserLocalStorage('companyProfile', JSON.stringify(dataToSave), currentUser.uid);
        console.log("MissionControl: Saved company profile to localStorage");
      } catch (e) {
        console.warn("MissionControl: Failed to save to localStorage:", e);
      }

      toast({
        title: "Profile saved",
        // description: "profile saved",
      });

      // Only mark company profile as saved if we have a valid company name
      if (savedCompanyName) {
        setIsCompanyProfileSaved(true);
        console.log("MissionControl: Company profile saved and customer profile unlocked");
      } else {
        console.warn("MissionControl: Company profile saved but company name is empty - not unlocking customer profile");
      }
      
      // Verify data was actually saved by immediately fetching it back
      console.log("MissionControl: Verifying data persistence by fetching saved profile...");
      setTimeout(async () => {
        try {
          const verifyResponse = await fetch(`/api/profile/company?user_id=${currentUser.uid}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            const savedCompanyName = verifyData?.company_name || verifyData?.companyName || "";
            if (savedCompanyName.trim() === payload.company_name.trim()) {
              console.log("✅ MissionControl: Data persistence verified - company name matches");
            } else {
              console.error("❌ MissionControl: Data persistence FAILED - company name mismatch!");
              console.error("   Expected:", payload.company_name);
              console.error("   Got:", savedCompanyName);
              console.error("   This indicates a database write/read issue!");
            }
          } else {
            console.warn("⚠️ MissionControl: Could not verify data persistence - GET request failed");
          }
        } catch (verifyError) {
          console.error("MissionControl: Error verifying data persistence:", verifyError);
        }
      }, 2000); // Wait 2 seconds for database to commit

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

  // Helper function to load profile from localStorage
  const loadProfileFromLocalStorage = async (userId: string) => {
    try {
      const { getUserLocalStorage } = await import("@/utils/cacheUtils");
      const localData = getUserLocalStorage('companyProfile', userId);
      if (localData) {
        const localProfile = JSON.parse(localData);
        if (localProfile.user_id === userId) {
          console.log("MissionControl: Loading from localStorage fallback");
          const profileData = {
            companyName: localProfile.company_name || localProfile.companyName || "",
            headquarters: localProfile.headquarters || "",
            employeeSize: localProfile.employee_size || localProfile.employeeSize || "",
            industry: localProfile.industry || "",
            revenue: localProfile.revenue_band || localProfile.revenue || "",
            gtmModel: localProfile.gtm_model || localProfile.gtmModel || "",
            regionFocus: localProfile.region_focus || localProfile.regionFocus || "",
            dealSize: localProfile.typical_deal_size || localProfile.dealSize || "",
            companyUrl: localProfile.company_url || localProfile.companyUrl || "",
            keyBuyerPersona: localProfile.key_buyer_persona || localProfile.keyBuyerPersona || "",
            businessGoals: localProfile.business_goals || localProfile.businessGoals || "",
            painPoints: localProfile.pain_points || localProfile.painPoints || "",
            targetSegments: localProfile.target_segments || localProfile.targetSegments || "",
            excludeSegments: localProfile.exclude_segments || localProfile.excludeSegments || "",
            complianceReqs: localProfile.compliance_reqs || localProfile.complianceReqs || "",
            messagingConstraints: localProfile.messaging_constraints || localProfile.messagingConstraints || "",
          };
          setCompanyProfile(profileData);
          if (localProfile.company_name || localProfile.companyName) {
            setIsCompanyProfileSaved(true);
          }
          return true;
        }
      }
    } catch (e) {
      console.error("MissionControl: Error loading from localStorage:", e);
    }
    return false;
  };

  // Helper function to map API data to form state
  const mapApiDataToFormState = (data: any, userId: string) => {
    console.log("MissionControl: mapApiDataToFormState called with:", {
      data,
      dataType: typeof data,
      isNull: data === null,
      isUndefined: data === undefined,
      keys: data ? Object.keys(data) : [],
      userId
    });
    
    // Check if data is empty or null
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      console.log("MissionControl: API returned empty data");
      return null;
    }

    // Verify user_id matches (multi-tenancy safety)
    if (data.user_id && data.user_id !== userId) {
      console.warn("MissionControl: API returned profile for different user! Ignoring data.", {
        apiUserId: data.user_id,
        currentUserId: userId
      });
      return null;
    }

    // Map API response to form state (handle both snake_case and camelCase)
    // Trim whitespace and handle empty strings properly
    const profileData = {
      companyName: (data.company_name || data.companyName || "").trim(),
      headquarters: (data.headquarters || "").trim(),
      employeeSize: (data.employee_size || data.employeeSize || "").trim(),
      industry: (data.industry || "").trim(),
      revenue: (data.revenue_band || data.revenue || "").trim(),
      gtmModel: (data.gtm_model || data.gtmModel || "").trim(),
      regionFocus: (data.region_focus || data.regionFocus || "").trim(),
      dealSize: (data.typical_deal_size || data.dealSize || "").trim(),
      companyUrl: (data.company_url || data.companyUrl || "").trim(),
      keyBuyerPersona: (data.key_buyer_persona || data.keyBuyerPersona || "").trim(),
      businessGoals: (data.business_goals || data.businessGoals || "").trim(),
      painPoints: (data.pain_points || data.painPoints || "").trim(),
      targetSegments: (data.target_segments || data.targetSegments || "").trim(),
      excludeSegments: (data.exclude_segments || data.excludeSegments || "").trim(),
      complianceReqs: (data.compliance_reqs || data.complianceReqs || "").trim(),
      messagingConstraints: (data.messaging_constraints || data.messagingConstraints || "").trim(),
    };

    console.log("MissionControl: Mapped profile data result:", profileData);
    console.log("MissionControl: Profile data values (showing empty strings):", {
      companyName: `"${profileData.companyName}"`,
      headquarters: `"${profileData.headquarters}"`,
      employeeSize: `"${profileData.employeeSize}"`,
      industry: `"${profileData.industry}"`,
      revenue: `"${profileData.revenue}"`,
      gtmModel: `"${profileData.gtmModel}"`,
      regionFocus: `"${profileData.regionFocus}"`,
      dealSize: `"${profileData.dealSize}"`,
      companyUrl: `"${profileData.companyUrl}"`,
      keyBuyerPersona: `"${profileData.keyBuyerPersona}"`,
    });
    return profileData;
  };

  // Load existing profile data on mount
  useEffect(() => {
    const loadProfileData = async () => {
      if (!currentUser?.uid) {
        console.log("MissionControl: No user ID, skipping profile load");
        return;
      }

      const userId = currentUser.uid;
      let retryCount = 0;
      const maxRetries = 2;
      const retryDelay = 1000; // 1 second

      while (retryCount <= maxRetries) {
        try {
          console.log(`MissionControl: Loading company profile for user: ${userId} (attempt ${retryCount + 1})`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

          const response = await fetch(`/api/profile/company?user_id=${userId}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            console.log("MissionControl: Loaded company profile data:", data);
            console.log("MissionControl: Data keys:", Object.keys(data || {}));
            console.log("MissionControl: company_name:", data?.company_name);
            console.log("MissionControl: companyName:", data?.companyName);
            console.log("MissionControl: Full data structure:", JSON.stringify(data, null, 2));
            
            // Database health check - verify if COMPANY PROFILE fields exist but are empty
            // Check specifically for company profile fields, not customer_profiles or other nested data
            const companyProfileFields = [
              'company_name', 'companyName',
              'headquarters',
              'employee_size', 'employeeSize',
              'industry',
              'revenue_band', 'revenue',
              'gtm_model', 'gtmModel',
              'region_focus', 'regionFocus',
              'typical_deal_size', 'dealSize',
              'company_url', 'companyUrl',
              'key_buyer_persona', 'keyBuyerPersona'
            ];
            
            const hasAnyData = data && Object.keys(data).length > 0;
            const hasCompanyProfileData = data && companyProfileFields.some(field => {
              const value = data[field];
              return value !== null && value !== undefined && value !== "" && 
                     (typeof value !== 'object' || (Array.isArray(value) && value.length > 0));
            });
            
            console.log("MissionControl: Database health check:", {
              'hasAnyData': hasAnyData,
              'hasCompanyProfileData': hasCompanyProfileData,
              'company_name': `"${data?.company_name || ''}"`,
              'companyName': `"${data?.companyName || ''}"`,
              'dataKeysCount': data ? Object.keys(data).length : 0,
              'user_id_in_response': data?.user_id,
              'expected_user_id': userId,
              'user_id_match': data?.user_id === userId,
              'response_status': response.status,
            });
            
            // Check if company profile fields are empty (even if customer_profiles exists)
            if (hasAnyData && !hasCompanyProfileData) {
              console.warn("⚠️ MissionControl: API returned profile structure but COMPANY PROFILE fields are empty!");
              console.warn("⚠️ This could indicate:");
              console.warn("   1. Database was reset/cleared");
              console.warn("   2. Data was deleted");
              console.warn("   3. Backend service restarted and lost data");
              console.warn("   4. Database connection issue");
              console.warn("   5. Transaction rollback occurred");
              
              // Try to load from localStorage as backup BEFORE processing empty API data
              console.log("MissionControl: Attempting to load from localStorage as backup...");
              const loaded = await loadProfileFromLocalStorage(userId);
              if (loaded) {
                console.log("✅ MissionControl: Successfully loaded from localStorage backup");
                return; // Exit retry loop - don't process empty API data
              } else {
                console.warn("⚠️ MissionControl: No localStorage backup available, will proceed with empty data");
              }
            }
            
            const profileData = mapApiDataToFormState(data, userId);
            console.log("MissionControl: Mapped profile data:", profileData);
            
            if (profileData) {
              console.log("MissionControl: Setting company profile state:", profileData);
              console.log("MissionControl: Profile data values being set:", {
                companyName: `"${profileData.companyName}"`,
                headquarters: `"${profileData.headquarters}"`,
                employeeSize: `"${profileData.employeeSize}"`,
                industry: `"${profileData.industry}"`,
                revenue: `"${profileData.revenue}"`,
                gtmModel: `"${profileData.gtmModel}"`,
                regionFocus: `"${profileData.regionFocus}"`,
                dealSize: `"${profileData.dealSize}"`,
                companyUrl: `"${profileData.companyUrl}"`,
                keyBuyerPersona: `"${profileData.keyBuyerPersona}"`,
              });

              // CRITICAL: Actually set the state with the profile data
              setCompanyProfile(profileData);
              console.log("MissionControl: State has been updated with profileData");

              // Check if company profile is saved (has at least company name)
              // Check both raw data and mapped profileData, but treat empty strings as falsy
              const companyName = (data.company_name || data.companyName || profileData.companyName || "").trim();
              const hasCompanyName = companyName.length > 0;
              
              console.log("MissionControl: Has company name check:", {
                'data.company_name': `"${data.company_name}"`,
                'data.companyName': data.companyName,
                'profileData.companyName': `"${profileData.companyName}"`,
                'companyName (trimmed)': `"${companyName}"`,
                'hasCompanyName': hasCompanyName
              });
              
              // Also save to localStorage for offline access
              // Only save if we have actual company profile data (not just empty strings)
              if (hasCompanyName || profileData.headquarters || profileData.industry || profileData.revenue) {
                try {
                  const { setUserLocalStorage } = await import("@/utils/cacheUtils");
                  // Save both the API response and the mapped profile data for redundancy
                  const dataToSave = {
                    ...data,
                    ...profileData,
                    user_id: userId,
                    // Ensure company_name is saved in both formats
                    company_name: profileData.companyName || data.company_name || "",
                    companyName: profileData.companyName || data.companyName || "",
                  };
                  setUserLocalStorage('companyProfile', JSON.stringify(dataToSave), userId);
                  console.log("MissionControl: Saved company profile to localStorage");
                } catch (e) {
                  console.warn("MissionControl: Failed to save to localStorage:", e);
                }
              } else {
                console.log("MissionControl: Skipping localStorage save - no meaningful company profile data");
              }
              
              if (hasCompanyName) {
                console.log("MissionControl: Company profile is saved, unlocking customer profile tab");
                setIsCompanyProfileSaved(true);
              } else {
                console.log("MissionControl: Company profile not yet saved - no company name found (empty string)");
                // Don't unlock customer profile if company name is empty
                setIsCompanyProfileSaved(false);
              }
              return; // Success, exit retry loop
            } else {
              // Data validation failed, try localStorage
              console.log("MissionControl: Data validation failed, trying localStorage fallback");
              const loaded = await loadProfileFromLocalStorage(userId);
              if (loaded) return;
            }
          } else {
            // Try to get error message from response
            let errorMessage = `HTTP ${response.status}`;
            try {
              const errorData = await response.text();
              if (errorData) {
                try {
                  const parsedError = JSON.parse(errorData);
                  errorMessage = parsedError.message || parsedError.error || errorMessage;
                } catch {
                  errorMessage = errorData.substring(0, 200); // First 200 chars if not JSON
                }
              }
            } catch (e) {
              // Ignore errors reading response body
            }
            
            console.error(`MissionControl: Profile load response not OK: ${response.status} - ${errorMessage}`);
            
            if (response.status === 404) {
              console.log("MissionControl: No company profile found (404) - trying localStorage fallback");
              const loaded = await loadProfileFromLocalStorage(userId);
              if (loaded) return;
            } else if (response.status >= 500 && retryCount < maxRetries) {
              // Server error, retry
              console.log(`MissionControl: Server error ${response.status}, will retry...`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
              continue;
            } else {
              // Other error status, try localStorage
              console.log(`MissionControl: API error (${response.status}), trying localStorage fallback`);
              const loaded = await loadProfileFromLocalStorage(userId);
              if (loaded) return;
            }
          }
        } catch (error: any) {
          const errorDetails = {
            name: error?.name,
            message: error?.message,
            stack: error?.stack?.substring(0, 500), // First 500 chars of stack
            type: error?.constructor?.name,
          };
          console.error("MissionControl: Error loading company profile:", errorDetails);
          console.error("MissionControl: Full error object:", error);
          
          // Handle abort (timeout)
          if (error.name === 'AbortError') {
            console.error("MissionControl: Request timeout after 10 seconds");
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`MissionControl: Retrying after timeout (attempt ${retryCount + 1})...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
              continue;
            }
          }
          
          // Network error or other error, try localStorage if we haven't already
          if (retryCount === 0) {
            console.log("MissionControl: Network/connection error, trying localStorage fallback");
            const loaded = await loadProfileFromLocalStorage(userId);
            if (loaded) {
              console.log("MissionControl: Successfully loaded from localStorage fallback");
              return;
            }
          }
          
          // If we've exhausted retries, try localStorage one more time
          if (retryCount >= maxRetries) {
            console.log("MissionControl: All retries exhausted, trying localStorage as last resort");
            const loaded = await loadProfileFromLocalStorage(userId);
            if (loaded) {
              console.log("MissionControl: Successfully loaded from localStorage as last resort");
            } else {
              console.warn("MissionControl: Failed to load from both API and localStorage");
            }
            return;
          }
          
          retryCount++;
          if (retryCount <= maxRetries) {
            console.log(`MissionControl: Retrying... (attempt ${retryCount + 1})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
          }
        }
      }
      
      // If we get here, all attempts failed
      console.warn("MissionControl: Failed to load company profile after all retries");
    };

    // Add a small delay to ensure user is fully initialized
    const timeoutId = setTimeout(() => {
      loadProfileData();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentUser?.uid]);

  const handleConnect = (sourceName: string) => {
    const source = dataSources.find(s => s.name === sourceName);
    if (!source) {
      console.error('Source not found:', sourceName, 'Available sources:', dataSources.map(s => s.name));
      return;
    }

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

    // If LinkedIn, open auth modal instead
    if (source.platform === 'LinkedIn' || source.name === 'LinkedIn Sales Navigator' || source.name === 'LinkedIn Company') {
      setLinkedInSourceToConnect(source);
      setIsLinkedInAuthModalOpen(true);
      return;
    }

    // If X/Twitter, open auth modal instead
    if (source.platform === 'Twitter' || source.name === 'X') {
      setXSourceToConnect(source);
      setIsXAuthModalOpen(true);
      return;
    }

    // If Google Analytics, open auth modal instead
    if (source.platform === 'Google Analytics' || source.name === 'Google Analytics') {
      setGoogleAnalyticsSourceToConnect(source);
      setIsGoogleAnalyticsAuthModalOpen(true);
      return;
    }

    // If Mixpanel, open auth modal instead
    if (source.platform === 'Mixpanel' || source.name === 'Mixpanel') {
      setMixpanelSourceToConnect(source);
      setIsMixpanelAuthModalOpen(true);
      return;
    }

    // If Slack, redirect to Slack OAuth
    if (source.platform === 'Slack' || source.name.startsWith('Slack')) {
      handleSlackConnect(source);
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

  const handleLinkedInLogin = async () => {
    if (!linkedInSourceToConnect) return;
    
    if (!linkedInEmail || !linkedInPassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLinkedInLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsLinkedInLoggingIn(false);
      setLinkedInAuthStep('permissions');
    }, 1500);
  };

  const handleLinkedInApprove = () => {
    if (!linkedInSourceToConnect) return;

    // Update data source to connected
    setDataSources(prev => prev.map(s => {
      if (s.id === linkedInSourceToConnect.id) {
        const mockData = {
          status: 'connected' as const,
          account: linkedInEmail,
          connectedDate: new Date().toISOString().split('T')[0],
          lastSyncTime: 'Just now',
          lastSyncStatus: 'success' as const,
          totalRecords: Math.floor(Math.random() * 5000) + 100,
          newRecordsThisWeek: Math.floor(Math.random() * 100),
          updatedRecords: Math.floor(Math.random() * 50),
          dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
          objectsSynced: linkedInSourceToConnect.name === 'LinkedIn Company' 
            ? ['Company Page', 'Posts', 'Followers'] 
            : ['Company Pages', 'Profiles', 'Messages'],
          fieldsMapped: Math.floor(Math.random() * 50) + 20,
          filters: ['Active profiles only']
        };
        return { ...s, ...mockData };
      }
      return s;
    }));

    // Close modal and reset form
    setIsLinkedInAuthModalOpen(false);
    setLinkedInEmail("");
    setLinkedInPassword("");
    setLinkedInSourceToConnect(null);
    setLinkedInAuthStep('login');

    toast({
      title: `${linkedInSourceToConnect.name} connected successfully`,
      description: "Your LinkedIn account is now connected and syncing. Records and sync options are now available.",
    });
  };

  const handleLinkedInDeny = () => {
    // Close modal and reset form
    setIsLinkedInAuthModalOpen(false);
    setLinkedInEmail("");
    setLinkedInPassword("");
    setLinkedInSourceToConnect(null);
    setLinkedInAuthStep('login');

    toast({
      title: "Connection not authorized",
      description: "You denied access to your LinkedIn account.",
      variant: "default",
    });
  };

  const handleXLogin = async () => {
    if (!xSourceToConnect) return;
    
    if (!xEmail || !xPassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsXLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsXLoggingIn(false);
      setXAuthStep('permissions');
    }, 1500);
  };

  const handleXApprove = () => {
    if (!xSourceToConnect) return;

    // Update data source to connected
    setDataSources(prev => prev.map(s => {
      if (s.id === xSourceToConnect.id) {
        const mockData = {
          status: 'connected' as const,
          account: xEmail,
          connectedDate: new Date().toISOString().split('T')[0],
          lastSyncTime: 'Just now',
          lastSyncStatus: 'success' as const,
          totalRecords: Math.floor(Math.random() * 5000) + 100,
          newRecordsThisWeek: Math.floor(Math.random() * 100),
          updatedRecords: Math.floor(Math.random() * 50),
          dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
          objectsSynced: ['Profiles', 'Tweets', 'Engagements'],
          fieldsMapped: Math.floor(Math.random() * 50) + 20,
          filters: ['Active profiles only']
        };
        return { ...s, ...mockData };
      }
      return s;
    }));

    // Close modal and reset form
    setIsXAuthModalOpen(false);
    setXEmail("");
    setXPassword("");
    setXSourceToConnect(null);
    setXAuthStep('login');

    toast({
      title: "X connected successfully",
      description: "Your X account is now connected and syncing. Records and sync options are now available.",
    });
  };

  const handleXDeny = () => {
    // Close modal and reset form
    setIsXAuthModalOpen(false);
    setXEmail("");
    setXPassword("");
    setXSourceToConnect(null);
    setXAuthStep('login');

    toast({
      title: "Connection not authorized",
      description: "You denied access to your X account.",
      variant: "default",
    });
  };

  const handleGoogleAnalyticsSignIn = async () => {
    if (!googleAnalyticsSourceToConnect) return;

    setIsGoogleAnalyticsSigningIn(true);

    // Simulate Google OAuth sign-in process, then show consent screen
    setTimeout(() => {
      setIsGoogleAnalyticsSigningIn(false);
      setGoogleAnalyticsAuthStep('permissions');
      // Set a mock email from Google account
      setGoogleAnalyticsEmail("user@gmail.com");
    }, 1500);
  };

  const handleGoogleAnalyticsApprove = () => {
    if (!googleAnalyticsSourceToConnect) return;

    // Update data source to connected
    setDataSources(prev => prev.map(s => {
      if (s.id === googleAnalyticsSourceToConnect.id) {
        const mockData = {
          status: 'connected' as const,
          account: googleAnalyticsEmail,
          connectedDate: new Date().toISOString().split('T')[0],
          lastSyncTime: 'Just now',
          lastSyncStatus: 'success' as const,
          totalRecords: Math.floor(Math.random() * 10000) + 500,
          newRecordsThisWeek: Math.floor(Math.random() * 500),
          updatedRecords: Math.floor(Math.random() * 200),
          dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
          objectsSynced: ['Page Views', 'Events', 'User Sessions', 'Conversions'],
          fieldsMapped: Math.floor(Math.random() * 50) + 30,
          filters: ['Active properties only']
        };
        return { ...s, ...mockData };
      }
      return s;
    }));

    // Show success state, then close modal after a brief delay
    setGoogleAnalyticsAuthStep('success');
    
    toast({
      title: "Google Analytics connected successfully",
      description: "Your Google Analytics account is now connected and syncing. Records and sync options are now available.",
    });

    // Close modal after showing success message
    setTimeout(() => {
      setIsGoogleAnalyticsAuthModalOpen(false);
      setGoogleAnalyticsEmail("");
      setGoogleAnalyticsSourceToConnect(null);
      setGoogleAnalyticsAuthStep('signin');
    }, 1500);
  };

  const handleGoogleAnalyticsDeny = () => {
    // Close modal and reset form
    setIsGoogleAnalyticsAuthModalOpen(false);
    setGoogleAnalyticsEmail("");
    setGoogleAnalyticsSourceToConnect(null);
    setGoogleAnalyticsAuthStep('signin');

    toast({
      title: "Connection not authorized",
      description: "You denied access to your Google Analytics account.",
      variant: "default",
    });
  };

  const handleMixpanelLogin = async () => {
    if (!mixpanelSourceToConnect) return;
    
    if (!mixpanelEmail || !mixpanelPassword) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsMixpanelLoggingIn(true);

    // Simulate login process, then show permissions screen
    setTimeout(() => {
      setIsMixpanelLoggingIn(false);
      setMixpanelAuthStep('permissions');
    }, 1500);
  };

  const handleMixpanelApprove = () => {
    if (!mixpanelSourceToConnect) return;

    // Generate fake events count (124 as per requirement)
    const fakeEventsCount = 124;

    // Update data source to connected
    setDataSources(prev => prev.map(s => {
      if (s.id === mixpanelSourceToConnect.id) {
        const mockData = {
          status: 'connected' as const,
          account: mixpanelEmail,
          connectedDate: new Date().toISOString().split('T')[0],
          lastSyncTime: 'Just now',
          lastSyncStatus: 'success' as const,
          totalRecords: fakeEventsCount,
          newRecordsThisWeek: Math.floor(Math.random() * 500) + 100,
          updatedRecords: Math.floor(Math.random() * 200) + 50,
          dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
          objectsSynced: ['Page Viewed', 'Sign Up', 'Button Clicked', 'Form Submitted'],
          fieldsMapped: Math.floor(Math.random() * 50) + 30,
          filters: ['Active projects only']
        };
        return { ...s, ...mockData };
      }
      return s;
    }));

    // Close modal and reset form
    setIsMixpanelAuthModalOpen(false);
    setMixpanelEmail("");
    setMixpanelPassword("");
    setMixpanelSourceToConnect(null);
    setMixpanelAuthStep('login');

    toast({
      title: "Mixpanel connected successfully",
      description: "Your Mixpanel account is now connected and syncing. Events and analytics are now available.",
    });
  };

  const handleMixpanelDeny = () => {
    // Close modal and reset form
    setIsMixpanelAuthModalOpen(false);
    setMixpanelEmail("");
    setMixpanelPassword("");
    setMixpanelSourceToConnect(null);
    setMixpanelAuthStep('login');

    toast({
      title: "Connection not authorized",
      description: "You denied access to your Mixpanel account.",
      variant: "default",
    });
  };

  const handleSlackConnect = (source: DataSource) => {
    // Build Slack OAuth URL
    // For demo purposes, we'll use a mock client ID
    const clientId = '1234567890.1234567890'; // Demo client ID - replace with actual in production
    const redirectUri = encodeURIComponent(`${window.location.origin}/mission-control`);
    const scope = 'channels:read,chat:write,users:read,conversations:read';
    const state = encodeURIComponent(JSON.stringify({ sourceId: source.id, sourceName: source.name }));
    
    const slackOAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;
    
    // Show toast before redirecting
    toast({
      title: "Redirecting to Slack",
      description: "You will be redirected to Slack to authorize the connection.",
    });

    // Store the source ID in sessionStorage to handle callback
    sessionStorage.setItem('slackSourceToConnect', JSON.stringify({ id: source.id, name: source.name }));

    // Redirect browser to Slack OAuth URL
    window.location.href = slackOAuthUrl;
  };

  const handleSlackOAuthCallback = (source: DataSource) => {
    // Update data source to connected
    setDataSources(prev => prev.map(s => {
      if (s.id === source.id || s.name === source.name || s.name.startsWith('Slack')) {
        const mockData = {
          status: 'connected' as const,
          account: 'slack@company.com',
          connectedDate: new Date().toISOString().split('T')[0],
          lastSyncTime: 'Just now',
          lastSyncStatus: 'success' as const,
          totalRecords: Math.floor(Math.random() * 5000) + 100,
          newRecordsThisWeek: Math.floor(Math.random() * 500) + 50,
          updatedRecords: Math.floor(Math.random() * 200) + 20,
          dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
          objectsSynced: ['Messages', 'Channels', 'Conversations'],
          fieldsMapped: Math.floor(Math.random() * 50) + 20,
          filters: ['Active channels only']
        };
        return { ...s, ...mockData };
      }
      return s;
    }));

    // Clean up
    sessionStorage.removeItem('slackSourceToConnect');

    toast({
      title: "Slack connected successfully",
      description: "Your Slack workspace is now connected and syncing. Messages and channels are now available.",
    });
  };

  // Handle Slack OAuth callback (check for code/state in URL params)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      // User denied access
      toast({
        title: "Slack connection cancelled",
        description: "You cancelled the Slack authorization.",
        variant: "default",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      sessionStorage.removeItem('slackSourceToConnect');
      return;
    }

    if (code && state) {
      // OAuth callback received from Slack
      try {
        const stateData = JSON.parse(decodeURIComponent(state));
        const storedSource = sessionStorage.getItem('slackSourceToConnect');
        
        if (storedSource) {
          const sourceData = JSON.parse(storedSource);
          
          // Update data source to connected
          setDataSources(prev => prev.map(s => {
            if (s.id === sourceData.id || s.name === sourceData.name || s.name.startsWith('Slack')) {
              const mockData = {
                status: 'connected' as const,
                account: 'slack@company.com',
                connectedDate: new Date().toISOString().split('T')[0],
                lastSyncTime: 'Just now',
                lastSyncStatus: 'success' as const,
                totalRecords: Math.floor(Math.random() * 5000) + 100,
                newRecordsThisWeek: Math.floor(Math.random() * 500) + 50,
                updatedRecords: Math.floor(Math.random() * 200) + 20,
                dataQualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
                objectsSynced: ['Messages', 'Channels', 'Conversations'],
                fieldsMapped: Math.floor(Math.random() * 50) + 20,
                filters: ['Active channels only']
              };
              return { ...s, ...mockData };
            }
            return s;
          }));

          // Clean up
          sessionStorage.removeItem('slackSourceToConnect');
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);

          toast({
            title: "Slack connected successfully",
            description: "Your Slack workspace is now connected and syncing. Messages and channels are now available.",
          });
        }
      } catch (err) {
        console.error('Error processing Slack callback:', err);
        toast({
          title: "Error processing Slack callback",
          description: "There was an error processing the Slack authorization. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, []);

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
    setIsAddResourcePopoverOpen(true);
  };

  const handleAddCustomResource = () => {
    if (!customResourceName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the resource.",
        variant: "destructive",
      });
      return;
    }

    // Check if source already exists
    const existingSource = dataSources.find(s => s.name === customResourceName.trim());
    if (existingSource) {
      toast({
        title: "Already exists",
        description: `${customResourceName.trim()} is already in your sources.`,
        variant: "default",
      });
      return;
    }

    const resourceName = customResourceName.trim();

    // Create new custom data source
    const newSource: DataSource = {
      id: `custom-${Date.now()}`,
      name: resourceName,
      type: customResourceType,
      icon: Database,
      platform: 'Custom',
      status: 'disconnected',
      syncFrequency: 'daily',
      totalRecords: 0,
      newRecordsThisWeek: 0,
      updatedRecords: 0,
      dataQualityScore: 0,
      objectsSynced: [],
      fieldsMapped: 0,
      filters: [],
      description: `Custom ${customResourceType} resource`
    };

    // Add to data sources
    setDataSources(prev => [...prev, newSource]);
    
    // Reset form
    setCustomResourceName("");
    setCustomResourceType('custom');
    setIsAddResourcePopoverOpen(false);
    
    toast({
      title: `${resourceName} added`,
      description: `Click "Connect" to set up the integration.`,
    });
  };

  const handleAddCustomFileUpload = () => {
    if (!customFileUploadName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the file upload.",
        variant: "destructive",
      });
      return;
    }

    // Check if either file or URL is provided
    if (!customFileUploadFile && !customFileUploadUrl.trim()) {
      toast({
        title: "File or URL required",
        description: "Please either upload a file or enter a file URL.",
        variant: "destructive",
      });
      return;
    }

    // Check if source already exists
    const existingSource = dataSources.find(s => s.name === customFileUploadName.trim());
    if (existingSource) {
      toast({
        title: "Already exists",
        description: `${customFileUploadName.trim()} is already in your sources.`,
        variant: "default",
      });
      return;
    }

    const uploadName = customFileUploadName.trim();

    // Determine description based on what's provided
    let description = 'Custom file upload';
    if (customFileUploadFile) {
      description = `File: ${customFileUploadFile.name}`;
    } else if (customFileUploadUrl.trim()) {
      description = `URL: ${customFileUploadUrl.trim()}`;
    }

    // Create new file upload source
    const newSource: DataSource = {
      id: `file-custom-${Date.now()}`,
      name: uploadName,
      type: 'file',
      icon: FileText,
      platform: 'File Upload',
      status: (customFileUploadFile || customFileUploadUrl.trim()) ? 'uploaded' : 'disconnected',
      syncFrequency: 'manual',
      totalRecords: 0,
      newRecordsThisWeek: 0,
      updatedRecords: 0,
      dataQualityScore: 0,
      objectsSynced: [],
      fieldsMapped: 0,
      filters: [],
      description: description
    };

    // Add to data sources
    setDataSources(prev => [...prev, newSource]);
    
    // Reset form
    setCustomFileUploadName("");
    setCustomFileUploadFile(null);
    setCustomFileUploadUrl("");
    setIsAddResourcePopoverOpen(false);
    
    toast({
      title: `${uploadName} added`,
      description: customFileUploadFile ? "File uploaded successfully." : customFileUploadUrl.trim() ? "File URL added successfully." : "Click 'Connect' to upload files.",
    });
  };

  // New handlers for Add Source
  const handleAddUrl = () => {
    setSourceUrls(prev => [...prev, {id: Date.now().toString(), url: '', status: 'pending'}]);
  };

  const handleRemoveUrl = (id: string) => {
    setSourceUrls(prev => prev.filter(item => item.id !== id));
  };

  const handleUrlChange = (id: string, url: string) => {
    setSourceUrls(prev => prev.map(item => 
      item.id === id ? { ...item, url, status: 'pending' as const } : item
    ));
  };

  const handleAddFile = () => {
    setSourceFiles(prev => [...prev, {id: Date.now().toString(), file: null, status: 'pending'}]);
  };

  const handleRemoveFile = (id: string) => {
    setSourceFiles(prev => prev.filter(item => item.id !== id));
  };

  const handleFileChange = (id: string, file: File | null) => {
    setSourceFiles(prev => prev.map(item => 
      item.id === id ? { ...item, file, status: 'pending' as const } : item
    ));
  };

  const handleVerifyUrl = async (id: string, url: string) => {
    if (!url.trim()) return;
    
    setSourceUrls(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'pending' as const } : item
    ));
    
    setIsProcessing(true);
    
    try {
      // Simulate verification - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simple URL validation
      const isValid = /^https?:\/\/.+/.test(url.trim());
      
      setSourceUrls(prev => prev.map(item => 
        item.id === id ? { ...item, status: isValid ? 'success' : 'error' } : item
      ));
      
      if (isValid) {
        toast({
          title: "URL verified",
          description: "The URL has been successfully verified.",
        });
      } else {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid URL starting with http:// or https://",
          variant: "destructive",
        });
      }
    } catch (error) {
      setSourceUrls(prev => prev.map(item => 
        item.id === id ? { ...item, status: 'error' } : item
      ));
      toast({
        title: "Verification failed",
        description: "Failed to verify the URL. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyFile = async (id: string, file: File | null) => {
    if (!file) return;
    
    setSourceFiles(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'pending' as const } : item
    ));
    
    setIsProcessing(true);
    
    try {
      // Simulate file verification - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simple file validation (size check)
      const isValid = file.size > 0 && file.size < 100 * 1024 * 1024; // 100MB limit
      
      setSourceFiles(prev => prev.map(item => 
        item.id === id ? { ...item, status: isValid ? 'success' : 'error' } : item
      ));
      
      if (isValid) {
        toast({
          title: "File verified",
          description: "The file has been successfully verified.",
        });
      } else {
        toast({
          title: "Invalid file",
          description: "File is empty or too large. Maximum size is 100MB.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setSourceFiles(prev => prev.map(item => 
        item.id === id ? { ...item, status: 'error' } : item
      ));
      toast({
        title: "Verification failed",
        description: "Failed to verify the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitSources = async () => {
    const validUrls = activeSections.link ? sourceUrls.filter(item => item.url.trim() && item.status === 'success') : [];
    const validFiles = activeSections.file ? sourceFiles.filter(item => item.file && item.status === 'success') : [];
    
    // Check if at least one valid source exists
    if (validUrls.length === 0 && validFiles.length === 0) {
      toast({
        title: "No valid sources",
        description: "Please add and verify at least one URL or file.",
        variant: "destructive",
      });
      return;
    }
    
    let addedCount = 0;
    
    // Process URLs - create data sources
    if (validUrls.length > 0) {
      for (const urlItem of validUrls) {
        const newSource: DataSource = {
          id: `url-${Date.now()}-${Math.random()}`,
          name: `URL Source ${new Date().toLocaleDateString()}`,
          type: 'file',
          icon: FileText,
          platform: 'URL',
          status: 'uploaded',
          syncFrequency: 'manual',
          totalRecords: 0,
          newRecordsThisWeek: 0,
          updatedRecords: 0,
          dataQualityScore: 0,
          objectsSynced: [],
          fieldsMapped: 0,
          filters: [],
          description: urlItem.url
        };
        setDataSources(prev => [...prev, newSource]);
        addedCount++;
      }
    }
    
    // Process files - create data sources
    if (validFiles.length > 0) {
      for (const fileItem of validFiles) {
        if (fileItem.file) {
          const newSource: DataSource = {
            id: `file-${Date.now()}-${Math.random()}`,
            name: fileItem.file.name,
            type: 'file',
            icon: FileText,
            platform: 'File Upload',
            status: 'uploaded',
            syncFrequency: 'manual',
            totalRecords: 0,
            newRecordsThisWeek: 0,
            updatedRecords: 0,
            dataQualityScore: 0,
            objectsSynced: [],
            fieldsMapped: 0,
            filters: [],
            description: `File: ${fileItem.file.name}`
          };
          setDataSources(prev => [...prev, newSource]);
          addedCount++;
        }
      }
    }
    
    const sourcesAdded = [];
    if (validUrls.length > 0) sourcesAdded.push(`${validUrls.length} URL(s)`);
    if (validFiles.length > 0) sourcesAdded.push(`${validFiles.length} file(s)`);
    
    toast({
      title: "Sources added",
      description: `${sourcesAdded.join(' and ')} added successfully.`,
    });
    
    // Reset only the sections that were submitted
    if (validUrls.length > 0) {
      setSourceUrls([{id: Date.now().toString(), url: '', status: 'pending'}]);
    }
    if (validFiles.length > 0) {
      setSourceFiles([{id: Date.now().toString(), file: null, status: 'pending'}]);
    }
    
    // Close form if all active sections are empty
    const hasRemainingUrls = activeSections.link && sourceUrls.some(item => item.url.trim());
    const hasRemainingFiles = activeSections.file && sourceFiles.some(item => item.file);
    if (!hasRemainingUrls && !hasRemainingFiles) {
      setIsAddResourcePopoverOpen(false);
    }
  };

  const handleTestApiConnection = async () => {
    if (!apiEndpoint.trim()) {
      toast({
        title: "API Endpoint required",
        description: "Please enter an API endpoint URL.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingApi(true);
    
    try {
      // Parse headers if provided
      let headers: Record<string, string> = {};
      if (apiHeaders.trim()) {
        try {
          headers = JSON.parse(apiHeaders);
        } catch (e) {
          toast({
            title: "Invalid headers",
            description: "Headers must be valid JSON format.",
            variant: "destructive",
          });
          setIsTestingApi(false);
          return;
        }
      }

      // Prepare credentials based on auth type
      const credentials: any = {};
      if (authType === 'api_key' || authType === 'bearer') {
        if (apiKey.trim()) {
          credentials.apiKey = apiKey.trim();
        }
      } else if (authType === 'oauth2') {
        if (clientId.trim()) credentials.clientId = clientId.trim();
        if (clientSecret.trim()) credentials.clientSecret = clientSecret.trim();
      }

      // Parse body if provided
      let body: any = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(apiMethod) && apiBody.trim()) {
        try {
          body = JSON.parse(apiBody);
        } catch (e) {
          body = apiBody;
        }
      }

      // Send test request to backend
      const result = await ApiService.testDataSourceConnection({
        endpoint: apiEndpoint.trim(),
        method: apiMethod,
        authType,
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        body,
      });

      if (result.success) {
        toast({
          title: "API Connection Successful",
          description: result.message || `Successfully connected to API.`,
        });
      } else {
        toast({
          title: "API Connection Failed",
          description: result.message || "Failed to connect to API.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "API Connection Error",
        description: error?.message || "Failed to connect to API. Please check your credentials and endpoint.",
        variant: "destructive",
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleAddApiResource = async () => {
    if (!apiResourceName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the API source.",
        variant: "destructive",
      });
      return;
    }

    if (!apiEndpoint.trim()) {
      toast({
        title: "API Endpoint required",
        description: "Please enter an API endpoint URL.",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    try {
      new URL(apiEndpoint.trim());
    } catch (e) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL (e.g., https://api.example.com/endpoint)",
        variant: "destructive",
      });
      return;
    }

    // Validate OAuth2 fields if OAuth2 is selected
    if (authType === 'oauth2') {
      if (!clientId.trim()) {
        toast({
          title: "Client ID required",
          description: "Please enter OAuth2 Client ID.",
          variant: "destructive",
        });
        return;
      }
      if (!clientSecret.trim()) {
        toast({
          title: "Client Secret required",
          description: "Please enter OAuth2 Client Secret.",
          variant: "destructive",
        });
        return;
      }
      if (!permissionsApproved) {
        toast({
          title: "Permissions required",
          description: "Please approve the required permissions.",
          variant: "destructive",
        });
        return;
      }
    }

    // Check if source already exists
    const existingSource = dataSources.find(s => s.name === apiResourceName.trim());
    if (existingSource) {
      toast({
        title: "Already exists",
        description: `${apiResourceName.trim()} is already in your sources.`,
        variant: "default",
      });
      return;
    }

    setIsAddingApiResource(true);

    try {
      // Parse headers if provided
      let headers: Record<string, string> = {};
      if (apiHeaders.trim()) {
        try {
          headers = JSON.parse(apiHeaders);
        } catch (e) {
          toast({
            title: "Invalid headers",
            description: "Headers must be valid JSON format.",
            variant: "destructive",
          });
          setIsAddingApiResource(false);
          return;
        }
      }

      // Prepare credentials based on auth type
      const credentials: any = {};
      if (authType === 'api_key' || authType === 'bearer') {
        if (apiKey.trim()) {
          credentials.apiKey = apiKey.trim();
        }
      } else if (authType === 'oauth2') {
        credentials.clientId = clientId.trim();
        credentials.clientSecret = clientSecret.trim();
      }

      // Parse body if provided
      let body: any = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(apiMethod) && apiBody.trim()) {
        try {
          body = JSON.parse(apiBody);
        } catch (e) {
          body = apiBody;
        }
      }

      // Send to backend for token exchange and data source creation
      const result = await ApiService.createDataSource({
        name: apiResourceName.trim(),
        endpoint: apiEndpoint.trim(),
        method: apiMethod,
        authType,
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        body,
        scopes: oauthScopes.length > 0 ? oauthScopes : undefined,
        permissions: permissionsApproved ? ['approved'] : undefined,
        type: apiResourceType,
      });

      if (result.success) {
        // Create new source from backend response
        const newSource: DataSource = {
          id: result.dataSource?.id || `api-${Date.now()}`,
          name: apiResourceName.trim(),
          type: apiResourceType,
          icon: Database,
          platform: 'API Integration',
          status: result.dataSource?.status || 'connected',
          syncFrequency: 'daily',
          totalRecords: 0,
          newRecordsThisWeek: 0,
          updatedRecords: 0,
          dataQualityScore: 0,
          objectsSynced: [],
          fieldsMapped: 0,
          filters: [],
          description: `API: ${apiEndpoint.trim()} (${apiMethod})${authType !== 'none' ? ' • Authenticated' : ''}`
        };
        
        // Add to data sources
        setDataSources(prev => [...prev, newSource]);
        
        // Reset form
        setApiResourceName("");
        setApiEndpoint("");
        setApiMethod('GET');
        setApiKey("");
        setApiHeaders("");
        setApiBody("");
        setApiResourceType('custom');
        setAuthType('api_key');
        setClientId("");
        setClientSecret("");
        setOauthScopes([]);
        setPermissionsApproved(false);
        setIsAddResourcePopoverOpen(false);
        
        toast({
          title: `${apiResourceName.trim()} added`,
          description: result.message || `API source connected successfully. Token exchange completed.`,
        });
      } else {
        toast({
          title: "Failed to add data source",
          description: result.message || "Failed to create data source. Please check your credentials.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error adding data source",
        description: error?.message || "An error occurred while adding the data source.",
        variant: "destructive",
      });
    } finally {
      setIsAddingApiResource(false);
    }
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

  // Calculate overall completeness based on completed sections
  const calculateOverallCompleteness = () => {
    // Check both local dataSources state and the hasDataSources flag
    const hasLocalDataSources = dataSources.length > 0;
    const hasAnyDataSources = hasLocalDataSources || hasDataSources;
    
    if (hasAnyDataSources && isCustomerProfileSaved && isCompanyProfileSaved) {
      return 100;
    } else if (isCustomerProfileSaved && isCompanyProfileSaved) {
      return 55;
    } else if (isCompanyProfileSaved) {
      return 30;
    }
    return 0;
  };

  const overallCompleteness = calculateOverallCompleteness();

  // Listen for customer profile save events from ICPManager
  useEffect(() => {
    const handleCustomerProfileSaved = () => {
      setIsCustomerProfileSaved(true);
    };

    // Listen for custom event from ICPManager
    window.addEventListener('customerProfileSaved', handleCustomerProfileSaved);
    
    return () => {
      window.removeEventListener('customerProfileSaved', handleCustomerProfileSaved);
    };
  }, []);

  // Check for existing customer profile data on mount
  useEffect(() => {
    // Check localStorage for saved ICPs
    const savedICPs = localStorage.getItem('icps');
    if (savedICPs) {
      try {
        const icps = JSON.parse(savedICPs);
        if (icps && icps.length > 0) {
          setIsCustomerProfileSaved(true);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Listen for data source added events from DataSourcesManager
  useEffect(() => {
    const handleDataSourceAdded = () => {
      // Data source was added in DataSourcesManager
      setHasDataSources(true);
    };

    window.addEventListener('dataSourceAdded', handleDataSourceAdded);
    
    return () => {
      window.removeEventListener('dataSourceAdded', handleDataSourceAdded);
    };
  }, []);

  // Also update hasDataSources when local dataSources state changes
  useEffect(() => {
    if (dataSources.length > 0) {
      setHasDataSources(true);
    }
  }, [dataSources.length]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Profile Completeness - Common to all tabs */}
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">Completeness:</span>
          <Progress value={overallCompleteness} className="w-32 h-1.5" />
          <span className="text-xs font-medium min-w-[2rem] text-right">{overallCompleteness}%</span>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => {
          // Prevent switching to locked tabs
          if (value === "customer-profile" && isCustomerProfileLocked) {
            return;
          }
          if (value === "sources" && isDataSourcesLocked) {
            return;
          }
          setActiveTab(value);
        }} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 gap-1 md:gap-0">
            <TabsTrigger value="profile" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4">
              <Building2 className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Company Profile</span>
              <span className="sm:hidden">Profile</span>
            </TabsTrigger>
            <TabsTrigger 
              value="customer-profile" 
              disabled={isCustomerProfileLocked}
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 disabled:opacity-50 disabled:cursor-not-allowed relative"
            >
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Customer Profile</span>
              <span className="sm:hidden">Customer</span>
              {isCustomerProfileLocked && (
                <span className="ml-1 text-[10px]">🔒</span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="sources" 
              disabled={isDataSourcesLocked}
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 disabled:opacity-50 disabled:cursor-not-allowed relative"
            >
              <Database className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Data Sources</span>
              <span className="sm:hidden">Sources</span>
              {isDataSourcesLocked && (
                <span className="ml-1 text-[10px]">🔒</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Company Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
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
                    <Label htmlFor="company-url">Company URL</Label>
                    <Input 
                      id="company-url" 
                      type="url"
                      placeholder="https://example.com"
                      value={companyProfile.companyUrl}
                      onChange={(e) => setCompanyProfile(prev => ({ ...prev, companyUrl: e.target.value }))}
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
                      value={companyProfile.industry || ""}
                      onValueChange={(value) => {
                        if (value === "__custom__") {
                          setCustomIndustryInput(companyProfile.industry || "");
                          setIsCustomIndustryPopoverOpen(true);
                        } else {
                          setCompanyProfile(prev => ({ ...prev, industry: value }));
                        }
                      }}
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
                        {companyProfile.industry && 
                         companyProfile.industry.trim() !== "" && 
                         !["saas", "fintech", "healthcare", "ecommerce", "enterprise"].includes(companyProfile.industry.toLowerCase()) && (
                          <SelectItem value={companyProfile.industry}>
                            {companyProfile.industry}
                          </SelectItem>
                        )}
                        <SelectItem value="__custom__" className="text-muted-foreground italic border-t mt-1 pt-1">
                          Enter custom industry...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Dialog open={isCustomIndustryPopoverOpen} onOpenChange={setIsCustomIndustryPopoverOpen}>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Enter Custom Industry</DialogTitle>
                          <DialogDescription>
                            Enter a custom industry name for your company.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="custom-industry-input">Industry</Label>
                            <Input
                              id="custom-industry-input"
                              placeholder="Enter custom industry"
                              value={customIndustryInput}
                              onChange={(e) => setCustomIndustryInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && customIndustryInput.trim()) {
                                  setCompanyProfile(prev => ({ ...prev, industry: customIndustryInput.trim() }));
                                  setIsCustomIndustryPopoverOpen(false);
                                  setCustomIndustryInput("");
                                }
                              }}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsCustomIndustryPopoverOpen(false);
                              setCustomIndustryInput("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              if (customIndustryInput.trim()) {
                                setCompanyProfile(prev => ({ ...prev, industry: customIndustryInput.trim() }));
                                setIsCustomIndustryPopoverOpen(false);
                                setCustomIndustryInput("");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
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
                </div>
                
                <Accordion type="multiple" className="space-y-4 mt-6">
                  <AccordionItem value="priorities">
                    <AccordionTrigger className="text-lg font-medium">
                      Goals
                    </AccordionTrigger>
                    <AccordionContent>
                      <Card>
                        <CardContent className="p-4 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="business-goals">Primary Business Goals</Label>
                            <Textarea 
                              id="business-goals" 
                              placeholder="Be as specific as possible - clearer goals help Brewra generate more accurate insights."
                              value={companyProfile.businessGoals}
                              onChange={(e) => setCompanyProfile(prev => ({ ...prev, businessGoals: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="pain-points">Key Pain Points We Solve</Label>
                            <Textarea 
                              id="pain-points" 
                              placeholder="Describe the key problems you're trying to solve. More detail leads to more relevant insights."
                              value={companyProfile.painPoints}
                              onChange={(e) => setCompanyProfile(prev => ({ ...prev, painPoints: e.target.value }))}
                            />
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
                              <Textarea 
                                id="target-segments" 
                                placeholder="e.g., Mid-market SaaS companies, Financial services..."
                                value={companyProfile.targetSegments}
                                onChange={(e) => setCompanyProfile(prev => ({ ...prev, targetSegments: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="exclude-segments">Exclude Segments</Label>
                              <Textarea 
                                id="exclude-segments" 
                                placeholder="e.g., Startups under 50 employees, Government..."
                                value={companyProfile.excludeSegments}
                                onChange={(e) => setCompanyProfile(prev => ({ ...prev, excludeSegments: e.target.value }))}
                              />
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
                            <Textarea 
                              id="compliance-reqs" 
                              placeholder="e.g., GDPR, HIPAA, SOC2..."
                              value={companyProfile.complianceReqs}
                              onChange={(e) => setCompanyProfile(prev => ({ ...prev, complianceReqs: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="messaging-constraints">General Instruction</Label>
                            <Textarea 
                              id="messaging-constraints" 
                              placeholder="e.g., Avoid certain terms, required disclaimers..."
                              value={companyProfile.messagingConstraints}
                              onChange={(e) => setCompanyProfile(prev => ({ ...prev, messagingConstraints: e.target.value }))}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
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

          {/* Customer Profile Tab */}
          <TabsContent value="customer-profile">
            <Card>
              <CardContent className="pt-6">
                <ICPManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Sources Tab */}
          <TabsContent value="sources">
            <DataSourcesManager onNavigateToCompanyProfile={() => setActiveTab("profile")} />
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

        {/* LinkedIn Auth Modal */}
        <Dialog open={isLinkedInAuthModalOpen} onOpenChange={(open) => {
          if (!open) {
            setIsLinkedInAuthModalOpen(false);
            setLinkedInEmail("");
            setLinkedInPassword("");
            setLinkedInSourceToConnect(null);
            setLinkedInAuthStep('login');
          }
        }}>
          <DialogContent className="max-w-md">
            {linkedInAuthStep === 'login' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to LinkedIn</DialogTitle>
                  <DialogDescription>
                    Enter your LinkedIn credentials to continue.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="linkedin-email">Email</Label>
                    <Input
                      id="linkedin-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={linkedInEmail}
                      onChange={(e) => setLinkedInEmail(e.target.value)}
                      disabled={isLinkedInLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin-password">Password</Label>
                    <Input
                      id="linkedin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={linkedInPassword}
                      onChange={(e) => setLinkedInPassword(e.target.value)}
                      disabled={isLinkedInLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isLinkedInLoggingIn) {
                          handleLinkedInLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Linkedin className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsLinkedInAuthModalOpen(false);
                      setLinkedInEmail("");
                      setLinkedInPassword("");
                      setLinkedInSourceToConnect(null);
                      setLinkedInAuthStep('login');
                    }}
                    disabled={isLinkedInLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleLinkedInLogin}
                    disabled={isLinkedInLoggingIn || !linkedInEmail || !linkedInPassword}
                  >
                    {isLinkedInLoggingIn ? (
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
                    This application would like to access the following data from your LinkedIn account:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Requested Permissions:</p>
                    <ul className="space-y-2 text-sm">
                      {linkedInSourceToConnect?.name === 'LinkedIn Company' ? (
                        <>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span><strong>Company Page</strong> - Read company page information and details</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span><strong>Posts</strong> - Read company posts and engagement data</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span><strong>Followers</strong> - Read follower information and analytics</span>
                          </li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span><strong>Company Pages</strong> - Read company page information and details</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span><strong>Profiles</strong> - Read profile information and contact details</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span><strong>Messages</strong> - Read messages and conversation data</span>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{linkedInEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleLinkedInDeny}
                  >
                    Deny
                  </Button>
                  <Button
                    onClick={handleLinkedInApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* X (Twitter) Auth Modal */}
        <Dialog open={isXAuthModalOpen} onOpenChange={(open) => {
          if (!open) {
            setIsXAuthModalOpen(false);
            setXEmail("");
            setXPassword("");
            setXSourceToConnect(null);
            setXAuthStep('login');
          }
        }}>
          <DialogContent className="max-w-md">
            {xAuthStep === 'login' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to X</DialogTitle>
                  <DialogDescription>
                    Enter your X credentials to continue.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="x-email">Email</Label>
                    <Input
                      id="x-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={xEmail}
                      onChange={(e) => setXEmail(e.target.value)}
                      disabled={isXLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="x-password">Password</Label>
                    <Input
                      id="x-password"
                      type="password"
                      placeholder="Enter your password"
                      value={xPassword}
                      onChange={(e) => setXPassword(e.target.value)}
                      disabled={isXLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isXLoggingIn) {
                          handleXLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Twitter className="h-4 w-4" />
                    <span>This is a demo. Any credentials will work.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsXAuthModalOpen(false);
                      setXEmail("");
                      setXPassword("");
                      setXSourceToConnect(null);
                      setXAuthStep('login');
                    }}
                    disabled={isXLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleXLogin}
                    disabled={isXLoggingIn || !xEmail || !xPassword}
                  >
                    {isXLoggingIn ? (
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
                    This application would like to access the following data from your X account:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Requested Permissions:</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Profiles</strong> - Read profile information and user data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Tweets</strong> - Read tweets and post information</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Engagements</strong> - Read likes, retweets, and engagement metrics</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{xEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleXDeny}
                  >
                    Deny
                  </Button>
                  <Button
                    onClick={handleXApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Google Analytics Auth Modal */}
        <Dialog open={isGoogleAnalyticsAuthModalOpen} onOpenChange={(open) => {
          if (!open) {
            setIsGoogleAnalyticsAuthModalOpen(false);
            setGoogleAnalyticsEmail("");
            setGoogleAnalyticsSourceToConnect(null);
            setGoogleAnalyticsAuthStep('signin');
          }
        }}>
          <DialogContent className="max-w-md">
            {googleAnalyticsAuthStep === 'signin' ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-600" />
                    Connect Google Analytics
                  </DialogTitle>
                  <DialogDescription>
                    Sign in with your Google account to connect Google Analytics
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-6">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg w-full">
                      <p className="text-sm text-center text-muted-foreground mb-4">
                        This will open Google's sign-in page in a new window
                      </p>
                      <Button
                        onClick={handleGoogleAnalyticsSignIn}
                        disabled={isGoogleAnalyticsSigningIn}
                        className="w-full h-12 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm font-medium flex items-center justify-center gap-3"
                      >
                        {isGoogleAnalyticsSigningIn ? (
                          <>
                            <RefreshCw className="h-5 w-5 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Sign in with Google
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <span>This is a demo. Clicking will simulate Google sign-in.</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsGoogleAnalyticsAuthModalOpen(false);
                      setGoogleAnalyticsEmail("");
                      setGoogleAnalyticsSourceToConnect(null);
                      setGoogleAnalyticsAuthStep('signin');
                    }}
                    disabled={isGoogleAnalyticsSigningIn}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : googleAnalyticsAuthStep === 'permissions' ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-600" />
                    Google Account
                  </DialogTitle>
                  <DialogDescription>
                    This app wants to access your Google Analytics data
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3 bg-white">
                    <div className="flex items-center gap-3 pb-3 border-b">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {googleAnalyticsEmail.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{googleAnalyticsEmail}</p>
                        <p className="text-xs text-muted-foreground">Google Account</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-3">This will allow:</p>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span><strong>View your Google Analytics data</strong> - Read analytics reports and metrics</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span><strong>View your Analytics properties</strong> - Access property information and settings</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span><strong>View your Analytics reports</strong> - Read page views, events, and user data</span>
                        </li>
                      </ul>
                    </div>
                    <div className="pt-3 border-t text-xs text-muted-foreground">
                      <p>By continuing, you allow this app to access your Google Analytics data. You can revoke access at any time in your Google Account settings.</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleGoogleAnalyticsDeny}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGoogleAnalyticsApprove}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Allow
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Connected Successfully
                  </DialogTitle>
                  <DialogDescription>
                    Google Analytics has been connected
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-6">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-lg">Google Analytics Connected</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Your Google Analytics account is now connected and syncing.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => {
                      setIsGoogleAnalyticsAuthModalOpen(false);
                      setGoogleAnalyticsEmail("");
                      setGoogleAnalyticsSourceToConnect(null);
                      setGoogleAnalyticsAuthStep('signin');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Done
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Mixpanel Auth Modal */}
        <Dialog open={isMixpanelAuthModalOpen} onOpenChange={(open) => {
          if (!open) {
            setIsMixpanelAuthModalOpen(false);
            setMixpanelEmail("");
            setMixpanelPassword("");
            setMixpanelSourceToConnect(null);
            setMixpanelAuthStep('login');
          }
        }}>
          <DialogContent className="max-w-md">
            {mixpanelAuthStep === 'login' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Sign in to Mixpanel</DialogTitle>
                  <DialogDescription>
                    Enter your Mixpanel credentials to continue.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="mixpanel-email">Email</Label>
                    <Input
                      id="mixpanel-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={mixpanelEmail}
                      onChange={(e) => setMixpanelEmail(e.target.value)}
                      disabled={isMixpanelLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mixpanel-password">Password</Label>
                    <Input
                      id="mixpanel-password"
                      type="password"
                      placeholder="Enter your password"
                      value={mixpanelPassword}
                      onChange={(e) => setMixpanelPassword(e.target.value)}
                      disabled={isMixpanelLoggingIn}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isMixpanelLoggingIn) {
                          handleMixpanelLogin();
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
                      setIsMixpanelAuthModalOpen(false);
                      setMixpanelEmail("");
                      setMixpanelPassword("");
                      setMixpanelSourceToConnect(null);
                      setMixpanelAuthStep('login');
                    }}
                    disabled={isMixpanelLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleMixpanelLogin}
                    disabled={isMixpanelLoggingIn || !mixpanelEmail || !mixpanelPassword}
                  >
                    {isMixpanelLoggingIn ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Authorize Mixpanel Access</DialogTitle>
                  <DialogDescription>
                    This app will be able to:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Track user events</strong> - Record and track user interactions and events</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Analyze funnels & retention</strong> - Access funnel analysis and user retention metrics</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>View engagement metrics</strong> - Read engagement data and analytics reports</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Account:</p>
                    <p>{mixpanelEmail}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleMixpanelDeny}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleMixpanelApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Allow Access
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
