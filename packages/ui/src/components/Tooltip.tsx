import React, { ReactNode } from 'react';
import './Tooltip.css';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  return (
    <div className="canvio-tooltip-wrapper">
      {children}
      <div className={`canvio-tooltip canvio-tooltip-${position}`}>
        {content}
      </div>
    </div>
  );
};
