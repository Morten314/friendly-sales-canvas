# Brewra — Frontend Design System

> **Snapshot — pre-backend-refactor.** This document reflects the backend as the flat `api.py`/`services.py` monolith and is preserved as a point-in-time analysis (authored 2026-05-08). For the **current** backend architecture see [`docs/architecture/BACKEND.md`](../../architecture/BACKEND.md). Frontend sections are likewise a snapshot; the frontend refactor is in progress (see specs 14–21).

> Source: `PWA-multi-tenancy/development/friendly-sales-canvas/`. Tokens + patterns depth.
> The system is shadcn-ui defaults extended with a small "sales" palette. It is **80% token-driven, 20% ad-hoc** — most divergence is in agent surfaces.

## 1. Foundation

| Layer | Choice |
|---|---|
| Component library | **shadcn-ui** (`components.json`: style `default`, baseColor `slate`, cssVariables `true`) |
| Primitives | Radix UI (~25 packages: dialog, dropdown, popover, select, tabs, tooltip, etc.) |
| Utility CSS | Tailwind 3.4 with `tailwindcss-animate`, `@tailwindcss/typography` |
| Icons | `lucide-react@0.462.0` |
| Charts | `recharts@2.12.7` |
| Toasts | `sonner` + legacy `react-hot-toast` |
| Theming | CSS variables in `src/index.css`, consumed via `hsl(var(--…))` in `tailwind.config.ts` |
| Dark mode | Class-based (`darkMode: ['class']`); **no toggle UI in app** — `next-themes` is installed but unused |
| Fonts | **No web font imported.** System sans-serif fallback only. |

The components.json convention means new shadcn components install into `src/components/ui/` with the `slate` baseColor; this is consistent throughout.

## 2. Color Tokens

Tokens are CSS variables (HSL values, no `hsl(...)` wrapper) declared at `:root` and overridden in `.dark`. Tailwind references them as `hsl(var(--token))`.

### 2.1 Light theme (`src/index.css:7-33`)

| Token | HSL | sRGB | Use |
|---|---|---|---|
| `--background` | `0 0% 100%` | `#ffffff` | Page bg |
| `--foreground` | `222.2 84% 4.9%` | near-black | Body text |
| `--card` / `--popover` | `0 0% 100%` | `#ffffff` | Surfaces |
| `--card-foreground` / `--popover-foreground` | `222.2 84% 4.9%` | near-black | Surface text |
| `--primary` | `221.2 83.2% 53.3%` | **`#2563eb`** | Brand blue (Brewra signature) |
| `--primary-foreground` | `210 40% 98%` | near-white | Text on primary |
| `--secondary` | `210 40% 96%` | `#f3f4f6` | Subtle bg |
| `--muted` | `210 40% 96%` | `#f3f4f6` | Mute/disabled bg |
| `--muted-foreground` | `215.4 16.3% 46.9%` | medium gray | Secondary text |
| `--accent` | `210 40% 96%` | `#f3f4f6` | (Same as muted in light — accent is functionally inert) |
| `--destructive` | `0 84.2% 60.2%` | `#ef4444` | Errors / delete |
| `--border` / `--input` | `214.3 31.8% 91.4%` | `#e5e7eb` | Dividers / input borders |
| `--ring` | `221.2 83.2% 53.3%` | `#2563eb` | Focus ring |
| `--radius` | `0.5rem` | 8px | Base radius |

### 2.2 Dark theme (`src/index.css:35-60`)

| Token | HSL | Use |
|---|---|---|
| `--background` | `222.2 84% 4.9%` | Dark blue-black canvas |
| `--foreground` | `210 40% 98%` | Off-white |
| `--primary` | `217.2 91.2% 59.8%` | Lifted blue (`#60a5fa`-ish) |
| `--secondary`, `--muted`, `--accent` | `217.2 32.6% 17.5%` | Dark gray |
| `--destructive` | `0 62.8% 30.6%` | Muted red |
| `--ring` | `224.3 76.3% 94.1%` | High-contrast focus ring |

### 2.3 Chart palette

Five chart tokens per theme, used by Recharts. Light: orange/teal/dark-blue/yellow/coral. Dark: shifted to blue/green/orange/purple/magenta. Defined in `index.css`; no Brewra-specific overrides.

