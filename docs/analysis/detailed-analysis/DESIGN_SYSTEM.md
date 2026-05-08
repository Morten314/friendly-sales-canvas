# Brewra Design System Documentation

**Document Version**: 1.0
**Last Updated**: 2025-04-24
**Status**: Production Design System Analysis

---

## Executive Summary

The Brewra design system is built on **shadcn/ui** - a comprehensive component library based on **Radix UI** primitives and **Tailwind CSS**. The system provides 51 pre-built components with a focus on accessibility, customization, and developer experience. The design language emphasizes clarity, efficiency, and professional aesthetics suitable for a B2B sales intelligence platform.

**Design Philosophy**: Accessible, customizable, composable components
**Component Library**: shadcn/ui (51 components)
**Styling Framework**: Tailwind CSS v3.4.11
**Icon System**: Lucide React v0.462.0
**Theming**: CSS variables with dark mode support

---

## Design Tokens

### Color System

The color system uses **HSL (Hue, Saturation, Lightness)** values defined as CSS custom properties for easy manipulation and theming.

#### Light Mode Colors

**Semantic Colors** (`:root`):
```css
--background: 0 0% 100%;           /* White - #FFFFFF */
--foreground: 222.2 84% 4.9%;      /* Dark slate - #0f172a */
--primary: 221.2 83.2% 53.3%;      /* Blue - #3b82f6 */
--primary-foreground: 210 40% 98%; /* White text on primary */
--secondary: 210 40% 96%;          /* Light gray - #f1f5f9 */
--secondary-foreground: 222.2 47.4% 11.2%; /* Dark text on secondary */
--muted: 210 40% 96%;              /* Light gray - #f1f5f9 */
--muted-foreground: 215.4 16.3% 46.9%; /* Gray text - #64748b */
--accent: 210 40% 96%;             /* Light accent - #f1f5f9 */
--accent-foreground: 222.2 47.4% 11.2%; /* Dark text on accent */
--destructive: 0 84.2% 60.2%;      /* Red - #ef4444 */
--destructive-foreground: 210 40% 98%; /* White text on destructive */
--border: 214.3 31.8% 91.4%;       /* Light gray border - #e2e8f0 */
--input: 214.3 31.8% 91.4%;        /* Input border - #e2e8f0 */
--ring: 221.2 83.2% 53.3%;         /* Focus ring - #3b82f6 */
--radius: 0.5rem;                  /* 8px border radius */
```

**Functional Usage**:
- `background`: Page background, card backgrounds
- `foreground`: Primary text color
- `primary`: Primary buttons, links, interactive elements
- `secondary`: Secondary buttons, less prominent elements
- `muted`: Disabled states, backgrounds
- `accent`: Highlighted elements, callouts
- `destructive`: Error states, delete actions, warnings
- `border`: Borders, dividers
- `ring`: Focus rings for accessibility

#### Dark Mode Colors

**Dark Mode Overrides** (`.dark`):
```css
--background: 222.2 84% 4.9%;      /* Dark slate - #0f172a */
--foreground: 210 40% 98%;          /* Light text - #f8fafc */
--primary: 217.2 91.2% 59.8%;      /* Bright blue - #3b82f6 */
--primary-foreground: 222.2 47.4% 11.2%; /* Dark text on primary */
--secondary: 217.2 32.6% 17.5%;    /* Dark gray - #1e293b */
--secondary-foreground: 210 40% 98%; /* Light text on secondary */
--muted: 217.2 32.6% 17.5%;         /* Dark gray - #1e293b */
--muted-foreground: 215 20.2% 65.1%; /* Light gray text - #94a3b8 */
--accent: 217.2 32.6% 17.5%;        /* Dark accent - #1e293b */
--accent-foreground: 210 40% 98%;   /* Light text on accent */
--destructive: 0 62.8% 30.6%;       /* Dark red - #7f1d1d */
--destructive-foreground: 210 40% 98%; /* White text on destructive */
--border: 217.2 32.6% 17.5%;        /* Dark border - #1e293b */
--input: 217.2 32.6% 17.5%;         /* Dark input border - #1e293b */
--ring: 224.3 76.3% 48%;           /* Focus ring - #2563eb */
```

#### Sales-Specific Colors

