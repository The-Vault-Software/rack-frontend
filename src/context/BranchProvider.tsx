import { useState, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { v1BranchListOptions } from '../client/@tanstack/react-query.gen';
import { BranchContext } from './BranchContext';
import { useAuth } from './AuthContext';
import type { Branch } from '../client/types.gen';

export function BranchProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [selectedBranch, setSelectedBranchState] = useState<Branch | null>(null);

  const { data: branches = [], isLoading } = useQuery({
    ...v1BranchListOptions(),
    enabled: isAuthenticated, 
  });

  // Load selected branch from localStorage or default to first branch
  useEffect(() => {
    if (branches.length > 0 && !selectedBranch) {
      const savedBranchId = localStorage.getItem('selectedBranchId');
      const found = savedBranchId ? branches.find((b) => b.id === savedBranchId) : null;
      
      if (found) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedBranchState(found);
      } else {
        setSelectedBranchState(branches[0]);
        localStorage.setItem('selectedBranchId', branches[0].id);
      }
    }
  }, [branches, selectedBranch]);

  const setSelectedBranch = (branch: Branch | null) => {
    setSelectedBranchState(branch);
    if (branch) {
      localStorage.setItem('selectedBranchId', branch.id);
    } else {
      localStorage.removeItem('selectedBranchId');
    }
  };

  return (
    <BranchContext.Provider
      value={{
        selectedBranch,
        setSelectedBranch,
        branches,
        isLoading,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}
