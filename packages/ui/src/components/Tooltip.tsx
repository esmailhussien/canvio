import React, { ReactNode } from 'react';
import './Tooltip.css';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', className = '' }) => {
  return (
    <div className={`canvio-tooltip-wrapper ${className}`.trim()}>
      {children}
      <div className={`canvio-tooltip canvio-tooltip-${position}`}>
        {content}
      </div>
    </div>
  );
};