**Custom Brand Colors** (Hardcoded in components):
```css
--sales-blue: #2563eb;      /* Primary brand blue */
--sales-teal: #0d9488;      /* Teal accent */
--sales-lightBlue: #93c5fd; /* Light blue */
--sales-gray: #e5e7eb;      /* Neutral gray */
--sales-darkGray: #4b5563;  /* Dark gray */
```

**⚠️ Design Debt**: Sales-specific colors are hardcoded instead of using design tokens. Should be migrated to CSS variables for consistency.

### Typography

**Font Families**:
- **Primary**: System font stack (San Francisco, Segoe UI, Roboto, etc.)
- **Monospace**: System monospace (SF Mono, Consolas, etc.)

**Type Scale**:
```css
text-xs      /* 12px - Small text */
text-sm      /* 14px - Base size, most components */
text-base    /* 16px - Body text */
text-lg      /* 18px - Large text */
text-xl      /* 20px - Extra large */
text-2xl     /* 24px - Headings */
text-3xl     /* 30px - Large headings */
text-4xl     /* 36px - Hero headings */
```

**Font Weights**:
```css
font-normal    /* 400 - Regular */
font-medium    /* 500 - Medium */
font-semibold  /* 600 - Semibold */
font-bold      /* 700 - Bold */
```

**Typography Patterns**:
- **Headings**: `font-semibold tracking-tight`
- **Body**: `text-sm text-foreground`
- **Muted**: `text-sm text-muted-foreground`
- **Captions**: `text-xs text-muted-foreground`

### Spacing

**Spacing Scale** (Tailwind default):
```css
0     /* 0px */
1     /* 4px */
2     /* 8px */
3     /* 12px */
4     /* 16px - 1rem */
5     /* 20px */
6     /* 24px - 1.5rem */
8     /* 32px - 2rem */
10    /* 40px */
12    /* 48px - 3rem */
16    /* 64px - 4rem */
20    /* 80px - 5rem */
24    /* 96px - 6rem */
```

**Common Spacing Patterns**:
```css
/* Buttons */
px-4 py-2          /* Horizontal: 16px, Vertical: 8px */
px-3 py-1.5        /* Small button */
px-8 py-3          /* Large button */

/* Cards */
p-6                /* Padding: 24px - default card */
p-4                /* Padding: 16px - compact card */

/* Layout */
gap-2              /* Gap: 8px - tight spacing */
gap-4              /* Gap: 16px - default spacing */
gap-6              /* Gap: 24px - loose spacing */

/* Sections */
py-8 md:py-12      /* Vertical padding: 32px mobile, 48px desktop */
px-4 md:px-8       /* Horizontal padding: 16px mobile, 32px desktop */
```

### Border Radius

**Radius Scale**:
```css
rounded-none       /* 0px */
rounded-sm         /* 2px */
rounded            /* 4px */
rounded-md         /* 6px - medium */
rounded-lg         /* 8px - large (uses --radius) */
rounded-xl         /* 12px */
rounded-2xl        /* 16px */
rounded-3xl        /* 24px */
rounded-full       /* 9999px - circles */
```

**Component-Specific Radius**:
```css
/* Buttons */
rounded-md         /* 6px */

/* Inputs */
rounded-md         /* 6px */

/* Cards */
rounded-lg         /* 8px */

/* Badges */
rounded-full       /* Circles */

/* Dialogs/Drawers */
rounded-lg         /* 8px */
```

### Shadows

**Shadow Scale**:
```css
shadow-sm          /* Subtle elevation */
shadow             /* Default elevation */
shadow-md          /* Medium elevation */
shadow-lg          /* High elevation */
shadow-xl          /* Extra high elevation */
shadow-2xl         /* Ultra high elevation */
```

**Usage Patterns**:
```css
/* Interactive elements */
hover:shadow-md    /* Elevation on hover */

/* Elevated content */
shadow-lg          /* Modals, popovers */

/* Subtle depth */
shadow-sm          /* Cards, panels */
```

### Animation

**Built-in Animations**:
```css
animate-spin       /* Rotation - loading indicators */
animate-pulse      /* Pulse - skeletons, loading */
```

**Custom Keyframes**:
```css
/* Accordion animations */
@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}
@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

/* Fade in */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide in */
@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* Logo reveal */
@keyframes logo-reveal {
  /* Complex clip-path animation */
}
```

