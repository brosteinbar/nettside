# Code Audit Todo List

## Dead Code

- [x] **LoginModal.css** — No textarea styles found; audit was a false positive
- [x] **Arrangement.jsx** — `Fragment` is used; audit was a false positive
- [x] **Navbar.jsx** — Hoisted `close` to component scope; removed duplicate declaration from inside useEffect

---

## Duplicate Code

### CSS
- [x] **Form inputs** — Shared base styles moved to `index.css` (background, border, font, color, transition). Component CSS files keep only their unique `padding` value. `.modal-form` and `.admin-form` flex container styles also consolidated
- [x] **Button hover transitions** — `.modal-submit` and `.admin-submit` consolidated into `index.css`; `admin-submit` retains only `width: 100%` override. Other button styles (event-form-actions, edit-form-actions) are intentionally different — no consolidation needed
- [x] **Modal/box containers** — `.modal-box` and `.admin-box` are NOT identical (admin-box is only `width`); audit was a false positive
- [x] **Error text** — `.modal-error` and `.admin-error` removed; all error text now uses shared `.form-error` in `index.css`

### JavaScript
- [x] **Login form logic** — Extracted to `src/hooks/useLoginForm.js`; accepts `onSuccess` callback for the differing post-login action
- [x] **Login form markup** — Extracted to `src/components/LoginForm.jsx`; accepts `formClassName` and `submitClassName` props (defaults to modal variants)

### HTML/JSX
- [x] **Button classes** — `.modal-submit` and `.admin-submit` consolidated in `index.css`. `event-form-actions` and `edit-form-actions` buttons are intentionally different — no consolidation needed

---

## Security

### Critical
- [x] **No Row Level Security (RLS)** — Already in place: anon `SELECT`, authenticated `ALL` on events, menu_categories, menu_items
- [x] **Client-side auth only** — Acceptable: no public signup, only one admin user can authenticate. Signup disabled in Supabase Auth settings

### High
- [x] **No admin role distinction** — Acceptable for single-admin app with signup disabled; `authenticated = admin` is always true
- [x] **Unauthenticated write paths** — Correctly enforced by RLS policies

### Medium
- [x] **Swallowed errors on mutations** — Fixed in Arrangement.jsx and Menu.jsx: all mutations now check `error`, skip state updates on failure, and surface a Norwegian error message to the user
- [x] **Missing input validation** — Fixed in Menu.jsx `EditItemForm`: name required/max 100, description/allergens max 500, price must be positive if set

---

## Overcomplicated Processes

- [x] **Menu.jsx — prop drilling** — Introduced `MenuAdminContext`; `SortableCategory` and `SortableMenuItem` now read all handlers from context instead of props. `SortableCategory` reduced from 13 props to 1 (`category`)
- [x] **Menu.jsx — race condition** — False positive; React controlled inputs keep state and DOM in sync, so no actual race condition exists
- [x] **CSS `!important`** — `.event-form-title` rule replaced with `.event-form input.event-form-title` (specificity 0,2,1 beats 0,1,1); all three `!important` flags removed

---

# Second-Pass Audit

## Bugs

- [x] **Context value identity (AuthContext)** — Wrapped value in `useMemo(() => ({ user }), [user])`
- [ ] **Context value identity (MenuAdminContext)** — Deferred. The handlers in `Menu.jsx` are recreated every render and most close over `categories` state, so a `useMemo` would only be effective if combined with `useCallback` on every handler. Without `React.memo` on `SortableCategory`/`SortableMenuItem` it provides no actual perf benefit, since children re-render with the parent regardless. Skipping until there's evidence of perf issues
- [ ] **`useLoginForm.js` — loading not reset on success** — `setLoading(false)` only called in error branch. Invisible in current usage (component unmounts), but technically wrong. Add it before `onSuccess()`
- [ ] **`Menu.jsx fetchData` — silent partial failure** — If categories succeed but items fetch fails, items silently becomes `[]`. Check both responses and surface an error

## Accessibility

- [x] **Icon-only buttons missing `aria-label`** — Added `aria-label` to all icon-only buttons across `Menu.jsx`, `Arrangement.jsx`, and `LoginModal.jsx`
- [x] **Form inputs missing `<label>`** — Added `aria-label` to all unlabeled inputs (item form, event form, date/time/select, category name)
- [x] **Drag handles unreachable by keyboard** — Removed `tabIndex={-1}` from item and category drag handles; dnd-kit's `KeyboardSensor` was already configured, so Space/Arrow keys now work
- [x] **Focus styles inadequate** — Added global `*:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }` in `index.css`
- [ ] **Navbar keyboard navigation** — No Escape-to-close, no keyboard way to open the menu (only mouseenter / tap). Add Escape key handler and ensure hamburger button toggles on Enter/Space
- [ ] **Tap targets below 44×44px** — Menu action buttons (✎ × ↩ ✕) and drag handles too small for reliable mobile use

## Architecture / Robustness

- [x] **No 404 route** — Added `<Route path="*" element={<NotFound />} />` in `App.jsx`
- [x] **No ErrorBoundary** — Added `src/components/ErrorBoundary.jsx`; wraps `<Routes>` in `App.jsx`
- [ ] **AuthContext has no `loading` state** — `/admin` briefly shows the login form before `getSession()` resolves. Add a `loading` state and gate UI on it
- [ ] **No lazy loading of routes** — All 5 pages eagerly imported into the 475 KB bundle. Use `React.lazy` + `<Suspense>` for at least Admin/Menu/Arrangement
- [x] **Unused `puppeteer` dependency** — Removed via `npm uninstall puppeteer`; 89 transitive packages removed

## Code Quality (minor)

- [x] **Hardcoded `#b94040`** — Promoted to `--error` CSS variable in `:root`; both usages now reference `var(--error)`
- [ ] **Inconsistent transition durations** — 0.15s, 0.2s, 0.35s, 0.55s scattered. Pick a small set (e.g. 0.15s / 0.3s) and stick to it
- [ ] **`signOut()` fire-and-forget** — `Navbar.jsx` doesn't await `supabase.auth.signOut()` and ignores errors
- [ ] **Item-reorder race** — Rapid drags while previous saves are in flight can produce wrong final `sort_order`. Lock during save, or queue
- [ ] **`isTouch` recomputed every render** — `Navbar.jsx:36` re-runs `matchMedia(...)` on every render. Compute once in state (very minor)
