
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, Bell, MessageSquare, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AskBrewra } from "@/components/agent-hub/AskBrewra";
import { ViewToggle } from "@/components/market-research/ViewToggle";
import { useNavigate } from "react-router-dom";

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
  const [openAsk, setOpenAsk] = useState(false);
  const [isAIViewActive, setIsAIViewActive] = useState(false);
  const navigate = useNavigate();

  const getPageTitle = () => {
    const path = window.location.pathname;
    
    if (path === '/agent-hub') return 'Agent Hub';
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/market-research') return 'Scout';
    if (path === '/customers') return 'Profiler';
    if (path === '/deals') return 'GTM Strategies (Strategist)';
    if (path === '/calendar') return 'Campaigns (Activator)';
    if (path === '/reports') return 'Demo Prep (Presenter)';
    if (path === '/insights') return 'Reports';
    if (path === '/settings') return 'Settings';

    return 'Agent Hub';
  };

  const handleViewModeChange = (isAIView: boolean) => {
    setIsAIViewActive(isAIView);
    // Dispatch custom event to communicate with other components
    window.dispatchEvent(new CustomEvent('aiViewChanged', { 
      detail: { isAIView } 
    }));
  };

  const handleDeployScout = () => {
    navigate('/scout-deployment');
  };

  const isMarketResearchPage = window.location.pathname === '/market-research';

  return (
    <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between relative z-50">
      <div className="flex flex-col">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-gray-800">{getPageTitle()}</h1>
          {isMarketResearchPage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-1 h-6 w-6 p-0 hover:bg-gray-100">
                  <Info className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80 bg-white border border-gray-200 shadow-lg z-50">
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
        {isMarketResearchPage && (
          <span className="text-base italic font-normal text-gray-600">Find your best markets before your competitors do</span>
        )}
      </div>

      <div className="flex items-center space-x-4">
        
        {/* View Toggle */}
        <ViewToggle onViewChange={handleViewModeChange} />

        {/* Market Research specific buttons */}
        {isMarketResearchPage && (
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            onClick={handleDeployScout}
          >
            Deploy Scout
          </Button>
        )}

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
      </div>
    </header>
  );
}
