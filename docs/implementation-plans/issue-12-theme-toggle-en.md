# Implementation Plan — GitHub Issue #12: Add light/dark mode support

## 1. Summary

This plan adds a persistent, accessible light/dark/system theme toggle to the task board. The toggle lives in `BoardHeader`, state is held in the existing Zustand store, and the active theme is applied before React mounts via an inline script in `client/index.html` to avoid a flash of unstyled content (FOUC). `tailwind.config.js` already uses `darkMode: 'class'` and components already have `dark:` variants, so this issue is primarily about wiring up the missing runtime logic.

## 2. Architecture & Design Decisions

### 2.1 Where does the toggle live? — **Option A: BoardHeader**

Issue #12 explicitly asks for the toggle "in board header". `BoardHeader.jsx` already exists and is the natural location for board-level chrome. Keeping it there avoids introducing new global layout components and follows the existing page structure.

### 2.2 Theme values? — **Option A: 3 states (light/dark/system)**

A three-state value is the most flexible and future-proof default:
- **light** — forces light mode.
- **dark** — forces dark mode.
- **system** — follows `prefers-color-scheme` and updates automatically when the OS changes.

Two states would remove the ability to fall back to OS preference without resetting the user's explicit choice.

### 2.3 FOUC prevention mechanism? — **Option A: Inline `<script>` in `index.html`**

A small, blocking inline script in `client/index.html` reads `localStorage` and applies the `dark` class to `<html>` before the first paint. This is the only mechanism that guarantees no FOUC because it runs before React, Vite, or any stylesheet is parsed. A CSS-only `@media` fallback would conflict with `darkMode: 'class'` and could not read `localStorage`.

### 2.4 State location? — **Option A: Zustand store**

Per the Flux pattern, UI components read from a single source of truth. We add a small `theme` slice to `useBoardStore` that:
- exposes `theme` and `setTheme`,
- persists to `localStorage`,
- toggles the `dark` class on `<html>`,
- listens to `prefers-color-scheme` when `theme === 'system'`.

The inline script in `index.html` acts as the *initial* source of truth for the very first paint; React hydrates against the same `localStorage` value on mount.

### 2.5 Toggle UI? — **Option B: Single button cycling through states**

A single accessible button cycles `light → dark → system → light` with an `aria-label` that announces the current and next state. This keeps the header compact and avoids the layout shift and focus-management complexity of a dropdown. Icon pairs (`☀ / 🌙 / 💻`) change with the state.

## 3. State Machine / Flow

```text
                    ┌─────────────────┐
        ┌──────────►│     system      │◄──────────┐
        │           │ (prefers-color  │           │
        │           │  scheme wins)   │           │
        │           └────────┬────────┘           │
        │                    │                    │
   setTheme('light')   mediaQuery change           │
        │              (recompute class)           │
        │                    │                    │
        │           ┌────────▼────────┐           │
        │           │     light       │           │
        │           │ (html.light)    │           │
        │           └────────┬────────┘           │
        │                    │ setTheme('dark')   │
        │                    ▼                    │
        │           ┌─────────────────┐           │
        └───────────┤      dark       ├───────────┘
   setTheme('system')│ (html.dark)     │
                    └─────────────────┘
```

*Transition rules*

- Clicking the button advances `system → light → dark → system`.
- `light` removes `dark` from `<html>`.
- `dark` adds `dark` to `<html>`.
- `system` adds or removes `dark` based on `window.matchMedia('(prefers-color-scheme: dark)').matches`.
- On mount, if the stored value is `system`, register a `change` listener and recompute the class whenever the OS preference changes.

## 4. API Contract

**N/A.** This issue is pure client-side. No backend endpoints, models, or database changes are required.

## 5. File Changes

- `client/index.html`
- `client/src/store/useBoardStore.js`
- `client/src/components/BoardHeader.jsx`
- `client/src/components/ThemeToggle.jsx` *(new)*

## 6. Implementation Steps

1. **Add the FOUC-prevention script to `client/index.html`.**
   - Insert a small inline `<script>` in `<head>` that runs immediately.
   - It reads `localStorage.getItem('task-board-theme')`, falls back to `'system'`, and applies the `dark` class to `<html>` when needed.
