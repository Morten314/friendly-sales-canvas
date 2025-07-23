
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DealStatus = "won" | "lost" | "in progress";

interface Deal {
  id: string;
  customer: string;
  amount: number;
  status: DealStatus;
  date: string;
}

const deals: Deal[] = [
  { id: "1", customer: "Acme Inc.", amount: 12500, status: "won", date: "Today" },
  { id: "2", customer: "Globex Corp", amount: 5000, status: "in progress", date: "Yesterday" },
  { id: "3", customer: "Stark Industries", amount: 32000, status: "in progress", date: "May 5" },
  { id: "4", customer: "Wayne Enterprises", amount: 7500, status: "lost", date: "May 3" },
  { id: "5", customer: "Hooli", amount: 25000, status: "won", date: "May 1" },
];

export function RecentDeals() {
  const renderStatus = (status: DealStatus) => {
    switch (status) {
      case "won":
        return <Badge className="bg-green-500">Won</Badge>;
      case "lost":
        return <Badge variant="destructive">Lost</Badge>;
      case "in progress":
        return <Badge variant="outline" className="text-amber-500 border-amber-500">In Progress</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Deals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {deals.map((deal) => (
            <div key={deal.id} className="flex items-center justify-between">
              <div>
                <div className="font-medium">{deal.customer}</div>
                <div className="text-sm text-gray-500">{deal.date}</div>
              </div>
              <div className="text-right">
                <div className={cn("font-medium", 
                  deal.status === "won" ? "text-green-600" : 
                  deal.status === "lost" ? "text-red-600" : ""
                )}>
                  ${deal.amount.toLocaleString()}
                </div>
                <div className="mt-1">{renderStatus(deal.status)}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
