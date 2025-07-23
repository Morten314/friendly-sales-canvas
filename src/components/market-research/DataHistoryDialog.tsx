

// import { useState, useEffect } from "react";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Badge } from "@/components/ui/badge";
// import { History, RefreshCw, CheckCircle, XCircle, Clock, Loader2, Calendar, TrendingUp, BarChart3 } from "lucide-react";

// interface DataHistoryEntry {
//   timestamp: Date;
//   type: 'fetch' | 'refresh' | 'scout_trigger' | 'report_generated';
//   status: 'success' | 'error' | 'loading';
//   source: 'cache' | 'api';
//   details?: string;
//   dataSize?: number;
//   rawTimestamp?: string;
//   reportData?: any;
// }

// interface MarketIntelligenceResponse {
//   report: {
//     timestamp: string;
//     data: any;
//     [key: string]: any;
//   };
//   report_history: string[]; // Array of date strings
//   [key: string]: any;
// }

// const API_BASE_URL = 'https://backend-11kr.onrender.com';

// export const DataHistoryDialog = () => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [historyEntries, setHistoryEntries] = useState<DataHistoryEntry[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [selectedReport, setSelectedReport] = useState<any>(null);
//   const [loadingReport, setLoadingReport] = useState<string | null>(null);

//   useEffect(() => {
//     if (isOpen && historyEntries.length === 0) {
//       fetchHistoryData();
//     }
//   }, [isOpen]);

//   const parseDate = (dateString: string): Date => {
//     try {
//       // Handle different date formats
//       if (dateString.includes('T') || dateString.includes('Z')) {
//         return new Date(dateString);
//       } else {
//         // Assume YYYY-MM-DD format and set to noon to avoid timezone issues
//         return new Date(dateString + 'T12:00:00.000Z');
//       }
//     } catch (error) {
//       console.warn('Failed to parse date:', dateString);
//       return new Date(); // Fallback to current date
//     }
//   };

//   const fetchAllHistoricalReports = async (historyDates: string[]) => {
//     console.log('Attempting to fetch all historical reports...');
//     const historicalReports: Record<string, any> = {};
    
//     // Try to fetch all historical reports in parallel
//     const fetchPromises = historyDates.map(async (dateString) => {
//       try {
//         // Try different endpoints for historical data
//         const endpoints = [
//           `${API_BASE_URL}/market_intelligence?date=${dateString}`,
//           `${API_BASE_URL}/market_intelligence/history/${dateString}`,
//           `${API_BASE_URL}/history/${dateString}`
//         ];
        
//         for (const endpoint of endpoints) {
//           try {
//             const response = await fetch(endpoint);
//             if (response.ok) {
//               const data = await response.json();
//               // Store the historical report
//               if (data.report) {
//                 historicalReports[dateString] = data.report;
//               } else if (data.timestamp || data.data) {
//                 historicalReports[dateString] = data;
//               }
//               break; // Success, break out of endpoint loop
//             }
//           } catch (endpointErr) {
//             console.log(`Endpoint ${endpoint} failed:`, endpointErr);
//           }
//         }
//       } catch (err) {
//         console.log(`Failed to fetch report for ${dateString}:`, err);
//       }
//     });
    
//     await Promise.allSettled(fetchPromises);
//     return historicalReports;
//   };

//   const fetchHistoryData = async () => {
//     setIsLoading(true);
//     setError(null);
    
//     try {
//       const response = await fetch(`${API_BASE_URL}/market_intelligence`);
      
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
      
//       const data: MarketIntelligenceResponse = await response.json();
//       console.log('API Response:', data);
//       console.log('Report History:', data.report_history);
//       console.log('Current Report:', data.report);
      
//       let historyEntries: DataHistoryEntry[] = [];
//       let historicalReports: Record<string, any> = {};
      
//       // Try to fetch all historical reports if we have history dates
//       if (data.report_history && Array.isArray(data.report_history) && data.report_history.length > 0) {
//         // Check if report_history contains full objects or just dates
//         const firstItem = data.report_history[0];
//         const hasFullObjects = typeof firstItem === 'object' && firstItem.timestamp;
        
