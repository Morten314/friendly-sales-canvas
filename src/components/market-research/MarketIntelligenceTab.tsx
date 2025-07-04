// import React from 'react';
// import {
//   BarChart3,
//   Bot,
//   Edit,
//   Target,
//   TrendingUp,
//   PieChart,
//   X,
//   FileText,
//   Save,
//   Share,
//   Clock,
// } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';
// import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// import { Badge } from '@/components/ui/badge';
// import MiniPieChart from '@/components/ui/MiniPieChart';
// import MiniLineChart from '@/components/ui/MiniLineChart';

// interface EditRecord {
//   id: string;
//   timestamp: string;
//   user: string;
//   summary: string;
//   field: string;
//   oldValue: string;
//   newValue: string;
// }

// interface MarketIntelligenceTabProps {
//   isEditing: boolean;
//   isSplitView: boolean;
//   isExpanded: boolean;
//   hasEdits: boolean;
//   deletedSections: Set<string>;
//   editHistory: EditRecord[];
//   executiveSummary: string;
//   tamValue: string;
//   samValue: string;
//   apacGrowthRate: string;
//   strategicRecommendations: string[];
//   marketEntry: string;
//   marketDrivers: string[];
//   onToggleEdit: () => void;
//   onScoutIconClick: () => void;
//   onEditHistoryOpen: () => void;
//   onDeleteSection: (sectionId: string) => void;
//   onSaveChanges: () => void;
//   onCancelEdit: () => void;
//   onExpandToggle: (expanded: boolean) => void;
//   onExecutiveSummaryChange: (value: string) => void;
//   onTamValueChange: (value: string) => void;
//   onSamValueChange: (value: string) => void;
//   onApacGrowthRateChange: (value: string) => void;
//   onStrategicRecommendationsChange: (recommendations: string[]) => void;
//   onMarketEntryChange: (value: string) => void;
//   onMarketDriversChange: (drivers: string[]) => void;
//   onExportPDF: () => void;
//   onSaveToWorkspace: () => void;
//   onGenerateShareableLink: () => void;
// }

// const MarketIntelligenceTab: React.FC<MarketIntelligenceTabProps> = ({
//   isEditing,
//   isSplitView,
//   isExpanded,
//   hasEdits,
//   deletedSections,
//   editHistory,
//   executiveSummary,
//   tamValue,
//   samValue,
//   apacGrowthRate,
//   strategicRecommendations,
//   marketEntry,
//   marketDrivers,
//   onToggleEdit,
//   onScoutIconClick,
//   onEditHistoryOpen,
//   onDeleteSection,
//   onSaveChanges,
//   onCancelEdit,
//   onExpandToggle,
//   onExecutiveSummaryChange,
//   onTamValueChange,
//   onSamValueChange,
//   onApacGrowthRateChange,
//   onStrategicRecommendationsChange,
//   onMarketEntryChange,
//   onMarketDriversChange,
//   onExportPDF,
//   onSaveToWorkspace,
//   onGenerateShareableLink
// }) => {
//   const [competitorExpanded, setCompetitorExpanded] = React.useState(true);

//   return (
//     <div className={`${isSplitView ? 'w-3/5' : 'flex-1'} transition-all duration-500 space-y-6`}>
//       {/* Market Size & Opportunity Section */}
//       <div className="bg-white rounded-lg border border-gray-200 p-6">
//         <div className="flex items-center justify-between mb-6">
//           <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
//             <BarChart3 className="h-5 w-5 text-blue-600" />
//             Market Size & Opportunity
//           </h2>
//           <div className="flex items-center gap-3">
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={onToggleEdit}
//               className="text-blue-800 hover:text-blue-900"
//             >
//               <Edit className="h-4 w-4" />
//             </Button>
//             {!isSplitView && (
//               <Tooltip>
//                 <TooltipTrigger asChild>
//                   <Button
//                     variant="ghost"
//                     size="sm"
//                     onClick={onScoutIconClick}
//                     className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 hover:shadow-md hover:shadow-blue-200/50 relative"
//                   >
//                     <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
//                     <Bot className="h-5 w-5 relative z-10" />
//                   </Button>
//                 </TooltipTrigger>
//                 <TooltipContent>
//                   <p>Explore More with Scout</p>
//                 </TooltipContent>
//               </Tooltip>
//             )}
//           </div>
//         </div>

//         {isEditing ? (
//           <div className="space-y-8">
//             {/* Executive Summary Edit */}
//             {!deletedSections.has('executive-summary') && (
//               <div className="relative group">
//                 <Tooltip>
//                   <TooltipTrigger asChild>
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       onClick={() => onDeleteSection('executive-summary')}
//                       className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
//                     >
//                       <X className="h-4 w-4" />
//                     </Button>
//                   </TooltipTrigger>
//                   <TooltipContent>
//                     <p>Delete this section</p>
//                   </TooltipContent>
//                 </Tooltip>
//                 <div>
//                   <Label htmlFor="executiveSummary" className="text-sm font-medium text-gray-700 mb-2 block">
//                     Executive Summary
//                   </Label>
//                   <Textarea
//                     id="executiveSummary"
//                     value={executiveSummary}
//                     onChange={(e) => onExecutiveSummaryChange(e.target.value)}
//                     className="w-full h-32 resize-none"
//                     placeholder="Enter executive summary..."
//                   />
//                 </div>
//               </div>
//             )}

