// Scout's chat panel, rendered inside the market-research surface (Scout's research
// surface IS market-research — Spec 30 §1.1). Only the ScoutDeployment page lives in
// features/scout; Scout's chat stays here under scout-chat/.

import { Bot, X, Send, Loader2, User } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

import type { EditRecord } from "../types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildApiUrl } from "@/shared/api/transport";
import { useAuth } from "@/shared/auth";
import { getUserLocalStorage } from "@/shared/lib/cacheUtils";

interface ScoutChatPanelProps {
  showScoutChat: boolean;
  isSplitView: boolean;
  hasEdits: boolean;
  showEditHistory: boolean;
  editHistory: EditRecord[];
  lastEditedField: string;
  context?:
    | "market-size"
    | "industry-trends"
    | "competitor-landscape"
    | "regulatory-compliance"
    | "market-entry"
    | "lead-stream"
    | "general";
  isPostSave?: boolean;
  customMessage?: string;
  /** Subtitle under workspace heading (e.g. Lead Stream → Chat with Scout) */
  workspaceLine?: string;
  inputPlaceholder?: string;
  /** Filled into the input when user picks a suggested question */
  prefillQuestion?: string | null;
  onPrefillConsumed?: () => void;
  /** Shown directly under the welcome message (e.g. Lead Stream) */
  suggestedQuestions?: string[];
  onPickSuggestedQuestion?: (question: string) => void;
  /** Compact lead context below “Researching …” (replaces sidebar Lead Profile) */
  leadHeaderDetail?:
    | { type: "single"; company?: string; source?: string }
    | {
        type: "multi";
        leadCount: number;
        leadSummaries: { name: string; company: string }[];
      };
  onClose: () => void;
  /** Hide close button for simpler Lead Stream view */
  hideCloseButton?: boolean;
}

