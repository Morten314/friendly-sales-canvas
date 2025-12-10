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
  Youtube
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const MissionControl = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const [completeness, setCompleteness] = useState(65);
  const [isSaving, setIsSaving] = useState(false);
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
          }).filter(value => value !== "").length;
          const totalFields = 8;
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

  const handleUpload = (type: string) => {
    toast({
      title: `Uploading ${type}`,
      description: `Processing your ${type} files...`,
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1 md:gap-0">
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
            <TabsTrigger value="uploads" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4">
              <Upload className="h-3 w-3 md:h-4 md:w-4" />
              Uploads
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
              <div>
                <h2 className="text-lg font-semibold mb-4">Integration Sources</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: "Salesforce", icon: Database, status: "connected", lastSync: "2 hours ago" },
                    { name: "HubSpot", icon: BarChart3, status: "not-connected" },
                    { name: "LinkedIn Sales Navigator", icon: Linkedin, status: "connected", lastSync: "1 day ago" },
                    { name: "Website Analytics", icon: Globe, status: "error" },
                    { name: "LinkedIn Company", icon: Linkedin, status: "not-connected" },
                    { name: "Twitter/X", icon: Twitter, status: "not-connected" },
                  ].map((source) => (
                    <Card key={source.name} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <source.icon className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">{source.name}</span>
                          </div>
                          {source.status === "connected" && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                          {source.status === "error" && (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        
                        {source.status === "connected" && (
                          <p className="text-xs text-muted-foreground mb-3">
                            Last synced: {source.lastSync}
                          </p>
                        )}
                        
                        {source.status === "error" && (
                          <p className="text-xs text-red-600 mb-3">
                            Connection failed - Retry needed
                          </p>
                        )}
                        
                        <Button
                          size="sm"
                          variant={source.status === "connected" ? "outline" : "default"}
                          className="w-full"
                          onClick={() => handleConnect(source.name)}
                        >
                          {source.status === "connected" ? "Reconnect" : 
                           source.status === "error" ? "Retry" : "Connect"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Competitor Analysis</h3>
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <Label htmlFor="competitor-urls">Competitor URLs (up to 3)</Label>
                    <div className="space-y-2">
                      <Input placeholder="https://competitor1.com" />
                      <Input placeholder="https://competitor2.com" />
                      <Input placeholder="https://competitor3.com" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Uploads Tab */}
          <TabsContent value="uploads">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: "Call Transcripts", icon: MessageSquare, status: "uploaded", lastUpdate: "Yesterday" },
                { name: "Meeting Notes", icon: FileText, status: "processing" },
                { name: "Product Documentation", icon: FileText, status: "empty" },
                { name: "Case Studies", icon: Users, status: "uploaded", lastUpdate: "3 days ago" },
                { name: "Support Tickets", icon: MessageSquare, status: "empty" },
                { name: "Sales Presentations", icon: BarChart3, status: "uploaded", lastUpdate: "1 week ago" },
              ].map((upload) => (
                <Card key={upload.name} className="relative">
                  <CardContent className="p-6 text-center">
                    <div className="mb-4">
                      <upload.icon className="h-8 w-8 mx-auto text-muted-foreground" />
                    </div>
                    <h3 className="font-medium mb-2">{upload.name}</h3>
                    
                    {upload.status === "uploaded" && (
                      <div className="space-y-2">
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Uploaded
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          Last Updated: {upload.lastUpdate}
                        </p>
                      </div>
                    )}
                    
                    {upload.status === "processing" && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Processing
                      </Badge>
                    )}
                    
                    {upload.status === "empty" && (
                      <div className="space-y-3">
                        <div className="border-2 border-dashed border-muted rounded-lg p-4">
                          <UploadIcon className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                          <p className="text-xs text-muted-foreground">
                            Drag & drop files here
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full"
                          onClick={() => handleUpload(upload.name)}
                        >
                          Upload Files
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
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
