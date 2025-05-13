
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const taskItems = [
  { 
    title: "Leads to follow-up", 
    count: 12, 
    color: "bg-blue-100 text-blue-700",
    icon: "📞"
  },
  { 
    title: "Discovery calls", 
    count: 5, 
    color: "bg-purple-100 text-purple-700",
    icon: "🔍"
  },
  { 
    title: "Demo calls", 
    count: 3, 
    color: "bg-green-100 text-green-700",
    icon: "💻"
  },
  { 
    title: "Negotiation calls", 
    count: 2, 
    color: "bg-amber-100 text-amber-700",
    icon: "🤝"
  }
];

export function TodaysFocus() {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold mb-3">Today's Focus</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {taskItems.map((item, index) => (
          <Card key={index} className={`hover:shadow-md transition-shadow cursor-pointer border-l-2 border-l-blue-500`}>
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
    </div>
  );
}
