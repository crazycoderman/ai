import React, { ReactNode } from 'react';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';

interface WindowFrameProps {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  isActive?: boolean;
  className?: string;
  isMaximized?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

const WindowFrame: React.FC<WindowFrameProps> = ({ 
  title, 
  children, 
  icon, 
  isActive = true, 
  className = "",
  isMaximized = false,
  onClose,
  onMinimize,
  onMaximize
}) => {
  return (
    <div 
      className={`
        bg-win98-gray p-1 shadow-out flex flex-col
        transition-all duration-200 ease-out 
        ${!isMaximized && 'hover:scale-[1.005] hover:shadow-modern'}
        ${className}
      `}
    >
      {/* Title Bar */}
      <div 
        className={`
          px-2 py-1 flex items-center justify-between mb-1 select-none
          ${isActive ? 'bg-gradient-to-r from-win98-blue to-win98-blue-light text-white' : 'bg-win98-gray-dark text-win98-gray-light'}
        `}
        onDoubleClick={onMaximize}
      >
        <div className="flex items-center gap-2 font-bold tracking-wider text-sm">
          {icon}
          <span className="truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onMinimize?.(); }}
            className="w-5 h-4 bg-win98-gray shadow-out flex items-center justify-center active:shadow-in hover:bg-win98-gray-light"
          >
            <Minus size={10} className="text-black" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onMaximize?.(); }}
            className="w-5 h-4 bg-win98-gray shadow-out flex items-center justify-center active:shadow-in hover:bg-win98-gray-light"
          >
            {isMaximized ? <Minimize2 size={10} className="text-black" /> : <Maximize2 size={10} className="text-black" />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
            className="w-5 h-4 bg-win98-gray shadow-out flex items-center justify-center active:shadow-in ml-1 hover:bg-win98-gray-light"
          >
            <X size={12} className="text-black" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-win98-gray overflow-hidden flex flex-col relative">
        {children}
      </div>
    </div>
  );
};

export default WindowFrame;