**Transition Patterns**:
```css
/* Color transitions */
transition-colors duration-200

/* Shadow transitions */
transition-shadow duration-200

/* All properties */
transition-all duration-200

/* Data-driven animations */
data-[state=open]:animate-in
data-[state=closed]:animate-out
```

---

## Component Library

### shadcn/ui Architecture

**Component Philosophy**:
- **Composable**: Components can be combined and nested
- **Accessible**: Built on Radix UI primitives with ARIA support
- **Customizable**: Style with Tailwind utility classes
- **Type-Safe**: Full TypeScript support

**Component Structure**:
```typescript
// Every component follows this pattern
import * as React from "react"
import { cn } from "@/lib/utils"

interface ComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  // Component-specific props
}

export const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("base-classes", className)}
        {...props}
      />
    )
  }
)
Component.displayName = "Component"
```

### Component Categories

#### Form Components (10 components)

**Input Components**:
- **Button**: Primary, secondary, ghost, outline variants with sizes
- **Input**: Text input with focus states and validation
- **Textarea**: Multi-line text input
- **Select**: Dropdown select with search (uses Radix Select)
- **Checkbox**: Boolean input (uses Radix Checkbox)
- **Radio Group**: Single select from options (uses Radix Radio Group)
- **Switch**: Toggle switch (uses Radix Switch)
- **Slider**: Range selection (uses Radix Slider)
- **Label**: Form label with accessibility

**Form System**:
```typescript
// react-hook-form + zod integration
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const formSchema = z.object({
  username: z.string().min(2),
  email: z.string().email(),
})

const form = useForm({
  resolver: zodResolver(formSchema),
})
```

#### Layout Components (8 components)

**Card System**:
```typescript
// Compound component pattern
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```

**Other Layout Components**:
- **Separator**: Visual divider (uses Radix Separator)
- **Scroll Area**: Custom scrollable container (uses Radix Scroll Area)
- **Resizable**: Resizable panels (uses ResizablePrimitive)
- **Collapsible**: Show/hide content (uses Radix Collapsible)
- **Accordion**: Expandable sections (uses Radix Accordion)
- **Tabs**: Tabbed navigation (uses Radix Tabs)
- **Sheet**: Side panel (uses Vaul drawer)

#### Feedback Components (10 components)

**Alerts & Notifications**:
- **Alert**: Non-dismissible alerts with variants (default, destructive)
- **Alert Dialog**: Dismissible alerts (uses Radix Alert Dialog)
- **Dialog**: Modal dialogs (uses Radix Dialog)
- **Drawer**: Bottom sheet (uses Vaul)
- **Popover**: Hover/focus tooltips (uses Radix Popover)
- **Tooltip**: Hover tooltips (uses Radix Tooltip)
- **Toast**: Temporary notifications (uses Sonner)
- **Sonner**: Styled toast notifications with theme support
- **Progress**: Progress bars (uses Radix Progress)
- **Skeleton**: Loading placeholders

#### Navigation Components (6 components)

- **Breadcrumb**: Navigation breadcrumb (uses Radix Navigation Menu)
- **Navigation Menu**: Dropdown menus (uses Radix Navigation Menu)
- **Dropdown Menu**: Context menus (uses Radix Dropdown Menu)
- **Context Menu**: Right-click menus (uses Radix Context Menu)
- **Menubar**: Application menu bar (uses Radix Menubar)
- **Command Palette**: Command palette with search (uses Cmdk)

#### Data Display Components (7 components)

- **Table**: Data tables with sorting (uses TanStack Table)
- **Badge**: Status indicators and tags
- **Avatar**: User avatars with fallback (uses Radix Avatar)
- **Calendar**: Date picker (uses React Day Picker)
- **Carousel**: Image sliders (uses Embla Carousel)
- **Aspect Ratio**: Maintain aspect ratio containers
- **Chart**: Data visualization (uses Recharts)

#### Advanced Components (10 components)

- **Pagination**: Page navigation
- **Hover Card**: Rich hover tooltips (uses Radix Hover Card)
- **Toggle**: Toggle buttons
- **Toggle Group**: Toggle button groups
- **Input OTP**: One-time password input
- **Sidebar**: Collapsible sidebar (uses Radix Sidebar)
- **Resizable**: Resizable panels (uses ResizablePrimitive)

### Component Variants

#### Button Variants