//         if (hasFullObjects) {
//           // report_history contains full objects
//           console.log('Report history contains full objects');
//           historyEntries = data.report_history.map((item: any, index: number) => {
//             const timestamp = parseDate(item.timestamp);
//             const isCurrentReport = data.report?.timestamp === item.timestamp;
            
//             return {
//               timestamp,
//               rawTimestamp: item.timestamp,
//               type: 'report_generated' as const,
//               status: 'success' as const,
//               source: 'api' as const,
//               details: isCurrentReport 
//                 ? `Current report: ${item.summary || item.timestamp}` 
//                 : `Historical report: ${item.summary || item.timestamp}`,
//               dataSize: Object.keys(item.data || {}).length,
//               reportData: item
//             };
//           });
//         } else {
//           // report_history contains only dates - try to fetch full data
//           console.log('Attempting to fetch full historical data...');
//           historicalReports = await fetchAllHistoricalReports(data.report_history);
          
//           historyEntries = data.report_history.map((dateString: string, index: number) => {
//             const timestamp = parseDate(dateString);
//             const isCurrentReport = data.report?.timestamp === dateString;
//             const historicalData = historicalReports[dateString];
            
//             return {
//               timestamp,
//               rawTimestamp: dateString,
//               type: 'report_generated' as const,
//               status: historicalData ? 'success' as const : 'loading' as const,
//               source: 'api' as const,
//               details: isCurrentReport 
//                 ? `Current report generated (${dateString})` 
//                 : historicalData 
//                   ? `Historical report from ${dateString} (Loaded)`
//                   : `Historical report from ${dateString} (Click to load)`,
//               dataSize: isCurrentReport 
//                 ? Object.keys(data.report?.data || {}).length 
//                 : historicalData 
//                   ? Object.keys(historicalData.data || historicalData || {}).length 
//                   : undefined,
//               reportData: isCurrentReport ? data.report : historicalData
//             };
//           });
//         }
        
//         // Sort by timestamp (most recent first)
//         historyEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
//       }
      
//       // If no history but we have a current report, create an entry for it
//       if (historyEntries.length === 0 && data.report) {
//         console.log('Creating entry for current report only');
//         const timestamp = parseDate(data.report.timestamp);
        
//         historyEntries = [{
//           timestamp,
//           rawTimestamp: data.report.timestamp,
//           type: 'report_generated' as const,
//           status: 'success' as const,
//           source: 'api' as const,
//           details: `Market intelligence report (${data.report.timestamp})`,
//           dataSize: Object.keys(data.report.data || {}).length,
//           reportData: data.report
//         }];
//       }

//       // Add a current fetch entry at the top to show the API call
//       const successfulHistoricalFetches = Object.keys(historicalReports).length;
//       const currentFetchEntry: DataHistoryEntry = {
//         timestamp: new Date(),
//         rawTimestamp: new Date().toISOString(),
//         type: 'refresh' as const,
//         status: 'success' as const,
//         source: 'api' as const,
//         details: `Loaded ${data.report_history?.length || 0} historical entries. Current: ${data.report?.timestamp || 'N/A'}. ${successfulHistoricalFetches > 0 ? `Pre-loaded ${successfulHistoricalFetches} reports.` : ''}`,
//         dataSize: data.report ? Object.keys(data.report.data || {}).length : 0,
//         reportData: data.report
//       };

//       setHistoryEntries([currentFetchEntry, ...historyEntries]);
      
//     } catch (err) {
//       console.error('Error fetching history:', err);
//       setError(err instanceof Error ? err.message : 'Failed to fetch history data');
      
//       const errorEntry: DataHistoryEntry = {
//         timestamp: new Date(),
//         rawTimestamp: new Date().toISOString(),
//         type: 'fetch' as const,
//         status: 'error' as const,
//         source: 'api' as const,
//         details: `Failed to fetch history: ${err instanceof Error ? err.message : 'Unknown error'}`
//       };
//       setHistoryEntries([errorEntry]);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const fetchSpecificReport = async (dateString: string) => {
//     setLoadingReport(dateString);
    
//     try {
//       // Check if we already have the report data
//       const entry = historyEntries.find(e => e.rawTimestamp === dateString);
//       if (entry?.reportData) {
//         setSelectedReport(entry.reportData);
        
