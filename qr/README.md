# QR code

`brostein-qr.svg` is the QR code for the bar's tables. It encodes a single fixed URL
on our own domain:

```
https://brosteinbar.no/#/qr
```

→ the "Kom inn, vi biter ikke! :)" page (`src/pages/Qr.jsx`) with a link to the menu.

It's a **static** code (the URL is baked into the pixels), so it has no expiry and no
dependency on any third-party redirect/QR service. It keeps working as long as the
domain stays registered, the site stays hosted, and the `/#/qr` route exists.

## Regenerate

```bash
npm run gen:qr
```

Writes `qr/brostein-qr.svg` using the brand palette (near-black `#0a0908` modules on
off-white `#ede8de`), error-correction level **H**, and the `B` mark
(`resources/img/B_svart.svg`) on a knockout medallion in the centre.

## Point it at a different URL

Pass the URL as an argument. Use the direct form, or `npm run … --`:

```bash
node scripts/gen-qr.mjs "https://brosteinbar.no/#/meny"
# or
npm run gen:qr -- "https://brosteinbar.no/#/meny"
```

(With no argument it defaults to `https://brosteinbar.no/#/qr`.)

## Resize the logo

Edit `LOGO_FRACTION` near the top of `scripts/gen-qr.mjs` (fraction of the code's width
the logo medallion spans), then regenerate. Current value: `0.15` (scan-tested).
Keep it under ~`0.25` — level-H tolerates ~30% loss, but the lower you stay the more
reliably it scans. **Always scan-test after changing it.**

## PNG / PDF for printing

Output is **SVG only** — it's vector, so it scales to any print size with no pixelation,
which is what print shops want. For a raster PNG or a PDF, open `brostein-qr.svg` in a
browser or any design tool and export. (A built-in PNG step would need an SVG→PNG
rasterizer dependency, intentionally left out to keep the repo lean.)
