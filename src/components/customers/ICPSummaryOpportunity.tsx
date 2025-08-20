import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, TrendingUp, Clock, Target, DollarSign, User, Zap, Flame, Users, Swords, TrendingDown, Filter, Shield, Calendar, Brain, CheckCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";
import { apiFetchJson } from "@/lib/api";

interface SuggestedICP {
  id: string;
  industry: string;
  segment: string;
  companySize: string;
  decisionMakers: string[];
  regions: string[];
  keyAttributes: string[];
  growthIndicator?: string;
  // Extended properties for detailed analysis
  title?: string;
  blurb?: string;
  marketSize?: string;
  growth?: string;
  urgency?: string;
  timeToClose?: string;
  corePersonas?: number;
  topPainPoint?: string;
  buyingTriggers?: number;
  competitors?: number;
  winLossChange?: string;
  buyingSignals?: number;
  buyingTriggersArray?: Array<{
    trigger: string;
    description: string;
  }>;
  marketAnalysis?: {
    totalMarketSize: string;
    servicableMarket: string;
    targetableMarket: string;
    marketGrowth: string;
    segments: Array<{
      name: string;
      size: string;
      growth: string;
      share: string;
    }>;
    keyChallenges: string[];
    strategicRecommendations: string[];
    signalsToMonitor: string[];
  };
  competitiveData?: {
    mainCompetitors: string[];
    competitiveMap: Array<{
      competitor: string;
      segment: string;
      share: string;
      winsLosses: string;
      differentiators: string;
    }>;
    competitiveNews: Array<{
      headline: string;
      competitor: string;
      date: string;
      impact: string;
    }>;
    buyingSignalsData: Array<{
      signal: string;
      strength: string;
      description: string;
      source: string;
      recency: string;
      region: string;
      type: string;
    }>;
  };
  _metadata?: {
    dataSource: 'api' | 'fallback';
    fetchedAt?: string;
    generatedAt?: string;
    originalICPId?: string;
    fallbackReason?: string;
    transformationIndex?: number;
  };
}

interface ICPSummaryOpportunityProps {
  selectedICP: SuggestedICP | null;
}

