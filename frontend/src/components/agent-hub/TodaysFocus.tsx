
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const taskItems = [
  { 
    title: "Leads to follow-up", 
    count: 12, 
    color: "bg-blue-100 text-blue-700",
    icon: "📞",
    action: "load-leads"
  },
  { 
    title: "Discovery calls", 
    count: 5, 
    color: "bg-purple-100 text-purple-700",
    icon: "🔍",
    action: "load-discovery"
  },
  { 
    title: "Demo calls", 
    count: 3, 
    color: "bg-green-100 text-green-700",
    icon: "💻",
    action: "load-demo"
  },
  { 
    title: "Negotiation calls", 
    count: 2, 
    color: "bg-amber-100 text-amber-700",
    icon: "🤝",
    action: "load-negotiation"
  }
];

export function TodaysFocus() {
  const { toast } = useToast();
  
  const handleCardClick = (action: string, title: string) => {
    // Simulate loading different sections based on card clicked
    toast({
      title: `Loading ${title}`,
      description: "This would load the relevant section in a real app.",
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {taskItems.map((item, index) => (
        <Card 
          key={index} 
          className={`hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500`}
          onClick={() => handleCardClick(item.action, item.title)}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`text-xl p-2 rounded-lg ${item.color}`}>
                {item.icon}
              </div>
              <div>
                <h3 className="font-medium">{item.title}</h3>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {item.count}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