**Visual Variants**:
```typescript
// Primary action
<Button variant="default">Submit</Button>

// Destructive action
<Button variant="destructive">Delete</Button>

// Secondary action
<Button variant="outline">Cancel</Button>

// Ghost button
<Button variant="ghost">Close</Button>

// Link style
<Button variant="link">Learn more</Button>

// Secondary button
<Button variant="secondary">Back</Button>
```

**Size Variants**:
```typescript
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

**Component Implementation**:
```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
  }
)
```

#### Badge Variants

```typescript
<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
```

**Usage Patterns**:
```typescript
// Status indicators
<Badge variant="default">Active</Badge>
<Badge variant="destructive">Inactive</Badge>

// Tags and categories
<Badge variant="outline">Sales</Badge>
<Badge variant="secondary">Marketing</Badge>
```

#### Alert Variants

```typescript
<Alert variant="default">
  <AlertTitle>Info</AlertTitle>
  <AlertDescription>Description</AlertDescription>
</Alert>

<Alert variant="destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Error message</AlertDescription>
</Alert>
```

---

## Patterns & Guidelines

### Layout Patterns

#### Container Pattern

```typescript
// Max-width container with padding
<div className="container mx-auto px-4 md:px-8">
  {/* Content */}
</div>
```

#### Grid Pattern

```typescript
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Grid items */}
</div>
```

#### Flex Pattern

```typescript
// Flex container with gap
<div className="flex items-center gap-4">
  {/* Flex items */}
</div>
```

### State Patterns

#### Loading State

```typescript
// Skeleton loader
{isLoading ? (
  <Skeleton className="h-4 w-full" />
) : (
  <div>{data}</div>
)}
```

#### Error State

```typescript
// Error boundary
{error ? (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
  </Alert>
) : (
  <div>{data}</div>
)}
```

#### Empty State

```typescript
// Empty state illustration
<div className="flex flex-col items-center justify-center py-12">
  <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
  <p className="text-muted-foreground">No data found</p>
</div>
```

### Interaction Patterns

#### Button Group

```typescript
// Button group with actions
<div className="flex items-center gap-2">
  <Button>Primary</Button>
  <Button variant="outline">Secondary</Button>
  <Button variant="ghost">Cancel</Button>
</div>
```

#### Icon Button

```typescript
// Icon button with tooltip
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon">
      <Settings className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Settings</TooltipContent>
</Tooltip>
```

#### Split Button

```typescript
// Split button with dropdown
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>
      <Split className="mr-2 h-4 w-4" />
      Export
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>PDF</DropdownMenuItem>
    <DropdownMenuItem>CSV</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Form Patterns

#### Form Field

```typescript
// Form field with label and error
<FormField
  control={form.control}
  name="username"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Username</FormLabel>
      <FormControl>
        <Input placeholder="Enter username" {...field} />
      </FormControl>
      <FormDescription>This is your public display name.</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

#### Form Validation

```typescript
// Client-side validation with zod
const formSchema = z.object({
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
})
```

### Responsive Patterns

#### Responsive Grid

```typescript
// Mobile → Tablet → Desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Grid items */}
</div>
```

#### Responsive Text

```typescript
// Mobile → Desktop text scaling
<h1 className="text-2xl md:text-4xl lg:text-5xl">Heading</h1>
```

#### Responsive Spacing

```typescript
// Mobile → Desktop padding
<div className="p-4 md:p-6 lg:p-8">
  {/* Content */}
</div>
```

#### Hidden/Visible

```typescript
// Hide on mobile, show on desktop
<div className="hidden md:block">
  {/* Desktop only */}
</div>

// Show on mobile, hide on desktop
<div className="block md:hidden">
  {/* Mobile only */}
</div>
```

---

## Icon System

### Lucide React

**Icon Library**: Lucide React v0.462.0
**Total Icons**: 1000+ icons available

**Icon Categories**:
- **Arrows**: ArrowUp, ArrowRight, ArrowDown, ArrowLeft, ChevronUp, ChevronDown
- **UI**: Search, X, Check, Plus, Minus, Filter, Sort
- **Communication**: MessageSquare, Mail, Phone, Send
- **Files**: File, FileText, Download, Upload, Folder
- **Media**: Image, Video, Music, Camera
- **Actions**: Edit, Trash, Copy, Refresh, Rotate
- **Navigation**: Home, Settings, Menu, More
- **Status**: AlertCircle, CheckCircle, Info, Loader
- **Charts**: BarChart, LineChart, PieChart, TrendingUp
- **User**: User, Users, UserPlus, UserMinus
- **Business**: Briefcase, Building, Megaphone, Target

**Icon Usage Patterns**:
```typescript
// Sizing
<Search className="h-4 w-4" />      // 16px
<Search className="h-5 w-5" />      // 20px
<Search className="h-6 w-6" />      // 24px