//             {/* Key Metrics Edit */}
//             {!deletedSections.has('key-metrics') && (
//               <div className="relative group">
//                 <Tooltip>
//                   <TooltipTrigger asChild>
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       onClick={() => onDeleteSection('key-metrics')}
//                       className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
//                     >
//                       <X className="h-4 w-4" />
//                     </Button>
//                   </TooltipTrigger>
//                   <TooltipContent>
//                     <p>Delete this section</p>
//                   </TooltipContent>
//                 </Tooltip>
//                 <div>
//                   <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
//                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//                     <div>
//                       <Label htmlFor="tamValue" className="text-sm font-medium text-gray-700 mb-2 block">
//                         Total Addressable Market
//                       </Label>
//                       <Input
//                         id="tamValue"
//                         value={tamValue}
//                         onChange={(e) => onTamValueChange(e.target.value)}
//                         placeholder="e.g., $4.2B"
//                       />
//                     </div>
//                     <div>
//                       <Label htmlFor="samValue" className="text-sm font-medium text-gray-700 mb-2 block">
//                         Serviceable Addressable Market
//                       </Label>
//                       <Input
//                         id="samValue"
//                         value={samValue}
//                         onChange={(e) => onSamValueChange(e.target.value)}
//                         placeholder="e.g., $2.1B"
//                       />
//                     </div>
//                     <div>
//                       <Label htmlFor="apacGrowthRate" className="text-sm font-medium text-gray-700 mb-2 block">
//                         APAC Growth Rate
//                       </Label>
//                       <Input
//                         id="apacGrowthRate"
//                         value={apacGrowthRate}
//                         onChange={(e) => onApacGrowthRateChange(e.target.value)}
//                         placeholder="e.g., 25%"
//                       />
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Strategic Recommendations Edit */}
//             {!deletedSections.has('strategic-recommendations') && (
//               <div className="relative group">
//                 <Tooltip>
//                   <TooltipTrigger asChild>
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       onClick={() => onDeleteSection('strategic-recommendations')}
//                       className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
//                     >
//                       <X className="h-4 w-4" />
//                     </Button>
//                   </TooltipTrigger>
//                   <TooltipContent>
//                     <p>Delete this section</p>
//                   </TooltipContent>
//                 </Tooltip>
//                 <div>
//                   <Label className="text-sm font-medium text-gray-700 mb-2 block">
//                     Strategic Recommendations
//                   </Label>
//                   {strategicRecommendations.map((rec, index) => (
//                     <Textarea
//                       key={index}
//                       value={rec}
//                       onChange={(e) => {
//                         const newRecs = [...strategicRecommendations];
//                         newRecs[index] = e.target.value;
//                         onStrategicRecommendationsChange(newRecs);
//                       }}
//                       className="w-full h-20 resize-none mb-3"
//                       placeholder={`Strategic recommendation ${index + 1}...`}
//                     />
//                   ))}
//                 </div>
//               </div>
//             )}

//             {/* Market Entry Edit */}
//             {!deletedSections.has('market-entry') && (
//               <div className="relative group">
//                 <Tooltip>
//                   <TooltipTrigger asChild>
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       onClick={() => onDeleteSection('market-entry')}
//                       className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
//                     >
//                       <X className="h-4 w-4" />
//                     </Button>
//                   </TooltipTrigger>
//                   <TooltipContent>
//                     <p>Delete this section</p>
//                   </TooltipContent>
//                 </Tooltip>
//                 <div>
//                   <Label htmlFor="marketEntry" className="text-sm font-medium text-gray-700 mb-2 block">
//                     Market Entry Strategy
//                   </Label>
//                   <Textarea
//                     id="marketEntry"
//                     value={marketEntry}
//                     onChange={(e) => onMarketEntryChange(e.target.value)}
//                     className="w-full h-32 resize-none"
//                     placeholder="Enter market entry strategy..."
//                   />
//                 </div>
//               </div>
//             )}

//             {/* Market Drivers Edit */}
//             {!deletedSections.has('market-drivers') && (
//               <div className="relative group">
//                 <Tooltip>
//                   <TooltipTrigger asChild>
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       onClick={() => onDeleteSection('market-drivers')}
//                       className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
//                     >
//                       <X className="h-4 w-4" />
//                     </Button>
//                   </TooltipTrigger>
//                   <TooltipContent>
//                     <p>Delete this section</p>
//                   </TooltipContent>
//                 </Tooltip>
//                 <div>
//                   <Label className="text-sm font-medium text-gray-700 mb-2 block">
//                     Key Market Drivers
//                   </Label>
//                   {marketDrivers.map((driver, index) => (
//                     <Textarea
//                       key={index}
//                       value={driver}
//                       onChange={(e) => {
//                         const newDrivers = [...marketDrivers];
//                         newDrivers[index] = e.target.value;
//                         onMarketDriversChange(newDrivers);
//                       }}
//                       className="w-full h-16 resize-none mb-3"
//                       placeholder={`Market driver ${index + 1}...`}
//                     />
//                   ))}
//                 </div>
//               </div>
//             )}

//             {/* Save/Cancel Buttons */}
//             <div className="flex items-center gap-3 pt-6 border-t">
//               <Button onClick={onSaveChanges}>Save Changes</Button>
//               <Button variant="outline" onClick={onCancelEdit}>Cancel</Button>
//               <div className="flex-1"></div>
              
//               <Tooltip>
//                 <TooltipTrigger asChild>
//                   <Button
//                     variant="ghost"
//                     size="sm"
//                     onClick={onEditHistoryOpen}
//                     className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${editHistory.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
//                     disabled={editHistory.length === 0}
//                   >
//                     <Clock className="h-4 w-4" />
//                     Edit History
//                   </Button>
//                 </TooltipTrigger>
//                 <TooltipContent>
//                   <p>View changes made to this report</p>
//                 </TooltipContent>
//               </Tooltip>

//               <Tooltip>
//                 <TooltipTrigger asChild>
//                   <Button
//                     variant="ghost"
//                     size="sm"
//                     onClick={onScoutIconClick}
//                     className="text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 hover:shadow-md hover:shadow-blue-200/50 transition-all duration-200 relative"
//                   >
//                     <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
//                     <Bot className="h-4 w-4 relative z-10" />
//                   </Button>
//                 </TooltipTrigger>
//                 <TooltipContent>
//                   <p>Explore More with Scout</p>
//                 </TooltipContent>
//               </Tooltip>
//             </div>

