
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Phone, Users } from "lucide-react";

interface Activity {
  id: string;
  title: string;
  type: "meeting" | "call" | "task";
  time: string;
  customer: string;
}

const activities: Activity[] = [
  { id: "1", title: "Sales Pitch", type: "meeting", time: "10:00 AM", customer: "Acme Inc." },
  { id: "2", title: "Follow-up Call", type: "call", time: "12:30 PM", customer: "Wayne Corp" },
  { id: "3", title: "Product Demo", type: "meeting", time: "2:00 PM", customer: "Stark Industries" },
  { id: "4", title: "Proposal Review", type: "task", time: "4:00 PM", customer: "Hooli" },
];

export function UpcomingActivities() {
  const renderIcon = (type: Activity["type"]) => {
    switch (type) {
      case "meeting":
        return <Users className="h-4 w-4" />;
      case "call":
        return <Phone className="h-4 w-4" />;
      case "task":
        return <Calendar className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Activities</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start p-3 rounded-lg hover:bg-gray-50">
              <div className="p-2 mr-3 bg-blue-50 rounded-md text-sales-blue">
                {renderIcon(activity.type)}
              </div>
              <div>
                <div className="font-medium">{activity.title}</div>
                <div className="text-sm text-gray-500">
                  {activity.time} · {activity.customer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