//         setHistoryEntries(prev => prev.map(historyEntry => 
//           historyEntry.rawTimestamp === dateString 
//             ? { ...historyEntry, status: 'success' as const, details: entry.details + ' (Loaded)' }
//             : historyEntry
//         ));
//         return;
//       }

//       // Try multiple approaches to fetch historical data
//       let reportData = null;
      
//       // Approach 1: Try fetching with date parameter
//       try {
//         const responseWithDate = await fetch(`${API_BASE_URL}/market_intelligence?date=${dateString}`);
//         if (responseWithDate.ok) {
//           const dataWithDate = await responseWithDate.json();
//           if (dataWithDate.report && dataWithDate.report.timestamp === dateString) {
//             reportData = dataWithDate.report;
//           }
//         }
//       } catch (err) {
//         console.log('Date parameter approach failed:', err);
//       }
      
//       // Approach 2: Try dedicated history endpoint
//       if (!reportData) {
//         try {
//           const historyResponse = await fetch(`${API_BASE_URL}/market_intelligence/history/${dateString}`);
//           if (historyResponse.ok) {
//             reportData = await historyResponse.json();
//           }
//         } catch (err) {
//           console.log('History endpoint approach failed:', err);
//         }
//       }
      
//       // Approach 3: Try alternative history endpoint format
//       if (!reportData) {
//         try {
//           const altHistoryResponse = await fetch(`${API_BASE_URL}/history/${dateString}`);
//           if (altHistoryResponse.ok) {
//             reportData = await altHistoryResponse.json();
//           }
//         } catch (err) {
//           console.log('Alternative history endpoint failed:', err);
//         }
//       }
      
//       // Approach 4: Check if current endpoint returns expanded history
//       if (!reportData) {
//         const response = await fetch(`${API_BASE_URL}/market_intelligence`);
//         if (response.ok) {
//           const data: MarketIntelligenceResponse = await response.json();
          
//           // Check if report_history now contains full objects instead of just dates
//           if (Array.isArray(data.report_history)) {
//             const historicalReport = data.report_history.find((item: any) => {
//               return (typeof item === 'object' && item.timestamp === dateString) ||
//                      (typeof item === 'string' && item === dateString);
//             });
            
//             if (historicalReport && typeof historicalReport === 'object') {
//               reportData = historicalReport;
//             }
//           }
          
//           // Also check current report
//           if (!reportData && data.report && data.report.timestamp === dateString) {
//             reportData = data.report;
//           }
//         }
//       }
      
//       if (reportData) {
//         setSelectedReport(reportData);
        
//         setHistoryEntries(prev => prev.map(historyEntry => 
//           historyEntry.rawTimestamp === dateString 
//             ? { 
//                 ...historyEntry, 
//                 status: 'success' as const, 
//                 details: `Report from ${dateString} (Loaded)`,
//                 reportData: reportData,
//                 dataSize: Object.keys(reportData.data || reportData || {}).length
//               }
//             : historyEntry
//         ));
//       } else {
//         throw new Error(`Historical report for ${dateString} is not available. Please implement one of the backend approaches.`);
//       }
      
//     } catch (err) {
//       console.error('Error loading specific report:', err);
      
//       setHistoryEntries(prev => prev.map(entry => 
//         entry.rawTimestamp === dateString 
//           ? { 
//               ...entry, 
//               status: 'error' as const, 
//               details: `Failed to load report: ${err instanceof Error ? err.message : 'Unknown error'}`
//             }
//           : entry
//       ));
//     } finally {
//       setLoadingReport(null);
//     }
//   };

//   const refreshHistory = async () => {
//     setHistoryEntries([]);
//     setSelectedReport(null);
//     await fetchHistoryData();
//   };

//   const getStatusIcon = (status: string) => {
//     switch (status) {
//       case 'success':
//         return <CheckCircle className="h-4 w-4 text-green-600" />;
//       case 'error':
//         return <XCircle className="h-4 w-4 text-red-600" />;
//       case 'loading':
//         return <Clock className="h-4 w-4 text-yellow-600" />;
//       default:
//         return <Clock className="h-4 w-4 text-gray-600" />;
//     }
//   };

//   const getStatusBadge = (status: string) => {
//     const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
//       success: "default",
//       error: "destructive",
//       loading: "secondary"
//     };
    
