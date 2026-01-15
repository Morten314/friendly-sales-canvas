
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
  Target,
  Activity,
  Command,
  Archive,
  X
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { clearUserCache } from "@/utils/cacheUtils";
import { useSidebar } from "@/contexts/SidebarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type NavItem = {
  icon: React.ElementType;
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  // { icon: LayoutDashboard, label: "Dashboard", href: "/agent-hub" }, // Commented out for future use
  { icon: Search, label: "Scout", href: "/market-research" },
  { icon: Users, label: "Profiler", href: "/customers" },
  { icon: FileText, label: "Strategist", href: "/deals" },
  { icon: Calendar, label: "Activator", href: "/calendar" },
  { icon: Presentation, label: "Presenter", href: "/reports" },
  { icon: BarChart, label: "Reports", href: "/insights" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const { logout, currentUser } = useAuth();
  const { clearTenant } = useTenant();
  const navigate = useNavigate();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [fullName, setFullName] = useState<string>('');
  const [aiTeamOpen, setAiTeamOpen] = useState(() => {
    // Check if there's a session-based state (not persistent across page reloads)
    return sessionStorage.getItem('aiTeamDropdownOpen') === 'true';
  });
  const [signalsOpen, setSignalsOpen] = useState(() => {
    return sessionStorage.getItem('signalsDropdownOpen') === 'true';
  });
  const location = useLocation();

  // Get user's full name from localStorage
  useEffect(() => {
    if (currentUser?.uid) {
      const storedFullName = localStorage.getItem(`userFullName_${currentUser.uid}`);
      if (storedFullName) {
        setFullName(storedFullName);
      }
    } else {
      setFullName('');
    }
  }, [currentUser?.uid]);

  // Get initials from full name
  const getInitials = (name: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleAITeamClick = (e: React.MouseEvent) => {
    // Prevent navigation, only toggle dropdown
    e.preventDefault();
    const newState = !aiTeamOpen;
    setAiTeamOpen(newState);
    // Store in sessionStorage to persist during navigation but not across page reloads
    sessionStorage.setItem('aiTeamDropdownOpen', newState.toString());
  };

  const handleSignalsDropdownToggle = () => {
    const newState = !signalsOpen;
    setSignalsOpen(newState);
    sessionStorage.setItem('signalsDropdownOpen', newState.toString());
  };

  const handleSignalsClick = () => {
    // Navigate to signals page and open dropdown
    navigate("/signals");
    if (!signalsOpen) {
      setSignalsOpen(true);
      sessionStorage.setItem('signalsDropdownOpen', 'true');
    }
    handleLinkClick();
  };

  // Auto-open Signals dropdown when on signals or artifacts page
  useEffect(() => {
    if (location.pathname === "/signals" || location.pathname === "/artifacts") {
      setSignalsOpen(true);
      sessionStorage.setItem('signalsDropdownOpen', 'true');
    }
  }, [location.pathname]);

  const handleLinkClick = () => {
    // Close mobile sidebar when a link is clicked
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // On mobile, always show full sidebar (not collapsed)
  const isCollapsed = isMobile ? false : collapsed;

  const sidebarContent = (
    <>
      {/* Logo Section */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!isCollapsed && (
          <div className="text-xl font-bold text-sales-blue">Brewra</div>
        )}
        {!isMobile && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        )}
        {isMobile && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setMobileOpen(false)}
            className="ml-auto"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-2">
          {/* Mission Control link - First item */}
          <li>
            <Link 
              to="/mission-control" 
              onClick={handleLinkClick}
              className={cn(
                "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
                location.pathname === "/mission-control" && "bg-blue-50 text-sales-blue"
              )}
            >
              <Command className="h-5 w-5" />
              {!isCollapsed && <span className="ml-3">Mission Control</span>}
            </Link>
          </li>
          
          {/* Signals Section - Manual Dropdown Control */}
          {!isCollapsed && (
            <li>
              <div className="mx-2">
                <div 
                  className={cn(
                    "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg transition-colors",
                    (location.pathname === "/signals" || location.pathname === "/artifacts") && "bg-blue-50 text-sales-blue"
                  )}
                >
                  <Zap className="h-5 w-5" />
                  <span 
                    className="ml-3 flex-1 cursor-pointer"
                    onClick={handleSignalsClick}
                  >
                    Signals
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSignalsDropdownToggle();
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    {signalsOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
                
                {/* Signals Dropdown Content */}
                {signalsOpen && (
                  <div className="mt-1">
                    <ul className="space-y-1">
                      <li>
                        <Link
                          to="/artifacts"
                          onClick={handleLinkClick}
                          className={cn(
                            "flex items-center px-4 py-2 text-sm text-gray-600 hover:bg-sales-gray hover:text-sales-blue rounded-lg transition-colors ml-9",
                            location.pathname === "/artifacts" && "bg-blue-50 text-sales-blue"
                          )}
                        >
                          <Archive className="h-4 w-4" />
                          <span className="ml-3">Artefacts</span>
                        </Link>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </li>
          )}
          
          {/* Dashboard link - Commented out for future use */}
          {/* <li>
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
          </li> */}
          
          {/* AI Team Section - Manual Dropdown Control */}
          {!isCollapsed && (
            <li>
              <div className="mx-2">
                <div 
                  className={cn(
                    "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg transition-colors cursor-pointer",
                    location.search.includes("view=ai-team") && "bg-blue-50 text-sales-blue"
                  )}
                  onClick={handleAITeamClick}
                >
                  <Users className="h-5 w-5" />
                  <span className="ml-3 flex-1">Your AI Team</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAITeamClick(e);
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    {aiTeamOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
                
                {/* Manual Dropdown Content */}
                {aiTeamOpen && (
                  <div className="mt-1">
                    <ul className="space-y-1">
                      {navItems.slice(0, 5).map((item) => (
                        <li key={item.label}>
                          <Link
                            to={item.href}
                            onClick={handleLinkClick}
                            className={cn(
                              "flex items-center px-4 py-2 text-sm text-gray-600 hover:bg-sales-gray hover:text-sales-blue rounded-lg transition-colors ml-9",
                              location.pathname === item.href && "bg-blue-50 text-sales-blue"
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            <span className="ml-3">{item.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          )}

          {/* Show Mission Control icon when collapsed */}
          {collapsed && !isMobile && (
            <li>
              <Link
                to="/mission-control"
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center justify-center py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
                  location.pathname === "/mission-control" && "bg-blue-50 text-sales-blue"
                )}
              >
                <Command className="h-5 w-5" />
              </Link>
            </li>
          )}

          {/* Show Signals icon when collapsed */}
          {collapsed && !isMobile && (
            <li>
              <Link
                to="/signals"
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center justify-center py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
                  (location.pathname === "/signals" || location.pathname === "/artifacts") && "bg-blue-50 text-sales-blue"
                )}
              >
                <Zap className="h-5 w-5" />
              </Link>
            </li>
          )}

          {/* Show AI Team icon when collapsed */}
          {collapsed && !isMobile && (
            <li>
              <div
                onClick={handleAITeamClick}
                className={cn(
                  "flex items-center justify-center py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors cursor-pointer",
                  location.search.includes("view=ai-team") && "bg-blue-50 text-sales-blue"
                )}
              >
                <Users className="h-5 w-5" />
              </div>
            </li>
          )}

          {/* Reports moved outside AI Team */}
          <li key="reports">
            <Link 
              to="/insights" 
              onClick={handleLinkClick}
              className={cn(
                "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
                location.pathname === "/insights" && "bg-blue-50 text-sales-blue"
              )}
            >
              <BarChart className="h-5 w-5" />
              {!isCollapsed && <span className="ml-3">Reports</span>}
            </Link>
          </li>


          {/* Settings navigation item */}
          <li key="settings">
            <Link 
              to="/settings" 
              onClick={handleLinkClick}
              className={cn(
                "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
                location.pathname === "/settings" && "bg-blue-50 text-sales-blue"
              )}
            >
              <Settings className="h-5 w-5" />
              {!isCollapsed && <span className="ml-3">Settings</span>}
            </Link>
          </li>
        </ul>
      </nav>

      {/* User Section */}
      <div className={cn(
        "border-t border-gray-200 p-4",
        isCollapsed ? "flex justify-center" : "flex items-center"
      )}>
        {!isCollapsed ? (
          <>
            <div className="w-10 h-10 rounded-full bg-sales-blue text-white flex items-center justify-center font-medium">
              {getInitials(fullName)}
            </div>
            <div className="ml-3">
              <div className="font-medium text-sm">{fullName || 'User'}</div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              className="ml-auto flex items-center gap-2 text-gray-600 hover:text-gray-900"
              onClick={async () => {
                // Clear all user-specific cache before logout
                clearUserCache(currentUser?.uid);
                clearTenant();
                await logout();
                navigate('/login');
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-sales-blue text-white flex items-center justify-center font-medium">
              {getInitials(fullName)}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={async () => {
                // Clear all user-specific cache before logout
                clearUserCache(currentUser?.uid);
                clearTenant();
                await logout();
                navigate('/login');
              }}
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  );

  // Mobile: Render as Sheet (drawer)
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <div className="bg-white h-full flex flex-col">
            {sidebarContent}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Render as fixed sidebar
  return (
    <div className={cn(
      "bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {sidebarContent}
    </div>
  );
}