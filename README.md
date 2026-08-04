# LOOT — Interactive 3D Merch Storefront

LOOT is an interactive merchandise storefront concept built around a game-like product-selection experience. Visitors can browse a catalog, inspect products, rotate 3D items, choose a size, and add gear to an in-page inventory.

## Highlights

- Interactive product catalog with keyboard and pointer controls
- 3D product viewers using Three.js and local assets
- Product rotation, alternate view controls, animated transitions, and reduced-motion support
- Responsive desktop and mobile layouts with a mobile purchase dock
- Client-side inventory/cart interaction
- Automated Node.js tests covering catalog rules, product controls, themes, and interaction behavior

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript
- Three.js
- Node.js built-in test runner
- GLB and image assets for product presentation

## Run locally

Because the project loads local assets and modules, serve the repository from a local HTTP server rather than opening the HTML file directly:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Test

The repository uses Node's built-in test runner and does not require an npm install:

```bash
node --test tests/*.test.js
```

## Controls

- Select products using the product list or keyboard controls
- Drag the product viewer to rotate an item
- Use the view controls to inspect top, side, and bottom views when available
- Choose a size and add an item to the inventory
- Respect reduced-motion preferences automatically; `?motion=full` can be used for a full-motion demo

## What this demonstrates

This project demonstrates frontend interaction design beyond a static landing page: state management, progressive product rendering, 3D presentation, responsive UX, accessibility-minded controls, animation fallbacks, and lightweight automated verification.

## Third-party notices

See `THIRD_PARTY_LICENSES.txt` and the attribution file under `models/hoodie/` for included third-party assets and libraries.