// With text
<div className="flex items-center gap-2">
  <Search className="h-4 w-4" />
  <span>Search</span>
</div>

// In buttons
<Button>
  <Download className="mr-2 h-4 w-4" />
  Download
</Button>

// Colored
<AlertCircle className="h-4 w-4 text-destructive" />
<CheckCircle className="h-4 w-4 text-green-600" />
```

---

## Accessibility

### WCAG Compliance

**Keyboard Navigation**:
- All interactive elements are keyboard accessible
- Tab order follows visual layout
- Focus indicators visible (`focus-visible:ring-2`)
- Escape key closes modals/drawers

**Screen Reader Support**:
- ARIA labels on interactive elements
- Semantic HTML (`<button>`, `<nav>`, `<main>`)
- Alt text for images
- Descriptive link text

**Color Contrast**:
- WCAG AA compliant color ratios
- Minimum 4.5:1 for normal text
- Minimum 3:1 for large text
- Color not the only indicator (use icons + text)

### Focus Management

**Focus Ring**:
```css
/* Double ring for high visibility */
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:ring-offset-2
focus-visible:ring-offset-background
```

**Focus Trapping**:
- Modals trap focus within dialog
- Drawers trap focus within sheet
- Escape key returns focus to trigger

---

## Responsive Design

### Breakpoints

**Breakpoint Scale**:
```css
sm:   640px   /* Small devices */
md:   768px   /* Medium devices (tablets) */
lg:   1024px  /* Large devices (desktops) */
xl:   1280px  /* Extra large devices */
2xl:  1400px  /* Extra extra large devices */
```

**Mobile Hook**:
```typescript
const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    setIsMobile(mql.matches)

    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
```

### Mobile-First Approach

**Default**: Mobile styles
**Responsive**: Add `md:` and up prefixes

```typescript
// Mobile: 1 column, Tablet: 2 columns, Desktop: 3 columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Grid items */}
</div>

// Mobile: stack vertical, Desktop: stack horizontal
<div className="flex flex-col md:flex-row gap-4">
  {/* Items */}
</div>
```

---

## Theming

### Theme Provider

**Implementation**:
```typescript
// next-themes integration
import { ThemeProvider } from "next-themes"

export function Providers({ children }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  )
}
```

### Dark Mode

**Class-Based Dark Mode**:
```typescript
// Apply dark mode
document.documentElement.classList.add('dark')

// Remove dark mode
document.documentElement.classList.remove('dark')
```

**Component Usage**:
```typescript
// Theme-aware component
<div className="bg-background text-foreground">
  {/* Automatically adapts to dark/light mode */}
</div>
```

**⚠️ Current Status**: Dark mode is configured but minimally used. Only visible in `sonner.tsx` toast component.

### Custom Themes

**Theme Extension**:
```css
/* Add custom theme colors */
:root {
  --sales-blue: 256 100% 50%; /* HSL */
  --sales-teal: 174 72% 56%;
}

/* Use in components */
<Button className="bg-[var(--sales-blue)]">
  Custom Button
</Button>
```

---

## Animation Guidelines

### Micro-Interactions

**Button Hover**:
```css
transition-colors duration-200
hover:bg-primary/90
```

**Card Elevation**:
```css
transition-shadow duration-200
hover:shadow-md
```

### State Transitions

**Loading State**:
```typescript
{isLoading ? (
  <Loader2 className="h-4 w-4 animate-spin" />
) : (
  <Check className="h-4 w-4" />
)}
```

**Progressive Disclosure**:
```typescript
<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <CollapsibleContent className="data-[state=closed]:animate-accordion-down data-[state=open]:animate-accordion-up">
    {/* Content */}
  </CollapsibleContent>
</Collapsible>
```

### Page Transitions

**Fade In**:
```typescript
<div className="animate-fade-in">
  {/* Page content */}
