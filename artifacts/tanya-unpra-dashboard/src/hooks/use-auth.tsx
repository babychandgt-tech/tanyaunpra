import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter, useGetMe, getGetMeQueryKey, UserProfile } from "@workspace/api-client-react";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (token: string, refreshToken: string, user: UserProfile) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [, setLocation] = useLocation();

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("token"));
  }, []);

  const logoutAction = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setToken(null);
    setLocation("/login");
  }, [setLocation]);

  const { data, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  const user = data?.user || null;

  useEffect(() => {
    if (error) {
      logoutAction();
    }
  }, [error, logoutAction]);

  const ROLE_DEFAULT_PATH: Record<string, string> = {
    admin: "/dashboard",
    dosen: "/jadwal",
    mahasiswa: "/kalender",
  };

  const loginAction = (newToken: string, refreshToken: string, userData: UserProfile) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("refreshToken", refreshToken);
    setToken(newToken);
    const dest = ROLE_DEFAULT_PATH[userData.role] ?? "/kalender";
    setLocation(dest);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading: isLoading && !!token, login: loginAction, logout: logoutAction }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
