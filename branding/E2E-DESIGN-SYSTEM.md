# E2E Design System

A practical reference for building consistent, on-brand web applications across all E2E projects.
E2E is a team within Axis Communications. All visual and tonal decisions here follow the Axis
brand identity guidelines (see `branding and how to write/` for the source PDFs).

---

## Brand identity

**Parent brand:** Axis Communications
**Division:** E2E (End-to-End)
**Character:** Warm · Direct · Dependable · Fresh
**Purpose:** Internal tools that feel as polished and trustworthy as Axis products.

---

## Colours

### Primary palette

| Name          | Hex       | Tailwind class    | Use                                      |
|---------------|-----------|-------------------|------------------------------------------|
| Brand yellow  | `#F5B700` | `bg-brand`        | Badges, primary buttons, accents         |
| Brand dark    | `#D4A000` | `bg-brand-dark`   | Hover states on yellow elements          |
| Brand light   | `#FDE68A` | `bg-brand-light`  | Subtle highlights, selected row tints    |
| Brand darker  | `#A37A00` | `border-brand-darker` | Focus rings, active borders          |

### Neutrals (light mode)

| Name          | Hex       | Tailwind class   | Use                                       |
|---------------|-----------|------------------|-------------------------------------------|
| White         | `#FFFFFF` | `bg-white`       | Card backgrounds, page backgrounds        |
| Surface       | `#F8FAFC` | `bg-slate-50`    | Page background behind cards              |
| Border        | `#E2E8F0` | `border-slate-200`| Card borders, dividers                   |
| Text primary  | `#1E293B` | `text-slate-800` | Body text, headings                       |
| Text secondary| `#64748B` | `text-slate-500` | Labels, meta text, placeholders           |

### Neutrals (dark mode)

| Name          | Hex       | Tailwind class       | Use                                    |
|---------------|-----------|----------------------|----------------------------------------|
| Page bg       | `#0F172A` | `dark:bg-slate-900`  | Dark mode page background              |
| Card bg       | `#1E293B` | `dark:bg-slate-800`  | Card and panel backgrounds             |
| Surface       | `#334155` | `dark:bg-slate-700`  | Input backgrounds, secondary surfaces  |
| Border        | `#334155` | `dark:border-slate-700` | Card borders in dark mode           |
| Text primary  | `#FFFFFF` | `dark:text-white`    | Headings, primary labels               |
| Text secondary| `#94A3B8` | `dark:text-slate-400`| Supporting text, placeholders          |

### Semantic colours

| Name    | Hex       | Tailwind class | Use                         |
|---------|-----------|----------------|-----------------------------|
| Success | `#22C55E` | `text-green-500`| Confirmations, active state |
| Warning | `#F59E0B` | `text-amber-500`| Warnings, overdue states    |
| Error   | `#EF4444` | `text-red-500` | Errors, destructive actions |

> **Rule:** Never use blue as a brand colour. Blue is not part of the Axis palette. Brand yellow
> replaces blue as the primary interactive accent across all E2E projects.

---

## Typography

### Font stack

| Role        | Font                   | Fallback                      |
|-------------|------------------------|-------------------------------|
| UI / body   | **Open Sans**          | `system-ui, -apple-system, sans-serif` |
| Display     | **Rotis Sans Serif Pro** | Open Sans, sans-serif        |
| Headlines   | **Lubalin Graph**      | Georgia, serif                |

**Open Sans** is the day-to-day font for all web UIs (buttons, labels, inputs, body text).
Font files are in `branding/fonts/Open_Sans.zip`. For web projects, load via Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

### Type scale

| Token      | Size      | Weight   | Use                                      |
|------------|-----------|----------|------------------------------------------|
| `text-xs`  | 12px      | 600      | Version numbers, badges, meta            |
| `text-sm`  | 14px      | 400–600  | Table cells, secondary labels            |
| `text-base`| 16px      | 400      | Body text, form labels                   |
| `text-lg`  | 18px      | 600      | Section headings, card titles            |
| `text-xl`  | 20px      | 700      | Page subheadings                         |
| `text-2xl` | 24px      | 700–800  | Input text in kiosk / large-touch UIs    |
| `text-4xl` | 36px      | 700–800  | Page titles, login headings              |

---

## Spacing & layout

- **Border radius:** `rounded-xl` (12px) for cards and inputs · `rounded-lg` (8px) for buttons ·
  `rounded-full` for pills and avatars
- **Card padding:** `p-6` default · `p-8 sm:p-10` for prominent cards (login, modals)
- **Section gap:** `gap-5` or `gap-6` between form fields · `gap-4` between list items
- **Page padding:** `p-4 sm:p-6` on the page wrapper

---

## Components

### Brand badge

The `E2E` identifier shown at the top of every app.

```jsx
<span className="bg-brand text-slate-900 text-xs font-extrabold tracking-widest rounded px-1.5 py-0.5">
  E2E
</span>
```

Or use the utility class: `<span className="brand-badge">E2E</span>`

---

### Cards

Cards are the primary content container across all web projects.

**Standard card (Tailwind):**
```jsx
<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
  ...
</div>
```

Or with utility class: `<div className="card card-body">...</div>`

**Card variants:**

| Variant      | Additional classes                              | Use                          |
|--------------|-------------------------------------------------|------------------------------|
| Default      | *(none)*                                        | Content panels, list items   |
| Prominent    | `shadow-xl p-8 sm:p-10`                         | Login forms, modals          |
| Accent       | `border-l-4 border-brand`                       | Highlighted items, callouts  |
| Interactive  | `hover:shadow-md hover:border-slate-200 cursor-pointer transition-all` | Clickable cards |
| Error state  | `border-red-300 dark:border-red-700`            | Validation errors            |

