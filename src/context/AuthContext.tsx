import { createContext, useContext } from 'react';
import type { CustomUser } from '../client/types.gen';

export interface AuthContextType {
  user: CustomUser | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
