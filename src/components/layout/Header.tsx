
// import { Button } from "@/components/ui/button";
// import { Search, Bell } from "lucide-react";
// import { Input } from "@/components/ui/input";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";

// export function Header() {
//   // Get the current page name from the URL
//   const getPageTitle = () => {
//     const path = window.location.pathname;
    
//     if (path === '/agent-hub') return 'Agent Hub';
//     if (path === '/dashboard') return 'Dashboard';
//     if (path === '/market-research') return 'Market Research (Scout)';
//     if (path === '/customers') return 'ICP Profiles (Profiler)';
//     if (path === '/deals') return 'GTM Strategies (Strategist)';
//     if (path === '/calendar') return 'Campaigns (Activator)';
//     if (path === '/reports') return 'Demo Prep (Presenter)';
//     if (path === '/insights') return 'Reports';
//     if (path === '/settings') return 'Settings';
    
//     return 'Agent Hub';
//   };

//   return (
//     <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
//       <div className="flex items-center">
//         <h1 className="text-xl font-bold text-gray-800">{getPageTitle()}</h1>
//       </div>

//       <div className="flex items-center space-x-4">
//         <div className="relative w-64">
//           <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
//           <Input className="pl-8" placeholder="Search..." />
//         </div>
        
//         <DropdownMenu>
//           <DropdownMenuTrigger asChild>
//             <Button variant="outline" size="icon" className="relative">
//               <Bell className="h-5 w-5" />
//               <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
//             </Button>
//           </DropdownMenuTrigger>
//           <DropdownMenuContent align="end" className="w-80">
//             <DropdownMenuLabel>Notifications</DropdownMenuLabel>
//             <DropdownMenuSeparator />
//             <DropdownMenuItem className="py-2">
//               <div>
//                 <div className="text-sm font-medium">Scout: Market analysis complete</div>
//                 <div className="text-xs text-gray-500">5 minutes ago</div>
//               </div>
//             </DropdownMenuItem>
//             <DropdownMenuItem className="py-2">
//               <div>
//                 <div className="text-sm font-medium">Activator: 3 new meetings booked</div>
//                 <div className="text-xs text-gray-500">2 hours ago</div>
//               </div>
//             </DropdownMenuItem>
//             <DropdownMenuItem className="py-2">
//               <div>
//                 <div className="text-sm font-medium">Presenter: Demo script ready for review</div>
//                 <div className="text-xs text-gray-500">Yesterday at 10:00 AM</div>
//               </div>
//             </DropdownMenuItem>
//             <DropdownMenuSeparator />
//             <DropdownMenuItem className="justify-center text-blue-600">
//               View all notifications
//             </DropdownMenuItem>
//           </DropdownMenuContent>
//         </DropdownMenu>
        
//         <Button className="bg-sales-blue hover:bg-blue-700">+ Deploy Agent</Button>
//       </div>
//     </header>
//   );
// }


import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, Bell, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AskBrewra } from "@/components/agent-hub/AskBrewra"; // Use the inner logic directly

export function Header() {
  const [openAsk, setOpenAsk] = useState(false);

  const getPageTitle = () => {
    const path = window.location.pathname;
    
    if (path === '/agent-hub') return 'Agent Hub';
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/market-research') return 'Market Research (Scout)';
    if (path === '/customers') return 'ICP Profiles (Profiler)';
    if (path === '/deals') return 'GTM Strategies (Strategist)';
    if (path === '/calendar') return 'Campaigns (Activator)';
    if (path === '/reports') return 'Demo Prep (Presenter)';
    if (path === '/insights') return 'Reports';
    if (path === '/settings') return 'Settings';

    return 'Agent Hub';
  };

  return (
    <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between relative z-50">
      <div className="flex items-center">
        <h1 className="text-xl font-bold text-gray-800">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center space-x-4">
        
        {/* Search Box */}
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <Input className="pl-8" placeholder="Search..." />
        </div>

        {/* Ask Brewra AI Button */}
        <div className="relative">
          <Button
            onClick={() => setOpenAsk(!openAsk)}
            className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex items-center"
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            Ask
          </Button>

          {openAsk && (
            <div className="absolute top-12 right-0 w-96 max-h-[80vh] bg-white rounded-xl shadow-xl border overflow-hidden z-50">
              <AskBrewra />
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="py-2">
              <div>
                <div className="text-sm font-medium">Scout: Market analysis complete</div>
                <div className="text-xs text-gray-500">5 minutes ago</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2">
              <div>
                <div className="text-sm font-medium">Activator: 3 new meetings booked</div>
                <div className="text-xs text-gray-500">2 hours ago</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2">
              <div>
                <div className="text-sm font-medium">Presenter: Demo script ready for review</div>
                <div className="text-xs text-gray-500">Yesterday at 10:00 AM</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-blue-600">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Deploy Agent Button */}
        <Button className="bg-sales-blue hover:bg-blue-700">+ Deploy Agent</Button>
      </div>
    </header>
  );
}
