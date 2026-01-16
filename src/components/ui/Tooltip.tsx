import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  icon?: boolean;
}

export default function Tooltip({ content, children, className, icon = false }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative inline-flex items-center group/tooltip"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {icon && (
        <Info className="h-3.5 w-3.5 ml-1 text-gray-400 cursor-help hover:text-blue-500 transition-colors" />
      )}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -8, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, y: -8, x: '-50%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={cn(
              "absolute bottom-full left-1/2 mb-2 w-64 p-3 bg-gray-900/95 backdrop-blur-sm text-white text-[11px] rounded-lg shadow-2xl z-[100] pointer-events-none border border-white/10",
              className
            )}
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-[6px] border-transparent border-t-gray-900/95" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
