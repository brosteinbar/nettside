# Brostein — TODO

## In progress
- [ ] Twitter/Google bot (WIP, see `scripts/` and `.github/workflows/google_bot.yml`)

## Pending

### 1. Arrangement page (`/#/arrangement`)
- [ ] New route and nav link
- [ ] Supabase table for events (title, description, date/time, image?, capacity?)
- [ ] Public view: list upcoming events
- [ ] Admin: create, edit, delete events (similar to menu admin flow)
- [ ] Support recurring events (e.g. "Quiz every Wednesday")
- [ ] Figure out remaining features during implementation

### 2. Kontakt oss page (`/#/kontakt`)
- [ ] Address
- [ ] Map
- [ ] Phone
- [ ] Opening hours
- [ ] Contact form

### 3. Om oss / nav link to landing page
- [ ] "Om oss" is currently the only nav link back to the landing page — rename it (e.g. "Hjem") rather than removing it

### 4. Fix hamburger menu fonts
- [x] Font weight too bulky — reduce weight
- [x] Add hover effects: italic on hover

### 5. Move admin login to `/admin` route
- [x] Remove "Admin"/"Logg ut" button from hamburger menu
- [x] Create `/#/admin` route with a standalone login page
- [x] Redirect to menu (or a dashboard) after successful login

### 6. Navbar overlay pushes page content down
- [x] Dropdown now floats as right-aligned overlay, doesn't affect page layout

### 7. Sign-out in hamburger menu when logged in
- [ ] When authenticated, show a "Logg ut" option in the hamburger menu (like before, but without the "Admin" login button for logged-out users)
