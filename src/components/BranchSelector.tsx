import { useBranch } from '../context/BranchContext';
import { Store } from 'lucide-react';

export function BranchSelector() {
  const { branches, selectedBranch, setSelectedBranch } = useBranch();

  if (branches.length === 0) return null;

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center space-x-2 bg-white border rounded-md px-3 py-1.5 shadow-sm">
        <Store className="h-4 w-4 text-gray-500" />
        <select
          value={selectedBranch?.id || ''}
          onChange={(e) => {
            const branch = branches.find((b) => b.id === e.target.value);
            setSelectedBranch(branch || null);
          }}
          className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer"
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
