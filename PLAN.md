# Brostein — Nav & Content Plan

## Items

### 1. Hamburger: click + hover trigger
- Desktop: open on `mouseenter`, close on `mouseleave` (the whole header zone)
- Mobile: open/close on click only (touch devices don't fire hover)
- Detection: use a `pointer: coarse` media query or `matchMedia` — coarse = touch = click-only
- State stays in Navbar, no new deps needed

### 2. Menu items: Om oss · Meny · Kontakt
- Drop 'Arrangementer'
- Each item will eventually link to a section or open a panel; for now all href="#"
- Order: Om oss → Meny → Kontakt

### 3. Meny — Supabase
- ⏸ Discuss before implementing
- Likely: fetch menu categories + items from a `menu_items` table
- Render as a section below the hero (or a full-screen overlay panel)
- Will need: Supabase client setup, env vars, a loading state

### 4. Kontakt — Custom email form
- ⏸ Discuss before implementing
- User has a specific implementation in mind

---

## Step order

- [x] Plan written
- [x] Step 1 — hover + click trigger
- [x] Step 2 — trim menu items to Om oss / Meny / Kontakt
- [ ] Step 3 — Meny (discuss first)
- [ ] Step 4 — Kontakt (discuss first)