//             {/* Export Options in Edit Mode */}
//             <div className="border-t pt-6">
//               <h4 className="text-sm font-medium text-gray-900 mb-3">Export Options</h4>
//               <div className="flex flex-wrap gap-3">
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   onClick={onExportPDF}
//                   className="flex items-center gap-2"
//                 >
//                   <FileText className="h-4 w-4" />
//                   Save PDF
//                 </Button>
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   onClick={onSaveToWorkspace}
//                   className="flex items-center gap-2"
//                 >
//                   <Save className="h-4 w-4" />
//                   Save to Workspace
//                 </Button>
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   onClick={onGenerateShareableLink}
//                   className="flex items-center gap-2"
//                 >
//                   <Share className="h-4 w-4" />
//                   Shareable Link
//                 </Button>
//               </div>
//             </div>
//           </div>
//         ) : (
//           <div className="space-y-6">
//             {/* Executive Summary - Always Visible */}
//             <div>
//               <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
//                 <BarChart3 className="h-5 w-5 text-blue-600" />
//                 Executive Summary
//               </h3>
//               <p className="text-gray-700 mb-6">{executiveSummary}</p>

//               {/* Key Metrics Cards - Always Visible */}
//               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
//                 <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
//                   <div className="text-2xl font-bold text-blue-600">{tamValue}</div>
//                   <div className="text-sm font-medium text-gray-900">Total Addressable Market</div>
//                   <div className="text-xs text-gray-600">Growing 15% YoY</div>
//                 </div>
//                 <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
//                   <div className="text-2xl font-bold text-green-600">{samValue}</div>
//                   <div className="text-sm font-medium text-gray-900">Serviceable Addressable Market</div>
//                   <div className="text-xs text-gray-600">Mid-market focus</div>
//                 </div>
//                 <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
//                   <div className="text-2xl font-bold text-purple-600">{apacGrowthRate}</div>
//                   <div className="text-sm font-medium text-gray-900">APAC Growth Rate</div>
//                   <div className="text-xs text-gray-600">Fastest growing region</div>
//                 </div>
//               </div>
//             </div>

//             {/* Read More Button - Only show when not expanded and not in split view */}
//             {!isExpanded && !isSplitView && (
//               <Button
//                 variant="secondary"
//                 onClick={() => onExpandToggle(true)}
//                 className="w-full"
//               >
//                 Read More
//               </Button>
//             )}

//             {/* Expanded Content */}
//             {(isExpanded || isSplitView) && (
//               <div className="animate-fade-in space-y-8">
//                 <div className="border-t pt-6">
//                   <h2 className="text-2xl font-bold text-gray-900 mb-8">
//                     Market Size & Opportunity Report
//                   </h2>

//                   {/* Strategic Recommendations */}
//                   <div className="mb-8">
//                     <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
//                       <Target className="h-5 w-5 text-green-600" />
//                       Strategic Recommendations
//                     </h3>
//                     <div className="bg-green-50 p-4 rounded-lg border border-green-200">
//                       <ul className="space-y-2 text-gray-700">
//                         {strategicRecommendations.map((rec, index) => (
//                           <li key={index} className="flex items-start gap-2">
//                             <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
//                             {rec}
//                           </li>
//                         ))}
//                       </ul>
//                     </div>
//                   </div>

//                   {/* Market Entry */}
//                   <div className="mb-8">
//                     <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
//                       <TrendingUp className="h-5 w-5 text-blue-600" />
//                       Market Entry
//                     </h3>
//                     <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
//                       <p className="text-gray-700 mb-4">{marketEntry}</p>
//                     </div>
//                   </div>

//                   {/* Market Opportunity Breakdown */}
//                   <div className="mb-8">
//                     <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
//                       <PieChart className="h-5 w-5 text-purple-600" />
//                       Market Opportunity Breakdown
//                     </h3>

//                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
//                       <div className="bg-white border border-gray-200 rounded-lg p-4">
//                         <h4 className="font-medium text-gray-900 mb-3">Market Size by Segment</h4>
//                         <MiniPieChart 
//                           data={[
//                             { name: "Enterprise", value: 45, color: "#3B82F6" },
//                             { name: "Mid-Market", value: 35, color: "#10B981" },
//                             { name: "SMB", value: 20, color: "#8B5CF6" }
//                           ]}
//                           title=""
//                         />
//                       </div>
//                       <div className="bg-white border border-gray-200 rounded-lg p-4">
//                         <h4 className="font-medium text-gray-900 mb-3">Growth Projections</h4>
//                         <MiniLineChart 
//                           data={[
//                             { name: "2023", value: 100 },
//                             { name: "2024", value: 115 },
//                             { name: "2025", value: 132 },
//                             { name: "2026", value: 152 }
//                           ]}
//                           title=""
//                           color="#3B82F6"
//                         />
//                       </div>
//                     </div>

//                     <div className="bg-gray-50 p-4 rounded-lg">
//                       <h4 className="font-medium text-gray-900 mb-3">Key Market Drivers</h4>
//                       <ul className="space-y-2 text-gray-700">
//                         {marketDrivers.map((driver, index) => (
//                           <li key={index} className="flex items-start gap-2">
//                             <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
//                             {driver}
//                           </li>
//                         ))}
//                       </ul>
//                     </div>
//                   </div>

