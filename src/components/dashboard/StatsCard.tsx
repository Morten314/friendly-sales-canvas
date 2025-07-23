
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
  className?: string;
}

export function StatsCard({ title, value, change, isPositive, icon, className }: StatsCardProps) {
  return (
    <div className={cn("bg-white rounded-lg shadow-sm p-6 border border-gray-100", className)}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
          {change && (
            <p className={cn("text-xs font-medium mt-2", 
              isPositive ? "text-green-600" : "text-red-600"
            )}>
              {isPositive ? "↑" : "↓"} {change} from last month
            </p>
          )}
        </div>
        <div className="p-2 rounded-md bg-blue-50 text-sales-blue">
          {icon}
        </div>
      </div>
    </div>
  );
}
