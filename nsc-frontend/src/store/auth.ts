import api from "@/lib/axios";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "super_admin" | "admin" | "operator";

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (args: {
    email: string;
    password: string;
    role: Role;
  }) => Promise<void>;
  logout: () => void;
  hasRole: (roles: Role | Role[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      async login({ email, password: _password, role }) {
        // Try real API login
        type LoginResponse = {
          status: boolean;
          code: number;
          message?: string;
          data?: {
            id?: number | string;
            uuid?: string;
            first_name?: string;
            last_name?: string;
            email?: string;
            role?: string;
            [k: string]: unknown;
          };
          tokens?: {
            access?: { token?: string; expires?: string };
            refresh?: { token?: string; expires?: string };
          };
        };
        const res = await api.post<LoginResponse>("/auth/login", {
          email,
          password: _password,
        });
        const payload = res;
        console.log(res)
        if (!payload?.status) {
          const msg = String(payload?.message || "Login failed");
          const err = new Error(msg) as Error & { response?: { data?: { message?: string } } };
          err.response = { data: { message: msg } };
          throw err;
        }

        type UserData = NonNullable<LoginResponse["data"]>;
        type Tokens = NonNullable<LoginResponse["tokens"]>;
        const userData = (payload.data || {}) as UserData;
        const tokens = (payload.tokens || {}) as Tokens;

        const fullName = [userData.first_name, userData.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        const mappedRole: Role =
          (userData.role === "super-admin"
            ? "super_admin"
            : userData.role === "user"
            ? "operator"
            : (userData.role as Role)) || role;

        const nextUser: User = {
          id: (userData.uuid as string) || String(userData.id ?? "u_local"),
          name:
            fullName ||
            (userData.email ? String(userData.email).split("@")[0] : "") ||
            "User",
          email: (userData.email as string) || email,
          roles: [mappedRole],
        };

        const accessToken = tokens.access?.token ?? undefined;
        const refreshToken = tokens.refresh?.token ?? undefined;
        // Persist tokens for interceptors as well
        if (accessToken) sessionStorage.setItem("token", accessToken);
        if (refreshToken) sessionStorage.setItem("refreshToken", refreshToken);

        set({
          user: nextUser,
          accessToken: accessToken ?? "token",
          refreshToken: refreshToken ?? null,
          isAuthenticated: true,
        });
      },
      logout() {
        try {
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("refreshToken");
        } catch {
          // no-op: sessionStorage may be unavailable (SSR) or blocked
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
      hasRole(roles) {
        const current = get().user?.roles || [];
        const required = Array.isArray(roles) ? roles : [roles];
        return required.some((r) => current.includes(r));
      },
    }),
    {
      name: "auth-store",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
