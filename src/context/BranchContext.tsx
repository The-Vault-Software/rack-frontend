import { createContext, useContext } from 'react';
import type { Branch } from '../client/types.gen';

export interface BranchContextType {
  selectedBranch: Branch | null;
  setSelectedBranch: (branch: Branch | null) => void;
  branches: Branch[];
  isLoading: boolean;
}

export const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}
