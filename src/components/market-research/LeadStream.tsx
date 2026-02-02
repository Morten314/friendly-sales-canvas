import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, Users, X, Check, Edit, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { buildApiUrl } from "@/lib/api";
import jwtManager from "@/lib/jwt";

interface Lead {
  lead_id?: string;
  id?: string;
  fullName?: string;
  email?: string;
  mobile?: string;
  companyName?: string;
  companyWebsite?: string;
  linkedInProfile?: string;
  actions?: string;
  company?: any;
  contact?: any;
  techStack?: any;
  [key: string]: any;
}

interface LeadStreamProps {
  selectedIndustry?: string;
  selectedSize?: string;
  selectedRegion?: string;
  onFiltersChange?: (filters: { selectedIndustry: string; selectedSize: string; selectedRegion: string }) => void;
}

const LeadStream: React.FC<LeadStreamProps> = ({
  selectedIndustry,
  selectedSize,
  selectedRegion,
  onFiltersChange,
}) => {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { selectedTenant } = useTenant();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual form state (for editing only)
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [linkedInProfile, setLinkedInProfile] = useState("");
  const [actions, setActions] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);

  // Get user_id and org_id
  const userId = currentUser?.uid || "";
  const orgId = selectedTenant?.id || userId || "";

  // API Functions
  const fetchLeads = async () => {
    if (!userId || !orgId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const authHeader = await jwtManager.getAuthHeader();
      const url = buildApiUrl(`leads?user_id=${userId}&org_id=${orgId}`);
      
      console.log("🚀 LeadStream - Fetching leads:", {
        url,
        userId,
        orgId,
        hasAuth: !!authHeader,
      });

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader && { Authorization: authHeader }),
        },
      });

      console.log("📨 LeadStream - Fetch response:", {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ LeadStream - Fetch error:", errorText);
        throw new Error(`Failed to fetch leads: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ LeadStream - Fetched data:", data);
      // Handle both array and object with leads property
      const leadsArray = Array.isArray(data) ? data : (data.leads || []);
      setLeads(leadsArray);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast({
        title: "Failed to fetch leads",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addLead = async (leadData: Record<string, any>) => {
    if (!userId || !orgId) {
      throw new Error("User ID and Org ID are required");
    }

    const authHeader = await jwtManager.getAuthHeader();
    const url = buildApiUrl("leads");
    
    const payload = {
      user_id: userId,
      org_id: orgId,
      data: leadData,
    };

    console.log("🚀 LeadStream - Adding lead:", {
      url,
      payload,
      hasAuth: !!authHeader,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader && { Authorization: authHeader }),
      },
      body: JSON.stringify(payload),
    });

    console.log("📨 LeadStream - Response:", {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ LeadStream - Error response:", errorText);
      throw new Error(`Failed to add lead: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  };

  const updateLead = async (leadId: string, leadData: Record<string, any>) => {
    if (!userId || !orgId) {
      throw new Error("User ID and Org ID are required");
    }

    const authHeader = await jwtManager.getAuthHeader();
    const url = buildApiUrl(`leads/${leadId}`);
    
    const payload = {
      user_id: userId,
      org_id: orgId,
      data: leadData,
    };

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader && { Authorization: authHeader }),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update lead: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  };

  const deleteLead = async (leadId: string) => {
    if (!userId || !orgId) {
      throw new Error("User ID and Org ID are required");
    }

    const authHeader = await jwtManager.getAuthHeader();
    const url = buildApiUrl(`leads/${leadId}?user_id=${userId}&org_id=${orgId}`);
    
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader && { Authorization: authHeader }),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete lead: ${response.status} - ${errorText}`);
    }

    return true;
  };

  const uploadCsvBatch = async (file: File) => {
    if (!userId || !orgId) {
      throw new Error("User ID and Org ID are required");
    }

    const authHeader = await jwtManager.getAuthHeader();
    const url = buildApiUrl("leads/batch-upload");
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", userId);
    formData.append("org_id", orgId);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...(authHeader && { Authorization: authHeader }),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload CSV: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  };

  // Fetch leads on mount
  useEffect(() => {
    if (userId && orgId) {
      fetchLeads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, orgId]);

  const handleFileSelect = (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUploadCsv = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadCsvBatch(selectedFile);
      
      toast({
        title: "CSV uploaded successfully",
        description: `Created ${result.created_count || 0} leads. ${result.error_count || 0} errors.`,
      });
      
      // Reset state
      setSelectedFile(null);
      setShowCsvUpload(false);
      
      // Refresh leads list
      await fetchLeads();
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload CSV file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelEditForm = () => {
    setShowEditForm(false);
    setEditingLeadId(null);
    // Reset form fields
    setFullName("");
    setEmail("");
    setMobile("");
    setCompanyName("");
    setCompanyWebsite("");
    setLinkedInProfile("");
    setActions("");
  };

  const handleSaveLead = async () => {
    // Basic validation
    if (!fullName.trim() || !email.trim()) {
      toast({
        title: "Required fields missing",
        description: "Please fill in at least Full Name and Email.",
        variant: "destructive",
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare lead data object
      const leadData: Record<string, any> = {};
      if (fullName.trim()) leadData.fullName = fullName.trim();
      if (email.trim()) leadData.email = email.trim();
      if (mobile.trim()) leadData.mobile = mobile.trim();
      if (companyName.trim()) leadData.companyName = companyName.trim();
      if (companyWebsite.trim()) leadData.companyWebsite = companyWebsite.trim();
      if (linkedInProfile.trim()) leadData.linkedInProfile = linkedInProfile.trim();
      if (actions.trim()) leadData.actions = actions.trim();

      if (editingLeadId) {
        // Update existing lead
        await updateLead(editingLeadId, leadData);
        toast({
          title: "Lead updated",
          description: `${fullName} has been updated.`,
        });
        setEditingLeadId(null);
      } else {
        // This should not happen since we removed manual add, but keep for safety
        toast({
          title: "Error",
          description: "Please use CSV upload to add new leads.",
          variant: "destructive",
        });
        return;
      }

      // Refresh leads list
      await fetchLeads();

      // Reset form and close
      handleCancelEditForm();
    } catch (error) {
      toast({
        title: editingLeadId ? "Update failed" : "Add failed",
        description: error instanceof Error ? error.message : "An error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditLead = (lead: Lead) => {
    const leadId = lead.lead_id || lead.id || "";
    setEditingLeadId(leadId);
    
    // Populate form with lead data
    setFullName(lead.fullName || lead.contact?.name || "");
    setEmail(lead.email || lead.contact?.email || "");
    setMobile(lead.mobile || lead.contact?.mobile || "");
    setCompanyName(lead.companyName || lead.company?.name || "");
    setCompanyWebsite(lead.companyWebsite || lead.company?.website || "");
    setLinkedInProfile(lead.linkedInProfile || lead.contact?.linkedIn || "");
    setActions(lead.actions || "");
    
    setShowEditForm(true);
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) {
      return;
    }

    try {
      await deleteLead(leadId);
      toast({
        title: "Lead deleted",
        description: "The lead has been removed.",
      });
      
      // Refresh leads list
      await fetchLeads();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete lead. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const hasLeads = leads.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      {!isLoading && (hasLeads || showEditForm || showCsvUpload) && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Your Lead Stream</h2>
            <p className="text-sm text-muted-foreground">
              Manage and track your leads
            </p>
          </div>
          <Button 
            className="gap-2"
            onClick={() => setShowCsvUpload(true)}
          >
            <Upload className="h-4 w-4" />
            Upload CSV
          </Button>
        </div>
      )}

      {/* Edit Form Section */}
      {showEditForm && (
        <div className="bg-white border border-black rounded-lg p-4 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold text-foreground">
              Edit Lead
            </h4>
            <Button variant="ghost" size="sm" onClick={handleCancelEditForm}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Full Name *</Label>
              <Input
                id="full-name"
                placeholder="Enter full name..."
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Mobile */}
            <div className="space-y-1.5">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                type="tel"
                placeholder="Enter mobile number..."
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Company Name */}
            <div className="space-y-1.5">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                placeholder="Enter company name..."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Company Website */}
            <div className="space-y-1.5">
              <Label htmlFor="company-website">Company Website</Label>
              <Input
                id="company-website"
                type="url"
                placeholder="https://example.com"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* LinkedIn Profile */}
            <div className="space-y-1.5">
              <Label htmlFor="linkedin-profile">LinkedIn Profile</Label>
              <Input
                id="linkedin-profile"
                type="url"
                placeholder="https://linkedin.com/in/..."
                value={linkedInProfile}
                onChange={(e) => setLinkedInProfile(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Actions - Full Width */}
          <div className="space-y-1.5">
            <Label htmlFor="actions">Actions</Label>
            <Input
              id="actions"
              placeholder="Enter actions or notes..."
              value={actions}
              onChange={(e) => setActions(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleCancelEditForm}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveLead} className="gap-1">
              <Check className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* CSV Upload Section */}
      {showCsvUpload && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Upload CSV File</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowCsvUpload(false);
                    setSelectedFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Drag and Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload
                    className={`h-12 w-12 mx-auto mb-4 ${
                      isDragging ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <p className="text-sm font-medium mb-2">
                    {selectedFile
                      ? selectedFile.name
                      : "Drag and drop your CSV file here, or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported format: CSV files only
                  </p>
                </label>
              </div>

              {/* Selected File Display */}
              {selectedFile && (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Upload Button */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCsvUpload(false);
                    setSelectedFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUploadCsv}
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? "Uploading..." : "Upload CSV"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !hasLeads && !showCsvUpload && !showEditForm && (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-lg bg-muted/20">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No leads added yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            Upload a CSV file to add leads and start tracking your pipeline.
          </p>
          <Button 
            className="gap-2"
            onClick={() => setShowCsvUpload(true)}
          >
            <Upload className="h-4 w-4" />
            Upload CSV
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading leads...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leads Display (when leads exist) */}
      {!isLoading && hasLeads && !showCsvUpload && !showEditForm && (
        <Card>
          <CardContent className="pt-6">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>LinkedIn</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead className="text-right">Operations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => {
                    const leadId = lead.lead_id || lead.id || "";
                    const displayName = lead.fullName || lead.contact?.name || "—";
                    const displayEmail = lead.email || lead.contact?.email || "—";
                    const displayMobile = lead.mobile || lead.contact?.mobile || "—";
                    const displayCompany = lead.companyName || lead.company?.name || "—";
                    const displayWebsite = lead.companyWebsite || lead.company?.website || "—";
                    const displayLinkedIn = lead.linkedInProfile || lead.contact?.linkedIn || "—";
                    const displayActions = lead.actions || "—";
                    
                    return (
                      <TableRow key={leadId}>
                        <TableCell className="font-medium">{displayName}</TableCell>
                        <TableCell>{displayEmail}</TableCell>
                        <TableCell>{displayMobile}</TableCell>
                        <TableCell>{displayCompany}</TableCell>
                        <TableCell>
                          {displayWebsite !== "—" ? (
                            <a href={displayWebsite} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {displayWebsite}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {displayLinkedIn !== "—" ? (
                            <a href={displayLinkedIn} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {displayLinkedIn}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{displayActions}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditLead(lead)}
                              className="h-8 w-8"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteLead(leadId)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LeadStream;

