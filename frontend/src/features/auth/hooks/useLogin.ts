import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@/shared/auth";
import { auth } from "@/shared/auth/firebase";
import { useTenant } from "@/shared/tenant";

// Wraps the existing Login.tsx post-login sequence verbatim. AuthContext is NOT
// restructured (tracked separately); this just gives the component isPending /
// error ergonomics and a relocatable hook (spec 20 §3.8).
export function useLogin() {
  const { login, fetchOrgId } = useAuth();
  const { selectTenant } = useTenant();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await login(email, password);
      const user = auth.currentUser;
      if (user?.uid) {
        const { orgId: fetchedOrgId, orgName: fetchedOrgName } = await fetchOrgId(user.uid);
        const orgIdToUse = fetchedOrgId || "brewra";
        const orgNameToUse = fetchedOrgName || "Brewra";
        selectTenant({
          id: orgIdToUse,
          name: orgNameToUse,
          domain: `${orgIdToUse}.com`,
        });
        const pendingFullName = localStorage.getItem("pendingFullName");
        if (pendingFullName) {
          localStorage.setItem(`userFullName_${user.uid}`, pendingFullName);
          localStorage.removeItem("pendingFullName");
        }
      }
    },
  });
}

export function useSignup() {
  const { signup } = useAuth();
  return useMutation({
    mutationFn: async ({
      email,
      password,
      fullName,
    }: {
      email: string;
      password: string;
      fullName: string;
    }) => {
      await signup(email, password);
      // Stored temporarily; associated with the user id after they log in.
      localStorage.setItem("pendingFullName", fullName);
    },
  });
}
