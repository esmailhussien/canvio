import React, { ReactNode, useId } from 'react';
import './Tooltip.css';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', className = '' }) => {
  const tooltipId = useId();

  // Associate the tooltip with its trigger so screen readers announce it and
  // keyboard users get the same hint hover users see.
  let trigger: ReactNode = children;
  if (React.isValidElement<{ 'aria-describedby'?: string }>(children) && !children.props['aria-describedby']) {
    trigger = React.cloneElement(children, {
      'aria-describedby': tooltipId,
    });
  }

  return (
    <div className={`canvio-tooltip-wrapper ${className}`.trim()}>
      {trigger}
      <div
        id={tooltipId}
        role="tooltip"
        className={`canvio-tooltip canvio-tooltip-${position}`}
      >
        {content}
      </div>
    </div>
  );
};
