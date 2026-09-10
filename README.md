# DSE – Digital Signage Image Arranger

A browser-only tool that arranges 2, 3, 4 or more images into layout patterns
that exactly fill a target canvas — by default a portrait 1080 × 1920 digital sign.
Everything runs client-side; no images are uploaded anywhere.

**Live:** enable GitHub Pages for this repo (Settings → Pages → Deploy from branch → `main`, root)
and open `https://<user>.github.io/dse/`.

## Features

- Drag & drop, paste, or browse to add any number of images; drag thumbnails (or click two) to reorder.
- Canvas presets: 1080×1920 portrait, 1920×1080, 4K variants, square, or any custom size.
- 17 layout patterns with live thumbnails: auto grid, 2/3 columns, stack, side-by-side,
  hero top/bottom/left/right, hero + grid, mosaic A/B, brick, masonry, L-shape, pinwheel, staircase.
- Adjustable hero size, mirror toggle, gap, outer margin, corner radius, cover/contain fit, background colour.
- Export as PNG or JPEG at full resolution.

## Development

Plain `index.html` + `style.css` + `app.js`, no build step. Open `index.html` directly or serve the folder.
