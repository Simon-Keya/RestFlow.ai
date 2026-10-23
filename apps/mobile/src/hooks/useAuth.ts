// apps/mobile/src/hooks/useAuth.ts
import { useAuthStore } from '../features/auth/authStore';

export const useAuth = () => {
  const { user, token, isAuthenticated, isLoading, login, logout } = useAuthStore();

  const signIn = async (email: string, password: string) => {
    await login(email, password);
  };

  const signOut = async () => {
    await logout();
  };

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    signIn,
    signOut,
  };
};