//     return (
//       <Badge variant={variants[status] || "outline"} className="text-xs">
//         {status}
//       </Badge>
//     );
//   };

//   const getTypeIcon = (type: string) => {
//     switch (type) {
//       case 'refresh':
//         return <RefreshCw className="h-4 w-4 text-blue-600" />;
//       case 'scout_trigger':
//         return <RefreshCw className="h-4 w-4 text-purple-600" />;
//       case 'report_generated':
//         return <BarChart3 className="h-4 w-4 text-green-600" />;
//       default:
//         return <History className="h-4 w-4 text-gray-600" />;
//     }
//   };

//   const formatTimeAgo = (timestamp: Date) => {
//     const now = new Date();
//     const diffMs = now.getTime() - timestamp.getTime();
//     const diffMins = Math.floor(diffMs / (1000 * 60));
//     const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
//     const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

//     if (diffMins < 1) {
//       return 'Just now';
//     } else if (diffMins < 60) {
//       return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
//     } else if (diffHours < 24) {
//       return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
//     } else {
//       return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
//     }
//   };

//   const formatDate = (dateString: string) => {
//     try {
//       const date = parseDate(dateString);
//       return date.toLocaleDateString('en-US', {
//         year: 'numeric',
//         month: 'short',
//         day: 'numeric'
//       });
//     } catch (error) {
//       return dateString;
//     }
//   };

//   return (
//     <Dialog open={isOpen} onOpenChange={setIsOpen}>
//       <DialogTrigger asChild>
//         <Button
//           variant="outline"
//           size="sm"
//           className="flex items-center gap-2"
//         >
//           <History className="h-4 w-4" />
//           History
//         </Button>
//       </DialogTrigger>
//       <DialogContent className="max-w-3xl max-h-[80vh]">
//         <DialogHeader>
//           <DialogTitle className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <History className="h-5 w-5" />
//               Market Intelligence History
//               {historyEntries.length > 0 && (
//                 <Badge variant="secondary" className="ml-2">
//                   {historyEntries.length} entries
//                 </Badge>
//               )}
//             </div>
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={refreshHistory}
//               disabled={isLoading}
//               className="flex items-center gap-1"
//             >
//               {isLoading ? (
//                 <Loader2 className="h-4 w-4 animate-spin" />
//               ) : (
//                 <RefreshCw className="h-4 w-4" />
//               )}
//               Refresh
//             </Button>
//           </DialogTitle>
//         </DialogHeader>
        
//         {error && (
//           <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
//             <p className="text-sm text-red-600">
//               <XCircle className="h-4 w-4 inline mr-1" />
//               {error}
//             </p>
//           </div>
//         )}
        
//         <ScrollArea className="max-h-[60vh] pr-4">
//           {isLoading && historyEntries.length === 0 ? (
//             <div className="flex items-center justify-center py-8">
//               <Loader2 className="h-6 w-6 animate-spin mr-2" />
//               Loading history...
//             </div>
//           ) : historyEntries.length === 0 ? (
//             <div className="text-center py-8 text-gray-500">
//               <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
//               <p>No history data available</p>
//               <p className="text-sm mt-1">Try refreshing to load recent data</p>
//             </div>
//           ) : (
//             <div className="space-y-3">
//               {historyEntries.map((entry, index) => (
//                 <div key={index} className="flex items-start gap-3 p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors">
//                   <div className="flex-shrink-0 mt-1">
//                     {getTypeIcon(entry.type)}
//                   </div>
                  
//                   <div className="flex-1 min-w-0">
//                     <div className="flex items-center justify-between gap-2 mb-2">
//                       <div className="flex items-center gap-2">
//                         <span className="font-medium text-sm capitalize">
//                           {entry.type.replace('_', ' ')}
//                         </span>
//                         {getStatusBadge(entry.status)}
//                         {entry.rawTimestamp && entry.rawTimestamp !== new Date().toISOString().split('T')[0] && (
//                           <Badge variant="outline" className="text-xs">
//                             {formatDate(entry.rawTimestamp)}
//                           </Badge>
//                         )}
//                       </div>
                      
