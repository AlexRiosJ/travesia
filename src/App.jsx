import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import TripCalendar from './components/TripCalendar'
import TripMap from './components/TripMap'
import { createEmptyStop, findKnownLocation } from './data/sampleTrip'
import {
  TRIP_LIBRARY_STORAGE_KEY,
  createBlankTrip,
  loadTripLibrary,
} from './data/tripLibrary'
import {
  UI_COPY,
  formatDate,
  formatDateRange,
} from './i18n'
import { buildRouteLegs } from './utils/routeLegs'
import { buildStopLabels } from './utils/stopLabels'
import './App.css'

const DAY_IN_MS = 24 * 60 * 60 * 1000
const LEGACY_TRANSPORT_LABELS = {
  unspecified: 'Por definir',
  walk: 'A pie',
  local: 'Transporte local',
  train: 'Tren',
  shinkansen: 'Shinkansen',
  flight: 'Avión',
  bus: 'Autobús',
  car: 'Auto',
  ferry: 'Ferry',
}

function dismissCard(card) {
  if (!card?.open) return

  const restoreFocus = card.contains(document.activeElement)
  card.open = false
  if (restoreFocus) card.querySelector(':scope > summary').focus()
}

function formatTransport(transport) {
  if (transport === 'unspecified' || transport === 'Por definir') return ''
  return LEGACY_TRANSPORT_LABELS[transport] || transport || ''
}

function parseDate(date) {
  return new Date(`${date}T12:00:00Z`)
}

function validateStops(stops, origin, destination) {
  if (!origin.place.trim() || !origin.date) {
    return 'Completa el punto de partida y su fecha.'
  }

  if (!destination.place.trim() || !destination.date) {
    return 'Completa el punto final y su fecha.'
  }

  if (stops.length < 1) {
    return 'Agrega al menos una estancia al itinerario.'
  }

  let baseStop = stops[0]

  for (const [index, stop] of stops.entries()) {
    if (!stop.place.trim() || !stop.startDate || !stop.endDate) {
      return 'Completa la ciudad y las fechas de cada parada.'
    }

    if (parseDate(stop.endDate) < parseDate(stop.startDate)) {
      return `La fecha de salida de ${stop.place} no puede ser anterior a la llegada.`
    }

    if (stop.category === 'day-trip') {
      if (index === 0) {
        return 'Una actividad o day trip necesita una ciudad base anterior.'
      }

      if (stop.startDate !== stop.endDate) {
        return `El day trip a ${stop.place} debe ocurrir en un solo día.`
      }

      if (
        stop.startDate < baseStop.startDate ||
        stop.startDate > baseStop.endDate
      ) {
        return `El day trip a ${stop.place} debe estar dentro de la estancia en ${baseStop.place}.`
      }
    } else {
      if (index > 0 && stop.startDate < baseStop.endDate) {
        return `La llegada a ${stop.place} ocurre antes de la salida de ${baseStop.place}.`
      }
      baseStop = stop
    }
  }

  const firstDate = stops[0].startDate
  const lastDate = stops.reduce(
    (latest, stop) => (stop.endDate > latest ? stop.endDate : latest),
    stops[0].endDate,
  )

  if (origin.date > firstDate) {
    return 'La salida del punto de partida ocurre después de la primera estancia.'
  }

  if (destination.date < lastDate) {
    return 'La llegada al punto final ocurre antes de terminar el itinerario.'
  }

  return null
}

