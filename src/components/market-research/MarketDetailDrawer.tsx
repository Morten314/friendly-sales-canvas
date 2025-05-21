// import { 
//   Drawer, 
//   DrawerClose, 
//   DrawerContent, 
//   DrawerDescription, 
//   DrawerFooter, 
//   DrawerHeader, 
//   DrawerTitle 
// } from "@/components/ui/drawer";
// import { Button } from "@/components/ui/button";
// import { Search, PieChart, Layers, BarChart3, Globe } from "lucide-react";

// interface SubMarket {
//   name: string;
//   size: string;
//   growth: string;
// }

// interface MarketDetails {
//   summary: string;
//   subMarkets: SubMarket[];
//   keyInsights: string[];
//   recommendedActions: string[];
// }

// interface SelectedMarket {
//   name: string;
//   score: string;
//   size: string;
//   competition: string;
//   barriers: string;
//   details: MarketDetails;
// }

// interface MarketDetailDrawerProps {
//   isOpen: boolean;
//   onOpenChange: (isOpen: boolean) => void;
//   selectedMarket: SelectedMarket | null;
// }

// export const MarketDetailDrawer = ({ isOpen, onOpenChange, selectedMarket }: MarketDetailDrawerProps) => {
//   if (!selectedMarket) return null;

//   return (
//     <Drawer open={isOpen} onOpenChange={onOpenChange}>
//       <DrawerContent className="max-h-[85vh]">
//         <DrawerHeader className="border-b">
//           <DrawerTitle className="text-xl flex items-center gap-2">
//             <Search className="h-5 w-5 text-blue-600" />
//             {selectedMarket.name}
//           </DrawerTitle>
//           <DrawerDescription>
//             Market score: <span className="font-medium">{selectedMarket.score}</span> | 
//             TAM: <span className="font-medium">{selectedMarket.size}</span>
//           </DrawerDescription>
//         </DrawerHeader>
        
//         <div className="p-6 overflow-auto">
//           <div className="space-y-6">
//             <div>
//               <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
//                 <PieChart className="h-5 w-5 text-blue-600" /> Market Summary
//               </h3>
//               <p className="text-gray-700">{selectedMarket.details.summary}</p>
//             </div>
            
//             <div>
//               <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
//                 <Layers className="h-5 w-5 text-blue-600" /> Sub-Markets
//               </h3>
//               <div className="bg-white rounded-md border overflow-hidden">
//                 <table className="w-full text-sm">
//                   <thead>
//                     <tr className="bg-gray-50 border-b">
//                       <th className="px-4 py-2 text-left">Sub-Market</th>
//                       <th className="px-4 py-2 text-left">Size</th>
//                       <th className="px-4 py-2 text-left">Growth</th>
//                     </tr>
//                   </thead>
//                   <tbody className="divide-y">
//                     {selectedMarket.details.subMarkets.map((submarket, index) => (
//                       <tr key={index}>
//                         <td className="px-4 py-2">{submarket.name}</td>
//                         <td className="px-4 py-2">{submarket.size}</td>
//                         <td className="px-4 py-2 text-green-600">{submarket.growth}</td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
            
//             <div className="grid md:grid-cols-2 gap-6">
//               <div>
//                 <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
//                   <BarChart3 className="h-5 w-5 text-blue-600" /> Key Insights
//                 </h3>
//                 <ul className="space-y-2">
//                   {selectedMarket.details.keyInsights.map((insight, index) => (
//                     <li key={index} className="flex items-start gap-2">
//                       <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
//                         {index + 1}
//                       </div>
//                       <span className="text-sm">{insight}</span>
//                     </li>
//                   ))}
//                 </ul>
//               </div>
              
//               <div>
//                 <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
//                   <Globe className="h-5 w-5 text-blue-600" /> Recommended Actions
//                 </h3>
//                 <ul className="space-y-2">
//                   {selectedMarket.details.recommendedActions.map((action, index) => (
//                     <li key={index} className="flex items-start gap-2">
//                       <div className="h-5 w-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
//                         {index + 1}
//                       </div>
//                       <span className="text-sm">{action}</span>
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             </div>
//           </div>
//         </div>
        
//         <DrawerFooter className="border-t">
//           <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
//             Generate Full Report
//           </Button>
//           <DrawerClose asChild>
//             <Button variant="outline">Close</Button>
//           </DrawerClose>
//         </DrawerFooter>
//       </DrawerContent>
//     </Drawer>
//   );
// };


import { 
  Drawer, 
  DrawerClose, 
  DrawerContent, 
  DrawerDescription, 
  DrawerFooter, 
  DrawerHeader, 
  DrawerTitle 
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Search, PieChart, Layers, BarChart3, Globe } from "lucide-react";
import { AIPromptingInterface } from "./AIPromptingInterface";

interface SubMarket {
  name: string;
  size: string;
  growth: string;
}

interface MarketDetails {
  summary: string;
  subMarkets: SubMarket[];
  keyInsights: string[];
  recommendedActions: string[];
}

interface SelectedMarket {
  name: string;
  score: string;
  size: string;
  competition: string;
  barriers: string;
  details: MarketDetails;
}

interface MarketDetailDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedMarket: SelectedMarket | null;
  isAIViewActive: boolean;
}

export const MarketDetailDrawer = ({ 
  isOpen, 
  onOpenChange, 
  selectedMarket,
  isAIViewActive
}: MarketDetailDrawerProps) => {
  if (!selectedMarket) return null;

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="text-xl flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-600" />
            {selectedMarket.name}
          </DrawerTitle>
          <DrawerDescription>
            Market score: <span className="font-medium">{selectedMarket.score}</span> | 
            TAM: <span className="font-medium">{selectedMarket.size}</span>
          </DrawerDescription>
        </DrawerHeader>
        
        <div className={`${isAIViewActive ? 'grid grid-cols-2 gap-4' : ''} overflow-auto`}>
          <div className={`p-6 overflow-auto ${isAIViewActive ? 'border-r' : ''}`}>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-blue-600" /> Market Summary
                </h3>
                <p className="text-gray-700">{selectedMarket.details.summary}</p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-600" /> Sub-Markets
                </h3>
                <div className="bg-white rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-4 py-2 text-left">Sub-Market</th>
                        <th className="px-4 py-2 text-left">Size</th>
                        <th className="px-4 py-2 text-left">Growth</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedMarket.details.subMarkets.map((submarket, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2">{submarket.name}</td>
                          <td className="px-4 py-2">{submarket.size}</td>
                          <td className="px-4 py-2 text-green-600">{submarket.growth}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" /> Key Insights
                  </h3>
                  <ul className="space-y-2">
                    {selectedMarket.details.keyInsights.map((insight, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {index + 1}
                        </div>
                        <span className="text-sm">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-600" /> Recommended Actions
                  </h3>
                  <ul className="space-y-2">
                    {selectedMarket.details.recommendedActions.map((action, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="h-5 w-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {index + 1}
                        </div>
                        <span className="text-sm">{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          {isAIViewActive && (
            <div className="h-[70vh]">
              <AIPromptingInterface marketName={selectedMarket.name} />
            </div>
          )}
        </div>
        
        <DrawerFooter className="border-t">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
            Generate Full Report
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
