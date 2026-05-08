import type { AuthProvider } from "@refinedev/core";
import type { ApiError, LoginResponse } from "../types/api";
import { http } from "./axios";
import { clearSession, loadSession, saveSession } from "./storage";

export const authProvider: AuthProvider = {
  login: async ({ username, password, errorName, loginFailedMessage, forbiddenMessage, noTokenMessage }) => {
    try {
      const { data } = await http.post<LoginResponse>("/api/auth/login", { username, password });

      if (!data?.token) {
        return {
          success: false,
          error: {
            name: String(errorName ?? "Login error"),
            message: String(noTokenMessage ?? loginFailedMessage ?? "Login failed"),
          },
        };
      }

      saveSession({
        token: data.token,
        role: String(data.role),
        username: String(username),
        expiresAtEpochMillis: data.expiresAtEpochMillis,
      });

      if (String(data.role).toUpperCase() !== "ADMIN") {
        clearSession();
        return {
          success: false,
          error: {
            name: String(errorName ?? "Login error"),
            message: String(forbiddenMessage ?? loginFailedMessage ?? "Login failed"),
          },
        };
      }

      return { success: true, redirectTo: "/" };
    } catch (error: any) {
      const apiError = error?.response?.data as ApiError | undefined;
      const message = loginFailedMessage ?? apiError?.error ?? apiError?.message ?? error?.message ?? "Login failed";
      const suffix = apiError?.code ? ` [${apiError.code}]` : "";

      return {
        success: false,
        error: { name: String(errorName ?? "Login error"), message: `${message}${suffix}` },
      };
    }
  },

  logout: async () => {
    try {
      const session = loadSession();
      if (session?.token) {
        await http.post("/api/auth/logout");
      }
    } catch {
      // ignore backend logout error
    } finally {
      clearSession();
    }

    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const session = loadSession();
    if (!session?.token) return { authenticated: false, redirectTo: "/login" };

    if (session.expiresAtEpochMillis && Date.now() > session.expiresAtEpochMillis) {
      clearSession();
      return { authenticated: false, redirectTo: "/login" };
    }

    return { authenticated: true };
  },

  getIdentity: async () => {
    const session = loadSession();
    if (!session) return null;
    return { name: session.username, role: session.role };
  },

  getPermissions: async () => {
    const session = loadSession();
    return session?.role ?? null;
  },

  onError: async (error) => {
    const anyError = error as any;
    if (anyError?.statusCode === 401 || anyError?.response?.status === 401) {
      clearSession();
      return { logout: true, redirectTo: "/login" };
    }
    return {};
  },
};
