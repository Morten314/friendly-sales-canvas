
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, X } from "lucide-react";
import { AskBrewra } from "./AskBrewra";

const FloatingAskBrewra = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="bg-white rounded-xl shadow-2xl border w-96 h-[500px] overflow-hidden flex flex-col">
          <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
            <div className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Ask Brewra
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-blue-700"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <AskBrewra />
          </div>
        </div>
      ) : (
        <Button
          size="lg"
          onClick={() => setIsOpen(true)}
          className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center p-0"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
};

export default FloatingAskBrewra;