### 2.4 Sales namespace (`tailwind.config.ts:67-73`)

These live **outside** the token system as inline hex:

```ts
sales: {
  blue:      '#2563eb',  // = --primary in light
  teal:      '#0d9488',
  lightBlue: '#93c5fd',
  gray:      '#e5e7eb',
  darkGray:  '#4b5563',
}
```

`Sidebar.tsx` uses `text-sales-blue` rather than `text-primary`, which is the principal source of token drift.

### 2.5 Sidebar tokens (`tailwind.config.ts:56-65`)

`sidebar.background`, `sidebar.foreground`, `sidebar.primary`, `sidebar.primary-foreground`, `sidebar.accent`, `sidebar.accent-foreground`, `sidebar.border`, `sidebar.ring` are wired to `var(--sidebar-*)` — but **the corresponding CSS variables are never declared**. The sidebar component falls back to hardcoded `bg-white text-gray-700` etc. This is dead config that should be either populated or removed.

### 2.6 Agent accents (de facto, not centralized)

| Agent | Treatment | Source |
|---|---|---|
| Scout | Primary blue (`#2563eb`), `Search` icon | Headers, badges |
| Profiler | Primary blue + occasional purple, `Users` icon | Customers/Mission Control headers |
| Strategist tiers | Tier 1 emerald, Tier 2 amber, Tier 3 red — full Tailwind classes inline (`bg-emerald-50 text-emerald-700 border-emerald-200`, etc., with `dark:` counterparts) | `StrategistRecommendations.tsx:24-100`, `StrategistLeadStream.tsx:44-48` |

Tier colors are repeated as long classname strings across files. They should become tokens (`--tier-strong`, `--tier-medium`, `--tier-weak`) so a brand refresh isn't a hand-edit campaign.

## 3. Typography

System sans-serif everywhere. Roles inferred from usage:

| Role | Class chain | Source |
|---|---|---|
| Page title | `text-xl md:text-2xl lg:text-3xl font-bold text-gray-800` | `Header.tsx:153` |
| Page subtitle | `text-sm md:text-base italic font-normal text-gray-600` | `Header.tsx:194` |
| Card title | `text-2xl font-semibold leading-none tracking-tight` | `ui/card.tsx:39` |
| Card description | `text-sm text-muted-foreground` | `ui/card.tsx:53` |
| Button | `text-sm font-medium` | `ui/button.tsx:7` |
| Badge | `text-xs font-semibold` | `ui/badge.tsx:8` |

Notable: page headers use `text-gray-800` instead of `text-foreground`, breaking the dark-mode contract on the most prominent element on every page.

There is no exported type scale. Adding one (e.g. a `typography` plugin or a typed `Heading`/`Text` component) would be a small lift with high consistency payoff.

## 4. Spacing, Radii, Shadows

- **Spacing:** Tailwind defaults; no custom extends. Common values: `gap-1/2/3/4`, `p-3/4/6`, `space-y-2`.
- **Radii (`tailwind.config.ts:75-78`):**
  ```ts
  borderRadius: {
    lg: 'var(--radius)',           // 0.5rem (8px)
    md: 'calc(var(--radius) - 2px)', // 6px
    sm: 'calc(var(--radius) - 4px)', // 4px
  }
  ```
  Cards `rounded-lg`, buttons/inputs `rounded-md`, badges `rounded-full`.
- **Shadows:** Only `shadow-sm` is used in earnest (cards). No elevation scale; layering relies on borders + bg color. This makes drawers, dialogs, and chat panels feel flat.

## 5. Iconography

`lucide-react`, sized by use:
- Sidebar nav: `h-5 w-5` (20px)
- Header / dropdown buttons: `h-4 w-4` (16px)
- Tier and inline action icons: `h-4 w-4` or `h-3 w-3`

Icons inherit color from text. Common set: `Search, Users, FileText, Settings, Compass, Command, Calendar, BarChart, Zap, MessageSquare, RefreshCw, Trash2, Edit, MoreVertical, Mail, Target, Handshake, Megaphone, TrendingUp, Eye, BarChart3, Shield, Archive, AlertCircle, CheckCircle, ChevronDown, ChevronUp, LogOut, PlusCircle`.

## 6. Component Inventory (shadcn primitives present)