//                       <div className="flex items-center gap-2 text-xs text-gray-500">
//                         {getStatusIcon(entry.status)}
//                         <span>{formatTimeAgo(entry.timestamp)}</span>
//                       </div>
//                     </div>
                    
//                     <p className="text-sm text-gray-600 mb-3 line-clamp-2">
//                       {entry.details}
//                     </p>
                    
//                     <div className="flex items-center justify-between">
//                       <div className="flex items-center gap-4 text-xs text-gray-500">
//                         <span className="flex items-center gap-1">
//                           <span className={`w-2 h-2 rounded-full ${
//                             entry.source === 'api' ? 'bg-blue-500' : 'bg-green-500'
//                           }`} />
//                           {entry.source === 'api' ? 'Live data' : 'Cached'}
//                         </span>
                        
//                         {entry.dataSize !== undefined && (
//                           <span className="flex items-center gap-1">
//                             <BarChart3 className="h-3 w-3" />
//                             {entry.dataSize} items
//                           </span>
//                         )}
                        
//                         <span className="flex items-center gap-1 text-gray-400">
//                           <Calendar className="h-3 w-3" />
//                           {entry.timestamp.toLocaleString()}
//                         </span>
//                       </div>
                      
//                       {entry.rawTimestamp && entry.type === 'report_generated' && (
//                         <Button
//                           variant="ghost"
//                           size="sm"
//                           onClick={() => fetchSpecificReport(entry.rawTimestamp!)}
//                           disabled={loadingReport === entry.rawTimestamp}
//                           className="text-xs h-7 px-3 hover:bg-blue-50"
//                         >
//                           {loadingReport === entry.rawTimestamp ? (
//                             <>
//                               <Loader2 className="h-3 w-3 animate-spin mr-1" />
//                               Loading...
//                             </>
//                           ) : (
//                             <>
//                               <TrendingUp className="h-3 w-3 mr-1" />
//                               View Report
//                             </>
//                           )}
//                         </Button>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </ScrollArea>
        
//         {selectedReport && (
//           <div className="pt-4 border-t">
//             <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
//               <div className="flex items-center gap-2 mb-2">
//                 <CheckCircle className="h-5 w-5 text-blue-600" />
//                 <p className="text-sm font-medium text-blue-800">Report Loaded Successfully</p>
//               </div>
//               <p className="text-xs text-blue-600">
//                 Report from {selectedReport.timestamp} with {Object.keys(selectedReport.data || {}).length} data points is now available
//               </p>
//             </div>
//           </div>
//         )}
        
//         <div className="pt-4 border-t">
//           <div className="flex items-center justify-between text-xs text-gray-500">
//             <span>Market Intelligence API • Live data tracking</span>
//             <span className="flex items-center gap-1">
//               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
//               Connected
//             </span>
//           </div>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// };




// with clickable timestamp alone

// import { useState, useEffect } from "react";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Badge } from "@/components/ui/badge";
// import { History, RefreshCw, CheckCircle, XCircle, Loader2, Calendar, TrendingUp, BarChart3, Clock } from "lucide-react";

// interface MarketIntelligenceResponse {
//   report: {
//     timestamp: string;
//     data: any;
//     [key: string]: any;
//   };
//   report_history: string[]; // Array of timestamp strings
//   [key: string]: any;
// }

// const API_BASE_URL = 'https://backend-11kr.onrender.com';

// export const DataHistoryDialog = () => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [reportHistory, setReportHistory] = useState<string[]>([]);
//   const [currentReport, setCurrentReport] = useState<any>(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [selectedReport, setSelectedReport] = useState<any>(null);
//   const [loadingTimestamp, setLoadingTimestamp] = useState<string | null>(null);

//   useEffect(() => {
//     if (isOpen && reportHistory.length === 0) {
//       fetchHistoryData();
//     }
//   }, [isOpen]);

//   const parseTimestamp = (timestamp: string): Date => {
//     try {
//       return new Date(timestamp);
//     } catch (error) {
//       console.warn('Failed to parse timestamp:', timestamp);
//       return new Date();
//     }
//   };

//   const fetchHistoryData = async () => {
//     setIsLoading(true);
//     setError(null);
    
//     try {
//       const response = await fetch(`${API_BASE_URL}/market_intelligence`);
      
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
      
