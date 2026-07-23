import React from 'react';

interface CanvioLogoIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export function CanvioLogoIcon({ size = 24, color = 'currentColor', className = '' }: CanvioLogoIconProps) {
  const gradientId = React.useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', flexShrink: 0, color }}
    >
      {/* Outer Gradient Orbital Arc */}
      <circle
        cx="12"
        cy="12"
        r="7.5"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="40 8"
      />

      {/* Connected Diagonal Tail / Node Line */}
      <path d="M12 12L18.5 18.5" stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" />

      {/* Central Glowing Node Point */}
      <circle cx="12" cy="12" r="2.3" fill={`url(#${gradientId})`} />

      <defs>
        <linearGradient id={gradientId} x1="3" y1="3" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00d2ff" />
          <stop offset="0.45" stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
    </svg>
  );
}