`src/components/ui/` contains the standard shadcn set, all installed:

```
accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, card,
carousel, chart, checkbox, collapsible, command, context-menu, dialog,
drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar,
navigation-menu, popover, progress, radio-group, resizable, scroll-area,
select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table,
tabs, textarea, toast, toaster, toggle, toggle-group, tooltip
```

Plus two custom helpers: `MiniLineChart.tsx`, `MiniPieChart.tsx`.

`breadcrumb` and `input-otp` are present but unused in any sampled page — installing on demand would shrink the surface. `sonner` and the legacy shadcn `toast`/`toaster` coexist; standardize on Sonner.

## 7. Layout Patterns

### 7.1 App shell (`components/layout/Layout.tsx`)

```jsx
<div className="flex h-screen bg-gray-50">
  <Sidebar />
  <div className="flex-1 flex flex-col overflow-hidden min-w-0">
    <Header />
    <main className="flex-1 overflow-auto p-3 md:p-4 lg:p-6">
      {children}
    </main>
  </div>
  <Toaster />
</div>
```

Page bg is `bg-gray-50` (not `bg-background`) — another small dark-mode fracture.

### 7.2 Sidebar
Width `w-64` expanded / `w-16` collapsed; `transition-all duration-300`. Mobile: rendered as a `Sheet` (slide-out drawer). Sections: brand → nav (`flex-1 py-4`) → user footer with avatar + logout, all `border-{t,b}`-separated.

### 7.3 Header
`bg-white border-b p-3 md:p-4`. Left: page title + subtitle. Right: per-page actions (Refresh, History, Settings) — buttons collapse to icon-only on mobile (`size={isMobile ? "icon" : "sm"}`). Tenant badge text is hidden on small screens.

### 7.4 Card

Standard shadcn pattern: `Card → CardHeader → CardTitle/CardDescription → CardContent → CardFooter`. `rounded-lg border bg-card text-card-foreground shadow-sm`.

### 7.5 Modal patterns
- **Dialog** for centered modals (`MissionControl`).
- **Sheet** for side drawers (mobile sidebar, history panels).
- **Drawer** (Vaul-based) for mobile-friendly bottom sheets.
- **Popover/HoverCard** for inline contextual info.

### 7.6 Chat / streaming
A recurring pattern: left rail of sessions (collapsible) + right pane with message stream + sticky input. Implemented twice: `ScoutChatWithHistory` and `ProfilerChatWithHistory`. The two should be one component parameterized by agent.

### 7.7 Detail drawer + edit history
`MarketDetailDrawer`, `DataHistoryDialog`, `EditHistoryPanel` form a recurring "open card → drawer detail → history sidebar" triad on Scout's Market Intelligence sections. Worth lifting into a generic component.

### 7.8 Tier card
Strategist's signature pattern: a tier-colored card containing a recommendation grid. Tier color is the only thing distinguishing them; shape is identical.

## 8. Agent UI Conventions

| Agent | Route | Header title / subtitle | Icon | Color signal | Key surface |
|---|---|---|---|---|---|
| **Scout** | `/your-ai-team/scout/:tab` | "Scout" / "Find the best markets before your competitors do" | `Search` | Brand blue | 5 Market Intelligence sections + Lead Stream + Chat |
| **Profiler** | `/customers`, `/mission-control` | "Profiler" / "Define ideal customers, find prospects, and enrich your data" | `Users` | Brand blue (occasional purple) | ICP CRUD + Suggested ICPs + Profiler chat |
| **Strategist** | `/your-ai-team/strategist/:tab` | "Strategist" | `FileText` | Tier emerald/amber/red | Tiered lead stream + sequence builder |
| **Signals** | `/signals` | "Signals" / "Monitor and analyze market signals…" | `Zap` | Per-card agent badge | Unified feed across Scout/Profiler |
| **Mission Control** | `/mission-control` | "Mission Control" / "Tell Brewra about your business…" | `Command` | Brand blue | Profile + Data Sources + ICPs |

Agent identity is currently carried by **route + page title + icon**. Color and typographic differentiation are weak; you could blur identity completely and the UI would still navigate. If "agents" are central to the brand, each should get a signature accent and an info-card / persona pattern that's reused at every entry point.

## 9. Motion

