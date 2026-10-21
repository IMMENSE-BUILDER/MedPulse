---
name: Obsidian Precision
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffffff'
  on-tertiary: '#2f3131'
  tertiary-container: '#e2e2e2'
  on-tertiary-container: '#636565'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 52px
    letterSpacing: -0.04em
  headline-xl-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.03em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  code-inline:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.5rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system embodies high-performance engineering discipline: utilitarian, ultra-crisp, and uncompromisingly modern. Built for technical operators, developers, and platform architects, the visual tone avoids decorative fluff, neon glows, and soft organic metaphors. Instead, it mirrors the architectural rigor of command-line tools, modern terminal emulators, and low-latency infrastructure consoles.

The aesthetic fuses **Minimalism** with an **Architectural High-Density Layout**. The interface is anchored by deep pitch-black backdrops, razor-sharp hairline borders, and pure white type hierarchy. Contrast is applied with mathematical precision: elements earn visual prominence strictly through functional state changes, typographic density, or precise blue status accents. The resulting emotional response is extreme focus, speed, stability, and supreme technical confidence.

## Colors

The palette operates on absolute values, rejecting diffuse blurs and multicolored gradients in favor of sharp, distinct surface tiers and high-contrast accessibility.

- **Canvas Base**: `#000000` serves as the root viewport canvas.
- **Surface Elevation Layers**:
  - `Surface 1 (Card/Layer)`: `#0a0a0a`
  - `Surface 2 (Float/Hover)`: `#121212`
  - `Surface 3 (Subtle Inset/Active)`: `#18181b`
- **Hairline Borders**:
  - `Border Default`: `#27272a` (1px solid hairline)
  - `Border Strong / Focus`: `#3f3f46`
- **Text & Foreground**:
  - `Text Primary`: `#ffffff` (High-contrast content and active labels)
  - `Text Secondary`: `#fafafa` (Headlines and emphasized readouts)
  - `Text Muted`: `#a1a1aa` (Standard descriptions and metadata)
  - `Text Subtle`: `#71717a` (De-emphasized labels, shortcuts, and counters)
- **Signal Accents**:
  - `Accent Primary (Blue)`: `#0000ff` (default state for primary buttons, verified badges, live pings, and savings statistics; white text on solid fills)
  - `Accent Hover (Dark Blue)`: `#0041c2` (hover state for solid blue buttons only)
  - `Accent Background`: `rgba(0, 0, 255, 0.10)` (subtle 10–15% opacity fills behind blue badges)

## Typography

The typographic hierarchy prioritizes legibility, density, and precision alignment.

- **Primary Interface Face**: **Geist** delivers crisp geometric forms, tight tracking on display headings, and clear vertical rhythm on UI body copy. Negative letter-spacing is applied systematically to display headers to eliminate loose whitespace.
- **Data & Monospace Face**: **JetBrains Mono** is utilized for metadata counters, IDs, API keys, badge readouts, commit hashes, and keyboard shortcuts.
- **Hierarchy Enforcers**: Headlines never use drop shadows or gradient text masks. High-contrast pure white (`#ffffff`) conveys direct structural titles; muted tones (`#a1a1aa` / `#71717a`) anchor narrative copy and secondary telemetry.

## Layout & Spacing

Layouts adhere to an explicit, modular 12-column fluid grid system pinned inside a max-width container of `1280px` for optimal data density.

- **Grid Discipline**:
  - **Desktop (>=1024px)**: 12-column grid with 24px (`1.5rem`) gutters and 48px (`3rem`) margins. Content spans standard multi-column modules (3, 4, 6, 8, or 12 columns).
  - **Tablet (768px - 1023px)**: 8-column layout with 24px (`1.5rem`) gutters and 32px (`2rem`) margins. Secondary sidebars collapse into toggleable panels.
  - **Mobile (<768px)**: 4-column layout with 16px (`1rem`) gutters and 16px (`1rem`) margins. Multi-column structures collapse vertically into continuous unified cards.
- **Rhythm**: Element padding relies strictly on a 4px/8px incremental base. Compact gaps (`0.5rem` to `1rem`) ensure high information density without visual crowding.

## Elevation & Depth

Visual hierarchy is communicated entirely through **tonal surface layering** and **hairline boundaries**, completely avoiding ambient drop shadows, blurred silhouettes, and glow artifacts.

