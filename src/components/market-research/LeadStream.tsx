
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
import { Upload, Users, X, Check, Edit, Trash2, Loader2, FileText, RefreshCw } from "lucide-react";
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

const LeadStream = ({
  selectedIndustry,
  selectedSize,
  selectedRegion,
  onFiltersChange,
}: LeadStreamProps) => {
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
  // For leads API, org_id should match user_id (backend requirement)
  const userId = currentUser?.uid || "";
  const orgId = userId || ""; // Use user_id as org_id to ensure they match

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
        userIdType: typeof userId,
        orgIdType: typeof orgId,
        userIdLength: userId?.length,
        orgIdLength: orgId?.length,
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
      console.log("✅ LeadStream - Data type:", Array.isArray(data) ? "Array" : typeof data);
      console.log("✅ LeadStream - Data keys:", Array.isArray(data) ? `Array length: ${data.length}` : Object.keys(data));
      
      // Handle both array and object with leads property
      let leadsArray: any[] = [];
      if (Array.isArray(data)) {
        leadsArray = data;
      } else if (data && typeof data === 'object') {
        // Try multiple possible response structures
        leadsArray = data.leads || data.data || data.results || data.items || [];
        // If still empty, check if data itself contains lead-like properties
        if (leadsArray.length === 0 && Object.keys(data).length > 0) {
          // Check if the object itself might be a single lead or contains nested data
          console.log("⚠️ LeadStream - Response is object but no leads array found. Object keys:", Object.keys(data));
          console.log("⚠️ LeadStream - Full response object:", JSON.stringify(data, null, 2));
        }
      }
      
      console.log("✅ LeadStream - Processed leads array length:", leadsArray.length);
      if (leadsArray.length > 0) {
        console.log("✅ LeadStream - First lead sample:", leadsArray[0]);
        console.log("✅ LeadStream - First lead keys:", Object.keys(leadsArray[0]));
        console.log("✅ LeadStream - First lead full object:", JSON.stringify(leadsArray[0], null, 2));
      }
      
      // Transform backend data structure to match frontend expectations
      // Backend returns: {lead_id, company, contact: {name, email, ...}, ...}
      // Frontend expects: {lead_id, fullName, email, mobile, companyName, companyWebsite, linkedInProfile, actions, ...}
      const transformedLeads = leadsArray.map((lead: any) => {
        // Helper function to clean and get value
        const getValue = (...values: any[]): string => {
          for (const val of values) {
            if (val !== null && val !== undefined && val !== "") {
              const trimmed = String(val).trim();
              if (trimmed !== "") return trimmed;
            }
          }
          return "";
        };
        
        // Map backend structure to frontend structure
        return {
          ...lead,
          // Map contact.name to fullName (handle whitespace)
          fullName: getValue(lead.fullName, lead.full_name, lead.contact?.name, lead.name),
          // Map contact.email to email (top level)
          email: getValue(lead.email, lead.contact?.email),
          // Map mobile/phone fields
          mobile: getValue(lead.mobile, lead.phone, lead.contact?.mobile, lead.contact?.phone),
          // Map company fields
          companyName: getValue(lead.companyName, lead.company_name, lead.company),
          companyWebsite: getValue(lead.companyWebsite, lead.company_website, lead.website, lead.company?.website),
          // Map LinkedIn fields
          linkedInProfile: getValue(lead.linkedInProfile, lead.linkedin_profile, lead.linkedIn, lead.contact?.linkedIn, lead.contact?.linkedin),
          // Map actions/notes
          actions: getValue(lead.actions, lead.notes, lead.action),
          // Preserve contact object for backward compatibility
          contact: lead.contact || {},
          // Preserve company object for backward compatibility
          company: lead.company || {},
        };
      });
      
      console.log("✅ LeadStream - Transformed leads count:", transformedLeads.length);
      if (transformedLeads.length > 0) {
        console.log("✅ LeadStream - First transformed lead:", transformedLeads[0]);
      }
      
      setLeads(transformedLeads);
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

    if (!leadId) {
      throw new Error("Lead ID is required");
    }

    const authHeader = await jwtManager.getAuthHeader();
    const url = buildApiUrl(`leads/${leadId}`);
    
    // API spec: Request body should have user_id, org_id, and data (flexible key-value updates)
    const payload = {
      user_id: userId,
      org_id: orgId,
      data: leadData,
    };

    console.log("🚀 LeadStream - Updating lead:", {
      url,
      leadId,
      userId,
      orgId,
      payload,
      hasAuth: !!authHeader,
    });

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader && { Authorization: authHeader }),
      },
      body: JSON.stringify(payload),
    });

    console.log("📨 LeadStream - Update response:", {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ LeadStream - Update error:", {
        status: response.status,
        errorText,
        leadId,
      });
      throw new Error(`Failed to update lead: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ LeadStream - Update success:", result);
    return result;
  };

  const deleteLead = async (leadId: string) => {
    if (!userId || !orgId) {
      throw new Error("User ID and Org ID are required");
    }

    if (!leadId) {
      throw new Error("Lead ID is required");
    }

    const authHeader = await jwtManager.getAuthHeader();
    // API spec: DELETE /leads/{lead_id} with user_id and org_id as query parameters
    const url = buildApiUrl(`leads/${leadId}?user_id=${userId}&org_id=${orgId}`);
    
    console.log("🚀 LeadStream - Deleting lead:", {
      url,
      leadId,
      userId,
      orgId,
      hasAuth: !!authHeader,
    });

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader && { Authorization: authHeader }),
      },
    });

    console.log("📨 LeadStream - Delete response:", {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ LeadStream - Delete error:", {
        status: response.status,
        errorText,
        leadId,
      });
      throw new Error(`Failed to delete lead: ${response.status} - ${errorText}`);
    }

    const result = await response.json().catch(() => ({})); // Some APIs return empty body on success
    console.log("✅ LeadStream - Delete success:", result);
    return result;
  };

  // Detect CSV delimiter (comma, semicolon, or tab)
  const detectDelimiter = (text: string): string => {
    const firstLine = text.split('\n')[0];
    const delimiters = [',', ';', '\t'];
    let maxCount = 0;
    let detectedDelimiter = ',';
    
    for (const delimiter of delimiters) {
      const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        detectedDelimiter = delimiter;
      }
    }
    
    return detectedDelimiter;
  };

  // Normalize a single column name to match backend expectations
  const normalizeSingleColumnName = (columnName: string): string => {
    const trimmed = columnName.trim();
    
    // Map common column name variations to backend-expected names
    // Backend expects camelCase (e.g., "companyName" not "company name")
    const columnMapping: Record<string, string> = {
      'fullname': 'fullName',
      'full_name': 'fullName',
      'FullName': 'fullName',
      'Full Name': 'fullName',
      'full name': 'fullName',
      'name': 'fullName',
      'Name': 'fullName',
      
      'email': 'email',
      'Email': 'email',
      
      'mobile': 'mobile',
      'Mobile': 'mobile',
      'phone': 'mobile',
      'Phone': 'mobile',
      'phone_number': 'mobile',
      'Phone Number': 'mobile',
      'phone number': 'mobile',
      
      'companyname': 'companyName',
      'company_name': 'companyName',
      'CompanyName': 'companyName',
      'Company Name': 'companyName',
      'company name': 'companyName',
      'company': 'companyName',
      'Company': 'companyName',
      
      'companywebsite': 'companyWebsite',
      'company_website': 'companyWebsite',
      'CompanyWebsite': 'companyWebsite',
      'Company Website': 'companyWebsite',
      'company website': 'companyWebsite',
      'website': 'companyWebsite',
      'Website': 'companyWebsite',
      
      'linkedinprofile': 'linkedInProfile',
      'linkedin_profile': 'linkedInProfile',
      'LinkedInProfile': 'linkedInProfile',
      'LinkedIn Profile': 'linkedInProfile',
      'linkedin profile': 'linkedInProfile',
      'linkedin': 'linkedInProfile',
      'LinkedIn': 'linkedInProfile',
      
      'actions': 'actions',
      'Actions': 'actions',
      'notes': 'actions',
      'Notes': 'actions',
    };

    const lowerKey = trimmed.toLowerCase().replace(/\s+/g, ''); // Remove spaces and lowercase
    const lowerWithSpaces = trimmed.toLowerCase(); // Lowercase with spaces
    
    // Try multiple matching strategies
    if (columnMapping[trimmed]) {
      return columnMapping[trimmed];
    } else if (columnMapping[lowerKey]) {
      return columnMapping[lowerKey];
    } else if (columnMapping[lowerWithSpaces]) {
      return columnMapping[lowerWithSpaces];
    } else if (columnMapping[trimmed.toLowerCase()]) {
      return columnMapping[trimmed.toLowerCase()];
    }
    
    // Return original if no mapping found (backend might accept it)
    return trimmed;
  };

  // Normalize CSV column names to match backend expectations
  const normalizeColumnNames = (headerLine: string): string => {
    console.log("🔍 LeadStream - Normalizing column names from:", headerLine);
    
    // Map common column name variations to backend-expected names
    // Backend expects camelCase (e.g., "companyName" not "company name")
    const columnMapping: Record<string, string> = {
      'fullname': 'fullName',
      'full_name': 'fullName',
      'FullName': 'fullName',
      'Full Name': 'fullName',
      'full name': 'fullName',
      'name': 'fullName',
      'Name': 'fullName',
      
      'email': 'email',
      'Email': 'email',
      
      'mobile': 'mobile',
      'Mobile': 'mobile',
      'phone': 'mobile',
      'Phone': 'mobile',
      'phone_number': 'mobile',
      'Phone Number': 'mobile',
      'phone number': 'mobile',
      
      'companyname': 'companyName',
      'company_name': 'companyName',
      'CompanyName': 'companyName',
      'Company Name': 'companyName',
      'company name': 'companyName',
      'company': 'companyName',
      'Company': 'companyName',
      
      'companywebsite': 'companyWebsite',
      'company_website': 'companyWebsite',
      'CompanyWebsite': 'companyWebsite',
      'Company Website': 'companyWebsite',
      'company website': 'companyWebsite',
      'website': 'companyWebsite',
      'Website': 'companyWebsite',
      
      'linkedinprofile': 'linkedInProfile',
      'linkedin_profile': 'linkedInProfile',
      'LinkedInProfile': 'linkedInProfile',
      'LinkedIn Profile': 'linkedInProfile',
      'linkedin profile': 'linkedInProfile',
      'linkedin': 'linkedInProfile',
      'LinkedIn': 'linkedInProfile',
      
      'actions': 'actions',
      'Actions': 'actions',
      'notes': 'actions',
      'Notes': 'actions',
    };

    // Parse header line and normalize column names
    // Handle CSV parsing with proper quote handling
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < headerLine.length; i++) {
      const char = headerLine[i];
      const nextChar = headerLine[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField); // Add last field
    
    const normalizedFields = fields.map(field => {
      const trimmed = field.trim().replace(/^"|"$/g, ''); // Remove quotes
      const lowerKey = trimmed.toLowerCase().replace(/\s+/g, ''); // Remove spaces and lowercase
      const lowerWithSpaces = trimmed.toLowerCase(); // Lowercase with spaces
      
      // Try multiple matching strategies
      if (columnMapping[trimmed]) {
        console.log(`  ✓ Mapping "${trimmed}" → "${columnMapping[trimmed]}"`);
        return columnMapping[trimmed];
      } else if (columnMapping[lowerKey]) {
        console.log(`  ✓ Mapping "${trimmed}" (lowercase no spaces) → "${columnMapping[lowerKey]}"`);
        return columnMapping[lowerKey];
      } else if (columnMapping[lowerWithSpaces]) {
        console.log(`  ✓ Mapping "${trimmed}" (lowercase) → "${columnMapping[lowerWithSpaces]}"`);
        return columnMapping[lowerWithSpaces];
      } else if (columnMapping[trimmed.toLowerCase()]) {
        console.log(`  ✓ Mapping "${trimmed}" (toLowerCase) → "${columnMapping[trimmed.toLowerCase()]}"`);
        return columnMapping[trimmed.toLowerCase()];
      }
      
      // Return original if no mapping found (backend might accept it)
      console.log(`  ⚠ No mapping found for "${trimmed}", keeping original`);
      return trimmed;
    });
    
    const result = normalizedFields.join(',');
    console.log("✅ LeadStream - Normalized column names to:", result);
    return result;
  };

  // Normalize CSV: convert to comma-delimited, ensure proper formatting
  const normalizeCsv = (text: string): string => {
    // Normalize line endings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Detect delimiter first (before any modifications)
    const delimiter = detectDelimiter(text);
    
    // Split into lines
    let lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return text;
    
    // If not comma, convert to comma
    if (delimiter !== ',') {
      // Simple conversion - split by detected delimiter and join with comma
      // Handle quoted fields properly
      const lines = text.split('\n');
      const normalizedLines = lines.map(line => {
        if (line.trim() === '') return line;
        
        // Check if line has quotes (indicating proper CSV format)
        if (line.includes('"')) {
          // Parse quoted CSV properly
          const fields: string[] = [];
          let currentField = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                // Escaped quote
                currentField += '"';
                i++; // Skip next quote
              } else {
                // Toggle quote state
                inQuotes = !inQuotes;
              }
            } else if ((char === delimiter || char === ',') && !inQuotes) {
              // Field separator
              fields.push(currentField);
              currentField = '';
            } else {
              currentField += char;
            }
          }
          fields.push(currentField); // Add last field
          
          // Join with commas, quote fields that contain commas or quotes
          return fields.map(field => {
            if (field.includes(',') || field.includes('"') || field.includes('\n')) {
              return `"${field.replace(/"/g, '""')}"`;
            }
            return field;
          }).join(',');
        } else {
          // Simple split and join
          return line.split(delimiter).join(',');
        }
      });
      
      text = normalizedLines.join('\n');
    }
    
    // Normalize header column names (after delimiter conversion)
    const finalLines = text.split('\n').filter(line => line.trim().length > 0);
    if (finalLines.length > 0) {
      finalLines[0] = normalizeColumnNames(finalLines[0]);
      text = finalLines.join('\n');
    }
    
    return text;
  };

  const uploadCsvBatch = async (file: File) => {
    if (!userId || !orgId) {
      throw new Error("User ID and Org ID are required");
    }

    // Convert file to UTF-8 encoding to avoid encoding errors
    // This handles files encoded in Windows-1252, ISO-8859-1, or other encodings
    const convertToUtf8 = (file: File): Promise<File> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            
            // Try different encodings in order of likelihood
            // Windows-1252 is common for Excel exports (byte 0x87 suggests this)
            const encodings = ['windows-1252', 'iso-8859-1', 'utf-8'];
            let text = '';
            let decoded = false;
            
            for (const encoding of encodings) {
              try {
                const decoder = new TextDecoder(encoding, { fatal: false });
                text = decoder.decode(arrayBuffer);
                decoded = true;
                break;
              } catch {
                continue;
              }
            }
            
            if (!decoded || !text) {
              // Last resort: try UTF-8 with error handling
              text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
            }
            
            // Normalize CSV format (convert delimiters, ensure proper formatting)
            // This handles WPS Office/Excel exports that may use semicolons or tabs
            text = normalizeCsv(text);
            
            // Create a new UTF-8 encoded file with normalized CSV
            const utf8Blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
            const utf8File = new File([utf8Blob], file.name, {
              type: 'text/csv',
              lastModified: file.lastModified,
            });
            
            resolve(utf8File);
          } catch (error) {
            reject(new Error(`Failed to convert file encoding: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
      });
    };

    let utf8File: File;
    try {
      utf8File = await convertToUtf8(file);
    } catch (error) {
      throw new Error(`Failed to process CSV file encoding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const authHeader = await jwtManager.getAuthHeader();
    const url = buildApiUrl("leads/batch-upload");
    
    // Backend expects FormData with file, user_id, and org_id
    // The CSV file has already been normalized (column names, encoding, delimiters)
    const formData = new FormData();
    formData.append("file", utf8File);
    formData.append("user_id", userId);
    formData.append("org_id", orgId);

    console.log("🚀 LeadStream - Batch Upload Starting:", {
      url,
      userId,
      orgId,
      fileName: utf8File.name,
      fileSize: utf8File.size,
      hasAuth: !!authHeader,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...(authHeader && { Authorization: authHeader }),
      },
      body: formData,
    });

    console.log("📨 LeadStream - Batch Upload Response:", {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ LeadStream - Batch Upload Error:", {
        status: response.status,
        errorText,
      });
      throw new Error(`Failed to upload CSV: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ LeadStream - Batch Upload Success:", {
      result,
      created_count: result.created_count,
      error_count: result.error_count,
      errors: result.errors,
    });
    
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

  // Basic CSV validation - lenient since backend is flexible
  const validateCsvFormat = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          
          // Just check if file is not empty
          if (!text || text.trim().length === 0) {
            resolve({ valid: false, error: "CSV file is empty" });
            return;
          }
          
          // Basic check: file should have at least one line
          const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
          if (lines.length === 0) {
            resolve({ valid: false, error: "CSV file appears to be empty" });
            return;
          }
          
          // Since backend is flexible, we just do basic validation
          // The normalization will happen during upload
          resolve({ valid: true });
        } catch (error) {
          resolve({ 
            valid: false, 
            error: `Failed to read CSV file: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
      };
      
      reader.onerror = () => {
        resolve({ valid: false, error: "Failed to read file" });
      };
      
      reader.readAsText(file, 'UTF-8');
    });
  };

  // Parse backend error message to provide helpful feedback
  const parseErrorMessage = (errorMessage: string): string => {
    // Check for CSV parsing errors
    if (errorMessage.includes('Expected') && errorMessage.includes('fields')) {
      const match = errorMessage.match(/Expected (\d+) fields in line (\d+), saw (\d+)/);
      if (match) {
        const [, expected, lineNum, actual] = match;
        return `CSV format error on line ${lineNum}: Expected ${expected} column(s), but found ${actual}. Please ensure all rows have the same number of columns and that fields containing commas are enclosed in quotes.`;
      }
    }
    
    // Check for tokenizing errors
    if (errorMessage.includes('tokenizing data')) {
      return `CSV parsing error: ${errorMessage}. Please check that your CSV file uses commas as delimiters and that fields with commas or special characters are enclosed in double quotes.`;
    }
    
    // Check for encoding errors
    if (errorMessage.includes('codec') || errorMessage.includes('decode')) {
      return `File encoding error: ${errorMessage}. The file has been converted to UTF-8, but please try saving your CSV file as UTF-8 format before uploading.`;
    }
    
    // Return original message if no specific pattern matches
    return errorMessage;
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

    // Validate CSV format before uploading
    setIsUploading(true);
    try {
      const validation = await validateCsvFormat(selectedFile);
      if (!validation.valid) {
        toast({
          title: "CSV validation failed",
          description: validation.error || "Invalid CSV format",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }
    } catch (validationError) {
      toast({
        title: "Validation error",
        description: "Failed to validate CSV file. Please check the file format.",
        variant: "destructive",
      });
      setIsUploading(false);
      return;
    }

    try {
      const result = await uploadCsvBatch(selectedFile);
      
      const createdCount = result.created_count || 0;
      const errorCount = result.error_count || 0;
      const errors = result.errors || [];
      
      console.log("📊 LeadStream - Upload Result Summary:", {
        created_count: createdCount,
        error_count: errorCount,
        errors: errors,
        fullResult: result,
      });
      
      // Show detailed success/error message
      if (errorCount > 0 && errors.length > 0) {
        // Log full error details for debugging
        console.warn("⚠️ LeadStream - Upload Errors:", errors);
        errors.forEach((error: any, index: number) => {
          console.error(`❌ LeadStream - Error ${index + 1}:`, error);
          if (typeof error === 'string') {
            // Try to parse if it's a stringified object
            try {
              const parsed = JSON.parse(error);
              console.error(`   Parsed error:`, parsed);
            } catch {
              console.error(`   Error message:`, error);
            }
          }
        });
        
        toast({
          title: "CSV uploaded with some errors",
          description: `Created ${createdCount} leads. ${errorCount} errors occurred. Check console for details.`,
          variant: "default",
        });
      } else if (createdCount > 0) {
        toast({
          title: "CSV uploaded successfully",
          description: `Successfully created ${createdCount} lead(s).`,
        });
      } else {
        toast({
          title: "Upload completed",
          description: "No leads were created. Please check your CSV file format.",
          variant: "default",
        });
      }
      
      // Reset state
      setSelectedFile(null);
      setShowCsvUpload(false);
      
      // Always refresh leads list after upload, even if there were errors
      // Some leads might have been created despite errors
      console.log("🔄 LeadStream - Refreshing leads list after upload...");
      try {
        // Use a small delay to allow backend processing, then refresh
        await new Promise(resolve => setTimeout(resolve, 1500));
        await fetchLeads();
        console.log("✅ LeadStream - Leads list refreshed after upload");
      } catch (refreshError) {
        console.error("❌ LeadStream - Failed to refresh leads after upload:", refreshError);
        // Don't show error toast here as upload might have succeeded
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload CSV file. Please try again.";
      const parsedMessage = parseErrorMessage(errorMessage);
      
      toast({
        title: "Upload failed",
        description: parsedMessage,
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
      if (!editingLeadId) {
        toast({
          title: "Error",
          description: "Please use CSV upload to add new leads.",
          variant: "destructive",
        });
        return;
      }

      // Prepare lead data object with flexible key-value updates
      // API spec: data field accepts flexible key-value pairs
      const leadData: Record<string, any> = {};
      
      // Only include fields that have values (backend handles flexible updates)
      if (fullName.trim()) leadData.fullName = fullName.trim();
      if (email.trim()) leadData.email = email.trim();
      if (mobile.trim()) leadData.mobile = mobile.trim();
      if (companyName.trim()) leadData.companyName = companyName.trim();
      if (companyWebsite.trim()) leadData.companyWebsite = companyWebsite.trim();
      if (linkedInProfile.trim()) leadData.linkedInProfile = linkedInProfile.trim();
      if (actions.trim()) leadData.actions = actions.trim();

      console.log("💾 LeadStream - Saving lead update:", {
        leadId: editingLeadId,
        leadData,
      });

      // Update existing lead
      const result = await updateLead(editingLeadId, leadData);
      
      toast({
        title: "Lead updated",
        description: `${fullName} has been updated successfully.`,
      });
      
      setEditingLeadId(null);

      // Refresh leads list to show updated data
      await fetchLeads();

      // Reset form and close
      handleCancelEditForm();
    } catch (error) {
      console.error("❌ LeadStream - Save lead error:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "An error occurred while updating the lead. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditLead = (lead: Lead) => {
    // Extract lead ID - try multiple possible ID fields
    const leadId = lead.lead_id || lead.id || lead._id || "";
    
    if (!leadId) {
      toast({
        title: "Error",
        description: "Cannot edit lead: Lead ID is missing.",
        variant: "destructive",
      });
      console.error("❌ LeadStream - Cannot edit lead without ID:", lead);
      return;
    }

    console.log("✏️ LeadStream - Editing lead:", {
      leadId,
      lead,
    });

    setEditingLeadId(leadId);
    
    // Populate form with lead data (handle multiple property name variations)
    setFullName(lead.fullName || lead.full_name || lead.contact?.name || lead.name || "");
    setEmail(lead.email || lead.contact?.email || "");
    setMobile(lead.mobile || lead.phone || lead.contact?.mobile || lead.contact?.phone || "");
    setCompanyName(lead.companyName || lead.company_name || lead.company || lead.company?.name || "");
    setCompanyWebsite(lead.companyWebsite || lead.company_website || lead.website || lead.company?.website || "");
    setLinkedInProfile(lead.linkedInProfile || lead.linkedin_profile || lead.linkedIn || lead.contact?.linkedIn || lead.contact?.linkedin || "");
    setActions(lead.actions || lead.notes || lead.action || "");
    
    setShowEditForm(true);
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!leadId) {
      toast({
        title: "Error",
        description: "Lead ID is missing. Cannot delete lead.",
        variant: "destructive",
      });
      return;
    }

    // Confirm deletion
    if (!confirm("Are you sure you want to delete this lead? This action cannot be undone.")) {
      return;
    }

    try {
      console.log("🗑️ LeadStream - Deleting lead:", leadId);
      await deleteLead(leadId);
      
      toast({
        title: "Lead deleted",
        description: "The lead has been successfully removed.",
      });
      
      // Refresh leads list to reflect deletion
      await fetchLeads();
    } catch (error) {
      console.error("❌ LeadStream - Delete lead error:", error);
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
      {!isLoading && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Your Lead Stream</h2>
            <p className="text-sm text-muted-foreground">
              Manage and track your leads
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fetchLeads()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              className="gap-2"
              onClick={() => setShowCsvUpload(true)}
            >
              <Upload className="h-4 w-4" />
              Upload CSV
            </Button>
          </div>
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
                  <div className="mt-4 p-3 bg-muted/50 rounded-md text-left text-xs">
                    <p className="font-medium mb-1">CSV Format Requirements:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>All rows must have the same number of columns</li>
                      <li>Fields containing commas must be enclosed in double quotes</li>
                      <li>Use commas (,) as column separators (semicolons will be auto-converted)</li>
                      <li>Recommended columns: Full Name, Email, Mobile, Company Name, Company Website, LinkedIn Profile, Actions</li>
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <strong>Note:</strong> Files from WPS Office, Excel, or Google Sheets are automatically converted to the correct format.
                    </p>
                  </div>
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
                  {leads.map((lead, index) => {
                    const leadId = lead.lead_id || lead.id || lead._id || `lead-${index}`;
                    // Try multiple property name variations to handle different backend formats
                    const displayName = lead.fullName || lead.full_name || lead.name || lead.contact?.name || lead.contact?.fullName || "—";
                    const displayEmail = lead.email || lead.contact?.email || "—";
                    const displayMobile = lead.mobile || lead.phone || lead.contact?.mobile || lead.contact?.phone || "—";
                    const displayCompany = lead.companyName || lead.company_name || lead.company?.name || "—";
                    const displayWebsite = lead.companyWebsite || lead.company_website || lead.website || lead.company?.website || "—";
                    const displayLinkedIn = lead.linkedInProfile || lead.linkedin_profile || lead.linkedIn || lead.contact?.linkedIn || lead.contact?.linkedin || "—";
                    const displayActions = lead.actions || lead.notes || lead.action || "—";
                    
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