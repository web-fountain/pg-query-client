# What goes in `assets/`

### TL;DR

Use **`assets/`** for *all* your non-code, static resources—images, fonts, stylesheets, videos, JSON data, icons—so that they’re organized separately from your application logic and helper code.

>An **`assets/`** folder is where you keep all your *static, non-code resources*—things that your app will serve or bundle, but that aren’t JavaScript/TypeScript modules. Here’s what typically belongs there:

## Common asset types

| Type                    | Examples                                      | Notes                                                     |
| ----------------------- | --------------------------------------------- | --------------------------------------------------------- |
| **Fonts**               | `Inter-Regular.woff2`, `Roboto-Bold.ttf`      | Custom web fonts you include alongside system fonts.      |
| **Styles**              | `styles/globals.css`, `styles/variables.scss` | Global CSS, Sass/SCSS, or other static stylesheet files.  |

---

## Example folder structure

```
assets/
├─ fonts/
│  ├─ Inter-Regular.woff2
│  └─ Inter-Bold.woff2
├─ styles/
│  ├─ scale.css
│  ├─ normalize.css
│  ├─ base.css
│  ├─ mediaQueries.css
│  ├─ typography.css
│  ├─ layouts.css
│  ├─ themes.css
│  ├─ utilities.css
│  ├─ semantics.css
│  ├─ forms.css
│  ├─ motion.css
│  ├─ a11y.css
│  ├─ scrollbars.css
│  ├─ prose.css
│  └─ print.css
```

---

## Project styles in this repo

Use `assets/styles/` for global, app-wide CSS organized by responsibility. Component-specific styles should live next to components as CSS Modules, while `assets/styles/` defines tokens, resets, layers, and utilities used everywhere.

### Files in `assets/styles/`

| File | What it contains | Notes |
| --- | --- | --- |
| `normalize.css` | A modern Normalize baseline using `@layer normalize`. | Loaded first to neutralize browser defaults.
| `base.css` | Base element rules (body, links, images, lists), focus rings, reduced motion. | Declares `@layer base`.
| `scale.css` | Design scale tokens: spacing (rem and px helpers), borders, radii, motion durations/easings, elevations, z-index. | Token home for non-theme primitives like `--border-*`, `--radius-*`, `--ease-standard`, `--duration-*`, `--shadow-*`, `--z-*`. Keep theme-independent here. Declares `@layer scale`.
| `themes.css` | Theme primitives and aliases; dark is default with light overrides; `data-theme` attribute for manual toggle. | Owns `--background`, `--foreground`, `--gray-*`, and aliases like `--text-primary`, `--bg-color`, `--link-color`, `--border-color`. Also sets `color-scheme` and `--shadow-color-*` for elevations.
| `semantics.css` | Semantic color roles mapped to current theme tokens (e.g., `--color-primary`, `--text-muted`). | Declares `@layer semantics`.
| `typography.css` | Typographic tokens (weights, line-heights, tracking) and base type styles for body and headings. | Declares `@layer typography`. Uses font CSS variables provided in `src/lib/fonts.ts`.
| `motion.css` | Keyframes and simple animation utilities. | Declares `@layer motion`. Motion durations/easing come from `scale.css`.
| `layouts.css` | Layout helpers and container queries. | Declares `@layer layouts`.
| `forms.css` | Unified form control sizing, focus, and defaults. | Declares `@layer forms`.
| `a11y.css` | Accessibility helpers like `.skip-link`. | Declares `@layer a11y`.
| `scrollbars.css` | Theme-aware custom scrollbars (WebKit + Firefox). | Declares `@layer scrollbars`.
| `prose.css` | Readable content defaults for long-form text via `.prose`. | Declares `@layer prose`.
| `print.css` | Print-specific overrides (hide nav, add link URLs, enforce contrast). | Declares `@layer print`.
| `mediaQueries.css` | Project-wide custom media queries (e.g., `--from-desktop`, `--from-wide`). | Provides `@custom-media` only; no layer.
| `utilities.css` | Single-purpose helpers (e.g., `.sr-only`, `.shadow-1`, `.rounded-8`, `.bordered`). | Declares `@layer utilities`.

### Layering and import order

All global styles are imported once in `src/app/layout.tsx` and registered into named CSS layers to maintain predictable cascade:

```app/layout.tsx
<style>@layer normalize, base, scale, themes, semantics, typography, motion, layouts, forms, a11y, scrollbars, prose, print, utilities;</style>
```

- **Order matters**: resets (`normalize`, `base`) → tokens (`scale`, `themes`) → role maps (`semantics`) → base type (`typography`) → motion/layout/forms → a11y/scrollbars → presentation (`prose`, `print`) → small helpers (`utilities`).
- **Theme switching**: the app toggles `<html data-theme="light|dark">`, which updates variables from `themes.css` and anything derived from them (e.g., `semantics.css`, scrollbars).

### Conventions

- **Token ownership**: keep theme-neutral tokens in `scale.css` and theme-dependent primitives/aliases in `themes.css`.
- **CSS Modules for components**: co-locate component styles as `*.module.css` and reference with bracket notation in TSX/JSX (e.g., `styles['container']`). Reserve `assets/styles/` for global layers/utilities.
- **AIDEV anchors**: when adding complex or critical rules, add inline anchors like `AIDEV-NOTE:`, `AIDEV-TODO:` in the CSS to document intent and follow-ups.
