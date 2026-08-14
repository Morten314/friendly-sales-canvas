import { Bot, Check, Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { OutreachPlanStep } from "../lib/aggregateOutreachPlan";
import type { TouchCopy } from "../lib/outreachCopy";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headline: string;
  snippet: string;
  step: OutreachPlanStep;
  touch: TouchCopy;
  /** Commit the agreed draft back onto the touch's block on the Signals page. */
  onCommit: (patch: { subject: string; body: string }) => void;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "Make it shorter and punchier",
  "Lead with the signal, not with us",
  "Soften the ask",
  "Rewrite for a CFO audience",
];

/**
 * Agentic chat for one outreach touch. The user iterates with the agent, the
 * live draft updates each turn, and "Save to signal" commits it to the card.
 */
const OutreachCopyChat = ({
  open,
  onOpenChange,
  headline,
  snippet,
  step,
  touch,
  onCommit,
}: Props) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState({ subject: touch.subject, body: touch.body });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTurns([]);
      setDraft({ subject: touch.subject, body: touch.body });
      setInput("");
      setError(null);
    }
  }, [open, touch.subject, touch.body]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, busy]);

  const ask = async (message: string) => {
    const text = message.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    const history = turns;
    setTurns((t) => [...t, { role: "user", content: text }]);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("refine-outreach-copy", {
        body: {
          headline,
          snippet,
          cohortLabel: step.label,
          relevance: step.relevance,
          touch: { day: touch.day, channel: touch.channel, action: touch.action },
          subject: draft.subject,
          body: draft.body,
          history,
          message: text,
        },
      });
      if (fnError) throw fnError;
      setDraft({ subject: data?.subject ?? draft.subject, body: data?.body ?? draft.body });
      setTurns((t) => [...t, { role: "assistant", content: data?.reply ?? "Updated the draft." }]);
    } catch {
      setError("The agent could not respond. Your draft is unchanged.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-blue-600" />
            Edit with the agent
          </DialogTitle>
          <DialogDescription className="text-xs">
            Day {touch.day} · {touch.channel} · {step.label}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          {/* Conversation */}
          <div className="flex flex-col rounded-md border border-gray-200">
            <div ref={scrollRef} className="h-64 space-y-2 overflow-y-auto p-2">
              {turns.length === 0 && (
                <p className="text-[11px] text-gray-500">
                  Tell the agent what to change. The draft on the right updates each turn.
                </p>
              )}
              {turns.map((t, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-md px-2 py-1.5 text-[11px] leading-relaxed ${
                    t.role === "user"
                      ? "ml-auto bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {t.content}
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Rewriting…
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1 border-t border-gray-100 p-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void ask(p)}
                  disabled={busy}
                  className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
            <form
              className="flex gap-1.5 border-t border-gray-100 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. mention their hiring push in the opener"
                className="h-8 text-[11px]"
              />
              <Button type="submit" size="sm" className="h-8 px-2" disabled={busy}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>

          {/* Live draft */}
          <div className="space-y-1.5 rounded-md border border-gray-200 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Working draft
            </p>
            {touch.channel === "email" && (
              <input
                value={draft.subject}
                onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                placeholder="Subject"
                className="w-full rounded border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-900"
              />
            )}
            <textarea
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              rows={12}
              className="w-full resize-y whitespace-pre-wrap rounded border border-gray-200 px-2 py-1 text-[11px] leading-relaxed text-gray-700"
            />
          </div>
        </div>

        {error && <p className="text-[11px] text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              onCommit(draft);
              onOpenChange(false);
            }}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Save and Commit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutreachCopyChat;