</div>
```

---

## Design Principles

### 1. Clarity

**Clear Visual Hierarchy**:
- Larger font for headings
- High contrast for readability
- Consistent spacing

**Purposeful Color**:
- Semantic color usage (destructive = delete)
- Status colors (green = success, red = error)
- Brand colors for CTAs

### 2. Efficiency

**Fast Performance**:
- Minimal CSS bundle size
- Optimized images
- Lazy loading for off-screen content

**Developer Experience**:
- Composable components
- Clear prop names
- TypeScript IntelliSense

### 3. Accessibility

**Inclusive Design**:
- Keyboard navigation
- Screen reader support
- High contrast mode
- Touch target sizes (min 44x44px)

### 4. Consistency

**Design Tokens**:
- Centralized design variables
- Component variants
- Reusable patterns

**Code Patterns**:
- Consistent component structure
- Predictable props
- Clear naming conventions

---

## Usage Guidelines

### Do's

✅ **Use shadcn/ui components** as building blocks
✅ **Follow mobile-first responsive design**
✅ **Use semantic HTML** for accessibility
✅ **Leverage Tailwind utilities** for styling
✅ **Test keyboard navigation** on custom components
✅ **Provide alt text** for images
✅ **Use proper heading hierarchy** (h1 → h2 → h3)
✅ **Maintain color contrast** ratios (WCAG AA)

### Don'ts

❌ **Override shadcn/ui component styles** directly
❌ **Hardcode colors** (use design tokens)
❌ **Use fixed widths** (use responsive utilities)
❌ **Skip accessibility testing**
❌ **Use color alone** to convey meaning
❌ **Mix button variants** without purpose
❌ **Ignore mobile layouts**
❌ **Use generic icons** without context

---

## Technical Debt & Issues

### Critical Issues

**🔴 Security**: See [ARCHITECTURE_DOCUMENT.md - Security Architecture](ARCHITECTURE_DOCUMENT.md#security-architecture)
- Firebase API keys exposed in client-side code (should be in env vars)

**🔴 Design System Gaps**:
- Sales-specific colors hardcoded instead of using tokens
- Inconsistent spacing patterns across components

### Medium Issues

**🟡 Underutilization**:
- React Query installed but not used for server state
- Dark mode configured but minimally implemented
- next-themes installed but only used in toasts

**🟡 Code Quality**:
- Some components have high complexity (Sidebar.tsx - 817 lines)
- Large page files (MarketResearch.tsx - 227KB)
- Excessive console logging (1,566 statements)

### Minor Issues

**🔵 Consistency**:
- Mixed spacing patterns (p-4 vs p-6 without clear hierarchy)
- Magic numbers for layout (16rem, 18rem, 3rem)
- Animation duplication in Tailwind and CSS

---

## Recommendations

For overall platform recommendations, see [README.md - Recommendations](README.md#recommendations)

### Design System Specific Actions

**Immediate Actions**:
1. Consolidate sales-specific colors into design tokens
2. Standardize spacing patterns
3. Enable dark mode throughout the application

**Short-term Goals**:
- Component library enhancement (missing variants, compound components)
- Performance optimization (code splitting, lazy loading)
- Accessibility improvements (ARIA labels, focus management)

**Long-term Vision**:
- Design tokens expansion (color palettes, typography, spacing)
- Component evolution (data visualization, rich text editor)
- Developer experience (documentation site, Storybook, Figma sync)

---

## Conclusion

The Brewra design system provides a **solid foundation** with shadcn/ui's comprehensive component library and Tailwind CSS's utility-first approach. The system is **accessible**, **customizable**, and **well-structured** for a B2B sales intelligence platform.

**Key Strengths**:
- 51 production-ready components
- Full accessibility support via Radix UI
- Flexible theming with CSS variables
- Mobile-first responsive design
- Type-safe with TypeScript

**Areas for Improvement**:
- Consolidate sales-specific colors into design tokens
- Expand dark mode implementation
- Add component documentation (Storybook)
- Optimize large component files
- Standardize spacing and layout patterns

**Overall Assessment**: The design system is **production-ready** with room for enhancement in theming, documentation, and consistency.

---

**Document Owner**: CTO
**Review Cycle**: Monthly
**Next Review**: 2025-05-24