//       const data: MarketIntelligenceResponse = await response.json();
//       console.log('API Response:', data);
      
//       // Set current report
//       if (data.report) {
//         setCurrentReport(data.report);
//       }
      
//       // Set report history (sorted by timestamp, most recent first)
//       if (data.report_history && Array.isArray(data.report_history)) {
//         const sortedHistory = [...data.report_history].sort((a, b) => 
//           new Date(b).getTime() - new Date(a).getTime()
//         );
//         setReportHistory(sortedHistory);
//       }
      
//     } catch (err) {
//       console.error('Error fetching history:', err);
//       setError(err instanceof Error ? err.message : 'Failed to fetch history data');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const fetchSpecificReport = async (timestamp: string) => {
//     setLoadingTimestamp(timestamp);
    
//     try {
//       // Make API call with timestamp parameter
//       const response = await fetch(`${API_BASE_URL}/market_intelligence?timestamp=${timestamp}`);
      
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
      
//       const data = await response.json();
      
//       // Set the selected report (could be data.report or data itself depending on API structure)
//       const reportData = data.report || data;
//       setSelectedReport(reportData);
      
//       console.log(`Loaded report for ${timestamp}:`, reportData);
      
//     } catch (err) {
//       console.error(`Error loading report for ${timestamp}:`, err);
//       setError(`Failed to load report for ${timestamp}: ${err instanceof Error ? err.message : 'Unknown error'}`);
//     } finally {
//       setLoadingTimestamp(null);
//     }
//   };

//   const refreshHistory = async () => {
//     setReportHistory([]);
//     setCurrentReport(null);
//     setSelectedReport(null);
//     await fetchHistoryData();
//   };

//   const formatTimestamp = (timestamp: string) => {
//     try {
//       const date = parseTimestamp(timestamp);
//       return {
//         date: date.toLocaleDateString('en-US', {
//           year: 'numeric',
//           month: 'short',
//           day: 'numeric'
//         }),
//         time: date.toLocaleTimeString('en-US', {
//           hour: '2-digit',
//           minute: '2-digit',
//           second: '2-digit'
//         }),
//         full: date.toLocaleString('en-US')
//       };
//     } catch (error) {
//       return {
//         date: timestamp,
//         time: '',
//         full: timestamp
//       };
//     }
//   };

//   const isCurrentReport = (timestamp: string) => {
//     return currentReport && currentReport.timestamp === timestamp;
//   };

//   return (
//     <Dialog open={isOpen} onOpenChange={setIsOpen}>
//       <DialogTrigger asChild>
//         <Button
//           variant="outline"
//           size="sm"
//           className="flex items-center gap-2"
//         >
//           <History className="h-4 w-4" />
//           History
//         </Button>
//       </DialogTrigger>
//       <DialogContent className="max-w-2xl max-h-[80vh]">
//         <DialogHeader>
//           <DialogTitle className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <History className="h-5 w-5" />
//               Report History
//               {reportHistory.length > 0 && (
//                 <Badge variant="secondary" className="ml-2">
//                   {reportHistory.length} reports
//                 </Badge>
//               )}
//             </div>
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={refreshHistory}
//               disabled={isLoading}
//               className="flex items-center gap-1"
//             >
//               {isLoading ? (
//                 <Loader2 className="h-4 w-4 animate-spin" />
//               ) : (
//                 <RefreshCw className="h-4 w-4" />
//               )}
//               Refresh
//             </Button>
//           </DialogTitle>
//         </DialogHeader>
        
//         {error && (
//           <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
//             <p className="text-sm text-red-600">
//               <XCircle className="h-4 w-4 inline mr-1" />
//               {error}
//             </p>
//           </div>
//         )}
        
//         <ScrollArea className="max-h-[50vh] pr-4">
//           {isLoading && reportHistory.length === 0 ? (
//             <div className="flex items-center justify-center py-8">
//               <Loader2 className="h-6 w-6 animate-spin mr-2" />
//               Loading report history...
//             </div>
//           ) : reportHistory.length === 0 ? (
//             <div className="text-center py-8 text-gray-500">
//               <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
//               <p>No report history available</p>
//               <p className="text-sm mt-1">Try refreshing to load recent data</p>
//             </div>
//           ) : (
//             <div className="space-y-2">
//               {reportHistory.map((timestamp, index) => {
//                 const formatted = formatTimestamp(timestamp);
//                 const isCurrent = isCurrentReport(timestamp);
//                 const isLoading = loadingTimestamp === timestamp;
                