async function geocodePlace(place, signal) {
  const query = new URLSearchParams({
    q: place,
    format: 'jsonv2',
    limit: '1',
    'accept-language': 'es',
  })
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${query}`,
    {
      headers: { Accept: 'application/json' },
      signal,
    },
  )

  if (!response.ok) {
    throw new Error(`No pudimos buscar ${place}. Intenta de nuevo.`)
  }

  const [result] = await response.json()
  if (!result) {
    throw new Error(`No encontramos "${place}". Prueba con ciudad y país.`)
  }

  return {
    lat: Number(result.lat),
    lng: Number(result.lon),
    displayName: result.display_name,
  }
}

function Icon({ name }) {
  const paths = {
    calendar: (
      <>
        <path d="M7 2v3M17 2v3M3.5 9h17" />
        <rect x="3.5" y="4" width="17" height="17" rx="3" />
      </>
    ),
    map: (
      <>
        <path d="m3.5 6 5-2.5 7 3 5-2.5v14l-5 2.5-7-3-5 2.5Z" />
        <path d="M8.5 3.5v14M15.5 6.5v14" />
      </>
    ),
    play: <path d="m9 6 9 6-9 6Z" />,
    pause: (
      <>
        <path d="M9 6v12M15 6v12" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    trash: (
      <>
        <path d="M4.5 7h15M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
      </>
    ),
    route: (
      <>
        <circle cx="6" cy="18" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <path d="M8.5 18h3a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3" />
      </>
    ),
    expandAll: (
      <>
        <path d="M5 17H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
        <rect x="7" y="7" width="15" height="15" rx="2" />
        <path d="M11 14.5h7M14.5 11v7" />
      </>
    ),
    collapseAll: (
      <>
        <path d="M5 17H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
        <rect x="7" y="7" width="15" height="15" rx="2" />
        <path d="M11 14.5h7" />
      </>
    ),
    edit: (
      <>
        <path d="m14 5 5 5M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10Z" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
    system: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
  }

  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

function StopCard({
  stop,
  displayLabel,
  totalStops,
  basePlace,
  nested = false,
  onUpdate,
  onRemove,
  onSelect,
  onAddDayTrip,
  childCount = 0,
  childSummary = '',
  treeExpansion,
  copy,
  language,
  children,
}) {
  const isExcursion = stop.category === 'day-trip'
  const [isOpen, setIsOpen] = useState(
    treeExpansion ? treeExpansion.mode === 'all' : !stop.place,
  )

  return (
    <details
      className={`stop-node${nested ? ' is-nested' : ''}`}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      onFocusCapture={onSelect}
    >
      <summary onClick={onSelect}>
        <span className="stop-number">{displayLabel}</span>
        <span className="stop-node-summary">
          <strong>
            {stop.place || (nested ? copy.newDayTrip : copy.newStay)}
          </strong>
          <small>
            {formatDateRange(stop.startDate, stop.endDate, language)}
          </small>
          {!nested && childCount > 0 && (
            <small
              className="stop-node-children-summary"
              title={childSummary}
            >
              {copy.dayTrips}: {childSummary}
            </small>
          )}
        </span>
        <span className="stop-node-chevron" aria-hidden="true">
          <Icon name="chevronRight" />
        </span>
      </summary>

      <div className="stop-node-body">
        <div className="place-fields">
          <label>
            <span>{copy.cityOrPlace}</span>
            <input
              type="text"
              value={stop.place}
              placeholder={copy.cityOrPlace}
              onChange={(event) =>
                onUpdate(stop.id, 'place', event.target.value)
              }
            />
          </label>
        </div>
        <div className="date-fields">
          <label>
            <span>{isExcursion ? copy.date : copy.arrival}</span>
            <input
              type="date"
              value={stop.startDate}
              onChange={(event) =>
                onUpdate(stop.id, 'startDate', event.target.value)
              }
            />
          </label>
          <label>
            <span>{copy.departure}</span>
            <input
              type="date"
              min={stop.startDate}
              value={stop.endDate}
              disabled={isExcursion}
              onChange={(event) =>
                onUpdate(stop.id, 'endDate', event.target.value)
              }
            />
          </label>
        </div>
        {isExcursion && basePlace && (
          <p className="day-trip-note">
            {copy.roundTripFrom} {basePlace}
          </p>
        )}
        {children && <div className="stop-children">{children}</div>}
        <div className="stop-node-actions">
          {!nested && (
            <button
              type="button"
              className="add-day-trip-button"
              onClick={(event) => {
                event.stopPropagation()
                onAddDayTrip(stop.id)
              }}
            >
              <Icon name="plus" />
              {copy.addDayTrip}
            </button>
          )}
          <button
            type="button"
            className="icon-button remove-button"
            onClick={() => onRemove(stop.id)}
            disabled={totalStops <= 1}
            aria-label={`Eliminar ${stop.place || `parada ${displayLabel}`}`}
            title={copy.delete}
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>
    </details>
  )
}

function EndpointCard({
  label,
  marker,
  endpoint,
  onUpdate,
  onSelect,
  treeExpansion,
  copy,
  language,
}) {
  const [isOpen, setIsOpen] = useState(
    treeExpansion ? treeExpansion.mode === 'all' : !endpoint.place,
  )

  return (
    <details
      className="endpoint-node"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      onFocusCapture={onSelect}
    >
      <summary onClick={onSelect}>
        <span className="endpoint-marker">{marker}</span>
        <span className="endpoint-node-summary">
          <strong>{label}</strong>
          <small>
            {endpoint.place || copy.unconfigured} ·{' '}
            {formatDate(endpoint.date, language)}
          </small>
        </span>
        <span className="stop-node-chevron" aria-hidden="true">
          <Icon name="chevronRight" />
        </span>
      </summary>
      <div className="endpoint-node-body">
        <label>
          <span>{copy.city}</span>
          <input
            type="text"
            value={endpoint.place}
            placeholder="Ej. Seattle, WA"
            onChange={(event) => onUpdate('place', event.target.value)}
          />
        </label>
        <label className="endpoint-date-field">
          <span>{copy.date}</span>
          <input
            type="date"
            value={endpoint.date}
            onChange={(event) => onUpdate('date', event.target.value)}
          />
        </label>
      </div>
    </details>
  )
}

function TransferConnector({
  from,
  to,
  date,
  transport,
  routeIndex,
  onTransportChange,
  onSelect,
  copy,
  language,
}) {
  return (
    <div className="transfer-connector">
      <button
        type="button"
        className="transfer-line-button"
        onClick={onSelect}
        disabled={routeIndex < 0}
        aria-label={`Ver traslado de ${from.place} a ${to.place}`}
      >
        <span className="transfer-line" />
        <span className="transfer-arrow">→</span>
      </button>
      <span className="transfer-date">{formatDate(date, language)}</span>
      <label>
        <span>{copy.transport}</span>
        <input
          type="text"
          value={LEGACY_TRANSPORT_LABELS[transport] || transport || ''}
          placeholder={copy.transportPlaceholder}
          onChange={(event) => onTransportChange(event.target.value)}
        />
      </label>
    </div>
  )
}

function App() {
  const [library, setLibrary] = useState(loadTripLibrary)
  const [activeRoute, setActiveRoute] = useState(-1)
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)
  const [mapStepCursor, setMapStepCursor] = useState(-1)
  const [treeExpansion, setTreeExpansion] = useState(null)
  const [language, setLanguage] = useState(
    () => localStorage.getItem('rumbo-language') || 'es',
  )
  const [theme, setTheme] = useState(
    () => localStorage.getItem('rumbo-theme') || 'system',
  )
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [status, setStatus] = useState(() =>
    library.loadError
      ? { type: 'error', message: library.loadError }
      : { type: 'idle', message: '' },
  )
  const geocodeCache = useRef(new Map())
  const routeGenerationController = useRef(null)
  const generateRouteRef = useRef(null)
  const tripMenuRef = useRef(null)
  const copy = UI_COPY[language] ?? UI_COPY.es
  const resolvedTheme =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  const activeTrip =
    library.trips.find((trip) => trip.id === library.activeTripId) ??
    library.trips[0]
  const draftStops = activeTrip.draftStops
  const resolvedStops = activeTrip.resolvedStops
  const origin = activeTrip.origin
  const destination = activeTrip.destination
  const resolvedOrigin = activeTrip.resolvedOrigin
  const resolvedDestination = activeTrip.resolvedDestination
  const routeLegs = useMemo(
    () =>
      buildRouteLegs(resolvedStops, resolvedOrigin, resolvedDestination),
    [resolvedDestination, resolvedOrigin, resolvedStops],
  )
  const draftRouteLegs = useMemo(
    () =>
      buildRouteLegs(
        draftStops,
        {
          ...origin,
          lat: resolvedOrigin?.lat ?? 0,
          lng: resolvedOrigin?.lng ?? 0,
        },
        {
          ...destination,
          lat: resolvedDestination?.lat ?? 0,
          lng: resolvedDestination?.lng ?? 0,
        },
      ),
    [destination, draftStops, origin, resolvedDestination, resolvedOrigin],
  )
  const routes = routeLegs.length
  const selectedStopIndex = draftStops.findIndex(
    (stop) => stop.id === selectedPlaceId,
  )
  const activeStopIndex =
    routeLegs[activeRoute]?.timelineIndex ?? selectedStopIndex
  const activeLeg = routeLegs[activeRoute]
  const mapNavigationSteps = useMemo(() => {
    const steps = []

    if (resolvedOrigin) {
      steps.push({
        type: 'place',
        id: `place-${resolvedOrigin.id}`,
        placeId: resolvedOrigin.id,
      })
    } else if (resolvedStops[0]) {
      steps.push({
        type: 'place',
        id: `place-${resolvedStops[0].id}`,
        placeId: resolvedStops[0].id,
      })
    }

    routeLegs.forEach((leg, routeIndex) => {
      steps.push({
        type: 'route',
        id: `route-${leg.id}`,
        routeIndex,
      })
      steps.push({
        type: 'place',
        id: `place-${leg.to.id}-${routeIndex}`,
        placeId: leg.to.id,
      })
    })

    return steps
  }, [resolvedOrigin, resolvedStops, routeLegs])
  const currentMapStepIndex = useMemo(() => {
    if (activeRoute >= 0) {
      return mapNavigationSteps.findIndex(
        (step) =>
          step.type === 'route' && step.routeIndex === activeRoute,
      )
    }

    return mapStepCursor
  }, [activeRoute, mapNavigationSteps, mapStepCursor])
  const selectedPlace =
    selectedPlaceId === origin.id
      ? { ...origin, selectionLabel: copy.origin }
      : selectedPlaceId === destination.id
        ? { ...destination, selectionLabel: copy.destination }
        : draftStops.find((stop) => stop.id === selectedPlaceId) ?? null
  const draftStopGroups = useMemo(() => {
    const groups = []

    draftStops.forEach((stop, index) => {
      const isExcursion = stop.category === 'day-trip'
      if (isExcursion && groups.length > 0) {
        groups.at(-1).children.push({ stop, index })
        return
      }

      groups.push({
        base: { stop, index },
        children: [],
      })
    })

    return groups
  }, [draftStops])
  const draftStopLabels = useMemo(
    () => buildStopLabels(draftStops),
    [draftStops],
  )
  const resolvedStopLabels = useMemo(
    () => buildStopLabels(resolvedStops),
    [resolvedStops],
  )
  const tripDateRange = useMemo(() => {
    if (!resolvedStops.length) return null

    return resolvedStops.reduce(
      (range, stop) => ({
        startDate:
          stop.startDate < range.startDate ? stop.startDate : range.startDate,
        endDate: stop.endDate > range.endDate ? stop.endDate : range.endDate,
      }),
      {
        startDate: resolvedOrigin?.date || resolvedStops[0].startDate,
        endDate:
          resolvedDestination?.date || resolvedStops[0].endDate,
      },
    )
  }, [resolvedDestination, resolvedOrigin, resolvedStops])
  const tripSummary = useMemo(() => {
    if (!tripDateRange) return null

    const days =
      Math.round(
        (parseDate(tripDateRange.endDate) -
          parseDate(tripDateRange.startDate)) /
          DAY_IN_MS,
      ) + 1
    const cities = new Set(
      resolvedStops
        .filter((stop) => stop.category !== 'day-trip')
        .map((stop) => stop.place.toLocaleLowerCase('es')),
    ).size

    return { days: Math.max(days, 1), cities }
  }, [resolvedStops, tripDateRange])

  useEffect(() => {
    try {
      localStorage.setItem(
        TRIP_LIBRARY_STORAGE_KEY,
        JSON.stringify({
          trips: library.trips,
          activeTripId: library.activeTripId,
        }),
      )
    } catch (error) {
      console.error('No se pudo guardar la biblioteca de viajes.', error)
    }
  }, [library.activeTripId, library.trips])

  useEffect(() => {
    localStorage.setItem('rumbo-language', language)
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    localStorage.setItem('rumbo-theme', theme)
    document.documentElement.dataset.theme = resolvedTheme
  }, [resolvedTheme, theme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = (event) => setSystemDark(event.matches)
    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])

  useEffect(() => {
    function handleOutsideInteraction(event) {
      document.querySelectorAll('details[open]').forEach((card) => {
        // Inline cards must stay in place until the click reaches its target.
        if (
          !card.contains(event.target) &&
          (event.type === 'click' || card.matches('.trip-menu, .settings-menu'))
        ) dismissCard(card)
      })
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        document.querySelectorAll('details[open]').forEach(dismissCard)
      }
    }

    document.addEventListener('pointerdown', handleOutsideInteraction, true)
    document.addEventListener('click', handleOutsideInteraction, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideInteraction, true)
      document.removeEventListener('click', handleOutsideInteraction, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!isPlaying || routes === 0) return undefined

    const timer = window.setInterval(() => {
      setActiveRoute((current) => {
        if (current >= routes - 1) {
          setIsPlaying(false)
          setMapStepCursor(-1)
          return -1
        }
        return current + 1
      })
    }, 2800)

    return () => window.clearInterval(timer)
  }, [isPlaying, routes])

  function updateTrip(tripId, updater) {
    setLibrary((current) => ({
      ...current,
      trips: current.trips.map((trip) =>
        trip.id === tripId
          ? {
              ...updater(trip),
              updatedAt: new Date().toISOString(),
            }
          : trip,
      ),
    }))
  }

  function updateActiveTrip(updater) {
    updateTrip(activeTrip.id, updater)
  }

  function setDraftStops(updater) {
    updateActiveTrip((trip) => ({
      ...trip,
      draftStops:
        typeof updater === 'function' ? updater(trip.draftStops) : updater,
    }))
  }

  function updateStop(id, field, value) {
    setDraftStops((current) =>
      current.map((stop) => {
        if (stop.id !== id) return stop
        if (field === 'startDate' && stop.category === 'day-trip') {
          return { ...stop, startDate: value, endDate: value }
        }
        return { ...stop, [field]: value }
      }),
    )
  }

  function removeStop(id) {
    setDraftStops((current) => current.filter((stop) => stop.id !== id))
  }

  function updateEndpoint(endpointName, field, value) {
    updateActiveTrip((trip) => ({
      ...trip,
      [endpointName]: {
        ...trip[endpointName],
        [field]: value,
      },
    }))
  }

  function addStop() {
    setDraftStops((current) => {
      const previousBase = current.findLast(
        (stop) => stop.category !== 'day-trip',
      )
      return [...current, createEmptyStop(previousBase)]
    })
  }

  function addDayTrip(baseStopId) {
    setDraftStops((current) => {
      const baseIndex = current.findIndex((stop) => stop.id === baseStopId)
      if (baseIndex < 0) return current

      let insertIndex = baseIndex + 1
      while (
        insertIndex < current.length &&
        current[insertIndex].category === 'day-trip'
      ) {
        insertIndex += 1
      }

      const baseStop = current[baseIndex]
      const dayTrip = {
        id: crypto.randomUUID(),
        place: '',
        startDate: baseStop.startDate,
        endDate: baseStop.startDate,
        category: 'day-trip',
        transport: '',
      }

      return [
        ...current.slice(0, insertIndex),
        dayTrip,
        ...current.slice(insertIndex),
      ]
    })
  }

  function switchTrip(tripId) {
    dismissCard(tripMenuRef.current)
    setLibrary((current) => ({ ...current, activeTripId: tripId }))
    setActiveRoute(-1)
    setSelectedPlaceId(null)
    setMapStepCursor(-1)
    setIsPlaying(false)
    setStatus({ type: 'idle', message: '' })
  }

  function addTrip() {
    dismissCard(tripMenuRef.current)
    const trip = createBlankTrip()
    setLibrary((current) => ({
      ...current,
      trips: [...current.trips, trip],
      activeTripId: trip.id,
    }))
    setActiveRoute(-1)
    setSelectedPlaceId(null)
    setMapStepCursor(-1)
    setIsPlaying(false)
    setStatus({
      type: 'success',
      message: 'Nuevo viaje creado. Agrega el nombre, las ciudades y las fechas.',
    })
  }

  function removeTrip() {
    if (library.trips.length <= 1) return
    const shouldRemove = window.confirm(
      `¿Eliminar "${activeTrip.title}" de este navegador?`,
    )
    if (!shouldRemove) return
    dismissCard(tripMenuRef.current)

    setLibrary((current) => {
      const trips = current.trips.filter((trip) => trip.id !== activeTrip.id)
      return { ...current, trips, activeTripId: trips[0].id }
    })
    setActiveRoute(-1)
    setSelectedPlaceId(null)
    setMapStepCursor(-1)
    setIsPlaying(false)
    setStatus({ type: 'idle', message: '' })
  }

  async function generateRoute({ automatic = false } = {}) {
    const validationError = validateStops(draftStops, origin, destination)
    if (validationError) {
      setStatus({ type: 'error', message: validationError })
      return
    }

    routeGenerationController.current?.abort()
    const controller = new AbortController()
    routeGenerationController.current = controller
    setStatus({
      type: 'loading',
      message: automatic
        ? copy.updatingAutomatically
        : 'Ubicando ciudades en el mapa…',
    })
    setIsPlaying(false)

    try {
      async function resolveLocation(place, shouldWait = false) {
        const key = place.trim().toLocaleLowerCase('es')
        let location = geocodeCache.current.get(key)

        if (!location) {
          const knownLocation = findKnownLocation(place)
          location = knownLocation
            ? {
                lat: knownLocation.lat,
                lng: knownLocation.lng,
                displayName: knownLocation.displayName,
              }
            : await geocodePlace(place.trim(), controller.signal)
          geocodeCache.current.set(key, location)

          if (!knownLocation && shouldWait) {
            await new Promise((resolve) => window.setTimeout(resolve, 1050))
          }
        }

        return location
      }

      const originLocation = await resolveLocation(origin.place, true)
      const nextStops = []

      for (const [index, stop] of draftStops.entries()) {
        const location = await resolveLocation(
          stop.place,
          index < draftStops.length - 1,
        )

        nextStops.push({
          ...stop,
          place: stop.place.trim(),
          ...location,
        })
      }

      const destinationLocation = await resolveLocation(destination.place)
      updateActiveTrip((trip) => ({
        ...trip,
        resolvedStops: nextStops,
        resolvedOrigin: {
          ...trip.origin,
          place: trip.origin.place.trim(),
          ...originLocation,
        },
        resolvedDestination: {
          ...trip.destination,
          place: trip.destination.place.trim(),
          ...destinationLocation,
        },
      }))
      setActiveRoute(-1)
      setSelectedPlaceId(null)
      setMapStepCursor(-1)
      setStatus({
        type: 'success',
        message: automatic
          ? copy.updatedAutomatically
          : 'Ruta actualizada. Selecciona una etapa para explorarla.',
      })
    } catch (error) {
      if (error.name !== 'AbortError') {
        setStatus({
          type: 'error',
          message: error.message || 'No pudimos crear la ruta.',
        })
      }
    } finally {
      if (routeGenerationController.current === controller) {
        routeGenerationController.current = null
      }
    }
  }

  useEffect(() => {
    generateRouteRef.current = generateRoute
  })

  useEffect(() => {
    routeGenerationController.current?.abort()
    const timer = window.setTimeout(() => {
      generateRouteRef.current?.({ automatic: true })
    }, 700)

    return () => window.clearTimeout(timer)
  }, [destination, draftStops, origin])

  function selectPlace(placeId, stepIndex) {
    setIsPlaying(false)
    setActiveRoute(-1)
    setSelectedPlaceId(placeId)
    setMapStepCursor(
      stepIndex ??
        mapNavigationSteps.findIndex(
          (step) =>
            step.type === 'place' && step.placeId === placeId,
        ),
    )
  }

  function selectStop(index) {
    const stop = draftStops[index]
    if (stop) selectPlace(stop.id)
  }

  function selectRoute(index, stepIndex) {
    if (index < 0) return
    setSelectedPlaceId(null)
    setIsPlaying(false)
    setActiveRoute(index)
    setMapStepCursor(
      stepIndex ??
        mapNavigationSteps.findIndex(
          (step) =>
            step.type === 'route' && step.routeIndex === index,
        ),
    )
  }

  function navigateMap(direction) {
    if (mapNavigationSteps.length === 0) return

    const nextIndex =
      currentMapStepIndex < 0
        ? direction > 0
          ? 0
          : -1
        : currentMapStepIndex + direction
    const step = mapNavigationSteps[nextIndex]
    if (!step) return

    if (step.type === 'route') {
      selectRoute(step.routeIndex, nextIndex)
      return
    }

    selectPlace(step.placeId, nextIndex)
  }

  function togglePlayback() {
    if (routes === 0) return
    if (isPlaying) {
      setIsPlaying(false)
      return
    }

    setSelectedPlaceId(null)
    if (activeRoute < 0 || activeRoute >= routes - 1) setActiveRoute(0)
    setIsPlaying(true)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Travesía, inicio">
          <span className="brand-mark">
            <Icon name="route" />
          </span>
          <span>Travesía</span>
        </a>
        <label className="topbar-trip-title">
          <span className="visually-hidden">{copy.tripName}</span>
          <input
            type="text"
            value={activeTrip.title}
            onChange={(event) =>
              updateActiveTrip((trip) => ({
                ...trip,
                title: event.target.value,
              }))
            }
            placeholder={copy.tripName}
          />
          <span className="topbar-title-edit-icon" aria-hidden="true">
            <Icon name="edit" />
          </span>
        </label>
        <div className="topbar-actions">
          <details className="trip-menu" ref={tripMenuRef}>
            <summary>
              <Icon name="map" />
              <span>{copy.trips}</span>
              <span className="trip-menu-count">{library.trips.length}</span>
              <Icon name="chevronRight" />
            </summary>
            <div className="trip-menu-popover">
              <span className="trip-menu-heading">{copy.changeTrip}</span>
              {library.trips.map((trip) => (
                <button
                  type="button"
                  className={`trip-menu-item${
                    trip.id === activeTrip.id ? ' is-active' : ''
                  }`}
                  onClick={() => switchTrip(trip.id)}
                  key={trip.id}
                >
                  <span className="trip-menu-active-dot" />
                  <span>{trip.title || copy.unnamedTrip}</span>
                </button>
              ))}
              <div className="trip-menu-separator" />
              <button
                type="button"
                className="trip-menu-action"
                onClick={addTrip}
              >
                <Icon name="plus" />
                {copy.newTrip}
              </button>
              <button
                type="button"
                className="trip-menu-action is-danger"
                onClick={removeTrip}
                disabled={library.trips.length <= 1}
              >
                <Icon name="trash" />
                {copy.deleteTrip}
              </button>
            </div>
          </details>
          <details className="settings-menu">
            <summary
              aria-label={copy.settings}
              title={copy.settings}
            >
              <Icon name="settings" />
            </summary>
            <div className="settings-popover">
              <span className="settings-label">{copy.language}</span>
              <div className="settings-choice-row">
                <button
                  type="button"
                  className={language === 'es' ? 'is-active' : ''}
                  onClick={() => setLanguage('es')}
                >
                  {copy.spanish}
                </button>
                <button
                  type="button"
                  className={language === 'en' ? 'is-active' : ''}
                  onClick={() => setLanguage('en')}
                >
                  {copy.english}
                </button>
              </div>
              <span className="settings-label">{copy.theme}</span>
              <div className="theme-choice-row">
                {[
                  ['light', 'sun', copy.light],
                  ['dark', 'moon', copy.dark],
                  ['system', 'system', copy.system],
                ].map(([value, icon, label]) => (
                  <button
                    type="button"
                    className={theme === value ? 'is-active' : ''}
                    onClick={() => setTheme(value)}
                    aria-label={label}
                    title={label}
                    key={value}
                  >
                    <Icon name={icon} />
                  </button>
                ))}
              </div>
            </div>
          </details>
          <div className="trip-chip">
            <Icon name="calendar" />
            <span>
              {tripDateRange
                ? formatDateRange(
                    tripDateRange.startDate,
                    tripDateRange.endDate,
                    language,
                  )
                : copy.noDates}
            </span>
          </div>
        </div>
      </header>

      <section
        className="summary-row"
        id="inicio"
        aria-label="Resumen del viaje"
      >
          <div className="summary-card">
            <span className="summary-value">{tripSummary?.days ?? 0}</span>
            <span className="summary-label">{copy.days}</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-card">
            <span className="summary-value">{tripSummary?.cities ?? 0}</span>
            <span className="summary-label">{copy.baseCities}</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-card">
            <span className="summary-value">{routes}</span>
            <span className="summary-label">{copy.routes}</span>
          </div>
      </section>

      <section className="workspace">
        <section className="map-panel" aria-label={copy.map}>
          <div className="map-heading">
            <h2>{copy.map}</h2>
            <div className="map-heading-controls">
              <button
                type="button"
                className="map-step-button"
                onClick={() => navigateMap(-1)}
                disabled={currentMapStepIndex <= 0}
                aria-label={copy.previousStep}
                title={copy.previousStep}
              >
                <Icon name="chevronLeft" />
              </button>
              <button
                type="button"
                className="play-button"
                onClick={togglePlayback}
                disabled={routes === 0}
              >
                <Icon name={isPlaying ? 'pause' : 'play'} />
                {isPlaying ? copy.pause : copy.playTrip}
              </button>
              <button
                type="button"
                className="map-step-button"
                onClick={() => navigateMap(1)}
                disabled={
                  mapNavigationSteps.length === 0 ||
                  currentMapStepIndex >= mapNavigationSteps.length - 1
                }
                aria-label={copy.nextStep}
                title={copy.nextStep}
              >
                <Icon name="chevronRight" />
              </button>
            </div>
          </div>

          {activeLeg && (
            <div className="active-route-context" aria-live="polite">
              <span>
                {formatDate(activeLeg.date, language)}
              </span>
              <strong>
                {activeLeg.from.place} → {activeLeg.to.place}
              </strong>
              <small>
                {activeLeg.direction === 'return'
                  ? 'Regreso a la ciudad base'
                  : activeLeg.category === 'day-trip'
                    ? copy.dayTrip
                    : formatTransport(activeLeg.transport)
                      ? `${formatTransport(activeLeg.transport)} · ${copy.transfer}`
                      : copy.transfer}
              </small>
            </div>
          )}

          {!activeLeg && selectedPlace && (
            <div className="selected-place-context" aria-live="polite">
              <span>
                {selectedPlace.selectionLabel ||
                  (selectedPlace.category === 'day-trip'
                    ? copy.dayTrip
                    : copy.stay)}
              </span>
              <strong>{selectedPlace.place}</strong>
              <small>
                {selectedPlace.startDate
                  ? formatDateRange(
                      selectedPlace.startDate,
                      selectedPlace.endDate,
                      language,
                    )
                  : formatDate(selectedPlace.date, language)}{' '}
              </small>
            </div>
          )}

          {!activeLeg && !selectedPlace && (
            <div className="map-selection-hint">
              {copy.selectHint}
            </div>
          )}

          <div className="map-type-legend" aria-label="Tipos de elementos">
            <span>
              <i className="map-type-marker" />
              {copy.stay}
            </span>
            <span>
              <i className="map-type-route" />
              {copy.transfer}
            </span>
            <span>
              <i className="map-type-day-trip" />
              {copy.dayTrip}
            </span>
          </div>

          <div className="map-frame">
            <TripMap
              stops={resolvedStops}
              origin={resolvedOrigin}
              destination={resolvedDestination}
              language={language}
              legs={routeLegs}
              activeRoute={activeRoute}
              selectedPlaceId={selectedPlaceId}
              onSelectRoute={selectRoute}
              onSelectPlace={selectPlace}
            />
            {activeLeg && (
              <div className="map-legend">
                <span className="legend-pulse" />
                {copy.routeActive}
              </div>
            )}
          </div>

          <div className="timeline" aria-label="Etapas del viaje">
            {resolvedStops.map((stop, index) => {
              const isActive =
                index === selectedStopIndex ||
                index === activeLeg?.timelineIndex ||
                (index === resolvedStops.length - 1 &&
                  activeRoute === routes - 1)

              return (
                <button
                  type="button"
                  className={`timeline-stop${isActive ? ' is-active' : ''}`}
                  key={stop.id}
                  onClick={() => selectStop(index)}
                >
                  <span className="timeline-index">
                    {resolvedStopLabels.get(index)}
                  </span>
                  <span className="timeline-content">
                    <strong>{stop.place}</strong>
                    <span
                      className={`timeline-category timeline-category--${stop.category}`}
                    >
                      {stop.category === 'day-trip'
                        ? copy.dayTrip
                        : copy.stay}
                    </span>
                    <span className="timeline-date">
                      {formatDateRange(
                        stop.startDate,
                        stop.endDate,
                        language,
                      )}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <aside className="planner-panel">
          <div className="section-heading">
            <h2>{copy.itinerary}</h2>
            <div className="section-heading-actions">
              <span className="stop-count">
                {draftStops.length} {copy.stages}
              </span>
              <button
                type="button"
                className="tree-control-button"
                aria-label={copy.expandAll}
                title={copy.expandAll}
                onClick={() =>
                  setTreeExpansion({
                    mode: 'all',
                    version: Date.now(),
                  })
                }
              >
                <Icon name="expandAll" />
              </button>
              <button
                type="button"
                className="tree-control-button"
                aria-label={copy.collapseAll}
                title={copy.collapseAll}
                onClick={() =>
                  setTreeExpansion({
                    mode: 'none',
                    version: Date.now(),
                  })
                }
              >
                <Icon name="collapseAll" />
              </button>
            </div>
          </div>

          <div className="route-flow">
            <EndpointCard
              key={`origin-${treeExpansion?.version ?? 0}`}
              label={copy.origin}
              marker="A"
              endpoint={origin}
              treeExpansion={treeExpansion}
              copy={copy}
              language={language}
              onSelect={() => selectPlace(origin.id)}
              onUpdate={(field, value) =>
                updateEndpoint('origin', field, value)
              }
            />

            {draftStopGroups[0] && (
              <TransferConnector
                from={origin}
                to={draftStopGroups[0].base.stop}
                date={origin.date}
                transport={origin.transport}
                routeIndex={routeLegs.findIndex(
                  (leg) => leg.from.id === 'trip-origin',
                )}
                onTransportChange={(value) =>
                  updateEndpoint('origin', 'transport', value)
                }
                onSelect={() => {
                  const routeIndex = routeLegs.findIndex(
                    (leg) => leg.from.id === 'trip-origin',
                  )
                  selectRoute(routeIndex)
                  document
                    .querySelector('.map-panel')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                copy={copy}
                language={language}
              />
            )}

            {draftStopGroups.map((group, groupIndex) => {
              const previousGroup = draftStopGroups[groupIndex - 1]
              const routeIndex = routeLegs.findIndex(
                (leg) =>
                  leg.toIndex === group.base.index &&
                  leg.category !== 'day-trip',
              )

              return (
                <Fragment key={group.base.stop.id}>
                  {previousGroup && (
                    <TransferConnector
                      from={previousGroup.base.stop}
                      to={group.base.stop}
                      date={group.base.stop.startDate}
                      transport={group.base.stop.transport}
                      routeIndex={routeIndex}
                      onTransportChange={(value) =>
                        updateStop(group.base.stop.id, 'transport', value)
                      }
                      onSelect={() => {
                        selectRoute(routeIndex)
                        document
                          .querySelector('.map-panel')
                          ?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                      }}
                      copy={copy}
                      language={language}
                    />
                  )}

                  <div className="stay-group">
                    <StopCard
                      key={`${group.base.stop.id}-${treeExpansion?.version ?? 0}`}
                      stop={group.base.stop}
                      displayLabel={draftStopLabels.get(group.base.index)}
                      totalStops={draftStops.length}
                      onSelect={() => selectPlace(group.base.stop.id)}
                      onAddDayTrip={addDayTrip}
                      onUpdate={updateStop}
                      onRemove={removeStop}
                      childCount={group.children.length}
                      childSummary={group.children
                        .map(
                          ({ stop, index }) =>
                            `${draftStopLabels.get(index)} ${stop.place || copy.newDayTrip}`,
                        )
                        .join(', ')}
                      treeExpansion={treeExpansion}
                      copy={copy}
                      language={language}
                    >
                      {group.children.map(({ stop, index }) => (
                        <StopCard
                          stop={stop}
                          displayLabel={draftStopLabels.get(index)}
                          totalStops={draftStops.length}
                          basePlace={group.base.stop.place}
                          nested
                          onSelect={() => selectPlace(stop.id)}
                          onAddDayTrip={addDayTrip}
                          onUpdate={updateStop}
                          onRemove={removeStop}
                          treeExpansion={treeExpansion}
                          copy={copy}
                          language={language}
                          key={`${stop.id}-${treeExpansion?.version ?? 0}`}
                        />
                      ))}
                    </StopCard>
                  </div>
                </Fragment>
              )
            })}

            {draftStopGroups.at(-1) && (
              <TransferConnector
                from={draftStopGroups.at(-1).base.stop}
                to={destination}
                date={destination.date}
                transport={destination.transport}
                routeIndex={routeLegs.findIndex(
                  (leg) => leg.to.id === 'trip-destination',
                )}
                onTransportChange={(value) =>
                  updateEndpoint('destination', 'transport', value)
                }
                onSelect={() => {
                  const routeIndex = routeLegs.findIndex(
                    (leg) => leg.to.id === 'trip-destination',
                  )
                  selectRoute(routeIndex)
                  document
                    .querySelector('.map-panel')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                copy={copy}
                language={language}
              />
            )}

            <EndpointCard
              key={`destination-${treeExpansion?.version ?? 0}`}
              label={copy.destination}
              marker="B"
              endpoint={destination}
              treeExpansion={treeExpansion}
              copy={copy}
              language={language}
              onSelect={() => selectPlace(destination.id)}
              onUpdate={(field, value) =>
                updateEndpoint('destination', field, value)
              }
            />
          </div>

          <div className="planner-actions">
            <button type="button" className="add-button" onClick={addStop}>
              <Icon name="plus" />
              {copy.addStay}
            </button>
          </div>

          {status.message && (
            <p className={`status-message status-message--${status.type}`}>
              {status.message}
            </p>
          )}
        </aside>

        <TripCalendar
          stops={draftStops}
          legs={draftRouteLegs}
          tripTitle={activeTrip.title}
          language={language}
          activeStopIndex={activeStopIndex}
          activeRoute={draftRouteLegs.findIndex(
            (leg) => leg.id === activeLeg?.id,
          )}
          onSelectRoute={(index) => {
            const resolvedIndex = routeLegs.findIndex(
              (leg) => leg.id === draftRouteLegs[index]?.id,
            )
            if (resolvedIndex >= 0) selectRoute(resolvedIndex)
            document
              .querySelector('.map-panel')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          onSelectStop={(index) => {
            selectStop(index)
            document
              .querySelector('.map-panel')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      </section>
    </main>
  )
}

export default App
