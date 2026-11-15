# Travesía

Visual travel planner with:

- Interactive map and animated geodesic routes.
- Itineraries with stays, transfers, and day trips.
- Interactive calendar and `.ics` export.
- Multiple trips saved in the browser.
- Light, dark, and system themes.
- Spanish and English interface.

## Local development

Requires Node.js 22.

```bash
npm install
npm run dev
```

The app will normally be available at `http://localhost:5173`.

## Validation

```bash
node --test src/utils/mapGeometry.test.js
npm run lint
npm run build
```

The card dismissal tests (settings, trips, and itinerary) cover keyboard, pointer,
and mobile interactions:

```bash
npx playwright install chromium
npm run test:settings
```

The map uses shared display coordinates for markers and routes that cross the
antimeridian, without modifying the saved coordinates.

## GitHub Pages

Changes pushed to `main` are automatically deployed through GitHub Actions.