Defined in `tailwind.config.ts:80-106` and `src/index.css:73-158`:

| Animation | Duration / curve | Use |
|---|---|---|
| `accordion-down/up` | 0.2s ease-out | Radix accordion (auto-wired) |
| `fade-in` | 0.3s ease-out | Page enter |
| `slide-in-right` | 0.5s ease-out | Drawer/panel enter |
| `hourglass-rotate` | continuous | Loading flourish |
| `logo-reveal` | 10-step keyframe | Splash/onboarding |
| `animate-spin` | Tailwind default | Refresh icons |

No route-level transitions, no shared layout animations. Sidebar collapse uses CSS `transition-all duration-300` rather than the keyframe system — minor inconsistency.

## 10. Density & Responsiveness

- **Breakpoints:** Tailwind defaults (`sm 640 / md 768 / lg 1024 / xl 1280`) plus `2xl: 1400px` (`tailwind.config.ts:14-19`) and `container { center: true, padding: '2rem' }`.
- **Approach:** Desktop-first base styles, mobile via `md:`/`lg:` overrides.
- **Touch targets:** Sidebar collapsed icons are not 44×44; small buttons (`h-9`, `h-10`) miss the iOS HIG threshold.
- **PWA viewport:** `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`, `apple-mobile-web-app-capable=yes`, `display: standalone`. Theme color `#2563eb`.

## 11. Inconsistencies & Drift

The shortlist of where the system breaks character:

1. **`text-sales-blue` vs `text-primary`** in Sidebar — duplicate truth for the same color.
2. **`text-gray-800` / `text-gray-600` / `bg-gray-50`** baked into Layout, Header, Sidebar — sidesteps the token system and breaks dark mode.
3. **Sidebar CSS variables declared in Tailwind but never set in `index.css`** — dead tokens.
4. **Strategist tier colors** as inline class strings across multiple files — rebrand pain.
5. **Two chat components** (`ScoutChatWithHistory`, `ProfilerChatWithHistory`) that are 90% the same.
6. **Three "Safe…" wrappers** (`SafeChatWithScout`, `SafeMarketIntelligenceTab`, `SafeViewToggle`) suggest iterative error-boundary rewrites; only one is actually imported in production paths.
7. **Sonner + legacy shadcn `toast`** both available — pick one.
8. **No font import** but design relies on system sans — fine as a deliberate choice, but should be documented (or replaced with a hosted font for brand consistency across OSes).
9. **No dark mode toggle** despite full token coverage; either ship the toggle or delete the dark CSS to reduce maintenance.
10. **Agent identity is mostly a label** — no signature color, persona avatar, or motif distinguishing Scout/Profiler/Strategist beyond the page title.

## 12. Recommended Next Moves

Ordered by impact-to-effort:

1. **Add `--tier-1/2/3` tokens** and a `<TierBadge>` / `<TierCard>` primitive — closes the largest source of inline color cruft.
2. **Wire or delete the `--sidebar-*` variables.** Either populate `:root` and `.dark` and migrate Sidebar to `bg-sidebar text-sidebar-foreground`, or remove the Tailwind extension.
3. **Replace `text-gray-*`/`bg-gray-50` in Layout/Header with token equivalents** (`text-foreground`, `bg-muted`, etc.). One PR, restores dark mode.
4. **Decide on dark mode.** Ship a toggle (use the already-installed `next-themes`), or remove the dark CSS.
5. **Adopt a hosted font** (e.g. Inter or Geist) and define a tokenized type scale — small file change, large brand uplift.
6. **Promote agent identity into the design system.** Per-agent accent color, an `<AgentHeader>` component shared across pages, signature lucide icons.
7. **Consolidate chat components.** One `<AgentChat agent="scout" | "profiler" | "strategist">`.
8. **Pick one toast library** (Sonner) and remove the other.
9. **Document a motion vocabulary** (`enter-soft`, `enter-firm`, `loading-pulse`, `success-pop`) so feature teams stop reaching for `animate-fade-in` ad hoc.

---
*Sources: `tailwind.config.ts`, `src/index.css`, `components.json`, `src/components/ui/*`, `src/components/layout/*`, `src/components/strategist/*`, `src/components/signals/*`, `index.html`, `vite.config.ts`.*