//                 return (
//                   <div 
//                     key={timestamp}
//                     className={`
//                       flex items-center justify-between p-4 border rounded-lg transition-all cursor-pointer
//                       ${isCurrent 
//                         ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
//                         : 'bg-white hover:bg-gray-50 border-gray-200'
//                       }
//                       ${isLoading ? 'opacity-75' : ''}
//                     `}
//                     onClick={() => !isLoading && fetchSpecificReport(timestamp)}
//                   >
//                     <div className="flex items-center gap-3">
//                       <div className="flex-shrink-0">
//                         <BarChart3 className={`h-5 w-5 ${isCurrent ? 'text-blue-600' : 'text-gray-500'}`} />
//                       </div>
                      
//                       <div className="flex-1">
//                         <div className="flex items-center gap-2 mb-1">
//                           <span className="font-medium text-sm">
//                             Report #{reportHistory.length - index}
//                           </span>
//                           {isCurrent && (
//                             <Badge variant="default" className="text-xs">
//                               Current
//                             </Badge>
//                           )}
//                         </div>
                        
//                         <div className="flex items-center gap-4 text-xs text-gray-500">
//                           <span className="flex items-center gap-1">
//                             <Calendar className="h-3 w-3" />
//                             {formatted.date}
//                           </span>
//                           <span className="flex items-center gap-1">
//                             <Clock className="h-3 w-3" />
//                             {formatted.time}
//                           </span>
//                         </div>
//                       </div>
//                     </div>
                    
//                     <div className="flex items-center gap-2">
//                       {isLoading ? (
//                         <>
//                           <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
//                           <span className="text-xs text-blue-600">Loading...</span>
//                         </>
//                       ) : (
//                         <Button
//                           variant="ghost"
//                           size="sm"
//                           className="text-xs h-7 px-3 hover:bg-blue-50"
//                           onClick={(e) => {
//                             e.stopPropagation();
//                             fetchSpecificReport(timestamp);
//                           }}
//                         >
//                           <TrendingUp className="h-3 w-3 mr-1" />
//                           Load Report
//                         </Button>
//                       )}
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </ScrollArea>
        
//         {selectedReport && (
//           <div className="pt-4 border-t">
//             <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
//               <div className="flex items-center gap-2 mb-2">
//                 <CheckCircle className="h-5 w-5 text-green-600" />
//                 <p className="text-sm font-medium text-green-800">Report Loaded Successfully</p>
//               </div>
//               <div className="text-xs text-green-600 space-y-1">
//                 <p>
//                   <strong>Timestamp:</strong> {selectedReport.timestamp}
//                 </p>
//                 <p>
//                   <strong>Data Points:</strong> {Object.keys(selectedReport.data || selectedReport || {}).length}
//                 </p>
//               </div>
//             </div>
//           </div>
//         )}
        
//         <div className="pt-4 border-t">
//           <div className="flex items-center justify-between text-xs text-gray-500">
//             <span>Market Intelligence API • Historical Reports</span>
//             <span className="flex items-center gap-1">
//               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
//               Connected
//             </span>
//           </div>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// };


// with reports generated with clickable timestamp

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, RefreshCw, CheckCircle, XCircle, Loader2, Calendar, TrendingUp, BarChart3, Clock } from "lucide-react";

interface MarketIntelligenceResponse {
  report: {
    timestamp: string;
    data: any;
    [key: string]: any;
  };
  report_history: string[]; // Array of timestamp strings
  [key: string]: any;
}

const API_BASE_URL = 'https://backend-11kr.onrender.com';

interface DataHistoryDialogProps {
  onReportSelected?: (reportData: any) => void;
}

