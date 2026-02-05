import type { ReactNode } from 'react';

interface SimpleTooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
}

export default function SimpleTooltip({ content, children, className = '' }: SimpleTooltipProps) {
  return (
    <div className={`group relative ${className}`}>
      {children}
      <div className="absolute left-0 -top-8 hidden group-hover:block z-50 w-max max-w-xs pointer-events-none">
        <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 shadow-lg relative">
          {content}
          <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </div>
  );
}
