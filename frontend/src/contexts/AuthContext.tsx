import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AuthUser, UserRole, ViewMode } from '@/types/auth';
import { hasAccess, ROLE_DEFAULT_VIEW } from '@/types/auth';
import { generateDevToken, DEV_USERS } from '@/lib/devAuth';
import { setAuthToken, setTokenRefresher } from '@/lib/apiClient';

interface AuthContextValue {
  user: AuthUser;
  token: string;
  isAuthenticated: boolean;
  canAccess: (viewMode: ViewMode) => boolean;
  switchRole: (role: UserRole) => void; // Dev-mode role switching
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'noui_dev_role';

export function AuthProvider({ children }: { children: ReactNode }) {
  const savedRole = (localStorage.getItem(STORAGE_KEY) as UserRole) || 'staff';
  const [user, setUser] = useState<AuthUser>(DEV_USERS[savedRole] || DEV_USERS.staff);
  const [token, setToken] = useState<string>('');

  // Generate JWT whenever user changes
  useEffect(() => {
    generateDevToken(user).then((t) => {
      setToken(t);
      setAuthToken(t);
    });
  }, [user]);

  // Register token refresh callback so apiClient can recover from 401s
  useEffect(() => {
    setTokenRefresher(async () => {
      const t = await generateDevToken(user);
      setToken(t);
      setAuthToken(t);
      return t;
    });
    return () => setTokenRefresher(null);
  }, [user]);

  const canAccess = useCallback(
    (viewMode: ViewMode) => hasAccess(user.role, viewMode),
    [user.role],
  );

  const switchRole = useCallback((role: UserRole) => {
    localStorage.setItem(STORAGE_KEY, role);
    setUser(DEV_USERS[role] || DEV_USERS.staff);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, canAccess, switchRole }}>
      {token ? children : null}
    </AuthContext.Provider>
  );
}

// Re-export ROLE_DEFAULT_VIEW for convenience
export { ROLE_DEFAULT_VIEW };

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
