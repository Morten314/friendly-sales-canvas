// import { useState } from "react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Send, Bot } from "lucide-react";

// interface AIPromptingInterfaceProps {
//   marketName: string;
// }

// export const AIPromptingInterface = ({ marketName }: AIPromptingInterfaceProps) => {
//   const [prompt, setPrompt] = useState("");
//   const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([
//     { role: "ai", content: `I can help you analyze the ${marketName} market. What would you like to know?` }
//   ]);

//   const handleSendPrompt = () => {
//     if (!prompt.trim()) return;

//     // Add user message
//     const userMessage = { role: "user" as const, content: prompt.trim() };
//     setMessages([...messages, userMessage]);

//     // Simulate AI response
//     setTimeout(() => {
//       // This is where you would integrate with a real AI backend
//       const aiResponse = { 
//         role: "ai" as const, 
//         content: `Based on my analysis of the ${marketName} market, I can provide insights on your question: "${prompt}". Let's analyze this further...`
//       };
//       setMessages(prev => [...prev, aiResponse]);
//     }, 1000);

//     setPrompt("");
//   };

//   return (
//     <div className="flex flex-col h-full">
//       <div className="p-3 bg-gray-50 border-b flex items-center gap-2">
//         <Bot className="h-5 w-5 text-purple-600" />
//         <h3 className="font-medium">AI Assistant</h3>
//       </div>
      
//       <div className="flex-1 overflow-auto p-4 space-y-4">
//         {messages.map((message, index) => (
//           <div 
//             key={index} 
//             className={`${
//               message.role === "ai" 
//                 ? "bg-blue-50 border-blue-100" 
//                 : "bg-gray-50 border-gray-100"
//             } border p-3 rounded-lg max-w-[90%] ${
//               message.role === "ai" ? "" : "ml-auto"
//             }`}
//           >
//             <p className="text-sm">{message.content}</p>
//           </div>
//         ))}
//       </div>
      
//       <div className="p-4 border-t flex gap-2">
//         <Input
//           value={prompt}
//           onChange={(e) => setPrompt(e.target.value)}
//           placeholder="Ask anything about this market..."
//           onKeyDown={(e) => {
//             if (e.key === 'Enter') handleSendPrompt();
//           }}
//           className="flex-1"
//         />
//         <Button 
//           onClick={handleSendPrompt}
//           className="bg-purple-600 hover:bg-purple-700"
//         >
//           <Send className="h-4 w-4" />
//         </Button>
//       </div>
//     </div>
//   );
// };


import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot } from "lucide-react";

interface AIPromptingInterfaceProps {
  marketName: string;
}

export const AIPromptingInterface = ({ marketName }: AIPromptingInterfaceProps) => {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([
    { role: "ai", content: `I can help you analyze the ${marketName} market. What would you like to know?` }
  ]);

  const handleSendPrompt = () => {
    if (!prompt.trim()) return;

    // Add user message
    const userMessage = { role: "user" as const, content: prompt.trim() };
    setMessages([...messages, userMessage]);

    // Simulate AI response
    setTimeout(() => {
      // This is where you would integrate with a real AI backend
      const aiResponse = { 
        role: "ai" as const, 
        content: `Based on my analysis of the ${marketName} market, I can provide insights on your question: "${prompt}". Let's analyze this further...`
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);

    setPrompt("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 bg-gray-50 border-b flex items-center gap-2">
        <Bot className="h-5 w-5 text-purple-600" />
        <h3 className="font-medium">AI Assistant</h3>
      </div>
      
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`${
              message.role === "ai" 
                ? "bg-blue-50 border-blue-100" 
                : "bg-gray-50 border-gray-100"
            } border p-3 rounded-lg max-w-[90%] ${
              message.role === "ai" ? "" : "ml-auto"
            }`}
          >
            <p className="text-sm">{message.content}</p>
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything about this market..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendPrompt();
          }}
          className="flex-1"
        />
        <Button 
          onClick={handleSendPrompt}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};