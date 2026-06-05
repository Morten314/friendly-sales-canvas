import { useCallback, useState } from "react";

/**
 * Primary-state localStorage hook for signal accept/reject IDs (TD-FE-49 — this is
 * state, not cache, so it stays on localStorage). Extracted verbatim from
 * SignalsPage's inline read/write logic (Phase 8, Task 11; consumed in Task 12).
 *
 * Keys are frozen (Spec 27 §2.3):
 *   signals_<uid>_accepted
 *   signals_<uid>_rejected
 *
 * Serialization mirrors the live page exactly: state is held as a `Set<string>`
 * for dedup, persisted via `JSON.stringify(Array.from(set))`, and read back with
 * `JSON.parse` into a `Set` (defaulting to empty on missing/unparseable). Append
 * dedups through Set spread (`new Set([...prev, id])`). Exposed values are arrays.
 */
export function useSignalAcceptance(userId: string) {
  const storageKey = `signals_${userId}`;
  const acceptedKey = `${storageKey}_accepted`;
  const rejectedKey = `${storageKey}_rejected`;

  const [accepted, setAccepted] = useState<Set<string>>(() => readSet(acceptedKey));
  const [rejected, setRejected] = useState<Set<string>>(() => readSet(rejectedKey));

  const markAccepted = useCallback(
    (signalId: string) => {
      setAccepted((prev) => {
        const next = new Set([...prev, signalId]);
        try {
          localStorage.setItem(acceptedKey, JSON.stringify(Array.from(next)));
        } catch (error) {
          console.error("Error saving accepted signals to localStorage:", error);
        }
        return next;
      });
    },
    [acceptedKey],
  );

  const markRejected = useCallback(
    (signalId: string) => {
      setRejected((prev) => {
        const next = new Set([...prev, signalId]);
        try {
          localStorage.setItem(rejectedKey, JSON.stringify(Array.from(next)));
        } catch (error) {
          console.error("Error saving rejected signals to localStorage:", error);
        }
        return next;
      });
    },
    [rejectedKey],
  );

  return {
    accepted: Array.from(accepted),
    rejected: Array.from(rejected),
    markAccepted,
    markRejected,
  };
}

/** Read a JSON-array localStorage key into a Set; default empty on missing/unparseable. */
function readSet(key: string): Set<string> {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return new Set<string>(JSON.parse(saved));
    }
  } catch (error) {
    console.error("Error loading signals from localStorage:", error);
  }
  return new Set<string>();
}
