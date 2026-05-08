import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export function WelcomeMessage() {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-slate-50 mb-4 md:mb-6 border-none shadow-sm">
      <CardContent className="p-4 md:p-6 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-xl font-medium text-slate-800">
            Hi Alex, here's your sales cockpit for the day.
          </h2>
          <p className="text-sm md:text-base text-slate-600 mt-1">
            Ask me anything when you're ready to roll.
          </p>
        </div>
        <div className="h-10 w-10 md:h-14 md:w-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 flex-shrink-0">
          <svg className="h-5 w-5 md:h-7 md:w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
