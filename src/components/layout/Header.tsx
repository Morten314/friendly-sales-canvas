
import { Button } from "@/components/ui/button";
import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
      <div className="flex items-center">
        <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <Input className="pl-8" placeholder="Search..." />
        </div>
        
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
                <div className="text-sm font-medium">New Lead: Jane Smith</div>
                <div className="text-xs text-gray-500">5 minutes ago</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2">
              <div>
                <div className="text-sm font-medium">Deal Closed: Acme Corp</div>
                <div className="text-xs text-gray-500">2 hours ago</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2">
              <div>
                <div className="text-sm font-medium">Meeting Reminder: Tech Bros Inc.</div>
                <div className="text-xs text-gray-500">Tomorrow at 10:00 AM</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-blue-600">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button className="bg-sales-blue hover:bg-blue-700">+ Add Deal</Button>
      </div>
    </header>
  );
}
