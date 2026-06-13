import { Badge } from "@/components/ui/badge";

export function UnverifiedBadge({ emailStatus }: { emailStatus?: string | null }) {
  if (emailStatus !== "unverified") return null;
  return (
    <Badge variant="outline" className="text-amber-600 border-amber-300">
      Unverified
    </Badge>
  );
}
