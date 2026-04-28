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