2. **Extend `useBoardStore` with a theme slice.**
   - Add `theme: 'system'` to initial state.
   - Add `setTheme` action that updates state, writes `localStorage`, and toggles the `dark` class.
   - On store initialization, read `localStorage`, subscribe to `prefers-color-scheme` if the value is `system`, and clean up the listener on store destroy (optional, since the app is long-lived).
3. **Create `client/src/components/ThemeToggle.jsx`.**
   - Use `const` arrow function component.
   - Read `theme` and `setTheme` from `useBoardStore` with selectors.
   - Render a single `<button>` with Tailwind classes and an `aria-label`.
   - Cycle through states on click.
4. **Import `ThemeToggle` in `BoardHeader.jsx`.**
   - Place it in the header flex row, aligned to the right of the editable title/description block.
   - Keep existing editable inputs untouched.
5. **Verify Tailwind dark variants work end-to-end.**
   - Confirm `dark:` classes already present in `BoardHeader` and the rest of the UI react to the `dark` class on `<html>`.
6. **Manual QA and, if time permits, add a unit test for the store slice.**

## 7. Edge Cases & Error Handling

- **localStorage unavailable or throws** (private browsing, disabled storage, `SecurityError`).
  - Wrap all `localStorage` access in `try/catch`.
  - Fall back to `'system'` silently.
  - The FOUC script must also be wrapped in `try/catch`.
- **Stored value is invalid.**
  - Validate against `['light', 'dark', 'system']`; default to `'system'`.
- **OS preference changes while `theme === 'system'`.**
  - Keep a `MediaQueryList` listener and recompute the `dark` class immediately.
- **Hydration mismatch.**
  - Because the inline script and React both read the same `localStorage` key, the server-rendered HTML (if any) and client markup will match after hydration. There is no SSR today, so this is a future-proofing concern only.
- **User sets `theme` and later clears `localStorage` manually.**
  - On next load the app falls back to `'system'`, which is the expected default.

## 8. Testing Strategy

### Unit tests (Zustand store slice)

- `setTheme('dark')` writes `'dark'` to `localStorage` and adds `dark` to `<html>`.
- `setTheme('light')` removes `dark` from `<html>`.
- `setTheme('system')` resolves to the correct class based on a mocked `matchMedia` value.
- Invalid stored values fall back to `'system'`.
- `localStorage` errors are caught and do not crash the store.

### Manual test checklist

- [ ] First visit with OS dark mode: board renders dark immediately, no flash.
- [ ] First visit with OS light mode: board renders light immediately, no flash.
- [ ] Toggle cycles `system → light → dark → system`.
- [ ] Refresh persists the selected mode.
- [ ] Switch OS mode while `theme === 'system'` updates the UI automatically.
- [ ] Button has correct `aria-label` and is keyboard focusable.
- [ ] `dark:` utility classes already present in `BoardHeader`, `Column`, `TaskCard`, etc. render correctly.
- [ ] `npm run dev` builds without errors.

## 9. Acceptance Criteria

- [ ] `ThemeToggle` component exists in `client/src/components/ThemeToggle.jsx`.
- [ ] Toggle is visible in `BoardHeader`.
- [ ] Selected theme persists across page reloads via `localStorage`.
- [ ] `system` theme respects and follows `prefers-color-scheme`.
- [ ] No FOUC on hard reload in either light or dark mode.
- [ ] All existing `dark:` variants continue to work.
- [ ] Code follows AGENTS.md conventions (`const` arrow components, single quotes, no semicolons, trailing commas, 2-space indent).

## 10. Out of Scope

- Syncing theme preference to the backend or user account.
- Animated transitions between themes.
- Additional color themes beyond light/dark.
- Theme preview in settings page.
- Changes to `tailwind.config.js` (already configured correctly).

## 11. Risks & Open Questions

- **Risk:** The inline FOUC script is duplicated logic shared with the Zustand store. If the theme logic evolves, both places must be updated. Mitigation: keep the inline script minimal (read + apply only) and centralize decision logic in the store.
- **Risk:** Third-party libraries or components may not respect the `dark` class on `<html>`. Mitigation: all current components use Tailwind `dark:` variants, which do respect it.
- **Open question:** Should the `ThemeToggle` also be reachable from a keyboard shortcut? Not required by the issue, but worth a follow-up.
- **Open question:** Should we store the theme under a namespaced key such as `task-board-theme` to avoid collisions? Recommended: yes, use `task-board-theme`.
