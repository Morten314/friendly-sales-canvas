import React, { useState } from "react";
import { AskBrewra } from "./AskBrewra";
import { MessageSquare } from "lucide-react";

const FloatingAskBrewra: React.FC = () => {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <>
      {/* Floating Icon Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg"
        aria-label="Ask Brewra"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Floating Ask Brewra Box */}
      {open && (
        <div className="fixed bottom-20 right-6 z-40 w-96 max-h-[80vh] bg-white rounded-xl shadow-xl border overflow-hidden">
          <AskBrewra />
        </div>
      )}
    </>
  );
};

export default FloatingAskBrewra;



// import React, { useState } from "react";
// import { AskBrewra } from "./AskBrewra";
// import { MessageSquare } from "lucide-react";

// const FloatingAskBrewra: React.FC = () => {
//   const [open, setOpen] = useState<boolean>(true); // changed from false to true

//   return (
//     <>
//       {/* Floating Icon Button */}
//       <button
//         onClick={() => setOpen(!open)}
//         className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg"
//         aria-label="Ask Brewra"
//       >
//         <MessageSquare className="w-6 h-6" />
//       </button>

//       {/* Floating Ask Brewra Box */}
//       {open && (
//         <div className="fixed bottom-20 right-6 z-40 w-96 max-h-[80vh] bg-white rounded-xl shadow-xl border overflow-hidden">
//           <AskBrewra />
//         </div>
//       )}
//     </>
//   );
// };

// export default FloatingAskBrewra;
