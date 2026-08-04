# ADR-0002: Tailwind CSS for Styling

**Status**: Accepted

**Date**: 2026-08-04

## Context
We need a styling approach for the React frontend. Options considered: Tailwind CSS, styled-components, and CSS Modules.

## Decision
**Tailwind CSS**

## Rationale
- **Utility-first speed**: No context-switching between JSX and CSS files. Styles are co-located with markup.
- **No naming fatigue**: No BEM, no class name conventions. Each utility class does one thing.
- **Built-in design system**: Spacing (`p-4`, `m-2`), colors (`bg-gray-100`), typography (`text-lg`) are pre-defined tokens. No design-system library needed.
- **Tree-shaken**: Purges unused CSS in production. Bundle stays small regardless of how many utility classes exist.
- **Industry standard**: Used by Vercel, GitHub, Shopify. Demonstrates awareness of modern CSS practices.
- **Responsive built in**: `md:flex`, `lg:grid-cols-3` — no media query strings needed.

## Alternatives Considered

| Option | Rejected Because |
|--------|-----------------|
| styled-components | CSS-in-JS adds runtime overhead. Styles are computed at render time in the browser. Requires separate import for every styled element. |
| CSS Modules | Requires separate `.module.css` files per component. Slower iteration — toggling between JSX and CSS. No design tokens out of the box. |

## Consequences
- **Easier**: Rapid prototyping, consistent spacing/sizing, smaller production CSS
- **Harder**: Long className strings can look messy. Mitigated by extracting repeated patterns into reusable components.