- **Flat Tonal Hierarchy**:
  - **Level 0 (Canvas)**: `#000000` base plane.
  - **Level 1 (Structural Cards & Sections)**: `#0a0a0a` with a 1px solid border of `#27272a`.
  - **Level 2 (Interactive Elements, Hover States, Floating Menus)**: `#121212` with a 1px solid border of `#3f3f46`.
  - **Level 3 (Modals & Tooltips)**: `#18181b` framed with a high-contrast 1px solid `#3f3f46` boundary.
- **Ghost Outlines**: Separation between interactive tiers is governed strictly by the 1px hairline border. Shadows are restricted to an optional 0px offset edge shadow: `box-shadow: 0 0 0 1px #27272a`.

## Shapes

The design system employs a refined, compact corner radius (`roundedness: 1`). 

- Default interactive elements (buttons, text inputs, segmented pills, chip controls) feature a precise `0.25rem` (4px) corner radius.
- Structural cards and floating flyout panels feature an intentional `0.5rem` (8px) corner radius (`rounded-lg`).
- Outer application frames and dialog viewports use `0.75rem` (12px) maximum (`rounded-xl`).
- Micro indicators, status avatars, and live deployment pings remain strict circles (`rounded-full`).

## Components

### Buttons
- **Primary**: Blue (`#0000ff`) solid background with white (`#ffffff`) text, font weight 600, rounded-xl. On hover: dark blue (`#0041c2`) background. Primary buttons are the only solid-blue controls.
- **Secondary**: Surface-2 (`#121212`) background, 1px solid hairline (`#27272a`), `#ffffff` text. On hover: border transitions to `#3f3f46` with `#18181b` fill, or to blue at 40% for accent actions.
- **Ghost**: Transparent fill, muted text (`#a1a1aa`). On hover: `#121212` background, white text.

### Badges & Chips
- **Status / Savings (Blue)**: `#000000` or `#0a0a0a` background with a 1px hairline border of `rgba(0, 0, 255, 0.3)`. Text is `#0000ff` rendered in `label-sm` (`JetBrains Mono`). Accompanied by a solid 6px blue circle ping.
- **Neutral Chip**: `#121212` fill, `#27272a` hairline border, `#a1a1aa` mono text.

### Trust & provenance surfaces
- **Savings receipt**: one panel per comparison, driven only by real per-10-tab offers. The delta uses mono/blue emphasis; the “per 10-tab strip” basis is always explicit. Monthly/yearly values are projections from the user-adjustable strips-per-month control and must be labelled as projections. Never render the receipt when there is no positive real delta. Copy receipt is a ghost action with a transient confirmation.
- **Provenance chips**: every offer shows how it was verified (`verified_by`), the source host as an outbound link with an external-link icon, the NABL batch when present, and “as of …” freshness. Demo fixtures must read “demo fixture”; unverified stock reads “Stock unverified — run agent”. Never hide that a price is a demo fixture.
- **Share link**: a ghost pill in each result header. The URL carries `q`, `pin` and `type`; the copy action shows a transient “Link copied” state.
- **Real progress**: stage list with timestamps measured from actual SSE arrivals and a total; the completed panel may stay visible. Never show simulated steps or invented timings.

### Empty states
- The pre-search state explains the real pipeline in plain language and offers example-query pills that actually run. Never fake a progress bar or placeholder prices. If a query cannot be decoded, show honest alternatives from real search results instead of a dead end.

### Form Inputs
- **Text Fields**: Pitch surface `#0a0a0a`, 1px border `#27272a`, `#ffffff` text, `#71717a` placeholder. 
- **Focus State**: 1px solid border `#ffffff` (or active `#3f3f46`) with zero outer ring glow. Sharp, immediate transition.
- **Checkboxes & Radios**: 16px square/circle with `#0a0a0a` base and `#27272a` stroke. When active: solid `#ffffff` fill with an inset `#000000` check icon.

### Cards & Panels
- Constructed with `#0a0a0a` background and a continuous 1px `#27272a` border. Header bars within cards are separated with a 1px solid `#27272a` horizontal hairline divider.
- Hoverable cards transition the border color directly from `#27272a` to `#3f3f46` without elevation lifting or translation.

### Data Tables & Lists
- Table headers utilize `#71717a` uppercase `label-sm` text with a 1px solid `#27272a` bottom border.
- Alternating row zebra striping is prohibited; rows sit on `#000000` and highlight to `#0a0a0a` on pointer hover, separated by clean 1px hairline rules.

### Code Snippets & Monospace Blocks
- Inset `#050505` background, 1px `#27272a` border, `#fafafa` syntax copy, JetBrains Mono font family, featuring a floating one-click copy trigger with a 4px radius.