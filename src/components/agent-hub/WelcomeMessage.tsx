
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export function WelcomeMessage() {
  return (
    <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 mb-6 border-none shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium text-slate-800">
            Hi Alex, here's your sales cockpit for the day.
          </h2>
          <p className="text-slate-600">
            Ask me anything when you're ready to roll.
          </p>
        </div>
        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
