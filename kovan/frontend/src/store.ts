import { create } from "zustand";
import { authClient } from "./auth-client";

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  banned?: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;

  // Actions
  fetchSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isAdmin: false,

  fetchSession: async () => {
    try {
      const res = await authClient.getSession();
      if (res.data?.user) {
        const user = res.data.user as User;
        set({ user, isAdmin: user.role === "admin", loading: false });
      } else {
        set({ user: null, isAdmin: false, loading: false });
      }
    } catch {
      set({ user: null, isAdmin: false, loading: false });
    }
  },

  logout: async () => {
    await authClient.signOut();
    set({ user: null, isAdmin: false });
  },
}));
