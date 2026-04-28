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
- [ ] **Login form logic** — LoginModal.jsx and Admin.jsx each contain ~40 lines of identical state (`email`, `password`, `error`, `loading`) and `handleSubmit`. Extract to a `useLoginForm()` custom hook
- [ ] **Login form markup** — LoginModal.jsx and Admin.jsx have identical 25-line form JSX. Extract to a shared `<LoginForm>` component

### HTML/JSX
- [ ] **Button classes** — `.modal-submit`, `.admin-submit`, `.event-form-actions button`, `.edit-form-actions button` are scattered with near-identical styles but no shared component. Create a unified `<Button>` component or shared CSS class

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

- [ ] **Menu.jsx — prop drilling** — `SortableCategory` receives 13+ props (`onEdit`, `onSave`, `onCancel`, `onSoftDelete`, `onHardDelete`, `onRestore`, `onAddItem`, `onCategoryNameChange`, `onCategoryNameBlur`, `onDeleteCategory`, `onItemsReorder`, …). Refactor to a context + reducer pattern scoped to the menu editor
- [ ] **Menu.jsx — race condition** — `handleCategoryNameChange` updates state immediately while `handleCategoryNameBlur` makes an async DB call, creating an inconsistency window. Debounce or consolidate into a single save action
- [ ] **CSS `!important`** — Menu.css uses `!important` 3 times in `.event-form-title` and `.event-form-desc`. Increase specificity instead or restructure the selectors so `!important` is not needed