export const DataHistoryDialog = ({ onReportSelected }: DataHistoryDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reportHistory, setReportHistory] = useState<string[]>([]);
  const [currentReport, setCurrentReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [loadingTimestamp, setLoadingTimestamp] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && reportHistory.length === 0) {
      fetchHistoryData();
    }
  }, [isOpen]);

  const parseTimestamp = (timestamp: string): Date => {
    try {
      return new Date(timestamp);
    } catch (error) {
      console.warn('Failed to parse timestamp:', timestamp);
      return new Date();
    }
  };

  const fetchHistoryData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/market_intelligence`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: MarketIntelligenceResponse = await response.json();
      console.log('API Response:', data);
      
      // Set current report
      if (data.report) {
        setCurrentReport(data.report);
      }
      
      // Set report history (sorted by timestamp, most recent first)
      if (data.report_history && Array.isArray(data.report_history)) {
        const sortedHistory = [...data.report_history].sort((a, b) => 
          new Date(b).getTime() - new Date(a).getTime()
        );
        setReportHistory(sortedHistory);
      }
      
    } catch (err) {
      console.error('Error fetching history:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch history data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSpecificReport = async (timestamp: string) => {
    setLoadingTimestamp(timestamp);
    
    try {
      // Make API call with timestamp parameter
      const response = await fetch(`${API_BASE_URL}/market_intelligence?timestamp=${timestamp}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Set the selected report (could be data.report or data itself depending on API structure)
      const reportData = data.report || data;
      setSelectedReport(reportData);
      
      console.log(`Loaded report for ${timestamp}:`, reportData);
      
      // Notify parent component about the selected report
      if (onReportSelected) {
        onReportSelected(reportData);
      }
      
      // Close the dialog after successful report selection
      setIsOpen(false);
      
    } catch (err) {
      console.error(`Error loading report for ${timestamp}:`, err);
      setError(`Failed to load report for ${timestamp}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingTimestamp(null);
    }
  };

  const refreshHistory = async () => {
    setReportHistory([]);
    setCurrentReport(null);
    setSelectedReport(null);
    await fetchHistoryData();
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = parseTimestamp(timestamp);
      return {
        date: date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        time: date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        full: date.toLocaleString('en-US')
      };
    } catch (error) {
      return {
        date: timestamp,
        time: '',
        full: timestamp
      };
    }
  };

  const isCurrentReport = (timestamp: string) => {
    return currentReport && currentReport.timestamp === timestamp;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <History className="h-4 w-4" />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Report History
              {reportHistory.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {reportHistory.length} reports
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshHistory}
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              <XCircle className="h-4 w-4 inline mr-1" />
              {error}
            </p>
          </div>
        )}
        
        <ScrollArea className="max-h-[50vh] pr-4">
          {isLoading && reportHistory.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading report history...
            </div>
          ) : reportHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No report history available</p>
              <p className="text-sm mt-1">Try refreshing to load recent data</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reportHistory.map((timestamp, index) => {
                const formatted = formatTimestamp(timestamp);
                const isCurrent = isCurrentReport(timestamp);
                const isLoading = loadingTimestamp === timestamp;
                
                return (
                  <div 
                    key={timestamp}
                    className={`
                      flex items-center justify-between p-4 border rounded-lg transition-all cursor-pointer
                      ${isCurrent 
                        ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                        : 'bg-white hover:bg-gray-50 border-gray-200'
                      }
                      ${isLoading ? 'opacity-75' : ''}
                    `}
                    onClick={() => !isLoading && fetchSpecificReport(timestamp)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <BarChart3 className={`h-5 w-5 ${isCurrent ? 'text-blue-600' : 'text-gray-500'}`} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            Report #{reportHistory.length - index}
                          </span>
                          {isCurrent && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatted.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatted.time}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                          <span className="text-xs text-blue-600">Loading...</span>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-3 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchSpecificReport(timestamp);
                          }}
                        >
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Load Report
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        {selectedReport && (
          <div className="pt-4 border-t">
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-800">Report Loaded Successfully</p>
              </div>
              <div className="text-xs text-green-600 space-y-1">
                <p>
                  <strong>Timestamp:</strong> {selectedReport.timestamp}
                </p>
                <p>
                  <strong>Data Points:</strong> {Object.keys(selectedReport.data || selectedReport || {}).length}
                </p>
              </div>  
            </div>
          </div>
        )}
        
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Market Intelligence API • Historical Reports</span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Connected
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};