**Card anatomy:**
```
┌─────────────────────────────────────────┐
│  Card header (text-lg font-semibold)    │
│  Card subtitle (text-sm text-slate-500) │
├─────────────────────────────────────────┤
│  Card body — main content               │
│                                         │
├─────────────────────────────────────────┤
│  Card footer — actions (right-aligned)  │
└─────────────────────────────────────────┘
```

---

### Buttons

**Primary** — brand yellow, dark text:
```jsx
<button className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-slate-900 font-bold px-6 py-3 rounded-xl transition-colors">
  Sign In
</button>
```

**Secondary** — slate, white text:
```jsx
<button className="bg-slate-600 hover:bg-slate-500 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors">
  Cancel
</button>
```

**Danger** — red, white text:
```jsx
<button className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors">
  Delete
</button>
```

> **Rule:** Primary buttons always use `text-slate-900` (dark) on brand yellow — never white text
> on yellow (insufficient contrast). Secondary and danger buttons use white text.

---

### Inputs

```jsx
<input
  className="border-2 border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white
             dark:placeholder-slate-400 rounded-xl px-4 py-3 focus:border-brand focus:outline-none
             transition-colors w-full"
/>
```

- Focus ring uses `border-brand` (yellow), not the browser default blue
- Labels: `text-slate-600 dark:text-slate-300 font-semibold text-sm`

---

### Navigation / app header

```jsx
<header className="bg-slate-700 dark:bg-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
  <div className="flex items-center gap-2">
    {/* Live indicator */}
    <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
    {/* Brand badge */}
    <span className="brand-badge">E2E</span>
    {/* App name */}
    <span className="text-white font-semibold text-lg">App Name</span>
    {/* Version */}
    <span className="text-slate-400 text-xs">v1.0.0</span>
  </div>
  <div className="flex items-center gap-3">
    {/* Nav actions go here */}
  </div>
</header>
```

---

### Status indicators

```jsx
{/* Success / active */}
<span className="text-green-400 font-semibold">● Active</span>

{/* Warning / overdue */}
<span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-sm font-semibold">
  Overdue 3 days
</span>

{/* Error */}
<div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl px-5 py-3 text-red-600 dark:text-red-400 text-center">
  Error message here
</div>
```

---

## Dark mode

All E2E projects default to **dark mode** with a user-controlled toggle stored in `localStorage`.

- Apply dark mode by toggling the `dark` class on `<html>` (Tailwind `darkMode: 'class'`)
- Every component must have a `dark:` variant — never design only for light or only for dark
- The brand yellow works equally well in both modes — no separate dark variant needed

```js
// On load — apply before React renders to avoid flash
(function() {
  var theme = localStorage.getItem('kioskTheme') || 'dark';
  if (theme === 'dark') document.documentElement.classList.add('dark');
})();
```

---

## Voice and tone in UI copy

Adapted from the Axis Communications writing guide for internal tool interfaces.

| Situation        | Do                              | Don't                          |
|------------------|---------------------------------|--------------------------------|
| Button labels    | "Sign in", "Check out", "Return"| "Submit", "Proceed", "Execute" |
| Empty states     | "Nothing here yet."             | "No data found."               |
| Errors           | "We couldn't find that asset."  | "Error 404: resource not found"|
| Loading states   | "Signing in…", "Processing…"   | "Loading…", "Please wait…"     |
| Success messages | "Done! Asset checked out."      | "Operation completed successfully." |
| Confirmations    | "Sure you want to sign out?"    | "Are you certain you wish to proceed?" |

**Key rules:**
- Use active voice and second person ("you", "your")
- Be direct — get to the point in the first few words
- Use contractions ("it's", "we're") — they're warmer
- Keep labels short — buttons ideally 1–3 words

---

## Tailwind setup for new projects

1. Install Tailwind CSS
2. Copy this `tailwind.config.js` to your project root:

```js
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          light:   '#FDE68A',
          DEFAULT: '#F5B700',
          dark:    '#D4A000',
          darker:  '#A37A00',
        },
      },
      fontFamily: {
        sans: ['Open Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

3. Add to your base CSS:

```css
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

body { font-family: 'Open Sans', system-ui, -apple-system, sans-serif; }
```

---

## Non-Tailwind projects (plain CSS variables)

For projects that don't use Tailwind, add these CSS custom properties:

```css
:root {
  --color-brand:        #F5B700;
  --color-brand-dark:   #D4A000;
  --color-brand-light:  #FDE68A;

  --color-bg:           #F8FAFC;
  --color-surface:      #FFFFFF;
  --color-border:       #E2E8F0;
  --color-text:         #1E293B;
  --color-text-muted:   #64748B;

  --color-success:      #22C55E;
  --color-warning:      #F59E0B;
  --color-error:        #EF4444;

  --font-sans:          'Open Sans', system-ui, -apple-system, sans-serif;
  --radius-card:        1rem;    /* 16px */
  --radius-input:       0.75rem; /* 12px */
  --radius-button:      0.5rem;  /* 8px  */
}

[data-theme="dark"] {
  --color-bg:           #0F172A;
  --color-surface:      #1E293B;
  --color-border:       #334155;
  --color-text:         #FFFFFF;
  --color-text-muted:   #94A3B8;
}
```

---

## Reference implementation

The **E2E Storeroom Kiosk** project (`github.com/er1kr1984/predator-kiosk`) is the canonical
reference for this design system — it demonstrates all patterns above in a production React +
Tailwind application.