export const ICPSummaryOpportunity = ({ selectedICP }: ICPSummaryOpportunityProps) => {
  const [isMarketExpanded, setIsMarketExpanded] = useState(false);
  const [isBuyerMapExpanded, setIsBuyerMapExpanded] = useState(false);
  const [isCompetitiveExpanded, setIsCompetitiveExpanded] = useState(false);
  const [isRegulatoryExpanded, setIsRegulatoryExpanded] = useState(false);
  const [signalRegionFilter, setSignalRegionFilter] = useState("all");
  const [signalTypeFilter, setSignalTypeFilter] = useState("all");
  const [reportGenerating, setReportGenerating] = useState(false);
  const [dataSource, setDataSource] = useState<'api' | 'fallback' | 'unknown'>('api');
  const [componentError, setComponentError] = useState<string | null>(null);
  
  // New state for API-generated report data
  const [apiReportData, setApiReportData] = useState<any>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  console.log("=== ICPSummaryOpportunity RENDER ===");
  console.log("selectedICP:", selectedICP);
  console.log("🔍 DATA SOURCE:", dataSource);
  console.log("🔍 API REPORT DATA:", apiReportData);
  console.log("🔍 IS LOADING REPORT:", isLoadingReport);
  console.log("🔍 REPORT ERROR:", reportError);

  // Early return if no ICP is selected
  if (!selectedICP) {
    console.log("No selectedICP, showing placeholder");
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Select an ICP card above</p>
          <p className="text-sm">to view detailed market analysis and insights</p>
        </div>
      </div>
    );
  }

  // Error boundary for component errors
  if (componentError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold mb-2">Component Error</h3>
        <p className="text-red-600 text-sm mb-4">{componentError}</p>
        <div className="space-y-2">
          <button 
            onClick={() => setComponentError(null)}
            className="px-4 py-2 bg-red-100 text-red-800 rounded text-sm mr-2"
          >
            Try Again
          </button>
          <div className="text-xs text-red-500 mt-2">
            Selected ICP: {selectedICP?.id || 'undefined'} | 
            Industry: {selectedICP?.industry || 'undefined'} | 
            Data Source: {dataSource}
          </div>
        </div>
      </div>
    );
  }

  try {
    // New function to generate report via API
    const generateReportViaAPI = async (componentName: string) => {
      try {
        setIsLoadingReport(true);
        setReportError(null);
        
        // Clear browser cache for this specific request
        if ('caches' in window) {
          try {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames.map(cacheName => caches.delete(cacheName))
            );
            console.log('🧹 Browser cache cleared');
          } catch (cacheError) {
            console.warn('⚠️ Could not clear browser cache:', cacheError);
          }
        }
        
        console.log("=== GENERATING REPORT VIA API ===");
        console.log("🔄 API Call Timestamp:", new Date().toISOString());
        console.log("🔧 Code Version: v8-WITH-DATA-WRAPPER-FIX");
        console.log("Component name:", componentName);
        console.log("Selected ICP:", selectedICP);
        
        if (!selectedICP) {
          throw new Error("No ICP selected for report generation");
        }

        console.log("=== API FIX ATTEMPT - 2025-08-20-07:30:00 ===");
        console.log("🔧 FINAL FIX: Using correct component name and data field");
        console.log("🔍 COMPONENT NAME: icp summary & market opportunity");
        console.log("✅ PAYLOAD STRUCTURE: data field with ICP object directly");
        console.log("🔧 REMOVED: Unnecessary health checks");
        
        // Create the API payload according to backend schema
        // Based on working market-research API: data should contain the ICP directly
        const apiPayload = {
          user_id: "user_123",
          component_name: componentName,
          refresh: true,
          data: selectedICP
        };

        console.log("🔄 API Call Timestamp:", new Date().toISOString());
        console.log("🎯 CORRECT APPROACH: Using data field with ICP directly");
        console.log("🔧 FINAL PAYLOAD STRUCTURE (v17-FINAL-FIX):");
        console.log("- user_id:", apiPayload.user_id);
        console.log("- component_name:", apiPayload.component_name); 
        console.log("- refresh:", apiPayload.refresh);
        console.log("- data type:", typeof apiPayload.data);
        console.log("- data keys:", Object.keys(apiPayload.data || {}));
        console.log("API Request Payload:", apiPayload);
        console.log("API Request Payload (stringified):", JSON.stringify(apiPayload, null, 2));
        
        // Validate payload structure before sending
        console.log("🔍 PAYLOAD VALIDATION:");
        console.log("   - Has user_id:", !!apiPayload.user_id);
        console.log("   - Has component_name:", !!apiPayload.component_name);
        console.log("   - Has refresh:", typeof apiPayload.refresh === 'boolean');
        console.log("   - Has data:", !!apiPayload.data);
        console.log("   - Data is object:", typeof apiPayload.data === 'object');

        // Call the icp research API endpoint with retry mechanism
        let response;
        let retryCount = 0;
        const maxRetries = 2;
        
        // Define endpoint outside try block for error logging
        const timestamp = Date.now();
        const randomParam = Math.random().toString(36).substring(7);
        const endpoint = `icp-research?t=${timestamp}&cache_bust=${randomParam}`;
        

        
        while (retryCount <= maxRetries) {
          try {
            console.log(`🔄 Attempting ICP Research API call (attempt ${retryCount + 1}/${maxRetries + 1})`);
            console.log(`🔍 Current timestamp: ${new Date().toISOString()}`);
            
            // Try the actual endpoint first with cache busting
            console.log(`🌐 Making request to: ${endpoint}`);
            console.log(`📤 About to send payload:`, apiPayload);
            // Try with direct fetch to bypass apiFetch function
            console.log("🔧 Attempting with direct fetch...");
            const directResponse = await fetch(`https://backend-11kr.onrender.com/${endpoint}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              },
              body: JSON.stringify(apiPayload)
            });
            
            console.log(`🌐 Direct fetch response status: ${directResponse.status}`);
            console.log(`🌐 Direct fetch response status text: ${directResponse.statusText}`);
            
            if (!directResponse.ok) {
              const errorText = await directResponse.text();
              console.error(`❌ Direct fetch error: ${directResponse.status} - ${errorText}`);
              throw new Error(`HTTP error! status: ${directResponse.status} - ${errorText}`);
            }
            
            response = await directResponse.json();
            
            console.log('✅ ICP Research API call successful');
            console.log('📊 Response received at:', new Date().toISOString());
            console.log('🔍 Response headers should indicate no caching');
            console.log('📥 Response data:', response);
            console.log('📥 Response type:', typeof response);
            console.log('📥 Response keys:', Object.keys(response || {}));
            break; // Success, exit retry loop
            
          } catch (error) {
            retryCount++;
            console.error(`❌ ICP Research API call failed (attempt ${retryCount}/${maxRetries + 1}):`, error);
            
            // Log detailed error information
            if (error instanceof Error) {
              console.error(`🔍 Error message: ${error.message}`);
              console.error(`🔍 Error name: ${error.name}`);
              console.error(`🔍 Error stack: ${error.stack}`);
              
              // Check if it's a network error
              if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                console.error(`🌐 NETWORK ERROR DETECTED: This might be a CORS or connectivity issue`);
              }
              
              // Check if it's a 422 error and extract the detailed error
              if (error.message.includes('422')) {
                console.error(`🔍 422 ERROR DETECTED: Backend validation failed`);
                console.error(`🔍 This suggests the payload structure is still incorrect`);
                
                // Try to extract the detailed error message from the response
                try {
                  const errorMatch = error.message.match(/\{.*\}/);
                  if (errorMatch) {
                    const errorDetails = JSON.parse(errorMatch[0]);
                    console.error(`🔍 DETAILED 422 ERROR:`, errorDetails);
                    console.error(`🔍 ERROR DETAIL:`, errorDetails.detail);
                  }
                } catch (parseError) {
                  console.error(`🔍 Could not parse error details:`, parseError);
                }
              }
            }
            
            // Log the exact payload that was sent
            console.error(`📤 Sent payload:`, apiPayload);
            console.error(`📤 Sent payload (stringified):`, JSON.stringify(apiPayload, null, 2));
            
            // Log additional debugging info
            console.error(`🔍 Request URL: ${endpoint}`);
            console.error(`🔍 Request method: POST`);
            console.error(`🔍 Request headers:`, {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            });
            
            if (retryCount > maxRetries) {
              // If all retries failed, fall back to mock response
              console.log("API endpoint not available after retries, using mock response...");
              break;
            }
            
            // Wait before retrying
            console.log(`⏳ Waiting 2 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
                // If API call failed after all retries, use mock response
        if (!response) {
          console.log("API endpoint not available after retries, using mock response...");
          // Mock response until backend endpoint is implemented
          response = {
            currentData: {
              title: selectedICP.title,
              blurb: selectedICP.blurb,
              _metadata: {
                dataSource: "mock"
              },
              marketSize: selectedICP.marketSize,
              growth: selectedICP.growth,
              urgency: selectedICP.urgency,
              timeToClose: selectedICP.timeToClose,
              marketAnalysis: {
                totalMarketSize: selectedICP.marketAnalysis?.totalMarketSize || "€51.7B",
                marketGrowth: selectedICP.growth || "+30%",
                servicableMarket: selectedICP.marketAnalysis?.servicableMarket || "€17.5B",
                targetableMarket: selectedICP.marketAnalysis?.targetableMarket || "€4.1B",
                segments: selectedICP.marketAnalysis?.segments || [
                  {
                    name: "Advanced Hospitals/Clinics",
                    share: "45%",
                    size: "€22.0B",
                    growth: "+40%"
                  },
                  {
                    name: "Traditional Hospitals/Clinics",
                    share: "35%",
                    size: "€17.0B",
                    growth: "+22%"
                  }
                ],
                growthTrajectory: {
                  units: "index(2023=100)",
                  points: [
                    { year: 2023, index: 100 },
                    { year: 2024, index: 103 },
                    { year: 2025, index: 107 },
                    { year: 2026, index: 112 }
                  ]
                },
                marketShareDistribution: [
                  { name: "Advanced Hospitals/Clinics", share: "45%" },
                  { name: "Traditional Hospitals/Clinics", share: "35%" },
                  { name: "Other", share: "20%" }
                ],
                keyChallenges: selectedICP.marketAnalysis?.keyChallenges || [
                  "Healthcare Providers sector complexity requiring specialized high cloud adoption",
                  "Hospitals/Clinics integration challenges for 201-500 employees organizations"
                ],
                strategicRecommendations: selectedICP.marketAnalysis?.strategicRecommendations || [
                  "Target Healthcare Providers companies specifically needing high cloud adoption",
                  "Focus hospitals/clinics messaging on high cloud adoption and HIPAA/GDPR compliance benefits"
                ],
                signalsToMonitor: selectedICP.marketAnalysis?.signalsToMonitor || [
                  "Healthcare Providers sector funding and hospitals/clinics investment announcements",
                  "Germany regulatory changes affecting healthcare providers high cloud adoption"
                ]
              },
              timestamp: new Date().toISOString()
            }
          };
        }

        console.log("API Response:", response);
        console.log("API Response type:", typeof response);
        console.log("API Response keys:", response ? Object.keys(response) : 'null');
        
        // Summary of the fix applied
        console.log("🎯 FINAL FIX SUMMARY:");
        console.log("   - COMPONENT NAME: icp summary & market opportunity");
        console.log("   - PAYLOAD STRUCTURE: data field with ICP object directly");
        console.log("   - REMOVED: Unnecessary health check endpoints");
        console.log("   - RESULT: Clean API call with correct structure");

        if (response && response.currentData) {
          setApiReportData(response.currentData);
          console.log("✅ Report data updated from API/Mock");
        } else if (response && response.data) {
          // Handle case where response might have data instead of currentData
          setApiReportData(response.data);
          console.log("✅ Report data updated from API (data field)");
        } else {
          console.error("❌ Invalid response format:", response);
          throw new Error("Invalid response format from API");
        }

      } catch (error) {
        console.error("=== ERROR GENERATING REPORT VIA API ===", error);
        setReportError(error instanceof Error ? error.message : "Failed to generate report");
      } finally {
        setIsLoadingReport(false);
      }
    };

    // Generate report via backend API (legacy function - keeping for compatibility)
    const generateReport = async (reportType: 'save' | 'pdf' = 'save') => {
      try {
        setReportGenerating(true);
        console.log(`=== GENERATING ${reportType.toUpperCase()} REPORT ===`);
        
        const currentData = selectedICP; // Use selectedICP directly
        if (!currentData) {
          throw new Error("No data available for report generation");
        }

        const reportPayload = {
          selectedICP: currentData,
          icpData: currentData, // Pass the entire ICP object
          activeCard: 0, // No internal card switching, always 0
          reportType,
          timestamp: new Date().toISOString(),
          sections: {
            marketAnalysis: currentData.marketAnalysis,
            competitiveData: currentData.competitiveData,
            buyingTriggers: currentData.buyingTriggersArray,
            filters: {
              signalRegionFilter,
              signalTypeFilter
            }
          }
        };

        console.log("Report payload:", reportPayload);

        const response = await fetch('https://backend-11kr.onrender.com/generate-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reportPayload)
        });

        if (!response.ok) {
          throw new Error(`Report generation failed: ${response.status}`);
        }

        const result = await response.json();
        console.log("Report generation result:", result);

        if (reportType === 'pdf') {
          // Handle PDF download
          if (result.downloadUrl) {
            window.open(result.downloadUrl, '_blank');
          } else {
            alert('Report generated successfully! Check your email for the PDF.');
          }
        } else {
          alert('Report saved successfully!');
        }

      } catch (err) {
        console.error("=== ERROR GENERATING REPORT ===", err);
        alert(`Failed to generate ${reportType} report. Please try again.`);
      } finally {
        setReportGenerating(false);
      }
    };

    // Fetch ICP data from backend
    const fetchICPData = async () => {
    try {
      console.log("=== FETCHING ICP DATA ===");
      setDataSource('api'); // Set data source to API
      
      // Add timestamp to force fresh data and avoid caching
      const timestamp = new Date().getTime();
      const apiUrl = `https://backend-11kr.onrender.com/icp?t=${timestamp}&fresh=true`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log("=== ICP API CALL DETAILS ===");
      console.log("URL:", apiUrl);
      console.log("Response Status:", response.status);
      console.log("Response OK:", response.ok);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("=== RAW BACKEND RESPONSE ===");
      console.log("Full response:", data);
      console.log("Response type:", typeof data);
      console.log("Is array:", Array.isArray(data));

      // Extract ICPs from response
      let icpsArray = [];
      if (data.suggestedICPs && Array.isArray(data.suggestedICPs)) {
        icpsArray = data.suggestedICPs;
      } else if (Array.isArray(data)) {
        icpsArray = data;
      } else {
        console.warn("Unexpected data structure, using fallback");
        // Use fallback data when API fails
        const fallbackData = generateFallbackData();
        setDataSource('fallback'); // Set data source to fallback
        return fallbackData; // Return fallback data directly
      }

      console.log("=== EXTRACTED ICP ARRAY ===");
      console.log("ICP count:", icpsArray.length);
      console.log("ICPs:", icpsArray);

      // Transform the data to use ACTUAL ICP data from backend
      const transformedData = icpsArray.map((icp: any, index: number) => {
        console.log(`Processing ICP ${index + 1}:`, icp);
        console.log("ICP ID:", icp.id);
        console.log("ICP Industry:", icp.industry);
        console.log("ICP Segment:", icp.segment);
        console.log("ICP Key Attributes:", icp.keyAttributes);
        console.log("ICP Regions:", icp.regions);
        console.log("ICP Decision Makers:", icp.decisionMakers);
        
        // Use the ACTUAL ICP data to create unique content for each card
        const icpId = icp.id || `icp-${index}`;
        const industry = icp.industry || "Technology";
        const segment = icp.segment || "Software Solutions";
        const companySize = icp.companySize || "50-200 employees";
        const regions = icp.regions || ["Global"];
        const keyAttributes = icp.keyAttributes || ["Scalability", "Security"];
        const decisionMakers = icp.decisionMakers || ["CTO", "Head of Engineering"];
        
        // Create unique market data based on the actual ICP properties
        const uniqueMarketData = {
          // Market size calculation based on industry and segment
          baseMarketSize: industry.toLowerCase().includes('healthcare') ? 45 :
                         industry.toLowerCase().includes('financial') ? 32 :
                         industry.toLowerCase().includes('manufacturing') ? 38 :
                         industry.toLowerCase().includes('retail') ? 25 :
                         30,
          
          // Growth rate based on segment and company size
          growthRate: segment.toLowerCase().includes('digital') ? 35 :
                     segment.toLowerCase().includes('cloud') ? 42 :
                     segment.toLowerCase().includes('ai') ? 48 :
                     companySize.includes('500+') ? 18 :
                     companySize.includes('200+') ? 25 :
                     28,
                     
          // Urgency based on key attributes and company size
          urgency: keyAttributes.some(attr => attr.toLowerCase().includes('compliance') || 
                                             attr.toLowerCase().includes('security') ||
                                             attr.toLowerCase().includes('regulatory')) ? "High" :
                  companySize.includes('100-500') || companySize.includes('200+') ? "High" : "Medium",
                  
          // Time to close based on company size and decision makers
          timeToClose: companySize.includes('500+') || decisionMakers.length > 3 ? "6-9 months" :
                      companySize.includes('200+') ? "4-6 months" :
                      "2-4 months"
        };
        
        const finalMarketSize = uniqueMarketData.baseMarketSize + (index * 7); // Make each ICP different
        const finalGrowthRate = uniqueMarketData.growthRate + (index * 3);
    
    return {
          id: icpId,
          title: `${industry} - ${segment} (${companySize})`,
          blurb: `${segment} companies in the ${industry} sector seeking ${keyAttributes.slice(0, 2).join(' and ').toLowerCase()} solutions. Operating primarily in ${regions.join(', ')} with focus on ${keyAttributes[0]?.toLowerCase() || 'operational efficiency'}.`,
          marketSize: `€${finalMarketSize}.${(index + 1) % 10}B`,
          growth: `+${finalGrowthRate}%`,
          urgency: uniqueMarketData.urgency,
          timeToClose: uniqueMarketData.timeToClose,
          corePersonas: decisionMakers.length,
          topPainPoint: keyAttributes[0] || "System Integration",
          buyingTriggers: keyAttributes.length + 2,
          competitors: Math.min(keyAttributes.length + 1, 5),
          winLossChange: `+${12 + (index * 5)}%`,
          buyingSignals: regions.length * 3 + keyAttributes.length,
          
          // Buying triggers based on ACTUAL ICP data
      buyingTriggersArray: [
            { 
              trigger: `${industry} Modernization`, 
              description: `${industry} companies upgrading ${segment.toLowerCase()} to address ${keyAttributes[0]?.toLowerCase() || 'operational challenges'}.` 
            },
            { 
              trigger: "Regulatory Compliance", 
              description: `New ${industry.toLowerCase()} regulations requiring ${keyAttributes.find(attr => attr.toLowerCase().includes('compliance') || attr.toLowerCase().includes('security')) || keyAttributes[0]} improvements in ${regions[0]}.` 
            },
            { 
              trigger: "Scale Requirements", 
              description: `${companySize} ${industry.toLowerCase()} organizations need ${segment.toLowerCase()} solutions for ${regions.length > 1 ? 'multi-region' : regions[0]} expansion.` 
            },
            { 
              trigger: "Technology Gap", 
              description: `${segment} providers in ${industry} sector investing in ${keyAttributes[1] || 'advanced capabilities'} to compete effectively.` 
            },
            { 
              trigger: "Decision Maker Priority", 
              description: `${decisionMakers[0] || 'Senior executives'} prioritizing ${keyAttributes[0]?.toLowerCase() || 'system improvements'} for ${industry.toLowerCase()} operations.` 
            }
          ],
          
          // Market analysis based on ACTUAL ICP properties
      marketAnalysis: {
            totalMarketSize: `€${finalMarketSize}.${(index + 1) % 10}B`,
            servicableMarket: `€${Math.floor(finalMarketSize * 0.35)}.${(index + 3) % 10}B`,
            targetableMarket: `€${Math.floor(finalMarketSize * 0.08)}.${(index + 5) % 10}B`,
            marketGrowth: `+${finalGrowthRate}%`,
            
        segments: [
              { 
                name: `Advanced ${segment}`, 
                size: `€${Math.floor(finalMarketSize * 0.45)}.${(index + 2) % 10}B`, 
                growth: `+${finalGrowthRate + 8}%`, 
                share: "45%" 
              },
              { 
                name: `Traditional ${segment}`, 
                size: `€${Math.floor(finalMarketSize * 0.35)}.${(index + 4) % 10}B`, 
                growth: `+${Math.max(finalGrowthRate - 12, 8)}%`, 
                share: "35%" 
              },
              { 
                name: `Emerging ${segment}`, 
                size: `€${Math.floor(finalMarketSize * 0.20)}.${(index + 6) % 10}B`, 
                growth: `+${finalGrowthRate + 15}%`, 
                share: "20%" 
              }
            ],
            
            // Challenges specific to this ICP
        keyChallenges: [
              `${industry} sector complexity requiring specialized ${keyAttributes[0]?.toLowerCase() || 'solutions'}`,
              `${segment} integration challenges for ${companySize} organizations`,
              `${regions.join(' and ')} regulatory compliance for ${industry.toLowerCase()} operations`,
              `Scaling ${keyAttributes[1]?.toLowerCase() || 'technology capabilities'} across ${decisionMakers.length} decision-making levels`,
              `${industry} competitive landscape demanding ${keyAttributes[2]?.toLowerCase() || 'innovation'} excellence`
            ],
            
            // Recommendations specific to this ICP
        strategicRecommendations: [
              `Target ${industry} companies specifically needing ${keyAttributes[0]?.toLowerCase() || 'core capabilities'}`,
              `Focus ${segment.toLowerCase()} messaging on ${keyAttributes.slice(0, 2).join(' and ').toLowerCase()} benefits`,
              `Develop ${regions.join(' and ')} market entry strategies for ${companySize} segment`,
              `Create ${decisionMakers[0] || 'executive'}-level case studies showcasing ${keyAttributes[0]?.toLowerCase() || 'results'}`,
              `Position against ${industry} incumbent solutions lacking ${keyAttributes[1]?.toLowerCase() || 'modern capabilities'}`
            ],
            
            // Signals specific to this ICP
        signalsToMonitor: [
              `${industry} sector funding and ${segment.toLowerCase()} investment announcements`,
              `${regions[0]} regulatory changes affecting ${industry.toLowerCase()} ${keyAttributes[0]?.toLowerCase() || 'compliance'}`,
              `${segment} product launches by ${companySize} companies in ${industry}`,
              `${decisionMakers.join(' and ')} hiring trends in ${industry.toLowerCase()} organizations`,
              `${keyAttributes[0]} technology adoption patterns in ${regions.join(' and ')} markets`
            ]
          },
          
          // Competitive data based on ICP specifics
          competitiveData: {
            mainCompetitors: generateCompetitors(industry, segment),
            
            competitiveMap: [
              {
                competitor: `${industry} Incumbent A`,
                segment: segment,
                share: `${20 + (index * 2)}%`,
                winsLosses: `Strong in ${regions[0]}, ${keyAttributes[0]?.toLowerCase() || 'established'} focus`,
                differentiators: `Legacy ${industry.toLowerCase()} presence, ${keyAttributes[0]?.toLowerCase() || 'traditional'} approach`
              },
              {
                competitor: `${segment} Specialist B`, 
                segment: segment,
                share: `${15 + index}%`,
                winsLosses: `Growing in ${regions[1] || regions[0]}, modern ${keyAttributes[1]?.toLowerCase() || 'technology'} stack`,
                differentiators: `${segment}-focused solutions, ${keyAttributes[1]?.toLowerCase() || 'cloud-native'} architecture`
              },
              {
                competitor: "Innovation Disruptor C",
                segment: segment,
                share: `${10 + index}%`,
                winsLosses: `Targeting ${companySize} ${industry.toLowerCase()} companies`,
                differentiators: `AI-powered ${keyAttributes[2]?.toLowerCase() || 'automation'}, ${keyAttributes[0]?.toLowerCase() || 'rapid'} deployment`
              }
            ],
            
            competitiveNews: [
              `${industry} Incumbent A expands ${segment.toLowerCase()} capabilities for ${regions[0]} market`,
              `New ${industry.toLowerCase()} regulations create ${keyAttributes[0]?.toLowerCase() || 'compliance'} opportunities`,
              `${segment} Specialist B raises funding targeting ${companySize} ${industry.toLowerCase()} segment`,
              `${industry} sector consolidation affects ${keyAttributes[1]?.toLowerCase() || 'technology'} vendor landscape`,
              `Emerging ${keyAttributes[2]?.toLowerCase() || 'AI'} solutions disrupt traditional ${segment.toLowerCase()} approaches`
            ],
            
            // Buying signals specific to this ICP
            buyingSignalsData: [
              {
                signalType: "Industry Investment",
                description: `${industry} company invests in ${keyAttributes[0]?.toLowerCase() || 'technology'} infrastructure for ${segment.toLowerCase()}`,
                source: "Industry Reports",
                recency: `${index + 1} weeks ago`,
                region: regions[0],
                type: "Investment"
              },
              {
                signalType: "Technology Adoption",
                description: `${companySize} ${industry.toLowerCase()} leader adopts ${keyAttributes[1]?.toLowerCase() || 'modern'} ${segment.toLowerCase()} solution`,
                source: "Technology News",
                recency: `${index + 2} days ago`,
                region: regions[1] || regions[0],
                type: "Tech adoption"
              },
              {
                signalType: "Leadership Change",
                description: `New ${decisionMakers[0] || 'CTO'} appointed at major ${industry.toLowerCase()} organization`,
                source: "LinkedIn",
                recency: `${index * 2 + 3} days ago`,
                region: regions[0],
                type: "Leadership"
              },
              {
                signalType: "Regulatory Update",
                description: `${regions[0]} announces new ${industry.toLowerCase()} ${keyAttributes[0]?.toLowerCase() || 'compliance'} requirements`,
                source: "Regulatory Filing",
                recency: `${index + 3} weeks ago`,
                region: regions[0],
                type: "Regulatory"
              },
              {
                signalType: "Market Expansion",
                description: `${segment} provider expands into ${regions[1] || 'adjacent'} market targeting ${industry.toLowerCase()} sector`,
                source: "Press Release",
                recency: `${index + 1} months ago`,
                region: regions[1] || regions[0],
                type: "Market expansion"
              }
            ]
          }
        };
      });

      console.log("=== FINAL TRANSFORMED DATA ===");
      console.log("Transformed ICP count:", transformedData.length);
      console.log("Transformed ICPs:", transformedData);
      console.log("🟢 DATA SOURCE: API - Successfully fetched from /icp endpoint");
      console.log("🕐 Fetch timestamp:", new Date().toISOString());

      // Add data source metadata to each transformed item
      const dataWithSource = transformedData.map((item, index) => ({
        ...item,
        _metadata: {
          dataSource: 'api',
          fetchedAt: new Date().toISOString(),
          originalICPId: icpsArray[index]?.id,
          transformationIndex: index
        }
      }));

      return dataWithSource;
      
    } catch (err) {
      console.error("=== ERROR FETCHING ICP DATA ===", err);
      console.log("🟡 DATA SOURCE: FALLBACK - Using fallback data due to API error");
      console.log("🕐 Fallback timestamp:", new Date().toISOString());
      
      // Use fallback data when API fails
      const fallbackData = generateFallbackData();
      
      // Add data source metadata to fallback data
      const fallbackWithSource = fallbackData.map((item, index) => ({
        ...item,
        _metadata: {
          dataSource: 'fallback',
          generatedAt: new Date().toISOString(),
          fallbackReason: 'API_ERROR',
          transformationIndex: index
        }
      }));
      
      return fallbackWithSource;
      
    } finally {
      // setLoading(false); // No longer needed
    }
  };

  // Helper method to generate industry-specific competitors
  const generateCompetitors = (industry: string, segment: string) => {
    const competitorMaps = {
      'Healthcare': ['Epic Systems', 'Cerner', 'Allscripts', 'athenahealth'],
      'Financial': ['Stripe', 'Square', 'PayPal', 'Adyen'],
      'Technology': ['Salesforce', 'Microsoft', 'Oracle', 'SAP'],
      'Manufacturing': ['Siemens', 'GE Digital', 'Honeywell', 'Rockwell'],
      'Retail': ['Shopify', 'Magento', 'BigCommerce', 'WooCommerce'],
      'default': ['Market Leader A', 'Established Player B', 'Innovation Challenger C', 'Traditional Provider D']
    };
    
    const industryKey = Object.keys(competitorMaps).find(key => 
      industry?.toLowerCase().includes(key.toLowerCase())
    ) || 'default';
    
    return competitorMaps[industryKey as keyof typeof competitorMaps];
  };

  // Generate fallback data when API fails - make it unique per ICP
  const generateFallbackData = () => {
    // Create two DIFFERENT fallback ICPs with completely different data
    return [
      {
        id: "fallback-healthcare",
        title: "Healthcare Technology - Digital Health Platforms (100-500 employees)",
        blurb: "Digital Health Platforms companies in the Healthcare Technology sector seeking hipaa compliance and scalability solutions. Operating primarily in North America, Europe with focus on hipaa compliance.",
        marketSize: "€52.3B",
        growth: "+31%",
        urgency: "High",
        timeToClose: "4-6 months",
        corePersonas: 3,
        topPainPoint: "HIPAA Compliance",
        buyingTriggers: 5,
        competitors: 4,
        winLossChange: "+17%",
        buyingSignals: 9,
        buyingTriggersArray: [
          { trigger: "Healthcare Technology Modernization", description: "Healthcare Technology companies upgrading digital health platforms to address hipaa compliance." },
          { trigger: "Regulatory Compliance", description: "New healthcare technology regulations requiring HIPAA Compliance improvements in North America." },
          { trigger: "Scale Requirements", description: "100-500 employees healthcare technology organizations need digital health platforms solutions for multi-region expansion." },
          { trigger: "Technology Gap", description: "Digital Health Platforms providers in Healthcare Technology sector investing in scalability to compete effectively." },
          { trigger: "Decision Maker Priority", description: "CTO prioritizing hipaa compliance for healthcare technology operations." }
        ],
        marketAnalysis: {
          totalMarketSize: "€52.3B",
          servicableMarket: "€18.8B",
          targetableMarket: "€4.2B",
          marketGrowth: "+31%",
          segments: [
            { name: "Advanced Digital Health Platforms", size: "€23.5B", growth: "+39%", share: "45%" },
            { name: "Traditional Digital Health Platforms", size: "€18.3B", growth: "+19%", share: "35%" },
            { name: "Emerging Digital Health Platforms", size: "€10.5B", growth: "+46%", share: "20%" }
          ],
          keyChallenges: [
            "Healthcare Technology sector complexity requiring specialized hipaa compliance",
            "Digital Health Platforms integration challenges for 100-500 employees organizations",
            "North America and Europe regulatory compliance for healthcare technology operations",
            "Scaling scalability across 3 decision-making levels",
            "Healthcare Technology competitive landscape demanding real-time processing excellence"
          ],
          strategicRecommendations: [
            "Target Healthcare Technology companies specifically needing hipaa compliance",
            "Focus digital health platforms messaging on hipaa compliance and scalability benefits",
            "Develop North America and Europe market entry strategies for 100-500 employees segment",
            "Create CTO-level case studies showcasing hipaa compliance",
            "Position against Healthcare Technology incumbent solutions lacking scalability"
          ],
          signalsToMonitor: [
            "Healthcare Technology sector funding and digital health platforms investment announcements",
            "North America regulatory changes affecting healthcare technology hipaa compliance",
            "Digital Health Platforms product launches by 100-500 employees companies in Healthcare Technology",
            "CTO and Chief Medical Officer and VP of Engineering hiring trends in healthcare technology organizations",
            "HIPAA Compliance technology adoption patterns in North America and Europe markets"
          ]
        },
        competitiveData: {
          mainCompetitors: ["Epic Systems", "Cerner", "Allscripts", "athenahealth"],
      competitiveMap: [
        {
              competitor: "Healthcare Technology Incumbent A",
              segment: "Digital Health Platforms",
              share: "22%",
              winsLosses: "Strong in North America, hipaa compliance focus",
              differentiators: "Legacy healthcare technology presence, hipaa compliance approach"
            },
            {
              competitor: "Digital Health Platforms Specialist B",
              segment: "Digital Health Platforms", 
              share: "16%",
              winsLosses: "Growing in Europe, modern scalability stack",
              differentiators: "Digital Health Platforms-focused solutions, scalability architecture"
            },
            {
              competitor: "Innovation Disruptor C",
              segment: "Digital Health Platforms",
              share: "11%",
              winsLosses: "Targeting 100-500 employees healthcare technology companies",
              differentiators: "AI-powered real-time processing, hipaa compliance deployment"
            }
          ],
          competitiveNews: [
            "Healthcare Technology Incumbent A expands digital health platforms capabilities for North America market",
            "New healthcare technology regulations create hipaa compliance opportunities",
            "Digital Health Platforms Specialist B raises funding targeting 100-500 employees healthcare technology segment",
            "Healthcare Technology sector consolidation affects scalability vendor landscape",
            "Emerging real-time processing solutions disrupt traditional digital health platforms approaches"
          ],
          buyingSignalsData: [
            {
              signalType: "Industry Investment",
              description: "Healthcare Technology company invests in hipaa compliance infrastructure for digital health platforms",
              source: "Industry Reports",
              recency: "1 weeks ago",
              region: "North America",
              type: "Investment"
            },
            {
              signalType: "Technology Adoption",
              description: "100-500 employees healthcare technology leader adopts scalability digital health platforms solution",
              source: "Technology News",
              recency: "2 days ago",
              region: "Europe",
              type: "Tech adoption"
        },
        {
          signalType: "Leadership Change",
              description: "New CTO appointed at major healthcare technology organization",
          source: "LinkedIn",
              recency: "3 days ago",
              region: "North America",
              type: "Leadership"
            }
          ]
        }
      },
      {
        id: "fallback-fintech",
        title: "Financial Services - Fintech Startups (50-200 employees)",
        blurb: "Fintech Startups companies in the Financial Services sector seeking regulatory compliance and security solutions. Operating primarily in US, Canada, UK with focus on regulatory compliance.",
        marketSize: "€37.8B",
        growth: "+34%",
        urgency: "High",
        timeToClose: "2-4 months",
        corePersonas: 3,
        topPainPoint: "Regulatory Compliance",
        buyingTriggers: 5,
        competitors: 3,
        winLossChange: "+22%",
        buyingSignals: 12,
        buyingTriggersArray: [
          { trigger: "Financial Services Modernization", description: "Financial Services companies upgrading fintech startups to address regulatory compliance." },
          { trigger: "Regulatory Compliance", description: "New financial services regulations requiring Security improvements in US." },
          { trigger: "Scale Requirements", description: "50-200 employees financial services organizations need fintech startups solutions for multi-region expansion." },
          { trigger: "Technology Gap", description: "Fintech Startups providers in Financial Services sector investing in api integration to compete effectively." },
          { trigger: "Decision Maker Priority", description: "CTO prioritizing regulatory compliance for financial services operations." }
        ],
        marketAnalysis: {
          totalMarketSize: "€37.8B",
          servicableMarket: "€13.2B",
          targetableMarket: "€3.0B",
          marketGrowth: "+34%",
          segments: [
            { name: "Advanced Fintech Startups", size: "€17.0B", growth: "+42%", share: "45%" },
            { name: "Traditional Fintech Startups", size: "€13.2B", growth: "+22%", share: "35%" },
            { name: "Emerging Fintech Startups", size: "€7.6B", growth: "+49%", share: "20%" }
          ],
          keyChallenges: [
            "Financial Services sector complexity requiring specialized regulatory compliance",
            "Fintech Startups integration challenges for 50-200 employees organizations",
            "US and Canada and UK regulatory compliance for financial services operations",
            "Scaling security across 3 decision-making levels",
            "Financial Services competitive landscape demanding api integration excellence"
          ],
          strategicRecommendations: [
            "Target Financial Services companies specifically needing regulatory compliance",
            "Focus fintech startups messaging on regulatory compliance and security benefits",
            "Develop US and Canada and UK market entry strategies for 50-200 employees segment",
            "Create CTO-level case studies showcasing regulatory compliance",
            "Position against Financial Services incumbent solutions lacking security"
          ],
          signalsToMonitor: [
            "Financial Services sector funding and fintech startups investment announcements",
            "US regulatory changes affecting financial services regulatory compliance",
            "Fintech Startups product launches by 50-200 employees companies in Financial Services",
            "CTO and Head of Compliance and VP of Product hiring trends in financial services organizations",
            "Regulatory Compliance technology adoption patterns in US and Canada and UK markets"
          ]
        },
        competitiveData: {
          mainCompetitors: ["Stripe", "Square", "PayPal", "Adyen"],
          competitiveMap: [
            {
              competitor: "Financial Services Incumbent A",
              segment: "Fintech Startups",
              share: "24%",
              winsLosses: "Strong in US, regulatory compliance focus",
              differentiators: "Legacy financial services presence, regulatory compliance approach"
            },
            {
              competitor: "Fintech Startups Specialist B",
              segment: "Fintech Startups",
              share: "17%",
              winsLosses: "Growing in Canada, modern security stack",
              differentiators: "Fintech Startups-focused solutions, security architecture"
            },
            {
              competitor: "Innovation Disruptor C",
              segment: "Fintech Startups",
              share: "12%",
              winsLosses: "Targeting 50-200 employees financial services companies",
              differentiators: "AI-powered api integration, regulatory compliance deployment"
            }
          ],
          competitiveNews: [
            "Financial Services Incumbent A expands fintech startups capabilities for US market",
            "New financial services regulations create regulatory compliance opportunities",
            "Square launches new B2B solutions",
            "Industry consolidation trends in Financial Services", 
            "Emerging technologies disrupt traditional approaches"
          ],
          buyingSignalsData: [
            {
              signalType: "Industry Investment",
              description: "Fintech Startups company raises growth capital",
              source: "Industry Reports",
              recency: "2 weeks ago",
              region: "US",
              type: "Funding"
            },
            {
              signalType: "Technology Adoption",
              description: "Major Financial Services player adopts new infrastructure", 
              source: "Technology News",
              recency: "1 week ago",
              region: "Canada",
              type: "Tech adoption"
            }
          ]
        }
      }
    ];
  };

  // Reset filters when active card changes
  useEffect(() => {
    try {
      console.log("=== ACTIVE CARD CHANGED ===");
      console.log("New active card:", 0); // Always 0 for single ICP
      console.log("Current data:", selectedICP);
      console.log("Current data ID:", selectedICP?.id);
      console.log("Current data title:", selectedICP?.title);
      console.log("Current data market size:", selectedICP?.marketSize);
      
      // Show data source information
      const currentMetadata = selectedICP?._metadata;
      if (currentMetadata) {
        console.log("📊 DATA SOURCE INFO:", {
          source: currentMetadata.dataSource,
          timestamp: currentMetadata.fetchedAt || currentMetadata.generatedAt,
          originalId: currentMetadata.originalICPId,
          reason: currentMetadata.fallbackReason || 'SUCCESS'
        });
        
        if (currentMetadata.dataSource === 'api') {
          console.log("🟢 SHOWING API DATA - Card", 0, "contains live data from /icp endpoint");
        } else {
          console.log("🟡 SHOWING FALLBACK DATA - Card", 0, "contains mock data due to:", currentMetadata.fallbackReason);
        }
      }
      
      console.log("Current data industry details:", {
        industry: selectedICP?.title?.split(' - ')[0],
        segment: selectedICP?.title?.split(' - ')[1]?.split(' (')[0],
        topPainPoint: selectedICP?.topPainPoint,
        buyingTriggers: selectedICP?.buyingTriggers,
        dataSource: currentMetadata?.dataSource || 'unknown'
      });
      
      // Reset filters to "all" when switching cards
      setSignalRegionFilter("all");
      setSignalTypeFilter("all");
      setComponentError(null); // Clear any component errors
    } catch (error) {
      console.error("Error in useEffect:", error);
      setComponentError(error instanceof Error ? error.message : "Error processing ICP data");
    }
  }, [selectedICP]);

  // Fetch data when component mounts or selectedICP changes
  useEffect(() => {
    try {
      if (selectedICP) {
        console.log("=== ICP CHANGED - FETCHING DATA ===");
        console.log("New selected ICP:", selectedICP);
        // fetchICPData(); // No longer needed, data is passed directly
      }
    } catch (error) {
      console.error("Error in ICP change useEffect:", error);
      setComponentError(error instanceof Error ? error.message : "Error loading ICP");
    }
  }, [selectedICP]);

  // Generate report via API when ICP is selected
  useEffect(() => {
    if (selectedICP) {
      console.log("=== ICP SELECTED - GENERATING REPORT VIA API ===");
              generateReportViaAPI("icp summary & market opportunity");
    }
  }, [selectedICP]);

  // Mock data for charts
  const mockGrowthData = [
    { name: "2022", value: 8.5 },
    { name: "2023", value: 10.2 },
    { name: "2024", value: 12.3 },
    { name: "2025", value: 15.1 },
    { name: "2026", value: 18.8 }
  ];

  // Dynamic segment data based on current ICP
  const dynamicSegmentData = useMemo(() => {
    const currentData = selectedICP;
    if (!currentData?.marketAnalysis?.segments) {
      return [
    { name: "Digital-only", value: 50, color: "#3b82f6" },
    { name: "Traditional", value: 31, color: "#10b981" },
    { name: "Challenger", value: 19, color: "#f59e0b" }
  ];
    }
    
    return currentData.marketAnalysis.segments.map((segment: any, index: number) => ({
      name: segment.name,
      value: parseInt(segment.share),
      color: ["#3b82f6", "#10b981", "#f59e0b"][index] || "#6b7280"
    }));
  }, [selectedICP]);

  // Get current data based on active card - prioritize API data over frontend data
  const currentData = apiReportData || selectedICP;

  // Filter buying signals
  const filteredBuyingSignals = useMemo(() => {
    if (!currentData?.competitiveData?.buyingSignalsData) return [];
    
    return currentData.competitiveData.buyingSignalsData.filter((signal: any) => {
      const regionMatch = signalRegionFilter === "all" || signal.region === signalRegionFilter;
      const typeMatch = signalTypeFilter === "all" || signal.type === signalTypeFilter;
    return regionMatch && typeMatch;
  });
  }, [currentData?.competitiveData?.buyingSignalsData, signalRegionFilter, signalTypeFilter]);

  if (!currentData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No ICP data available</p>
      </div>
    );
  }

    return (
    <div className="space-y-6">
      {/* Data Source Indicator */}
      <div className="flex justify-between items-center p-3 rounded-lg border-2 border-dashed">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            apiReportData ? 'bg-blue-100 text-blue-800 border border-blue-300' :
            dataSource === 'api' ? 'bg-green-100 text-green-800 border border-green-300' :
            dataSource === 'fallback' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
            'bg-gray-100 text-gray-800 border border-gray-300'
          }`}>
                         {apiReportData ? (apiReportData._metadata?.dataSource === 'mock' ? '🟡 Mock Data' : '🔵 API Report Data') :
              dataSource === 'api' ? '🟢 API Data' : 
              dataSource === 'fallback' ? '🟡 Fallback Data' : 
              '⚪ Loading...'}
      </div>
                     <div className="text-sm text-gray-600">
                           {apiReportData ? (apiReportData._metadata?.dataSource === 'mock' ? 'Components showing mock data (Backend endpoint not available)' : 'Components showing API-generated report data from /icp-research endpoint') :
               dataSource === 'api' ? 'Components showing live data from /icp endpoint' :
               dataSource === 'fallback' ? 'Components showing fallback data (API unavailable)' :
               'Determining data source...'}
       </div>
        </div>
        <div className="text-xs text-gray-500">
          Active Card: 1 | Total ICPs: 1
          {isLoadingReport && ' | Generating Report...'}
        </div>
      </div>

      {/* API Report Error Display */}
      {reportError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">API Report Error: {reportError}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => generateReportViaAPI("icp summary & market opportunity")}
            className="mt-2"
          >
            Retry API Report
          </Button>
        </div>
      )}

      {/* API Report Generation Button */}
      {selectedICP && !apiReportData && !isLoadingReport && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm mb-2">Generate API-powered report for this ICP</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => generateReportViaAPI("icp summary & market opportunity")}
          >
            Generate Report
          </Button>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoadingReport && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm">🔄 Generating API report...</p>
        </div>
      )}

      {/* Error Banner (if any) */}
      {/* Removed error banner as it's not directly tied to a single ICP */}

      {/* ICP Summary & Market Opportunity */}
      <div className="space-y-4">
        <Card className="border border-gray-200">
          <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
                <CardTitle className="text-xl font-semibold">ICP Summary & Market Opportunity</CardTitle>
                <CardDescription className="mt-1">
                  Overview of target customer profile and market dynamics
                  {apiReportData && (
                    <span className="ml-2 text-blue-600">(API Generated)</span>
                  )}
                </CardDescription>
            </div>
            {apiReportData && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateReportViaAPI("icp summary & market opportunity")}
                disabled={isLoadingReport}
              >
                {isLoadingReport ? 'Regenerating...' : 'Regenerate Report'}
              </Button>
            )}
              {/* Removed Card 1/Card 2 selection buttons */}
          </div>
        </CardHeader>
          
        <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  {currentData.title}
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    apiReportData 
                      ? 'bg-blue-100 text-blue-700' 
                      : currentData._metadata?.dataSource === 'api' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                                         {apiReportData ? (apiReportData._metadata?.dataSource === 'mock' ? 'Mock' : 'API Report') : currentData._metadata?.dataSource === 'api' ? 'API' : 'Mock'}
                  </span>
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {currentData.blurb}
                </p>
            </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <Target className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-600">Market Size</p>
                    <p className="font-semibold text-blue-900">{currentData.marketSize}</p>
            </div>
            </div>
                
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-600">Growth Rate</p>
                    <p className="font-semibold text-green-900">{currentData.growth}</p>
            </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-xs text-gray-600">Urgency</p>
                    <p className="font-semibold text-orange-900">{currentData.urgency}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-xs text-gray-600">Time to Close</p>
                    <p className="font-semibold text-purple-900">{currentData.timeToClose}</p>
                  </div>
                </div>
              </div>

              {!isMarketExpanded && (
                <div className="flex justify-center">
                  <Button 
                    variant="ghost" 
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => setIsMarketExpanded(true)}
                  >
                    Read More <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}

          {isMarketExpanded && (
                <div className="mt-6 space-y-8 border-t pt-6">
                  {/* Market Size & Growth */}
              <div>
                    <h4 className="font-semibold text-lg mb-4">Market Size & Growth</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm font-medium text-blue-900">Total Market Size</p>
                            <p className="text-2xl font-bold text-blue-600">{currentData.marketAnalysis?.totalMarketSize || 'N/A'}</p>
                          </div>
                          <div className="p-4 bg-green-50 rounded-lg">
                            <p className="text-sm font-medium text-green-900">Market Growth</p>
                            <p className="text-2xl font-bold text-green-600">{currentData.marketAnalysis?.marketGrowth || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-purple-50 rounded-lg">
                            <p className="text-sm font-medium text-purple-900">Serviceable Market</p>
                            <p className="text-xl font-bold text-purple-600">{currentData.marketAnalysis?.servicableMarket || 'N/A'}</p>
                          </div>
                          <div className="p-4 bg-orange-50 rounded-lg">
                            <p className="text-sm font-medium text-orange-900">Targetable Market</p>
                            <p className="text-xl font-bold text-orange-600">{currentData.marketAnalysis?.targetableMarket || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h5 className="font-medium mb-3">Market Growth Trajectory</h5>
                        <div className="h-32">
                <MiniLineChart 
                  data={mockGrowthData} 
                            title="Market Growth Trajectory"
                            color="#3b82f6"
                />
                        </div>
                      </div>
                    </div>
              </div>

                  {/* Segment Breakdown */}
              <div>
                    <h4 className="font-semibold text-lg mb-4">Segment Breakdown</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        {(currentData.marketAnalysis?.segments || []).map((segment: any, index: number) => (
                          <div key={index} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h5 className="font-medium">{segment.name}</h5>
                              <Badge variant="outline">{segment.share}</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600">Market Size</p>
                                <p className="font-semibold">{segment.size}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Growth Rate</p>
                                <p className="font-semibold text-green-600">{segment.growth}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h5 className="font-medium mb-3">Market Share Distribution</h5>
                        <div className="h-48">
                <MiniPieChart 
                            data={dynamicSegmentData}
                            title="Market Share Distribution"
                          />
                    </div>
                      </div>
                </div>
              </div>

                  {/* Key Challenges */}
              <div>
                    <h4 className="font-semibold text-lg mb-4">Key Challenges</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(currentData.marketAnalysis?.keyChallenges || []).map((challenge: string, index: number) => (
                        <div key={index} className="p-4 bg-red-50 rounded-lg border-l-4 border-red-400">
                          <p className="text-sm text-red-800">{challenge}</p>
                        </div>
                      ))}
                    </div>
              </div>

                  {/* Strategic Recommendations */}
              <div>
                    <h4 className="font-semibold text-lg mb-4">Strategic Recommendations</h4>
                    <div className="space-y-3">
                      {(currentData.marketAnalysis?.strategicRecommendations || []).map((recommendation: string, index: number) => (
                        <div key={index} className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                          <p className="text-sm text-blue-800">{recommendation}</p>
                        </div>
                      ))}
                    </div>
              </div>

                  {/* Signals to Monitor */}
              <div>
                    <h4 className="font-semibold text-lg mb-4">Signals to Monitor</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(currentData.marketAnalysis?.signalsToMonitor || []).map((signal: string, index: number) => (
                        <div key={index} className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                          <p className="text-sm text-yellow-800">{signal}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-center gap-3 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => generateReport('save')}
                      disabled={reportGenerating}
                    >
                      {reportGenerating ? 'Generating...' : 'Save Report'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => generateReport('pdf')}
                      disabled={reportGenerating}
                    >
                      {reportGenerating ? 'Generating...' : 'Export PDF'}
                    </Button>
                  </div>
                  
                  <div className="flex justify-center pt-4">
                    <Button 
                      variant="ghost" 
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => setIsMarketExpanded(false)}
                    >
                      Show Less <ChevronUp className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
            </div>
          )}
            </div>
        </CardContent>
      </Card>
      </div>

      {/* Buyer Map & Roles, Pain Points, Triggers */}
      <div className="space-y-4">
        <Card className="border border-gray-200">
          <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Buyer Map & Roles, Pain Points, Triggers</CardTitle>
                <CardDescription className="mt-1">
                  Key stakeholders, challenges, and purchase catalysts
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Primary decision makers include CTOs focused on infrastructure modernization and Heads of Digital 
                  driving customer experience improvements. Key pain points center around legacy system constraints 
                  and regulatory compliance complexity, with funding rounds and competitive pressures serving as 
                  primary buying triggers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <User className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-600"># of core buyer personas</p>
                    <p className="font-semibold text-blue-900">{currentData.corePersonas}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                  <Flame className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-xs text-gray-600">Top pain point</p>
                    <p className="font-semibold text-red-900">{currentData.topPainPoint}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-xs text-gray-600"># of buying triggers identified</p>
                    <p className="font-semibold text-yellow-900">{currentData.buyingTriggers}</p>
                  </div>
                </div>
              </div>

              {!isBuyerMapExpanded && (
                <div className="flex justify-center">
                  <Button 
                    variant="ghost" 
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => setIsBuyerMapExpanded(true)}
                  >
                    Read More <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}

          {isBuyerMapExpanded && (
                <div className="mt-6 space-y-6 border-t pt-6">
                  <div>
                    <h4 className="font-semibold mb-4">Buying Triggers</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium">Trigger</th>
                            <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(currentData.buyingTriggersArray || []).map((trigger: any, index: number) => (
                            <tr key={index}>
                              <td className="border border-gray-300 px-4 py-2 text-sm font-medium">{trigger.trigger}</td>
                              <td className="border border-gray-300 px-4 py-2 text-sm">{trigger.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  </div>
                  </div>

                  <div className="flex justify-center gap-3 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => generateReport('save')}
                      disabled={reportGenerating}
                    >
                      {reportGenerating ? 'Generating...' : 'Save Report'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => generateReport('pdf')}
                      disabled={reportGenerating}
                    >
                      {reportGenerating ? 'Generating...' : 'Export PDF'}
                    </Button>
                  </div>
                  
                  <div className="flex justify-center pt-4">
                    <Button 
                      variant="ghost" 
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => setIsBuyerMapExpanded(false)}
                    >
                      Show Less <ChevronUp className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
            </div>
          )}
            </div>
        </CardContent>
      </Card>
      </div>

      {/* Competitive Overlap & Buying Signals */}
      <div className="space-y-4">
        <Card className="border border-gray-200">
          <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Competitive Overlap & Buying Signals</CardTitle>
                <CardDescription className="mt-1">
                  Competitive landscape analysis and market signals
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Key competitors include {(currentData.competitiveData?.mainCompetitors || []).slice(0, 2).join(" and ")} dominating 
                  the established market, while cloud-native solutions gain traction. Recent market signals show increased 
                  funding activity and regulatory-driven technology investments creating new opportunities.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                  <Swords className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-xs text-gray-600">Number of main competitors</p>
                    <p className="font-semibold text-red-900">{currentData.competitors}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-600">Notable recent win/loss % change</p>
                    <p className="font-semibold text-green-900">{currentData.winLossChange}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
                  <Flame className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-xs text-gray-600">Count of active buying signals</p>
                    <p className="font-semibold text-orange-900">{currentData.buyingSignals}</p>
                  </div>
                </div>
              </div>

              {!isCompetitiveExpanded && (
                <div className="flex justify-center">
                  <Button 
                    variant="ghost" 
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => setIsCompetitiveExpanded(true)}
                  >
                    Read More <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}

          {isCompetitiveExpanded && (
                <div className="mt-6 space-y-6 border-t pt-6">
                  <div>
                    <h4 className="font-semibold mb-4">Competitive Map</h4>
                    <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="font-medium">Competitor</TableHead>
                            <TableHead className="font-medium">Segment</TableHead>
                            <TableHead className="font-medium">Share</TableHead>
                            <TableHead className="font-medium">Wins/Losses</TableHead>
                            <TableHead className="font-medium">Differentiators</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                          {(currentData.competitiveData?.competitiveMap || []).map((competitor: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{competitor.competitor}</TableCell>
                              <TableCell>{competitor.segment}</TableCell>
                              <TableCell>{competitor.share}</TableCell>
                              <TableCell>{competitor.winsLosses}</TableCell>
                              <TableCell>{competitor.differentiators}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Competitive News & Events</h4>
                    <div className="space-y-2">
                      {(currentData.competitiveData?.competitiveNews || []).map((newsItem, index: number) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">"{newsItem.headline}"</p>
                          <p className="text-xs text-gray-500 mt-1">{newsItem.competitor} • {newsItem.date}</p>
                        </div>
                      ))}
              </div>
          </div>

            <div>
                    <h4 className="font-semibold mb-4">Buying Signals</h4>
                    
                    <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-500" />
              <Select value={signalRegionFilter} onValueChange={setSignalRegionFilter}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                            <SelectItem value="North America">North America</SelectItem>
                            <SelectItem value="Europe">Europe</SelectItem>
                            <SelectItem value="US">US</SelectItem>
                            <SelectItem value="Canada">Canada</SelectItem>
                            <SelectItem value="UK">UK</SelectItem>
                </SelectContent>
              </Select>
                      </div>
                      
                      <div>
              <Select value={signalTypeFilter} onValueChange={setSignalTypeFilter}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Signal Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="Funding">Funding</SelectItem>
                            <SelectItem value="Tech adoption">Tech Adoption</SelectItem>
                            <SelectItem value="Regulatory">Regulatory</SelectItem>
                            <SelectItem value="Partnership">Partnership</SelectItem>
                </SelectContent>
              </Select>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="font-medium">Signal Type</TableHead>
                            <TableHead className="font-medium">Description</TableHead>
                            <TableHead className="font-medium">Source</TableHead>
                            <TableHead className="font-medium">Recency</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredBuyingSignals.map((signal: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{signal.signalType}</TableCell>
                              <TableCell>{signal.description}</TableCell>
                              <TableCell>{signal.source}</TableCell>
                              <TableCell>{signal.recency}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="flex justify-center gap-3 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => generateReport('save')}
                      disabled={reportGenerating}
                    >
                      {reportGenerating ? 'Generating...' : 'Save Report'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => generateReport('pdf')}
                      disabled={reportGenerating}
                    >
                      {reportGenerating ? 'Generating...' : 'Export PDF'}
                    </Button>
                  </div>
                  
                  <div className="flex justify-center pt-4">
                    <Button 
                      variant="ghost" 
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => setIsCompetitiveExpanded(false)}
                    >
                      Show Less <ChevronUp className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regulatory, Compliance & Recommended ICP */}
      <div className="space-y-4">
        <Card className="border border-gray-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Regulatory, Compliance & Recommended ICP</CardTitle>
                <CardDescription className="mt-1">
                  Regulatory frameworks, compliance requirements, and ICP refinement recommendations
                </CardDescription>
            </div>
          </div>
        </CardHeader>
          
        <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Companies in this segment face increasing compliance requirements, especially around cloud-hosted data and regulatory frameworks. 
                  This section recommends refining your ICP to reflect these regulatory triggers and market dynamics.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-600">Key Compliance Frameworks</p>
                    <p className="font-semibold text-blue-900">GDPR, Industry Standards</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-xs text-gray-600">Upcoming Mandates</p>
                    <p className="font-semibold text-orange-900">Q4 2025 Updates</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-xs text-gray-600">ICP Fit Score</p>
                    <p className="font-semibold text-purple-900">92% match</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-600">Recommendation Confidence</p>
                    <p className="font-semibold text-green-900">High</p>
                  </div>
                </div>
              </div>

              {!isRegulatoryExpanded && (
                <div className="flex justify-center">
                  <Button 
                    variant="ghost" 
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => setIsRegulatoryExpanded(true)}
                  >
                    Read More <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}

              {isRegulatoryExpanded && (
                <div className="mt-6 space-y-8 border-t pt-6">
                  {/* ICP Refinement Recommendations */}
                    <div>
                    <h4 className="font-semibold text-lg mb-4">ICP Refinement Recommendations</h4>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                        <h5 className="font-medium text-blue-800 mb-2">Target High-Compliance Organizations</h5>
                        <p className="text-sm text-blue-700">Focus on companies that have already invested in compliance infrastructure and understand regulatory complexity</p>
                    </div>
                      <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                        <h5 className="font-medium text-blue-800 mb-2">Prioritize Multi-Jurisdiction Players</h5>
                        <p className="text-sm text-blue-700">Companies operating across multiple regions face the highest compliance burden and need comprehensive solutions</p>
                  </div>
                      <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                        <h5 className="font-medium text-blue-800 mb-2">Focus on Cloud-First Organizations</h5>
                        <p className="text-sm text-blue-700">Target companies already committed to cloud infrastructure who need compliance-ready solutions</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                        <h5 className="font-medium text-blue-800 mb-2">Emphasize Audit-Ready Capabilities</h5>
                        <p className="text-sm text-blue-700">Position solutions that provide built-in audit trails and compliance reporting features</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center gap-3 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => generateReport('save')}
                      disabled={reportGenerating}
                    >
                      {reportGenerating ? 'Generating...' : 'Save Report'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => generateReport('pdf')}
                      disabled={reportGenerating}
                    >
                      {reportGenerating ? 'Generating...' : 'Export PDF'}
                    </Button>
                  </div>
                  
                  <div className="flex justify-center pt-4">
                    <Button 
                      variant="ghost" 
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => setIsRegulatoryExpanded(false)}
                    >
                      Show Less <ChevronUp className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
  
  } catch (error) {
    console.error("=== COMPONENT RENDER ERROR ===", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown render error";
    
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold mb-2">Render Error</h3>
        <p className="text-red-600 text-sm mb-4">{errorMessage}</p>
        <div className="text-xs text-red-500">
          ICP ID: {selectedICP?.id || 'undefined'} | 
          Industry: {selectedICP?.industry || 'undefined'}
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="mt-3 px-4 py-2 bg-red-100 text-red-800 rounded text-sm"
        >
          Reload Page
        </button>
      </div>
    );
  }
};