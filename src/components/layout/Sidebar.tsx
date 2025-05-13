
import { 
  Home, 
  Users, 
  FileText, 
  Calendar, 
  Settings, 
  LogOut, 
  Search,
  BarChart, 
  Menu,
  LayoutDashboard
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = {
  icon: React.ElementType;
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Agent Hub", href: "/agent-hub" },
  { icon: Home, label: "Dashboard", href: "/" },
  { icon: Search, label: "Market Research (Scout)", href: "/market-research" },
  { icon: Users, label: "ICP Profiles (Profiler)", href: "/customers" },
  { icon: FileText, label: "GTM Strategies (Strategist)", href: "/deals" },
  { icon: Calendar, label: "Campaigns (Activator)", href: "/calendar" },
  { icon: BarChart, label: "Demo Prep (Presenter)", href: "/reports" },
  { icon: BarChart, label: "Reports", href: "/insights" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

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
          {navItems.map((item) => (
            <li key={item.label}>
              <Link 
                to={item.href} 
                className={cn(
                  "flex items-center px-4 py-3 text-gray-700 hover:bg-sales-gray hover:text-sales-blue rounded-lg mx-2 transition-colors",
                  window.location.pathname === item.href && "bg-blue-50 text-sales-blue"
                )}
              >
                <item.icon className="h-5 w-5" />
                {!collapsed && <span className="ml-3">{item.label}</span>}
              </Link>
            </li>
          ))}
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
