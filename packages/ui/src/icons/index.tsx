import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

const IconBase = ({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

export const IconSelect = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    <path d="M13 13l6 6" />
  </IconBase>
);

export const IconPan = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </IconBase>
);

export const IconDraw = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </IconBase>
);

export const IconHighlighter = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m9 11 6-6a2.1 2.1 0 0 1 3 3l-6 6" />
    <path d="m7 13 4 4" />
    <path d="m3 21 4.5-1 8.5-8.5-4-4L3.5 16 3 21Z" />
    <path d="M14 21h7" />
  </IconBase>
);

export const IconArrowTool = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 19 19 5" />
    <path d="M9 5h10v10" />
  </IconBase>
);

export const IconText = (props: IconProps) => (
  <IconBase {...props}>
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" x2="15" y1="20" y2="20" />
    <line x1="12" x2="12" y1="4" y2="20" />
  </IconBase>
);

export const IconSticky = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 4h16v12.59l-4.59 4.41H4V4z" />
    <path d="M15 15h4v4" />
  </IconBase>
);

export const IconMap = (props: IconProps) => (
  <IconBase {...props}>
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
    <line x1="9" x2="9" y1="3" y2="18" />
    <line x1="15" x2="15" y1="6" y2="21" />
  </IconBase>
);

export const IconRelation = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="5" cy="12" r="3" />
    <circle cx="19" cy="12" r="3" />
    <path d="M8 12h8" />
    <path d="M13 9l3 3-3 3" />
  </IconBase>
);

export const IconEraser = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </IconBase>
);

export const IconUndo = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </IconBase>
);

export const IconRedo = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
  </IconBase>
);

export const IconZoomIn = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" x2="16.65" y1="21" y2="16.65" />
    <line x1="11" x2="11" y1="8" y2="14" />
    <line x1="8" x2="14" y1="11" y2="11" />
  </IconBase>
);

export const IconZoomOut = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" x2="16.65" y1="21" y2="16.65" />
    <line x1="8" x2="14" y1="11" y2="11" />
  </IconBase>
);

export const IconFitToWorld = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    <rect x="8" y="8" width="8" height="8" rx="2" />
  </IconBase>
);

export const IconShare = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" x2="12" y1="2" y2="15" />
  </IconBase>
);

export const IconTheme = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" x2="12" y1="1" y2="3" />
    <line x1="12" x2="12" y1="21" y2="23" />
    <line x1="4.22" x2="5.64" y1="4.22" y2="5.64" />
    <line x1="18.36" x2="19.78" y1="18.36" y2="19.78" />
    <line x1="1" x2="3" y1="12" y2="12" />
    <line x1="21" x2="23" y1="12" y2="12" />
    <line x1="4.22" x2="5.64" y1="19.78" y2="18.36" />
    <line x1="18.36" x2="19.78" y1="5.64" y2="4.22" />
  </IconBase>
);

export const IconTrash = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </IconBase>
);

export const IconMinimap = (props: IconProps) => (
  <IconBase {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </IconBase>
);

export const IconArrowRight = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </IconBase>
);

export const IconX = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </IconBase>
);

export const IconCopy = (props: IconProps) => (
  <IconBase {...props}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </IconBase>
);

export const IconLock = (props: IconProps) => (
  <IconBase {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </IconBase>
);

export const IconUnlock = (props: IconProps) => (
  <IconBase {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </IconBase>
);

export const IconArrowUp = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </IconBase>
);

export const IconArrowDown = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </IconBase>
);

export const IconImage = (props: IconProps) => (
  <IconBase {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </IconBase>
);

export const IconShape = (props: IconProps) => (
  <IconBase {...props}>
    <rect width="16" height="16" x="4" y="4" rx="3" ry="3" />
  </IconBase>
);

export const IconFrame = (props: IconProps) => (
  <IconBase {...props}>
    <line x1="6" x2="6" y1="3" y2="21" />
    <line x1="18" x2="18" y1="3" y2="21" />
    <line x1="3" x2="21" y1="6" y2="6" />
    <line x1="3" x2="21" y1="18" y2="18" />
  </IconBase>
);

export const IconCode = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m8 9-3 3 3 3" />
    <path d="m16 9 3 3-3 3" />
    <path d="m14 5-4 14" />
  </IconBase>
);
