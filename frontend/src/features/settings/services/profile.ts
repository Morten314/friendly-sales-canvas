import type { UntypedBackendProfile } from "@/shared/types/escape-hatches";

/** GET /api/profile/{type}?user_id= with the SettingsPage ownership check.
 *  Returns null when the profile belongs to another user (TD-FE-11). */
export async function fetchOwnProfile(
  profileType: "user" | "agent_name",
  userId: string,
): Promise<UntypedBackendProfile | null> {
  const res = await fetch(`/api/profile/${profileType}?user_id=${encodeURIComponent(userId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as UntypedBackendProfile;
  if (data?.user_id && data.user_id !== userId) return null;
  if (!data?.user_id) return { ...data, user_id: userId };
  return data;
}