const ScoutChatPanel: React.FC<ScoutChatPanelProps> = ({
  showScoutChat,
  isSplitView: _isSplitView,
  hasEdits,
  showEditHistory,
  editHistory,
  lastEditedField,
  context = "market-size",
  isPostSave = false,
  customMessage,
  workspaceLine,
  inputPlaceholder,
  prefillQuestion,
  onPrefillConsumed,
  suggestedQuestions,
  onPickSuggestedQuestion,
  leadHeaderDetail,
  onClose,
  hideCloseButton = false,
}) => {
  const { currentUser, orgId } = useAuth();
  const [userInput, setUserInput] = useState("");
  type ChatTurn = { id: string; role: "user" | "assistant"; content: string };
  const [transcript, setTranscript] = useState<ChatTurn[]>([]);
  /** Prior turns for /signal_Ask (non–edit-mode only). */
  const [signalAskHistory, setSignalAskHistory] = useState<{ user: string; assistant: string }[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const newTurnId = () => `turn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  /** Wider textarea for “Chat with Scout” + Lead Stream tabs. */
  const useExpandedChatInput = context === "general" || context === "lead-stream";

  // Function to clean up response content - removes special characters and formats properly
  const cleanResponseContent = (content: string): string => {
    if (!content) return "";

    return (
      content
        // FIRST: Remove any literal "response_message" text that might appear in the response
        .replace(/["']?response_message["']?\s*[:=]\s*/gi, "")
        .replace(/response_message/gi, "")
        // Remove any literal "response_json" text
        .replace(/["']?response_json["']?\s*[:=]\s*/gi, "")
        .replace(/response_json/gi, "")
        // Remove JSON-like structures that appear after the main message (e.g., "competitor_analysis": {...})
        // Match patterns like: ", "key": {...}" or ", "key": "value""
        .replace(/,\s*["']?\w+_analysis["']?\s*[:=]\s*\{[^}]*\}/gi, "")
        .replace(/,\s*["']?\w+["']?\s*[:=]\s*\{[^{}]*\{[^}]*\}[^}]*\}/gi, "")
        .replace(/,\s*["']?\w+["']?\s*[:=]\s*\{[^}]*\}/gi, "")
        // Remove standalone JSON objects at the end
        .replace(/\s*,\s*\{[^}]*\}/g, "")
        // Remove key-value pairs that appear after commas (JSON-like patterns)
        .replace(/,\s*["']?\w+["']?\s*[:=]\s*["']?[^"',}]+["']?\s*/gi, "")
        // Handle escaped newline patterns - convert literal "\n" (backslash-n) to actual newline first
        .replace(/\\n/g, "\n")
        // Handle n- patterns (convert to newlines with bullets) - only when clearly formatting
        // Match "n-" only when preceded by space, start of line, or punctuation
        .replace(/(^|[.:!?\s])n-\s*/g, "$1\n• ")
        // Handle n n patterns (convert to paragraph breaks) - only when clearly two separate formatting n's
        .replace(/(^|[.:!?\s])n\s+n(\s|$|[.:!?])/g, "$1\n\n$2")
        // Handle n followed by actual newline character - only standalone formatting n
        .replace(/(^|[.:!?\s])n\s*\n/g, "$1\n")
        // Handle n followed by whitespace and capital letter (new paragraph) - only when clearly formatting
        // Must be preceded by space/punctuation to avoid matching "in APAC" -> "i APAC"
        .replace(/(^|[.:!?\s])n\s+([A-Z])/g, "$1\n\n$2")
        // Handle n followed by bullet character - only when clearly formatting
        .replace(
          /(^|[.:!?\s])n\s*([•\-\u2022\u25E6\u25AA\u25AB\u25A0\u25A1\u2B24\u25CB])/g,
          "$1\n$2",
        )
        // Handle standalone n at end of sentence - convert to newline
        .replace(/([.:!?])\s+n(\s|$)/g, "$1\n$2")
        // Handle r character used as line break (convert to newline)
        .replace(/\s+r\s+/g, "\n")
        .replace(/\s+r$/gm, "\n")
        .replace(/r\s+([A-Z])/g, "\n$1")
        // Remove markdown-style separators (--, ---, etc.) - do this early to catch all patterns
        // Handle bullets (both • and -) followed by dashes
        .replace(/[•\-\u2022\u25E6\u25AA\u25AB\u25A0\u25A1\u2B24\u25CB]\s*[-]{2,}\s*/g, "") // Remove any bullet followed by dashes (e.g., "• --")
        // Remove multiple dashes (3 or more) anywhere - do this before handling double dashes
        .replace(/[-]{3,}/g, "")
        // Remove standalone dash separators on their own lines
        .replace(/\n\s*[-]{2,}\s*\n/g, "\n\n")
        // Remove dashes at end of lines
        .replace(/\s+[-]{2,}\s*\n/g, "\n")
        // Remove dashes at start of lines
        .replace(/\n\s*[-]{2,}\s*/g, "\n")
        // Replace " -- " (double dash with spaces) with double newline for section separation
        .replace(/\s+[-]{2}\s+/g, "\n\n")
        // Remove trailing double dashes
        .replace(/\s+[-]{2}$/gm, "")
        // Remove leading double dashes
        .replace(/^[-]{2}\s+/gm, "")
        // Remove markdown formatting symbols
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/#{1,6}\s/g, "")
        .replace(/`{1,3}/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove markdown links but keep text
        // Normalize bullet points to standard bullet
        // FIRST: Replace literal "u2022" text with actual bullet character
        .replace(/u2022/gi, "•")
        .replace(/[•◦▪▫■□●○]/g, "•")
        .replace(/[\u2022\u25E6\u25AA\u25AB\u25A0\u25A1\u2B24\u25CB]/g, "•")
        // Normalize arrows
        .replace(/[→←↑↓]/g, "→")
        // Normalize dashes (em dash, en dash to regular dash)
        .replace(/[—–]/g, "-")
        // Normalize quotes
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        // Clean up excessive whitespace but preserve intentional line breaks
        .replace(/[ \t]+/g, " ") // Multiple spaces/tabs to single space
        .replace(/\n{3,}/g, "\n\n") // More than 2 newlines to 2 newlines
        // Format lists properly - ensure consistent bullet formatting
        .replace(/\n\s*[-•]\s*/g, "\n• ")
        .replace(/\n\s*\d+\.\s*/g, "\n• ")
        // Remove empty lines with only whitespace or dashes
        .replace(/\n\s*[-•\s]*\n/g, "\n\n")
        // Ensure proper spacing around punctuation
        .replace(/\s+([.,!?;:])/g, "$1")
        .replace(/([.,!?;:])\s*([A-Z])/g, "$1 $2")
        // Remove problematic special characters but keep common punctuation and symbols
        .replace(/[^\w\s•\-\n\r.,!?;:()'"→$%&@#+=<>]/g, " ")
        // Clean up any double spaces that might have been created
        .replace(/  +/g, " ")
        // Remove leading/trailing whitespace from each line but preserve line breaks
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        // Remove leading/trailing whitespace but preserve internal structure
        .trim()
    );
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;
    const question = userInput.trim();
    setUserInput("");
    setTranscript((prev) => [...prev, { id: newTurnId(), role: "user", content: question }]);
    await callChatAPI(question);
  };

  const callChatAPI = async (question: string) => {
    setIsLoading(true);
    try {
      // Determine API endpoint based on context and edit state
      const isEditMode = hasEdits || isPostSave;

      let url: string;
      let requestOptions: RequestInit;

      if (isEditMode) {
        // Edit diff context: GET /ask (not signal_Ask)
        url = buildApiUrl(`ask/?question=${encodeURIComponent(question)}`);

        // Get the stored JSON data from localStorage (user-specific)
        const storedOriginalJson = getUserLocalStorage(
          `${context}_original_json`,
          currentUser?.uid,
        );
        const storedModifiedJson = getUserLocalStorage(
          `${context}_modified_json`,
          currentUser?.uid,
        );

        if (storedOriginalJson && storedModifiedJson) {
          console.log("📤 Sending to /ask API with JSON context:", {
            question,
            original_json: JSON.parse(storedOriginalJson),
            modified_json: JSON.parse(storedModifiedJson),
          });
        }

        requestOptions = {
          method: "GET",
          headers: {
            accept: "application/json",
          },
        };
      } else {
        // Same contract as Signals Swagger: POST /signal_ask_claude (not GET /chat)
        if (!currentUser?.uid) {
          setTranscript((prev) => [
            ...prev,
            { id: newTurnId(), role: "assistant", content: "Please sign in to chat with Scout." },
          ]);
          setIsLoading(false);
          return;
        }
        url = buildApiUrl("signal_ask_claude");
        requestOptions = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            org_id: orgId ?? "org-123",
            user_id: currentUser.uid,
            question,
            history: signalAskHistory,
          }),
        };
      }

      console.log(
        `🤖 Making Scout API call to ${isEditMode ? "/ask" : "/signal_ask_claude"} with question:`,
        question,
      );

      const response = await fetch(url, requestOptions);

      if (response.ok) {
        const data = await response.json();
        console.log("Raw Scout API Response:", data);
        console.log("Response type:", typeof data);
        console.log("Is array:", Array.isArray(data));

        // Backend /signal_Ask: answer; /chat legacy: response_message, response
        const pickScoutBody = (obj: Record<string, unknown> | null | undefined): string => {
          if (!obj || typeof obj !== "object") return "";
          const ans = obj.answer;
          const msg = obj.response_message;
          const alt = obj.response;
          if (typeof ans === "string" && ans.trim() !== "") return ans;
          if (typeof msg === "string" && msg.trim() !== "") return msg;
          if (typeof alt === "string" && alt.trim() !== "") return alt;
          return "";
        };

        // Handle different response formats — extract user-facing text only
        let answer = "";
        if (Array.isArray(data) && data.length > 0) {
          console.log("Processing as array, first element:", data[0]);
          console.log("First element type:", typeof data[0]);

          if (typeof data[0] === "string") {
            answer = data[0];
          } else if (typeof data[0] === "object" && data[0] !== null) {
            answer = pickScoutBody(data[0] as Record<string, unknown>);
          } else {
            answer = String(data[0]);
          }
        } else if (typeof data === "object" && data !== null) {
          console.log("Processing as object, keys:", Object.keys(data));
          answer = pickScoutBody(data as Record<string, unknown>);
        } else if (typeof data === "string") {
          console.log("Processing as string");
          // Try to parse as JSON string in case it contains response / response_message
          try {
            const parsedData = JSON.parse(data) as Record<string, unknown>;
            answer = pickScoutBody(parsedData);
          } catch (_e) {
            // If it's not JSON, use the string as-is
            answer = data;
          }
        } else {
          console.log("Unknown data format, falling back");
          answer = "I received your question but couldn't generate a proper response.";
        }

        // If answer is empty, provide a fallback message instead of showing JSON
        if (!answer || answer.trim() === "") {
          answer = "I received your question but couldn't generate a proper response.";
        }

        // If answer contains JSON-like structures (e.g., starts with quote and has JSON), extract only the message part
        // Split on common JSON delimiters to separate message from JSON
        if (answer.includes('", "') || answer.includes('",\n"')) {
          // Extract only the part before the JSON starts (before ", "key":)
          const jsonStartIndex = answer.search(/",\s*["']?\w+["']?\s*[:=]/);
          if (jsonStartIndex > 0) {
            answer = answer
              .substring(0, jsonStartIndex)
              .replace(/^["']|["']$/g, "")
              .trim();
          }
        }

        console.log("Final answer:", answer);
        // Clean and format the response before setting it
        const cleanedAnswer = cleanResponseContent(answer);
        setTranscript((prev) => [
          ...prev,
          { id: newTurnId(), role: "assistant", content: cleanedAnswer },
        ]);
        if (!isEditMode) {
          setSignalAskHistory((prev) => [...prev, { user: question, assistant: cleanedAnswer }]);
        }
      } else {
        setTranscript((prev) => [
          ...prev,
          {
            id: newTurnId(),
            role: "assistant",
            content: "Sorry, I'm having trouble connecting right now. Please try again later.",
          },
        ]);
        console.error("Failed to get response from Scout API");
      }
    } catch (error) {
      setTranscript((prev) => [
        ...prev,
        {
          id: newTurnId(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again later.",
        },
      ]);
      console.error("Error calling Scout API:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fixed ScoutChatPanel getContextualScoutMessage function
  const getContextualScoutMessage = () => {
    // Use custom message if provided (for deletion scenarios or Lead Stream)
    if (customMessage) {
      return customMessage;
    }

    if (context === "lead-stream") {
      return "Hi there! 👋 I'm Scout. Want to research leads or find companies that match your ICP? I can help with company research, market positioning, and discovering similar companies.";
    }

    if (context === "general") {
      return "Hi there! 👋 I'm Scout. Want to explore something new? I can help with market research, market sizing, company analysis, industry trends, competitive landscape, and more. What would you like to investigate?";
    }

    if (context === "competitor-landscape") {
      if (showEditHistory && editHistory.length > 0) {
        return "Hi!! Reviewing your competitor changes? Let me know if you'd like me to pull latest funding news or analyze market positioning shifts.";
      }

      if (hasEdits) {
        if (lastEditedField.includes("market share") || lastEditedField.includes("share")) {
          return "I noticed you updated market share figures for competitors. Want me to pull the latest news or analysis?";
        }
        if (lastEditedField.includes("executive summary")) {
          return "You updated the executive summary for competitor analysis. Should I provide additional market intelligence or competitive insights?";
        }
        if (lastEditedField.includes("funding") || lastEditedField.includes("news")) {
          return "Would you like me to analyze new funding rounds for these competitors or check for recent M&A activity?";
        }
        if (lastEditedField.includes("emerging players")) {
          return "I see you updated emerging players data. Should I research these companies or identify additional rising competitors?";
        }
        if (lastEditedField.includes("deleted")) {
          return "You removed a section from the competitor analysis. Would you like me to suggest alternative content or analyze why that section might not be relevant?";
        }
        return "I noticed you updated the competitor analysis. Would you like me to provide additional insights on competitive positioning or recent market moves?";
      }

      // Default message for competitor-landscape context (even when hasEdits is false)
      return "Hi there! 👋 I'm Scout. Ready to dive deeper into competitor analysis? I can help with market share trends, funding rounds, and competitive positioning.";
    }

    if (context === "industry-trends") {
      if (showEditHistory && editHistory.length > 0) {
        return "Hi!! Reviewing your changes? Let me know if you'd like to validate data or explore why market estimates shifted.";
      }

      if (hasEdits) {
        if (lastEditedField.includes("AI") || lastEditedField.includes("ai")) {
          return "I noticed you updated AI adoption metrics. Would you like deeper insights on AI implementation trends or regulatory impacts?";
        }
        if (lastEditedField.includes("cloud") || lastEditedField.includes("migration")) {
          return "I see you modified cloud migration data. Should we explore the key drivers behind this trend or regional variations?";
        }
        return "I noticed you updated the industry trends analysis. Would you like me to provide additional insights based on your changes?";
      }

      // Default message for industry-trends context (even when hasEdits is false)
      return "Hi there! 👋 I'm Scout. Want to dive deeper into industry trends and emerging technologies? Ask me anything.";
    }

    if (context === "regulatory-compliance") {
      // Post-save specific message
      if (isPostSave) {
        return "Great work saving your regulatory updates! 🎉 Now that your compliance analysis is saved, I can help you take it further. What would you like to explore next?";
      }

      if (showEditHistory && editHistory.length > 0) {
        return "Hi!! Reviewing your compliance changes? Let me know if you'd like me to analyze regulatory impacts or track upcoming deadlines.";
      }

      if (hasEdits) {
        if (lastEditedField.includes("EU AI Act") || lastEditedField.includes("ai act")) {
          return "I noticed you updated EU AI Act information. Would you like the latest timeline updates or implementation guidance?";
        }
        if (lastEditedField.includes("data protection") || lastEditedField.includes("GDPR")) {
          return "I see you modified data protection details. Should I provide regional compliance variations or recent enforcement updates?";
        }
        if (lastEditedField.includes("deleted")) {
          return "You removed a compliance section. Would you like me to suggest alternative regulatory content or analyze why that section might not be relevant?";
        }
        return "I noticed you updated the regulatory analysis. Would you like me to provide additional compliance insights or track regulatory changes?";
      }

      return "Hi there! 👋 I'm Scout. Ready to dive deeper into regulatory compliance? I can help you stay ahead of changing regulations and assess compliance risks.";
    }

    if (context === "market-entry") {
      // Post-save specific message
      if (isPostSave) {
        return "Hi!! I noticed you adjusted the Market Pathways. Want help exploring alternatives?";
      }

      if (showEditHistory && editHistory.length > 0) {
        return "Hi!! Reviewing your market entry changes? Let me know if you'd like me to validate entry timelines or explore alternative go-to-market strategies.";
      }

      if (hasEdits) {
        if (lastEditedField.includes("entry barriers") || lastEditedField.includes("barriers")) {
          return "I noticed you updated entry barriers. Would you like me to research ways to overcome these challenges or analyze their impact on timelines?";
        }
        if (
          lastEditedField.includes("competitive differentiation") ||
          lastEditedField.includes("differentiation")
        ) {
          return "I see you modified competitive differentiation. Should I help identify additional competitive advantages or analyze market positioning strategies?";
        }
        if (lastEditedField.includes("time to market") || lastEditedField.includes("timeline")) {
          return "You updated the market entry timeline. Would you like me to validate these timelines or suggest ways to accelerate market entry?";
        }
        if (lastEditedField.includes("deleted")) {
          return "I noticed you removed the Market Entry & Growth Strategy section. Want me to help refine or replace it?";
        }
        return "I noticed you updated the market entry strategy. Would you like me to provide additional insights on go-to-market approaches or competitive positioning?";
      }

      return "Hi!! 👋 I'm Scout. Ready to help you navigate your market entry and growth plan. Want to dig deeper into barriers, timelines, or the best go-to-market path?";
    }

    // Default market-size context - only reached when context is not competitor-landscape, industry-trends, or regulatory-compliance
    if (showEditHistory && editHistory.length > 0) {
      return "Hi!! Reviewing your changes? Let me know if you'd like to validate data or explore why market estimates shifted.";
    }

    if (hasEdits) {
      if (lastEditedField.includes("APAC") || lastEditedField.includes("apac")) {
        return "I noticed you updated the APAC growth rate. Would you like deeper insights on regional trends or competitor presence in APAC?";
      }
      if (lastEditedField.includes("TAM") || lastEditedField.includes("tam")) {
        return "I see you modified the TAM estimate. Should we explore the key drivers behind this market size or break down by industry verticals?";
      }
      return "I noticed you updated the market analysis. Would you like me to provide additional insights based on your changes?";
    }

    return "Hi there! 👋 I'm Scout. Want to dive deeper into your market size and opportunities? Ask me anything.";
  };

  useEffect(() => {
    if (prefillQuestion == null || prefillQuestion === "") return;
    setUserInput(prefillQuestion);
    onPrefillConsumed?.();
  }, [prefillQuestion, onPrefillConsumed]);

  /** Keep latest messages and “thinking” row in view */
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript, isLoading]);

  if (!showScoutChat) return null;

  return (
    <div className="w-full max-w-none min-w-0 bg-white rounded-lg border border-gray-200 p-4 sm:p-6 transition-all duration-500 animate-slide-in-right min-h-[min(72vh,880px)] flex-1 flex flex-col">
      {!hideCloseButton && (
        <div className="flex items-center justify-end mb-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {(workspaceLine || context === "lead-stream") && (
        <div className="mb-3 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Scout Agent Workspace</h2>
          {workspaceLine && <p className="text-xs text-muted-foreground mt-0.5">{workspaceLine}</p>}
          {leadHeaderDetail?.type === "single" &&
            (leadHeaderDetail.source || leadHeaderDetail.company) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {/* Company appears in workspaceLine as “— Acme Corp”; show here only if no source */}
                {!leadHeaderDetail.source && leadHeaderDetail.company && (
                  <span>
                    Company:{" "}
                    <span className="font-medium text-foreground">{leadHeaderDetail.company}</span>
                  </span>
                )}
                {leadHeaderDetail.source && (
                  <span className="inline-flex items-center gap-1">
                    Source:{" "}
                    <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-foreground">
                      {leadHeaderDetail.source}
                    </span>
                  </span>
                )}
              </div>
            )}
          {leadHeaderDetail?.type === "multi" && (
            <div className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
              <p className="text-foreground font-medium">
                {leadHeaderDetail.leadCount} leads selected
              </p>
              {leadHeaderDetail.leadSummaries.length > 0 && (
                <ul className="max-h-24 overflow-y-auto space-y-0.5 pl-0 list-none">
                  {leadHeaderDetail.leadSummaries.slice(0, 8).map((row, i) => (
                    <li key={`${row.name}-${i}`}>
                      <span className="font-medium text-foreground">{row.name}</span>
                      <span className="text-muted-foreground"> · {row.company}</span>
                    </li>
                  ))}
                  {(leadHeaderDetail.leadSummaries.length > 8 ||
                    leadHeaderDetail.leadCount > 8) && (
                    <li className="italic text-muted-foreground">…</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div ref={chatContainerRef} className="space-y-4 mb-4 flex-1 min-h-0 overflow-y-auto">
        <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border border-blue-200 space-y-2.5">
          <p className="text-sm sm:text-base text-gray-700">{getContextualScoutMessage()}</p>
          {suggestedQuestions && suggestedQuestions.length > 0 && onPickSuggestedQuestion && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-0.5 border-t border-blue-200/60">
              <span className="text-[10px] font-medium text-muted-foreground shrink-0">Try</span>
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onPickSuggestedQuestion(q)}
                  className="inline-flex max-w-full text-left text-[11px] leading-snug rounded-full border border-blue-200/80 bg-white/80 px-2.5 py-1 text-foreground hover:bg-primary/10 hover:border-primary/40 transition-colors"
                >
                  <span className="line-clamp-2">{q}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {transcript.map((turn) =>
          turn.role === "user" ? (
            <div key={turn.id} className="flex justify-end w-full">
              <div className="max-w-[min(100%,48rem)] rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground shadow-sm">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{turn.content}</p>
                </div>
              </div>
            </div>
          ) : (
            <div key={turn.id} className="flex justify-start w-full">
              <div className="w-full max-w-[min(100%,72rem)] rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <Bot className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" aria-hidden />
                  <div className="text-sm sm:text-base text-blue-900 leading-relaxed whitespace-pre-wrap break-words min-w-0">
                    {turn.content}
                  </div>
                </div>
              </div>
            </div>
          ),
        )}

        {isLoading && (
          <div className="flex justify-start w-full">
            <div className="w-full max-w-[min(100%,72rem)] rounded-lg border border-muted bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" aria-hidden />
                <span>Scout is thinking…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={transcriptEndRef} className="h-px w-full shrink-0" aria-hidden />
      </div>

      <div className={`flex gap-2 mt-auto ${useExpandedChatInput ? "items-end" : ""}`}>
        {useExpandedChatInput ? (
          <Textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={inputPlaceholder ?? "Ask Scout anything… (Shift+Enter for a new line)"}
            className="flex-1 min-h-[100px] max-h-[240px] resize-y"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSendMessage();
              }
            }}
            disabled={isLoading}
            rows={4}
          />
        ) : (
          <Input
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Ask Scout anything..."
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={isLoading}
          />
        )}
        <Button
          size="sm"
          onClick={handleSendMessage}
          disabled={isLoading || !userInput.trim()}
          className={`bg-blue-600 hover:bg-blue-700 shrink-0 ${useExpandedChatInput ? "h-10 self-end" : ""}`}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export default ScoutChatPanel;
