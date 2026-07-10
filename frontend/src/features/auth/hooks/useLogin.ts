import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@/shared/auth";
import { auth } from "@/shared/auth/firebase";

// Relocatable login hook giving the component isPending / error ergonomics
// (spec 20 §3.8). No longer wraps the original Login.tsx sequence verbatim:
// the org-resolution await was removed (spec 48 WS1 / Task 2), see below.
export function useLogin() {
  const { login } = useAuth();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await login(email, password);
      // Org resolution is NOT awaited here: AuthContext's onAuthStateChanged
      // independently resolves it for the same user, and the requireOrg route
      // gate is the single waiter for the has-org outcome (spec 48 WS1 / Task 2).
      // Awaiting it here too was a duplicate resolution that could hang login
      // for the full bounded-retry window on a cold/down backend.
      const user = auth.currentUser;
      if (user?.uid) {
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
