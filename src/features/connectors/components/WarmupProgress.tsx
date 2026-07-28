import type { ApolloWarmup } from "../contracts";

import { Button } from "@/components/ui/button";

export function WarmupProgress({
  warmup,
  onDeepLink,
}: {
  warmup: Pick<ApolloWarmup, "ready_count" | "missing">;
  onDeepLink: (hint: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{warmup.ready_count} of 4 agents ready</p>
      {warmup.missing.length > 0 && (
        <ul className="space-y-1">
          {warmup.missing.map((m) => (
            <li key={m.step}>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-left"
                onClick={() => onDeepLink(m.deep_link_hint)}
              >
                {m.label}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