//                   {/* Export Options */}
//                   <div className="border-t pt-6">
//                     <h4 className="text-sm font-medium text-gray-900 mb-3">Export Options</h4>
//                     <div className="flex flex-wrap gap-3">
//                       <Button
//                         variant="outline"
//                         size="sm"
//                         onClick={onExportPDF}
//                         className="flex items-center gap-2"
//                       >
//                         <FileText className="h-4 w-4" />
//                         Save PDF
//                       </Button>
//                       <Button
//                         variant="outline"
//                         size="sm"
//                         onClick={onSaveToWorkspace}
//                         className="flex items-center gap-2"
//                       >
//                         <Save className="h-4 w-4" />
//                         Save to Workspace
//                       </Button>
//                       <Button
//                         variant="outline"
//                         size="sm"
//                         onClick={onGenerateShareableLink}
//                         className="flex items-center gap-2"
//                       >
//                         <Share className="h-4 w-4" />
//                         Shareable Link
//                       </Button>
//                     </div>
//                   </div>

//                   {/* Show Less Button - Only when not in split view */}
//                   {!isSplitView && (
//                     <Button
//                       variant="secondary"
//                       onClick={() => onExpandToggle(false)}
//                       className="w-full"
//                     >
//                       Show Less
//                     </Button>
//                   )}
//                 </div>
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       {/* Competitor Landscape Section */}
//       <div className="bg-white rounded-lg border border-gray-200 p-6">
//         <div className="flex items-center justify-between mb-6">
//           <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
//             <BarChart3 className="h-5 w-5 text-purple-600" />
//             Competitor Landscape
//           </h2>
//           <div className="flex items-center gap-3">
//             <Button
//               variant="ghost"
//               size="sm"
//               className="text-blue-800 hover:text-blue-900"
//             >
//               <Edit className="h-4 w-4" />
//             </Button>
//             <Tooltip>
//               <TooltipTrigger asChild>
//                 <Button
//                   variant="ghost"
//                   size="sm"
//                   onClick={onScoutIconClick}
//                   className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 hover:shadow-md hover:shadow-blue-200/50 relative"
//                 >
//                   <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
//                   <Bot className="h-5 w-5 relative z-10" />
//                 </Button>
//               </TooltipTrigger>
//               <TooltipContent>
//                 <p>Explore More with Scout</p>
//               </TooltipContent>
//             </Tooltip>
//           </div>
//         </div>

//         <div className="space-y-6">
//           {/* Executive Summary */}
//           <div>
//             <h3 className="text-lg font-semibold text-gray-900 mb-4">Executive Summary</h3>
//             <p className="text-gray-700 mb-4">
//               The enterprise collaboration tools market is increasingly competitive, with several dominant players holding significant market share. However, emerging startups are introducing disruptive features, shifting the landscape rapidly.
//             </p>
            
//             {/* Key Highlights */}
//             <div className="space-y-3 mb-4">
//               <div className="flex items-start gap-2">
//                 <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
//                 <span className="text-gray-700">Top 3 Players: Slack, Microsoft Teams, Zoom</span>
//               </div>
//               <div className="flex items-start gap-2">
//                 <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
//                 <span className="text-gray-700">Emerging Players: Asana, Notion</span>
//               </div>
//               <div className="flex items-start gap-2">
//                 <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
//                 <span className="text-gray-700">Key Moves: $300M funding round by Notion; new AI feature launch by Teams</span>
//               </div>
//             </div>

//             {/* Competitor Tags */}
//             <div className="flex flex-wrap gap-2 mb-6">
//               <Badge variant="secondary" className="bg-blue-100 text-blue-800">Slack</Badge>
//               <Badge variant="secondary" className="bg-blue-100 text-blue-800">Microsoft Teams</Badge>
//               <Badge variant="secondary" className="bg-blue-100 text-blue-800">Zoom</Badge>
//               <Badge variant="outline" className="border-green-300 text-green-700">Asana</Badge>
//               <Badge variant="outline" className="border-green-300 text-green-700">Notion</Badge>
//             </div>
//           </div>

//           {/* Visual Element - Market Share Chart */}
//           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
//             <h4 className="font-medium text-gray-900 mb-3">Market Share by Competitor</h4>
//             <div className="h-48 flex items-center justify-center">
//               <MiniLineChart 
//                 data={[
//                   { name: "Microsoft Teams", value: 35 },
//                   { name: "Slack", value: 28 },
//                   { name: "Zoom", value: 22 },
//                   { name: "Asana", value: 8 },
//                   { name: "Notion", value: 7 }
//                 ]}
//                 title=""
//                 color="#8B5CF6"
//               />
//             </div>
//           </div>

//           {/* Read More Button */}
//           {!competitorExpanded && (
//             <Button
//               variant="secondary"
//               onClick={() => setCompetitorExpanded(true)}
//               className="w-full"
//             >
//               Read More
//             </Button>
//           )}

//           {/* Expanded Content */}
//           {competitorExpanded && (
//             <div className="animate-fade-in border-t pt-6">
//               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
//                 <div className="bg-white border border-gray-200 rounded-lg p-4">
//                   <h4 className="font-medium text-gray-900 mb-3">Competitive Positioning</h4>
//                   <div className="space-y-3">
//                     <div className="flex justify-between items-center">
//                       <span className="text-sm font-medium text-gray-700">Enterprise Focus</span>
//                       <Badge className="bg-blue-600">Microsoft Teams</Badge>
//                     </div>
//                     <div className="flex justify-between items-center">
//                       <span className="text-sm font-medium text-gray-700">Developer-Friendly</span>
//                       <Badge className="bg-purple-600">Slack</Badge>
//                     </div>
//                     <div className="flex justify-between items-center">
//                       <span className="text-sm font-medium text-gray-700">Video-First</span>
//                       <Badge className="bg-green-600">Zoom</Badge>
//                     </div>
//                   </div>
//                 </div>
                
