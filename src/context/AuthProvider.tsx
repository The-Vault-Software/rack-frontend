import { type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logoutCreateMutation, userInfoRetrieveOptions } from '../client/@tanstack/react-query.gen';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // We use userInfoRetrieve to check session status
  const { data: user, isLoading, error } = useQuery({
    ...userInfoRetrieveOptions(),
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation(logoutCreateMutation());
  
  const logout = () => {
    logoutMutation.mutate({}, {
        onSuccess: () => {
            queryClient.setQueryData(userInfoRetrieveOptions().queryKey, undefined);
            window.location.href = '/login';
        }
    });
  };

  const isAuthenticated = !!user && !error;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
