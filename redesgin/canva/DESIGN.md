---
name: Obsidian Glass
colors:
  surface: '#13131b'
  surface-dim: '#13131b'
  surface-bright: '#393841'
  surface-container-lowest: '#0d0d15'
  surface-container-low: '#1b1b23'
  surface-container: '#1f1f27'
  surface-container-high: '#292932'
  surface-container-highest: '#34343d'
  on-surface: '#e4e1ed'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e4e1ed'
  inverse-on-surface: '#303038'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#ddb7ff'
  on-secondary: '#490080'
  secondary-container: '#6f00be'
  on-secondary-container: '#d6a9ff'
  tertiary: '#4ae176'
  on-tertiary: '#003915'
  tertiary-container: '#00a74b'
  on-tertiary-container: '#003111'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#f0dbff'
  secondary-fixed-dim: '#ddb7ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#6900b3'
  tertiary-fixed: '#6bff8f'
  tertiary-fixed-dim: '#4ae176'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005321'
  background: '#13131b'
  on-background: '#e4e1ed'
  surface-variant: '#34343d'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  toolbar-height: 48px
  container-margin: 24px
  canvas-gutter: 32px
---

## Brand & Style

This design system is engineered for a high-performance, spatial canvas environment. It evokes a sense of "digital craftsmanship" through a blend of deep, monolithic backgrounds and ethereal, translucent interfaces. The brand personality is futuristic, precise, and authoritative, targeting power users who value speed and aesthetic depth.

The visual direction combines **Glassmorphism** with **Minimalism**. It utilizes high-index backdrop blurs (16px+) to create a sense of physical layering without the clutter of traditional shadows. The "Deep Obsidian" canvas acts as a void, where UI elements float as luminous, tactile objects. Interactive elements leverage subtle neon glows to signal state changes, creating a UI that feels responsive and alive.

## Colors

The palette is anchored in a true-dark obsidian base, providing maximum contrast for the neon accents. 

- **Canvas:** The primary workspace uses `#0a0a0b`. A subtle dot-grid pattern in `#1f1f23` should be overlaid with an 8px spacing interval.
- **Glass Surfaces:** Containers use a semi-transparent white tint (`rgba(255, 255, 255, 0.03)`) paired with a `backdrop-filter: blur(16px)`.
- **Accents:** 
    - **Neon Indigo:** Used for primary actions and selection states.
    - **Electric Violet:** Used for AI-driven features and creative tools.
    - **Emerald Green:** Used for success states and collaborative presence.
    - **Sunset Pink:** Used for destructive actions or urgent notifications.
- **Borders:** All glass panels must have a 1px solid border (`rgba(255, 255, 255, 0.08)`) to define edges against the dark background.

## Typography

The typography system balances the geometric modernity of **Outfit** for headlines with the utilitarian precision of **Inter** for functional text.

- **Headlines:** Set in Outfit with tight letter-spacing to create a "locked-in" premium feel. 
- **Body:** Inter is used for all reading and input text to ensure maximum legibility at small sizes.
- **Special States:** Labels and metadata should use `label-sm` with increased letter-spacing and uppercase styling to mimic technical instrumentation.
- **Anti-Aliasing:** Ensure `-webkit-font-smoothing: antialiased` is applied across all dark mode surfaces to maintain crispness on high-DPI displays.

## Layout & Spacing

This design system uses a **Fluid Spatial Grid** focused on the central canvas. 

- **The Canvas:** Elements on the infinite canvas are not bound by a traditional column grid but snap to an 8px underlying grid system.
- **Interface Overlays:** Floating toolbars and panels utilize fixed positioning with a 24px margin from the viewport edges.
- **Spacing Rhythm:** All dimensions and paddings must be multiples of 4px. 16px is the standard "Comfortable" padding for glass containers.
- **Responsive Behavior:** On mobile, the toolbars collapse into a single bottom-anchored "Command Bar," and the side panels transition to full-screen overlays with a heavy backdrop blur (24px) to obscure the canvas.

## Elevation & Depth

Depth is conveyed through **refraction and luminance** rather than traditional cast shadows.

1.  **Level 0 (Base):** The Obsidian canvas (`#0a0a0b`).
2.  **Level 1 (Panels):** Semi-transparent glass with 16px blur. No shadow, but a 1px interior border.
3.  **Level 2 (Active/Floating):** Floating toolbars and active cards. These feature a "Neon Glow" — a 15px-20px spread shadow with 10% opacity using the primary Indigo or Violet color.
4.  **Level 3 (Modals):** Centered overlays with a background dimming effect (60% opacity black) and a 32px backdrop blur on the canvas behind it.

Use `z-index` systematically: 100 for toolbars, 200 for panels, 500 for modals/menus.

## Shapes

The shape language is primarily **Rounded** with strategic use of **Pill-shapes** for interactive controls.

- **Standard Containers:** Use a 0.5rem (8px) border radius for cards, notes, and map elements.
- **Interactive Toolbars:** Floating bars (like the bottom tool dock) must be fully pill-shaped (`9999px`) to emphasize their "floating" nature.
- **Selection Brackets:** Use sharp or slightly soft (4px) corners for marquee selection boxes to differentiate transient interactions from permanent UI objects.

## Components

### Buttons
- **Primary:** Neon Indigo background, white text, subtle outer glow on hover. Pill-shaped.
- **Ghost:** No background, `rgba(255,255,255,0.08)` border, becomes semi-opaque on hover.

### Toolbars
- **Floating Dock:** Bottom-centered, pill-shaped glass container. Active tool icons receive a circular Indigo background glow.
- **Context Menus:** Glass panels with 12px radius. Menu items have an 8px radius hover state in `rgba(255,255,255,0.05)`.

### Input Fields
- Transparent background with a bottom-only 1px border. On focus, the border animates to a full 1px Indigo stroke around the entire field with a subtle glow.

### Cards & Notes
- Content cards use the standard glass style. In a "Canvas" context, they should have a subtle drop shadow only when being dragged to simulate physical lifting from the surface.

### Chips & Presence
- Circular avatars for collaborators with a 2px colored ring (Indigo, Emerald, etc.) indicating their current activity or selection color.