# Travesía

Planificador visual de viajes con:

- Mapa interactivo y rutas geodésicas animadas.
- Itinerarios con estancias, traslados y day trips.
- Calendario interactivo y exportación `.ics`.
- Múltiples viajes guardados en el navegador.
- Temas claro, oscuro y sistema.
- Interfaz en español e inglés.

## Desarrollo local

Requiere Node.js 22.

```bash
npm install
npm run dev
```

La aplicación estará disponible normalmente en `http://localhost:5173`.

## Validación

```bash
node --test src/utils/mapGeometry.test.js
npm run lint
npm run build
```

Las pruebas de cierre de opciones cubren teclado, puntero y pantallas móviles:

```bash
npx playwright install chromium
npm run test:settings
```

El mapa usa coordenadas de visualización compartidas para los marcadores y las
rutas que cruzan el antimeridiano, sin modificar las coordenadas guardadas.

## GitHub Pages

Los cambios enviados a `main` se publican automáticamente mediante GitHub
Actions.
