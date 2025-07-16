
// // import { 
// //   Home, 
// //   Users, 
// //   FileText, 
// //   Calendar, 
// //   Settings, 
// //   LogOut, 
// //   Search,
// //   BarChart, 
// //   Menu,
// //   LayoutDashboard
// // } from "lucide-react";
// // import { useState } from "react";
// // import { Link } from "react-router-dom";
// // import { cn } from "@/lib/utils";
// // import { Button } from "@/components/ui/button";

// // type NavItem = {
// //   icon: React.ElementType;
// //   label: string;
// //   href: string;
// // };

// // const navItems: NavItem[] = [
// //   { icon: LayoutDashboard, label: "Agent Hub", href: "/agent-hub" },
// //   // { icon: Home, label: "Dashboard", href: "/" },
// //   { icon: Search, label: "Market Research (Scout)", href: "/market-research" },
// //   { icon: Users, label: "ICP Profiles (Profiler)", href: "/customers" },
// //   { icon: FileText, label: "GTM Strategies (Strategist)", href: "/deals" },
// //   { icon: Calendar, label: "Campaigns (Activator)", href: "/calendar" },
// //   { icon: BarChart, label: "Demo Prep (Presenter)", href: "/reports" },
// //   { icon: BarChart, label: "Reports", href: "/insights" },
// //   { icon: Settings, label: "Settings", href: "/settings" },
// // ];

// // export function Sidebar() {
// //   const [collapsed, setCollapsed] = useState(false);

// //   return (
// //     <div className={cn(
// //       "bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-300",
// //       collapsed ? "w-16" : "w-64"
// //     )}>
// //       {/* Logo Section */}
// //       <div className="p-4 border-b border-gray-200 flex items-center justify-between">
// //         {!collapsed && (
// //           <div className="text-xl font-bold text-sales-blue">Brewra</div>
// //         )}
// //         <Button 
// //           variant="ghost" 
// //           size="icon" 
// //           onClick={() => setCollapsed(!collapsed)}
// //           className="ml-auto"
// //         >
// //           <Menu className="h-5 w-5" />
// //           <span className="sr-only">Toggle sidebar</span>
// //         </Button>
// //       </div>

// //       {/* Navigation */}
// //       <nav className="flex-1 py-4">
// //         <ul className="space-y-2">
// //           {navItems.map((item) => (
// //             <li key={item.label}>
// //               <Link 
// //                 to={item.href} 
// //                 className={cn(
// //                   "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
// //                   window.location.pathname === item.href && "bg-blue-50 text-sales-blue"
// //                 )}
// //               >
// //                 <item.icon className="h-5 w-5" />
// //                 {!collapsed && <span className="ml-3">{item.label}</span>}
// //               </Link>
// //             </li>
// //           ))}
// //         </ul>
// //       </nav>

// //       {/* User Section */}
// //       <div className={cn(
// //         "border-t border-gray-200 p-4",
// //         collapsed ? "flex justify-center" : "flex items-center"
// //       )}>
// //         {!collapsed ? (
// //           <>
// //             <div className="w-10 h-10 rounded-full bg-sales-blue text-white flex items-center justify-center font-medium">
// //               AR
// //             </div>
// //             <div className="ml-3">
// //               <div className="font-medium text-sm">Alex Rodriguez</div>
// //               <div className="text-xs text-gray-500">Revenue Leader</div>
// //             </div>
// //             <Button variant="ghost" size="icon" className="ml-auto">
// //               <LogOut className="h-4 w-4" />
// //               <span className="sr-only">Log out</span>
// //             </Button>
// //           </>
// //         ) : (
// //           <div className="w-10 h-10 rounded-full bg-sales-blue text-white flex items-center justify-center font-medium">
// //             AR
// //           </div>
// //         )}
// //       </div>
// //     </div>
// //   );
// // }


// // changes made to collapsable sidebar

// import { 
//   Users, 
//   FileText, 
//   Calendar, 
//   Settings, 
//   LogOut, 
//   Search,
//   BarChart, 
//   Menu,
//   LayoutDashboard,
//   ChevronDown,
//   ChevronUp,
//   User,
//   Compass,
//   Zap,
//   Presentation,
//   Shield,
//   FileCheck,
//   Target
// } from "lucide-react";
// import { useState } from "react";
// import { Link } from "react-router-dom";
// import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";
// import { 
//   Collapsible, 
//   CollapsibleContent, 
//   CollapsibleTrigger 
// } from "@/components/ui/collapsible";

// type NavItem = {
//   icon: React.ElementType;
//   label: string;
//   href: string;
// };