//                 <div className="bg-white border border-gray-200 rounded-lg p-4">
//                   <h4 className="font-medium text-gray-900 mb-3">Recent Developments</h4>
//                   <div className="space-y-3 text-sm">
//                     <div className="flex items-start gap-2">
//                       <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
//                       <span className="text-gray-700">Teams launched AI-powered meeting summaries</span>
//                     </div>
//                     <div className="flex items-start gap-2">
//                       <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
//                       <span className="text-gray-700">Notion secured $300M Series C funding</span>
//                     </div>
//                     <div className="flex items-start gap-2">
//                       <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
//                       <span className="text-gray-700">Slack introduced workflow automation tools</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               <Button
//                 variant="secondary"
//                 onClick={() => setCompetitorExpanded(false)}
//                 className="w-full"
//               >
//                 Show Less
//               </Button>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default MarketIntelligenceTab;


import React from 'react';
import {
  BarChart3,
  Bot,
  Edit,
  Target,
  TrendingUp,
  PieChart,
  X,
  FileText,
  Save,
  Share,
  Clock,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import MiniPieChart from '@/components/ui/MiniPieChart';
import MiniLineChart from '@/components/ui/MiniLineChart';

interface EditRecord {
  id: string;
  timestamp: string;
  user: string;
  summary: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface TrendSnapshot {
  title: string;
  metric: string;
  type: 'growth' | 'performance' | 'adoption';
}

interface IndustryTrendsRecommendations {
  primaryFocus: string;
  marketEntry: string;
}

interface MarketIntelligenceTabProps {
  isEditing: boolean;
  isSplitView: boolean;
  isExpanded: boolean;
  hasEdits: boolean;
  deletedSections: Set<string>;
  editHistory: EditRecord[];
  executiveSummary: string;
  tamValue: string;
  samValue: string;
  apacGrowthRate: string;
  strategicRecommendations: string[];
  marketEntry: string;
  marketDrivers: string[];
  // Industry Trends props
  isIndustryTrendsEditing: boolean;
  industryTrendsExpanded: boolean;
  industryTrendsHasEdits: boolean;
  industryTrendsDeletedSections: Set<string>;
  industryTrendsEditHistory: EditRecord[];
  industryTrendsExecutiveSummary: string;
  industryTrendsAiAdoption: string;
  industryTrendsCloudMigration: string;
  industryTrendsRegulatory: string;
  industryTrendSnapshots: TrendSnapshot[];
  industryTrendsRecommendations: IndustryTrendsRecommendations;
  industryTrendsRisks: string[];
  industryTrendsLastEditedField: string;
  onToggleEdit: () => void;
  onScoutIconClick: (context?: 'market-size' | 'industry-trends' | 'competitor-landscape') => void;
  onEditHistoryOpen: () => void;
  onDeleteSection: (sectionId: string) => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onExpandToggle: (expanded: boolean) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onTamValueChange: (value: string) => void;
  onSamValueChange: (value: string) => void;
  onApacGrowthRateChange: (value: string) => void;
  onStrategicRecommendationsChange: (recommendations: string[]) => void;
  onMarketEntryChange: (value: string) => void;
  onMarketDriversChange: (drivers: string[]) => void;
  // Industry Trends handlers
  onIndustryTrendsToggleEdit: () => void;
  onIndustryTrendsSaveChanges: () => void;
  onIndustryTrendsCancelEdit: () => void;
  onIndustryTrendsDeleteSection: (sectionId: string) => void;
  onIndustryTrendsEditHistoryOpen: () => void;
  onIndustryTrendsExpandToggle: (expanded: boolean) => void;
  onIndustryTrendsExecutiveSummaryChange: (value: string) => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
}

const MarketIntelligenceTab: React.FC<MarketIntelligenceTabProps> = ({
  isEditing,
  isSplitView,
  isExpanded,
  hasEdits,
  deletedSections,
  editHistory,
  executiveSummary,
  tamValue,
  samValue,
  apacGrowthRate,
  strategicRecommendations,
  marketEntry,
  marketDrivers,
  // Industry Trends props
  isIndustryTrendsEditing,
  industryTrendsExpanded,
  industryTrendsHasEdits,
  industryTrendsDeletedSections,
  industryTrendsEditHistory,
  industryTrendsExecutiveSummary,
  industryTrendsAiAdoption,
  industryTrendsCloudMigration,
  industryTrendsRegulatory,
  industryTrendSnapshots,
  industryTrendsRecommendations,
  industryTrendsRisks,
  industryTrendsLastEditedField,
  onToggleEdit,
  onScoutIconClick,
  onEditHistoryOpen,
  onDeleteSection,
  onSaveChanges,
  onCancelEdit,
  onExpandToggle,
  onExecutiveSummaryChange,
  onTamValueChange,
  onSamValueChange,
  onApacGrowthRateChange,
  onStrategicRecommendationsChange,
  onMarketEntryChange,
  onMarketDriversChange,
  // Industry Trends handlers
  onIndustryTrendsToggleEdit,
  onIndustryTrendsSaveChanges,
  onIndustryTrendsCancelEdit,
  onIndustryTrendsDeleteSection,
  onIndustryTrendsEditHistoryOpen,
  onIndustryTrendsExpandToggle,
  onIndustryTrendsExecutiveSummaryChange,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink
}) => {
  const [competitorExpanded, setCompetitorExpanded] = React.useState(true);

  return (
    <div className={`${isSplitView ? 'w-3/5' : 'flex-1'} transition-all duration-500 space-y-6`}>
      {/* Market Size & Opportunity Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Market Size & Opportunity
          </h2>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleEdit}
              className="text-blue-800 hover:text-blue-900"
            >
              <Edit className="h-4 w-4" />
            </Button>
            {!isSplitView && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onScoutIconClick}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 hover:shadow-md hover:shadow-blue-200/50 relative"
                  >
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    <Bot className="h-5 w-5 relative z-10" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Explore More with Scout</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-8">
            {/* Executive Summary Edit */}
            {!deletedSections.has('executive-summary') && (
              <div className="relative group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteSection('executive-summary')}
                      className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
                <div>
                  <Label htmlFor="executiveSummary" className="text-sm font-medium text-gray-700 mb-2 block">
                    Executive Summary
                  </Label>
                  <Textarea
                    id="executiveSummary"
                    value={executiveSummary}
                    onChange={(e) => onExecutiveSummaryChange(e.target.value)}
                    className="w-full h-32 resize-none"
                    placeholder="Enter executive summary..."
                  />
                </div>
              </div>
            )}

            {/* Key Metrics Edit */}
            {!deletedSections.has('key-metrics') && (
              <div className="relative group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteSection('key-metrics')}
                      className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="tamValue" className="text-sm font-medium text-gray-700 mb-2 block">
                        Total Addressable Market
                      </Label>
                      <Input
                        id="tamValue"
                        value={tamValue}
                        onChange={(e) => onTamValueChange(e.target.value)}
                        placeholder="e.g., $4.2B"
                      />
                    </div>
                    <div>
                      <Label htmlFor="samValue" className="text-sm font-medium text-gray-700 mb-2 block">
                        Serviceable Addressable Market
                      </Label>
                      <Input
                        id="samValue"
                        value={samValue}
                        onChange={(e) => onSamValueChange(e.target.value)}
                        placeholder="e.g., $2.1B"
                      />
                    </div>
                    <div>
                      <Label htmlFor="apacGrowthRate" className="text-sm font-medium text-gray-700 mb-2 block">
                        APAC Growth Rate
                      </Label>
                      <Input
                        id="apacGrowthRate"
                        value={apacGrowthRate}
                        onChange={(e) => onApacGrowthRateChange(e.target.value)}
                        placeholder="e.g., 25%"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Strategic Recommendations Edit */}
            {!deletedSections.has('strategic-recommendations') && (
              <div className="relative group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteSection('strategic-recommendations')}
                      className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Strategic Recommendations
                  </Label>
                  {strategicRecommendations.map((rec, index) => (
                    <Textarea
                      key={index}
                      value={rec}
                      onChange={(e) => {
                        const newRecs = [...strategicRecommendations];
                        newRecs[index] = e.target.value;
                        onStrategicRecommendationsChange(newRecs);
                      }}
                      className="w-full h-20 resize-none mb-3"
                      placeholder={`Strategic recommendation ${index + 1}...`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Market Entry Edit */}
            {!deletedSections.has('market-entry') && (
              <div className="relative group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteSection('market-entry')}
                      className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
                <div>
                  <Label htmlFor="marketEntry" className="text-sm font-medium text-gray-700 mb-2 block">
                    Market Entry Strategy
                  </Label>
                  <Textarea
                    id="marketEntry"
                    value={marketEntry}
                    onChange={(e) => onMarketEntryChange(e.target.value)}
                    className="w-full h-32 resize-none"
                    placeholder="Enter market entry strategy..."
                  />
                </div>
              </div>
            )}

            {/* Market Drivers Edit */}
            {!deletedSections.has('market-drivers') && (
              <div className="relative group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteSection('market-drivers')}
                      className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Key Market Drivers
                  </Label>
                  {marketDrivers.map((driver, index) => (
                    <Textarea
                      key={index}
                      value={driver}
                      onChange={(e) => {
                        const newDrivers = [...marketDrivers];
                        newDrivers[index] = e.target.value;
                        onMarketDriversChange(newDrivers);
                      }}
                      className="w-full h-16 resize-none mb-3"
                      placeholder={`Market driver ${index + 1}...`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Save/Cancel Buttons */}
            <div className="flex items-center gap-3 pt-6 border-t">
              <Button onClick={onSaveChanges}>Save Changes</Button>
              <Button variant="outline" onClick={onCancelEdit}>Cancel</Button>
              <div className="flex-1"></div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onEditHistoryOpen}
                    className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${editHistory.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={editHistory.length === 0}
                  >
                    <Clock className="h-4 w-4" />
                    Edit History
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View changes made to this report</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onScoutIconClick}
                    className="text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 hover:shadow-md hover:shadow-blue-200/50 transition-all duration-200 relative"
                  >
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    <Bot className="h-4 w-4 relative z-10" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Explore More with Scout</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Export Options in Edit Mode */}
            <div className="border-t pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Export Options</h4>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportPDF}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Save PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSaveToWorkspace}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save to Workspace
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onGenerateShareableLink}
                  className="flex items-center gap-2"
                >
                  <Share className="h-4 w-4" />
                  Shareable Link
                </Button>
              </div>
            </div>   
          </div>


        ) : (
          <div className="space-y-6">
            {/* Executive Summary - Always Visible */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Executive Summary
              </h3>
              <p className="text-gray-700 mb-6">{executiveSummary}</p>

              {/* Key Metrics Cards - Always Visible */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                  <div className="text-2xl font-bold text-blue-600">{tamValue}</div>
                  <div className="text-sm font-medium text-gray-900">Total Addressable Market</div>
                  <div className="text-xs text-gray-600">Growing 15% YoY</div>
                </div>
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                  <div className="text-2xl font-bold text-green-600">{samValue}</div>
                  <div className="text-sm font-medium text-gray-900">Serviceable Addressable Market</div>
                  <div className="text-xs text-gray-600">Mid-market focus</div>
                </div>
                <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
                  <div className="text-2xl font-bold text-purple-600">{apacGrowthRate}</div>
                  <div className="text-sm font-medium text-gray-900">APAC Growth Rate</div>
                  <div className="text-xs text-gray-600">Fastest growing region</div>
                </div>
              </div>
            </div>

            {/* Read More Button - Only show when not expanded and not in split view */}
            {!isExpanded && !isSplitView && (
              <Button
                variant="secondary"
                onClick={() => onExpandToggle(true)}
                className="w-full"
              >
                Read More
              </Button>
            )}

            {/* Expanded Content */}
            {(isExpanded || isSplitView) && (
              <div className="animate-fade-in space-y-8">
                <div className="border-t pt-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-8">
                    Market Size & Opportunity Report
                  </h2>

                  {/* Strategic Recommendations */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5 text-green-600" />
                      Strategic Recommendations
                    </h3>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <ul className="space-y-2 text-gray-700">
                        {strategicRecommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Market Entry */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      Market Entry
                    </h3>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-gray-700 mb-4">{marketEntry}</p>
                    </div>
                  </div>

                  {/* Market Opportunity Breakdown */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-purple-600" />
                      Market Opportunity Breakdown
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Market Size by Segment</h4>
                        <MiniPieChart 
                          data={[
                            { name: "Enterprise", value: 45, color: "#3B82F6" },
                            { name: "Mid-Market", value: 35, color: "#10B981" },
                            { name: "SMB", value: 20, color: "#8B5CF6" }
                          ]}
                          title=""
                        />
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Growth Projections</h4>
                        <MiniLineChart 
                          data={[
                            { name: "2023", value: 100 },
                            { name: "2024", value: 115 },
                            { name: "2025", value: 132 },
                            { name: "2026", value: 152 }
                          ]}
                          title=""
                          color="#3B82F6"
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">Key Market Drivers</h4>
                      <ul className="space-y-2 text-gray-700">
                        {marketDrivers.map((driver, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
                            {driver}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Export Options */}
                  <div className="border-t pt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Export Options</h4>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onExportPDF}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Save PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onSaveToWorkspace}
                        className="flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Save to Workspace
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onGenerateShareableLink}
                        className="flex items-center gap-2"
                      >
                        <Share className="h-4 w-4" />
                        Shareable Link
                      </Button>
                    </div>
                  </div>

                  {/* Show Less Button - Only when not in split view */}
                  {!isSplitView && (
                    <Button
                      variant="secondary"
                      onClick={() => onExpandToggle(false)}
                      className="w-full"
                    >
                      Show Less
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Industry Trends Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            Industry Trends
          </h2>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onIndustryTrendsToggleEdit}
              className="text-purple-800 hover:text-purple-900"
            >
              <Edit className="h-4 w-4" />
            </Button>
            {!isSplitView && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onScoutIconClick('industry-trends')}
                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-all duration-200 hover:shadow-md hover:shadow-purple-200/50 relative"
                  >
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    <Bot className="h-5 w-5 relative z-10" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Explore More with Scout</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {isIndustryTrendsEditing ? (
          <div className="space-y-8">
            {/* Executive Summary Edit */}
            {!industryTrendsDeletedSections.has('executive-summary') && (
              <div className="relative group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onIndustryTrendsDeleteSection('executive-summary')}
                      className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this section</p>
                  </TooltipContent>
                </Tooltip>
                <div>
                  <Label htmlFor="industryTrendsExecutiveSummary" className="text-sm font-medium text-gray-700 mb-2 block">
                    Executive Summary
                  </Label>
                  <Textarea
                    id="industryTrendsExecutiveSummary"
                    value={industryTrendsExecutiveSummary}
                    onChange={(e) => onIndustryTrendsExecutiveSummaryChange(e.target.value)}
                    className="w-full h-32 resize-none"
                    placeholder="Enter executive summary..."
                  />
                </div>
              </div>
            )}

            {/* Save/Cancel Buttons */}
            <div className="flex items-center gap-3 pt-6 border-t">
              <Button onClick={onIndustryTrendsSaveChanges}>Save Changes</Button>
              <Button variant="outline" onClick={onIndustryTrendsCancelEdit}>Cancel</Button>
              <div className="flex-1"></div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onIndustryTrendsEditHistoryOpen}
                    className={`text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${industryTrendsEditHistory.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={industryTrendsEditHistory.length === 0}
                  >
                    <Clock className="h-4 w-4" />
                    Edit History
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View changes made to this report</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onScoutIconClick('industry-trends')}
                    className="text-purple-600 hover:text-purple-700 bg-purple-50 border border-purple-200 hover:shadow-md hover:shadow-purple-200/50 transition-all duration-200 relative"
                  >
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    <Bot className="h-4 w-4 relative z-10" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Explore More with Scout</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Export Options in Edit Mode */}
            <div className="border-t pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Export Options</h4>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportPDF}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Save PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSaveToWorkspace}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save to Workspace
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onGenerateShareableLink}
                  className="flex items-center gap-2"
                >
                  <Share className="h-4 w-4" />
                  Shareable Link
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Default View */}
            <div>
              <p className="text-gray-700 mb-6">{industryTrendsExecutiveSummary}</p>

              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                  <div className="text-2xl font-bold text-blue-600">{industryTrendsAiAdoption}</div>
                  <div className="text-sm font-medium text-gray-900">AI Adoption Rate</div>
                  <div className="text-xs text-gray-600">Enterprise pilots</div>
                </div>
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                  <div className="text-2xl font-bold text-green-600">{industryTrendsCloudMigration}</div>
                  <div className="text-sm font-medium text-gray-900">Cloud Migration Increase</div>
                  <div className="text-xs text-gray-600">Year over year</div>
                </div>
                <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
                  <div className="text-2xl font-bold text-purple-600">{industryTrendsRegulatory}</div>
                  <div className="text-sm font-medium text-gray-900">Regulatory Changes</div>
                  <div className="text-xs text-gray-600">Impacting sector</div>
                </div>
              </div>
            </div>

            {/* Read More Button */}
            {!industryTrendsExpanded && !isSplitView && (
              <Button
                variant="secondary"
                onClick={() => onIndustryTrendsExpandToggle(true)}
                className="w-full"
              >
                Read More
              </Button>
            )}

            {/* Expanded Content */}
            {(industryTrendsExpanded || isSplitView) && (
              <div className="animate-fade-in space-y-8">
                <div className="border-t pt-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-8">
                    Industry Trends Report
                  </h2>

                  {/* Executive Summary */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Executive Summary</h3>
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{industryTrendsExecutiveSummary}</p>
                  </div>

                  {/* Key Trend Snapshots */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Trend Snapshots</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {industryTrendSnapshots.map((trend, index) => (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-2">{trend.title}</h4>
                          <p className="text-sm text-gray-600 mb-3">{trend.metric}</p>
                          <div className="h-8 bg-gradient-to-r from-purple-100 to-blue-100 rounded"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Regional Hotspots */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Hotspots</h3>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-gray-700">APAC leads in AI adoption with 78% of enterprises implementing AI solutions, followed by Europe at 65% and North America at 72%.</p>
                    </div>
                  </div>

                  {/* Strategic Recommendations */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h4 className="font-medium text-green-900 mb-2">Primary Focus</h4>
                        <p className="text-green-700 text-sm">{industryTrendsRecommendations.primaryFocus}</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-medium text-blue-900 mb-2">Market Entry</h4>
                        <p className="text-blue-700 text-sm">{industryTrendsRecommendations.marketEntry}</p>
                      </div>
                    </div>
                  </div>

                  {/* Risks & Watchouts */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Risks & Watchouts</h3>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <ul className="space-y-2">
                        {industryTrendsRisks.map((risk, index) => (
                          <li key={index} className="flex items-start gap-2 text-red-700 text-sm">
                            <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Visual Charts Section */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Visual Charts</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">AI Adoption Trends</h4>
                        <MiniLineChart 
                          data={[
                            { name: "Q1", value: 45 },
                            { name: "Q2", value: 58 },
                            { name: "Q3", value: 67 },
                            { name: "Q4", value: 78 }
                          ]}
                          title=""
                          color="#8B5CF6"
                        />
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Technology Budget Allocation</h4>
                        <MiniPieChart 
                          data={[
                            { name: "AI/ML", value: 35, color: "#8B5CF6" },
                            { name: "Cloud", value: 40, color: "#3B82F6" },
                            { name: "Security", value: 25, color: "#10B981" }
                          ]}
                          title=""
                        />
                      </div>
                    </div>
                  </div>

                  {/* Export Footer */}
                  <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-6 -mb-6 rounded-b-lg">
                    <div className="flex flex-wrap gap-3 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onExportPDF}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Save PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onSaveToWorkspace}
                        className="flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Save to Workspace
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onGenerateShareableLink}
                        className="flex items-center gap-2"
                      >
                        <Share className="h-4 w-4" />
                        Shareable Link
                      </Button>
                    </div>
                  </div>

                  {/* Show Less Button - Only when not in split view */}
                  {!isSplitView && (
                    <Button
                      variant="secondary"
                      onClick={() => onIndustryTrendsExpandToggle(false)}
                      className="w-full mt-6"
                    >
                      Show Less
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Competitor Landscape Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Competitor Landscape
          </h2>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-800 hover:text-blue-900"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onScoutIconClick}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 hover:shadow-md hover:shadow-blue-200/50 relative"
                >
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Bot className="h-5 w-5 relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Explore More with Scout</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="space-y-6">
          {/* Executive Summary */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Executive Summary</h3>
            <p className="text-gray-700 mb-4">
              The enterprise collaboration tools market is increasingly competitive, with several dominant players holding significant market share. However, emerging startups are introducing disruptive features, shifting the landscape rapidly.
            </p>
            
            {/* Key Highlights */}
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                <span className="text-gray-700">Top 3 Players: Slack, Microsoft Teams, Zoom</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                <span className="text-gray-700">Emerging Players: Asana, Notion</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
                <span className="text-gray-700">Key Moves: $300M funding round by Notion; new AI feature launch by Teams</span>
              </div>
            </div>

            {/* Competitor Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">Slack</Badge>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">Microsoft Teams</Badge>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">Zoom</Badge>
              <Badge variant="outline" className="border-green-300 text-green-700">Asana</Badge>
              <Badge variant="outline" className="border-green-300 text-green-700">Notion</Badge>
            </div>
          </div>

          {/* Visual Element - Market Share Chart */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Market Share by Competitor</h4>
            <div className="h-48 flex items-center justify-center">
              <MiniLineChart 
                data={[
                  { name: "Microsoft Teams", value: 35 },
                  { name: "Slack", value: 28 },
                  { name: "Zoom", value: 22 },
                  { name: "Asana", value: 8 },
                  { name: "Notion", value: 7 }
                ]}
                title=""
                color="#8B5CF6"
              />
            </div>
          </div>

          {/* Read More Button */}
          {!competitorExpanded && (
            <Button
              variant="secondary"
              onClick={() => setCompetitorExpanded(true)}
              className="w-full"
            >
              Read More
            </Button>
          )}

          {/* Expanded Content */}
          {competitorExpanded && (
            <div className="animate-fade-in border-t pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Competitive Positioning</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Enterprise Focus</span>
                      <Badge className="bg-blue-600">Microsoft Teams</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Developer-Friendly</span>
                      <Badge className="bg-purple-600">Slack</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Video-First</span>
                      <Badge className="bg-green-600">Zoom</Badge>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Recent Developments</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                      <span className="text-gray-700">Teams launched AI-powered meeting summaries</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
                      <span className="text-gray-700">Notion secured $300M Series C funding</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                      <span className="text-gray-700">Slack introduced workflow automation tools</span>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                variant="secondary"
                onClick={() => setCompetitorExpanded(false)}
                className="w-full"
              >
                Show Less
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketIntelligenceTab;
