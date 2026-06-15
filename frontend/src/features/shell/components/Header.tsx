import {
  Search,
  MessageSquare,
  Info,
  RefreshCw,
  Settings,
  Download,
  UserPlus,
  PlusCircle,
  Menu,
  Building2,
} from "lucide-react";
import { useState, useEffect } from "react";

import { useAppSidebar } from "../SidebarContext";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/components/ui/use-mobile";
import { cn } from "@/components/ui/utils";
import { useTenant } from "@/shared/tenant";

// Define our deployment data type
export interface DeploymentData {
  targetMarket: string;
  industryFocus: string;
  companySize: string;
  geographicRegion: string;
  leadPriority: string;
  additionalContext?: string;
  deployedAt: string;
}

export function Header() {
  // const [openAsk, setOpenAsk] = useState(false); // Commented out - removed Ask button
  // const [isAIViewActive, setIsAIViewActive] = useState(false); // Commented out - removed User/AI toggle
  const [isSignalsRefreshing, setIsSignalsRefreshing] = useState(false);
  const isMobile = useIsMobile();
  const { setMobileOpen } = useAppSidebar();
  const { selectedTenant } = useTenant();

  // Listen for signals refresh state changes
  useEffect(() => {
    const handleSignalsRefreshStart = () => {
      setIsSignalsRefreshing(true);
    };

    const handleSignalsRefreshEnd = () => {
      setIsSignalsRefreshing(false);
    };

    window.addEventListener("signalsRefreshStart", handleSignalsRefreshStart);
    window.addEventListener("signalsRefreshEnd", handleSignalsRefreshEnd);

    return () => {
      window.removeEventListener("signalsRefreshStart", handleSignalsRefreshStart);
      window.removeEventListener("signalsRefreshEnd", handleSignalsRefreshEnd);
    };
  }, []);

  const getPageTitle = () => {
    const path = window.location.pathname;
    const search = window.location.search;

    // Check if we're on the AI Team view
    if (path === "/agent-hub" && search.includes("view=ai-team")) {
      return "Signals";
    }

    if (path === "/mission-control") return "Mission Control";
    if (path === "/signals") return "Signals";
    if (path === "/agent-hub") return "Signals";
    if (path === "/dashboard") return "Dashboard";
    if (path === "/market-research" || path.startsWith("/your-ai-team/scout")) return "Scout";
    if (path.startsWith("/your-ai-team/strategist")) return "Strategist";
    if (path === "/customers") return "Profiler";
    if (path === "/deals") return "Strategist";
    if (path === "/calendar") return "Activator";
    if (path === "/reports") return "Presenter";
    if (path === "/insights") return "Reports";
    if (path === "/artifacts") return "Artefacts";
    if (path === "/settings") return "Settings";

    return "Agent Hub";
  };

  const getPageSubtitle = () => {
    const path = window.location.pathname;
    const search = window.location.search;

    // Check if we're on the Mission Control page
    if (path === "/mission-control") {
      return "Tell Brewra about your business so it can work smarter for you";
    }

    // Check if we're on the AI Team view
    if (path === "/agent-hub" && search.includes("view=ai-team")) {
      return "Monitor and analyze market signals, trends, and opportunities";
    }

    // Check if we're on the Signals page or agent-hub (now shows Signals content)
    if (path === "/signals" || path === "/agent-hub") {
      return "Monitor and analyze market signals, trends, and opportunities";
    }

    // Check if we're on the Scout page
    if (path === "/market-research" || path.startsWith("/your-ai-team/scout")) {
      return "Find the best markets before your competitors do";
    }

    // Check if we're on the Profiler page
    if (path === "/customers") {
      return "Define ideal customers, find prospects, and enrich your data";
    }

    // Check if we're on the Artefacts page
    if (path === "/artifacts") {
      return "Agent-generated insights and deliverables from your workflows";
    }

    return null;
  };

  // const handleViewModeChange = (isAIView: boolean) => { // Commented out - removed User/AI toggle
  //   setIsAIViewActive(isAIView);
  //   // Dispatch custom event to communicate with other components
  //   window.dispatchEvent(new CustomEvent('aiViewChanged', {
  //     detail: { isAIView }
  //   }));
  // };

  const isMarketResearchPage = window.location.pathname === "/market-research";

  return (
    <header className="bg-white border-b border-gray-200 p-3 md:p-4 flex items-center justify-between relative z-50">
      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
        {/* Mobile Menu Button */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="flex-shrink-0"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        )}

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 truncate">
              {getPageTitle()}
            </h1>
            {(isMarketResearchPage ||
              window.location.pathname.startsWith("/your-ai-team/scout")) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-1 h-6 w-6 p-0 hover:bg-gray-100"
                  >
                    <Info className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[calc(100vw-2rem)] sm:w-80 bg-white border border-gray-200 shadow-lg z-50"
                >
                  <DropdownMenuLabel className="text-sm font-semibold text-gray-800 pb-2">
                    What can this agent do for you?
                  </DropdownMenuLabel>
                  <div className="px-2 pb-2">
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li className="flex items-start">
                        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        <span>Market size estimation & TAM analysis</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        <span>Competitor research & positioning</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        <span>Industry trends & growth forecasts</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        <span>Regulatory & compliance landscape</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        <span>Market entry barriers analysis</span>
                      </li>
                    </ul>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {getPageSubtitle() && (
            <span className="text-sm md:text-base italic font-normal text-gray-600 truncate">
              {getPageSubtitle()}
            </span>
          )}
          {isMarketResearchPage && !getPageSubtitle() && (
            <span className="text-sm md:text-base italic font-normal text-gray-600 truncate">
              Find your best markets before your competitors do
            </span>
          )}
          {/* Scout page info text */}
          {(isMarketResearchPage || window.location.pathname.startsWith("/your-ai-team/scout")) && (
            <span className="text-xs md:text-sm font-normal text-gray-400 mt-0.5 truncate">
              Reports are generated according to fields such as company name, industry, etc. from
              your Company profile on Mission Control
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2 lg:gap-4 flex-shrink-0">
        {/* Signals page buttons */}
        {(window.location.pathname === "/signals" ||
          window.location.pathname.startsWith("/signals") ||
          (window.location.pathname === "/agent-hub" &&
            window.location.search.includes("view=ai-team"))) && (
          <Button
            variant="outline"
            size={isMobile ? "icon" : "sm"}
            disabled={isSignalsRefreshing}
            onClick={() => {
              // Trigger refresh by dispatching a custom event
              window.dispatchEvent(new CustomEvent("signalsRefresh"));
            }}
            className="flex items-center gap-2"
            title={
              isMobile ? (isSignalsRefreshing ? "Refreshing..." : "Refresh Signals") : undefined
            }
          >
            <RefreshCw className={`h-4 w-4 ${isSignalsRefreshing ? "animate-spin" : ""}`} />
            {!isMobile && (isSignalsRefreshing ? "Refreshing..." : "Refresh Signals")}
          </Button>
        )}

        {/* Scout page buttons */}
        {(isMarketResearchPage || window.location.pathname.startsWith("/your-ai-team/scout")) && (
          <>
            {isMobile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => window.dispatchEvent(new CustomEvent("scoutRefresh"))}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </DropdownMenuItem>
                  {/* <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('scoutHistory'))}>
                    <History className="h-4 w-4 mr-2" />
                    History
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('scoutSettings'))}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem> */}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("scoutRefresh"));
                  }}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>

                {/* <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('scoutHistory'));
                  }}
                  className="flex items-center gap-2"
                >
                  <History className="h-4 w-4" />
                  History
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('scoutSettings'));
                  }}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button> */}
              </>
            )}
          </>
        )}

        {/* Profiler page buttons */}
        {window.location.pathname === "/customers" && (
          <>
            {isMobile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => window.dispatchEvent(new CustomEvent("profilerRefresh"))}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => window.dispatchEvent(new CustomEvent("profilerExportData"))}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => window.dispatchEvent(new CustomEvent("profilerCreateICP"))}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create New ICP
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("profilerRefresh"));
                  }}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("profilerExportData"));
                  }}
                >
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
                {/* <Button 
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('profilerCreateICP'));
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Create New ICP
                </Button> */}
              </>
            )}
          </>
        )}

        {/* Strategist page buttons - commented out */}
        {/* {window.location.pathname === '/deals' && (
          <>
            {isMobile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('strategistChat'))}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Chat with Strategist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('strategistCreateStrategy'))}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create New Strategy
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('strategistChat'));
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat with Strategist
                </Button>
                <Button 
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('strategistCreateStrategy'));
                  }}
                >
                  <PlusCircle className="h-4 w-4" />
                  Create New Strategy
                </Button>
              </>
            )}
          </>
        )} */}

        {/* Presenter page buttons */}
        {window.location.pathname === "/reports" && (
          <>
            {isMobile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => window.dispatchEvent(new CustomEvent("presenterChat"))}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Chat with Presenter
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => window.dispatchEvent(new CustomEvent("presenterCreateDemo"))}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create New Demo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("presenterChat"));
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat with Presenter
                </Button>
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("presenterCreateDemo"));
                  }}
                >
                  <PlusCircle className="h-4 w-4" />
                  Create New Demo
                </Button>
              </>
            )}
          </>
        )}

        {/* Signals page controls */}
        {window.location.pathname === "/signals" && !isMobile && (
          <>
            {/* <Button variant="outline" size="sm" className="flex items-center gap-2">
               <Bookmark className="h-4 w-4" />
               Saved Insights (0)
             </Button> */}

            <Select defaultValue="today">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="3days">Last 3 Days</SelectItem>
                <SelectItem value="week">Last Week</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        {/* Mission Control Chat with Agent button - commented out */}
        {/* {window.location.pathname === '/mission-control' && (
           <Button variant="ghost" size="sm" className="flex items-center gap-2">
             <MessageSquare className="h-4 w-4" />
             Chat with Agent
           </Button>
         )} */}

        {/* Artifacts page search bar */}
        {window.location.pathname === "/artifacts" && (
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search artefacts..."
              className={cn("pl-8", isMobile ? "w-[120px]" : "w-[300px]")}
              onChange={(e) => {
                window.dispatchEvent(
                  new CustomEvent("artifactsSearch", {
                    detail: { query: e.target.value },
                  }),
                );
              }}
            />
          </div>
        )}

        {/* Organization Badge - Ready for future dropdown when multiple orgs are available */}
        {selectedTenant && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 shadow-sm">
            <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <span className="text-base font-bold text-blue-700 hidden sm:inline whitespace-nowrap">
              {selectedTenant.name}
            </span>
            <span className="text-base font-bold text-blue-700 sm:hidden">
              {selectedTenant.name.substring(0, 1)}
            </span>
          </div>
        )}

        {/* Notification Bell */}
        {/* <DropdownMenu>
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
        </DropdownMenu> */}
      </div>
    </header>
  );
}