// const navItems: NavItem[] = [
//   { icon: LayoutDashboard, label: "Dashboard", href: "/agent-hub" },
//   { icon: Search, label: "Market Research (Scout)", href: "/market-research" },
//   { icon: Users, label: "ICP Profiles (Profiler)", href: "/customers" },
//   { icon: FileText, label: "GTM Strategies (Strategist)", href: "/deals" },
//   { icon: Calendar, label: "Campaigns (Activator)", href: "/calendar" },
//   { icon: BarChart, label: "Demo Prep (Presenter)", href: "/reports" },
//   { icon: BarChart, label: "Reports", href: "/insights" },
//   { icon: Settings, label: "Settings", href: "/settings" },
// ];

// export function Sidebar() {
//   const [collapsed, setCollapsed] = useState(false);
//   const [aiTeamOpen, setAiTeamOpen] = useState(false);

//   return (
//     <div className={cn(
//       "bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-300",
//       collapsed ? "w-16" : "w-64"
//     )}>
//       {/* Logo Section */}
//       <div className="p-4 border-b border-gray-200 flex items-center justify-between">
//         {!collapsed && (
//           <div className="text-xl font-bold text-sales-blue">Brewra</div>
//         )}
//         <Button 
//           variant="ghost" 
//           size="icon" 
//           onClick={() => setCollapsed(!collapsed)}
//           className="ml-auto"
//         >
//           <Menu className="h-5 w-5" />
//           <span className="sr-only">Toggle sidebar</span>
//         </Button>
//       </div>

//       {/* Navigation */}
//       <nav className="flex-1 py-4">
//         <ul className="space-y-2">
//           {/* Agent Hub link */}
//           <li>
//             <Link 
//               to="/agent-hub" 
//               className={cn(
//                 "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
//                 window.location.pathname === "/agent-hub" && "bg-blue-50 text-sales-blue"
//               )}
//             >
//               <LayoutDashboard className="h-5 w-5" />
//               {!collapsed && <span className="ml-3">Dashboard</span>}
//             </Link>
//           </li>
          
//           {/* AI Team Collapsible Section */}
// {!collapsed && (
//   <li>
//     <Collapsible 
//       open={aiTeamOpen}
//       onOpenChange={setAiTeamOpen}
//       className="mx-2"
//     >
//       <CollapsibleTrigger asChild>
//         <div className={cn(
//           "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg transition-colors cursor-pointer",
//           aiTeamOpen && "bg-blue-50 text-sales-blue"
//         )}>
//           <Users className="h-5 w-5" />
//           <span className="ml-3 flex-1">AI Team</span>
//           {aiTeamOpen ? (
//             <ChevronUp className="h-4 w-4" />
//           ) : (
//             <ChevronDown className="h-4 w-4" />
//           )}
//         </div>
//       </CollapsibleTrigger>
//       <CollapsibleContent>
//         {/* Exclude Reports from here */}
//         <ul className="space-y-1">
//           {navItems.slice(1, 6).map((item) => (
//             <li key={item.label}>
//               <Link 
//                 to={item.href} 
//                 className={cn(
//                   "flex items-center px-4 py-2 text-sm text-gray-600 hover:bg-sales-gray hover:text-sales-blue rounded-lg transition-colors ml-9",
//                   window.location.pathname === item.href && "bg-blue-50 text-sales-blue"
//                 )}
//               >
//                 <item.icon className="h-4 w-4" />
//                 <span className="ml-3">{item.label}</span>
//               </Link>
//             </li>
//           ))}
//         </ul>
//       </CollapsibleContent>
//     </Collapsible>
//   </li>
// )}

// {/* Show AI Team icon when collapsed */}
// {collapsed && (
//   <li>
//     <div className="flex items-center justify-center py-3 text-gray-700">
//       <Users className="h-5 w-5" />
//     </div>
//   </li>
// )}

// {/* Reports moved outside AI Team */}
// <li key="reports">
//   <Link 
//     to="/insights" 
//     className={cn(
//       "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
//       window.location.pathname === "/insights" && "bg-blue-50 text-sales-blue"
//     )}
//   >
//     <BarChart className="h-5 w-5" />
//     {!collapsed && <span className="ml-3">Reports</span>}
//   </Link>
// </li>

//           {/* Settings navigation item */}
//           <li key="settings">
//             <Link 
//               to="/settings" 
//               className={cn(
//                 "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
//                 window.location.pathname === "/settings" && "bg-blue-50 text-sales-blue"
//               )}
//             >
//               <Settings className="h-5 w-5" />
//               {!collapsed && <span className="ml-3">Settings</span>}
//             </Link>
//           </li>
//         </ul>
//       </nav>

//       {/* User Section */}
//       <div className={cn(
//         "border-t border-gray-200 p-4",
//         collapsed ? "flex justify-center" : "flex items-center"
//       )}>
//         {!collapsed ? (
//           <>
//             <div className="w-10 h-10 rounded-full bg-sales-blue text-white flex items-center justify-center font-medium">
//               AR
//             </div>
//             <div className="ml-3">
//               <div className="font-medium text-sm">Alex Rodriguez</div>
//               <div className="text-xs text-gray-500">Revenue Leader</div>
//             </div>
//             <Button variant="ghost" size="icon" className="ml-auto">
//               <LogOut className="h-4 w-4" />
//               <span className="sr-only">Log out</span>
//             </Button>
//           </>
//         ) : (
//           <div className="w-10 h-10 rounded-full bg-sales-blue text-white flex items-center justify-center font-medium">
//             AR
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }


import { 
  Users, 
  FileText, 
  Calendar, 
  Settings, 
  LogOut, 
  Search,
  BarChart, 
  Menu,
  LayoutDashboard,
  ChevronDown,
  ChevronUp,
  User,
  Compass,
  Zap,
  Presentation,
  Shield,
  FileCheck,
  Target
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";

type NavItem = {
  icon: React.ElementType;
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/agent-hub" },
  { icon: Search, label: "Scout", href: "/market-research" },
  { icon: Users, label: "Profiler", href: "/customers" },
  { icon: FileText, label: "Strategist", href: "/deals" },
  { icon: Calendar, label: "Activator", href: "/calendar" },
  { icon: Presentation, label: "Presenter", href: "/reports" },
  { icon: BarChart, label: "Reports", href: "/insights" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [aiTeamOpen, setAiTeamOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleAITeamClick = () => {
    setAiTeamOpen(!aiTeamOpen);
    navigate("/agent-hub?view=ai-team");
  };

  return (
    <div className={cn(
      "bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo Section */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!collapsed && (
          <div className="text-xl font-bold text-sales-blue">Brewra</div>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-2">
          {/* Agent Hub link */}
          <li>
            <Link 
              to="/agent-hub" 
              className={cn(
                "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
                window.location.pathname === "/agent-hub" && !location.search.includes("view=ai-team") && "bg-blue-50 text-sales-blue"
              )}
            >
              <LayoutDashboard className="h-5 w-5" />
              {!collapsed && <span className="ml-3">Dashboard</span>}
            </Link>
          </li>
          
          {/* AI Team Collapsible Section */}
          {!collapsed && (
            <li>
              <Collapsible 
                open={aiTeamOpen}
                onOpenChange={setAiTeamOpen}
                className="mx-2"
              >
                <CollapsibleTrigger asChild>
                  <div 
                    className={cn(
                      "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg transition-colors cursor-pointer",
                      (aiTeamOpen || location.search.includes("view=ai-team")) && "bg-blue-50 text-sales-blue"
                    )}
                    onClick={handleAITeamClick}
                  >
                    <Users className="h-5 w-5" />
                    <span className="ml-3 flex-1">Your AI Team</span>
                    {aiTeamOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {/* Individual agents */}
                  {navItems.slice(1, 6).map((item) => (
                    <li key={item.label}>
                      <a 
                        href={item.href} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "flex items-center px-4 py-2 text-sm text-gray-600 hover:bg-sales-gray hover:text-sales-blue rounded-lg transition-colors ml-9",
                          window.location.pathname === item.href && "bg-blue-50 text-sales-blue"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="ml-3">{item.label}</span>
                      </a>
                    </li>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </li>
          )}

          {/* Show AI Team icon when collapsed */}
          {collapsed && (
            <li>
              <Link
                to="/agent-hub?view=ai-team"
                className={cn(
                  "flex items-center justify-center py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
                  location.search.includes("view=ai-team") && "bg-blue-50 text-sales-blue"
                )}
              >
                <Users className="h-5 w-5" />
              </Link>
            </li>
          )}

          {/* Reports moved outside AI Team */}
          <li key="reports">
            <Link 
              to="/insights" 
              className={cn(
                "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
                window.location.pathname === "/insights" && "bg-blue-50 text-sales-blue"
              )}
            >
              <BarChart className="h-5 w-5" />
              {!collapsed && <span className="ml-3">Reports</span>}
            </Link>
          </li>

          {/* Settings navigation item */}
          <li key="settings">
            <Link 
              to="/settings" 
              className={cn(
                "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
                window.location.pathname === "/settings" && "bg-blue-50 text-sales-blue"
              )}
            >
              <Settings className="h-5 w-5" />
              {!collapsed && <span className="ml-3">Settings</span>}
            </Link>
          </li>
        </ul>
      </nav>

      {/* User Section */}
      <div className={cn(
        "border-t border-gray-200 p-4",
        collapsed ? "flex justify-center" : "flex items-center"
      )}>
        {!collapsed ? (
          <>
            <div className="w-10 h-10 rounded-full bg-sales-blue text-white flex items-center justify-center font-medium">
              AR
            </div>
            <div className="ml-3">
              <div className="font-medium text-sm">Alex Rodriguez</div>
              <div className="text-xs text-gray-500">Revenue Leader</div>
            </div>
            <Button variant="ghost" size="icon" className="ml-auto">
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Log out</span>
            </Button>
          </>
        ) : (
          <div className="w-10 h-10 rounded-full bg-sales-blue text-white flex items-center justify-center font-medium">
            AR
          </div>
        )}
      </div>
    </div>
  );
}