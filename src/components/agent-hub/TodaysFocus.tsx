
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

const taskItems = [
  { 
    title: "Leads to follow-up", 
    count: 12, 
    color: "bg-blue-100 border-blue-500 text-blue-700",
    icon: "📞"
  },
  { 
    title: "Discovery calls", 
    count: 5, 
    color: "bg-purple-100 border-purple-500 text-purple-700",
    icon: "🔍"
  },
  { 
    title: "Demo calls", 
    count: 3, 
    color: "bg-green-100 border-green-500 text-green-700",
    icon: "💻"
  },
  { 
    title: "Negotiation calls", 
    count: 2, 
    color: "bg-amber-100 border-amber-500 text-amber-700",
    icon: "🤝"
  }
];

export function TodaysFocus() {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4">Today's Focus</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {taskItems.map((item, index) => (
          <Card key={index} className={`hover:shadow-md transition-shadow cursor-pointer border-l-4 ${item.color.replace('bg-', 'border-')} hover:scale-[1.01] transition-transform`}>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`text-2xl p-2 rounded-lg ${item.color}`}>
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <Badge className={item.color}>{item.count}</Badge>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
