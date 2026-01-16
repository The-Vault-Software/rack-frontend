import React, { useState, useRef, useLayoutEffect } from 'react';
import { Info } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  icon?: boolean;
  delay?: number;
}

export default function Tooltip({ content, children, className, icon = false, delay = 0 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left + rect.width / 2
      });
    }
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useLayoutEffect(() => {
    if (isVisible && triggerRef.current) {
       const updatePos = () => {
         const rect = triggerRef.current?.getBoundingClientRect();
         if (rect) {
           setCoords({
             top: rect.top,
             left: rect.left + rect.width / 2
           });
         }
       };
       window.addEventListener('scroll', updatePos, true);
       window.addEventListener('resize', updatePos);
       return () => {
         window.removeEventListener('scroll', updatePos, true);
         window.removeEventListener('resize', updatePos);
       };
    }
  }, [isVisible]);

  return (
    <div 
      ref={triggerRef}
      className="relative inline-flex items-center group/tooltip"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {icon && (
        <Info className="h-4 w-4 ml-1.5 text-gray-400 cursor-help hover:text-blue-500 transition-colors duration-200" />
      )}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: 'spring', damping: 15, stiffness: 400 }}
            style={{ 
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              transform: 'translate(-50%, -100%)',
              marginTop: '-8px'
            }}
            className={cn(
              "w-72 p-4 bg-gray-900/90 backdrop-blur-md text-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-[9999] pointer-events-none border border-white/10 ring-1 ring-white/20",
              className
            )}
          >
            <div className="relative z-10 text-[12px] leading-relaxed font-medium">
              {content}
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-[6px] border-transparent border-t-gray-900/90" />
            
            {/* Subtle Gradient Glow */}
            <div className="absolute inset-0 rounded-xl bg-linear-to-br from-white/5 to-transparent pointer-none" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
