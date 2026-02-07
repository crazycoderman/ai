import React, { ReactNode } from 'react';
import { X, Minus, Maximize2 } from 'lucide-react';

interface WindowFrameProps {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  isActive?: boolean;
  className?: string;
  onClose?: () => void;
}

const WindowFrame: React.FC<WindowFrameProps> = ({ 
  title, 
  children, 
  icon, 
  isActive = true, 
  className = "",
  onClose
}) => {
  return (
    <div 
      className={`
        bg-win98-gray p-1 shadow-out flex flex-col
        transition-all duration-300 ease-out transform hover:scale-[1.005] hover:shadow-modern
        ${className}
      `}
    >
      {/* Title Bar */}
      <div className={`
        px-2 py-1 flex items-center justify-between mb-1
        ${isActive ? 'bg-gradient-to-r from-win98-blue to-win98-blue-light text-white' : 'bg-win98-gray-dark text-win98-gray-light'}
      `}>
        <div className="flex items-center gap-2 font-bold tracking-wider text-sm select-none">
          {icon}
          <span className="truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-5 h-4 bg-win98-gray shadow-out flex items-center justify-center active:shadow-in">
            <Minus size={10} className="text-black" />
          </button>
          <button className="w-5 h-4 bg-win98-gray shadow-out flex items-center justify-center active:shadow-in">
            <Maximize2 size={10} className="text-black" />
          </button>
          <button 
            onClick={onClose}
            className="w-5 h-4 bg-win98-gray shadow-out flex items-center justify-center active:shadow-in ml-1"
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