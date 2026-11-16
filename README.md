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

## UI stack

Ant Design provides application controls, cards, feedback, legends, and calendar
event/export buttons; `@ant-design/icons` supplies application icons. The shared
`ConfigProvider` follows the saved English/Spanish locale and light/dark/system
theme without changing stored trip data.

Leaflet remains the geographic renderer for zoom controls, numbered markers,
permanent selected/active labels, route paths, and the moving direction arrow.
The basemap uses OpenFreeMap vector tiles through MapLibre GL Leaflet. Legend
swatches mirror these geographic symbols. The calendar retains its Monday-first
grid, multi-day lanes, nested day trips, and transfer placement, composed with
Ant Design cards and buttons rather than replacing them with a calendar widget
with different semantics. Its lane colors and continuation edges are domain
styles; `.ics` export retains all-day dates, exclusive end dates, and round-trip
transfer semantics.

## GitHub Pages

Changes pushed to `main` are automatically deployed through GitHub Actions.
