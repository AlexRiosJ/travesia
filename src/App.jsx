import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  ConfigProvider,
  Dropdown,
  Input,
  Segmented,
  Statistic,
  Tag,
  theme as antdTheme,
} from 'antd'
import enUS from 'antd/locale/en_US'
import esES from 'antd/locale/es_ES'
import {
  CalendarOutlined,
  ArrowDownOutlined,
  CompassOutlined,
  DeleteOutlined,
  DesktopOutlined,
  DownOutlined,
  EditOutlined,
  EnvironmentOutlined,
  ExpandOutlined,
  LeftOutlined,
  MoonOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined,
  ShrinkOutlined,
  SunOutlined,
} from '@ant-design/icons'
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
import { getStayDateKeys } from './utils/stayDays'
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
  if (!card?.classList.contains('ant-collapse-item-active')) return

  const restoreFocus = card.contains(document.activeElement)
  const header = card.querySelector(':scope > .ant-collapse-header')
  header?.click()
  if (restoreFocus) header?.focus()
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
  onUpdateDailyPlan,
  childCount = 0,
  childSummary = '',
  treeExpansion,
  copy,
  language,
  children,
}) {
  const isExcursion = stop.category === 'day-trip'
  const stayDates = isExcursion
    ? []
    : getStayDateKeys(stop.startDate, stop.endDate)
  const [isOpen, setIsOpen] = useState(
    treeExpansion ? treeExpansion.mode === 'all' : !stop.place,
  )

  return (
    <Collapse
      className="itinerary-collapse"
      activeKey={isOpen ? ['card'] : []}
      expandIcon={({ isActive }) => (
        <RightOutlined
          className={`stop-node-chevron${isActive ? ' is-open' : ''}`}
          aria-hidden="true"
        />
      )}
      expandIconPlacement="end"
      onChange={(keys) =>
        setIsOpen(Array.isArray(keys) ? keys.includes('card') : keys === 'card')
      }
      onFocusCapture={onSelect}
      items={[
        {
          key: 'card',
          className: `stop-node${nested ? ' is-nested' : ''}`,
          label: (
            <>
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
            </>
          ),
          children: (
            <div className="stop-node-body">
              <div className="place-fields">
                <label>
                  <span>{copy.cityOrPlace}</span>
                  <Input
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
                  <Input
                    type="date"
                    value={stop.startDate}
                    onChange={(event) =>
                      onUpdate(stop.id, 'startDate', event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>{copy.departure}</span>
                  <Input
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
              {stayDates.length > 0 && (
                <section
                  className="daily-plans"
                  aria-label={copy.dailyPlans}
                >
                  <div className="daily-plans-heading">
                    <strong>{copy.dailyPlans}</strong>
                    <small>{copy.dailyPlansHint}</small>
                  </div>
                  <div className="daily-plan-list">
                    {stayDates.map((date) => {
                      const formattedDate = formatDate(date, language, {
                        weekday: 'short',
                      })

                      return (
                        <label className="daily-plan-row" key={date}>
                          <span>{formattedDate}</span>
                          <Input.TextArea
                            className="daily-plan-input"
                            value={stop.dailyPlans?.[date] ?? ''}
                            placeholder={copy.dailyPlanPlaceholder}
                            aria-label={`${copy.dailyPlanFor} ${formattedDate}`}
                            autoSize={{ minRows: 2, maxRows: 5 }}
                            onChange={(event) =>
                              onUpdateDailyPlan(
                                stop.id,
                                date,
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      )
                    })}
                  </div>
                </section>
              )}
              {children && <div className="stop-children">{children}</div>}
              <div className="stop-node-actions">
                {!nested && (
                  <Button
                    htmlType="button"
                    type="text"
                    className="add-day-trip-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onAddDayTrip(stop.id)
                    }}
                  >
                    <PlusOutlined aria-hidden="true" />
                    {copy.addDayTrip}
                  </Button>
                )}
                <Button
                  htmlType="button"
                  type="text"
                  className="icon-button remove-button"
                  onClick={() => onRemove(stop.id)}
                  disabled={totalStops <= 1}
                  aria-label={`${copy.delete} ${stop.place || `${copy.stop} ${displayLabel}`}`}
                  title={copy.delete}
                  icon={<DeleteOutlined aria-hidden="true" />}
                />
              </div>
            </div>
          ),
        },
      ]}
    />
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
    <Collapse
      className="itinerary-collapse"
      activeKey={isOpen ? ['card'] : []}
      expandIcon={({ isActive }) => (
        <RightOutlined
          className={`stop-node-chevron${isActive ? ' is-open' : ''}`}
          aria-hidden="true"
        />
      )}
      expandIconPlacement="end"
      onChange={(keys) =>
        setIsOpen(Array.isArray(keys) ? keys.includes('card') : keys === 'card')
      }
      onFocusCapture={onSelect}
      items={[
        {
          key: 'card',
          className: 'endpoint-node',
          label: (
            <>
              <span className="endpoint-marker">{marker}</span>
              <span className="endpoint-node-summary">
                <strong>{label}</strong>
                <small>
                  {endpoint.place || copy.unconfigured} ·{' '}
                  {formatDate(endpoint.date, language)}
                </small>
              </span>
            </>
          ),
          children: (
            <div className="endpoint-node-body">
              <label>
                <span>{copy.city}</span>
                <Input
                  value={endpoint.place}
                  placeholder={copy.cityPlaceholder}
                  onChange={(event) => onUpdate('place', event.target.value)}
                />
              </label>
              <label className="endpoint-date-field">
                <span>{copy.date}</span>
                <Input
                  type="date"
                  value={endpoint.date}
                  onChange={(event) => onUpdate('date', event.target.value)}
                />
              </label>
            </div>
          ),
        },
      ]}
    />
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
      <Button
        htmlType="button"
        type="text"
        className="transfer-line-button"
        onClick={onSelect}
        disabled={routeIndex < 0}
        aria-label={`${copy.viewTransfer} ${from.place} ${copy.to} ${to.place}`}
        icon={<ArrowDownOutlined aria-hidden="true" />}
      >
        <span className="transfer-date">{formatDate(date, language)}</span>
      </Button>
      <label>
        <span>{copy.transport}</span>
        <Input
          value={LEGACY_TRANSPORT_LABELS[transport] || transport || ''}
          placeholder={copy.transportPlaceholder}
          onChange={(event) => onTransportChange(event.target.value)}
          aria-label={copy.transport}
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
    () => {
      const savedLanguage = localStorage.getItem('rumbo-language')
      if (savedLanguage === 'en' || savedLanguage === 'es') return savedLanguage
      return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
    },
  )
  const [theme, setTheme] = useState(
    () => localStorage.getItem('rumbo-theme') || 'system',
  )
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const [tripMenuOpen, setTripMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [status, setStatus] = useState(() =>
    library.loadError
      ? { type: 'error', message: library.loadError }
      : { type: 'idle', message: '' },
  )
  const geocodeCache = useRef(new Map())
  const routeGenerationController = useRef(null)
  const generateRouteRef = useRef(null)
  const settingsPanelRef = useRef(null)
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
  const routeInputSignature = useMemo(
    () =>
      JSON.stringify(
        draftStops.map(
          ({ dailyPlans: _dailyPlans, ...routeStopFields }) => routeStopFields,
        ),
      ),
    [draftStops],
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
    if (!settingsOpen) return undefined

    const frame = window.requestAnimationFrame(() => {
      settingsPanelRef.current
        ?.querySelector('input[type="radio"]')
        ?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [settingsOpen])

  useEffect(() => {
    function restoreMenuFocus(event) {
      if (event.key !== 'Escape') return

      if (settingsOpen) {
        const focusTarget = document.activeElement
        const focusInsideSettings = settingsPanelRef.current?.contains(
          focusTarget,
        )
        setSettingsOpen(false)
        if (focusInsideSettings) {
          document.querySelector('.settings-trigger')?.focus()
        } else if (focusTarget !== document.body) {
          window.requestAnimationFrame(() => {
            if (focusTarget.isConnected) focusTarget.focus()
          })
        }
      }
      if (tripMenuOpen) {
        const focusTarget = document.activeElement
        const focusInsideTripMenu = focusTarget.closest('.ant-dropdown-menu')
        setTripMenuOpen(false)
        if (focusInsideTripMenu) {
          document.querySelector('.trip-menu-trigger')?.focus()
        } else if (focusTarget !== document.body) {
          window.requestAnimationFrame(() => {
            if (focusTarget.isConnected) focusTarget.focus()
          })
        }
      }
    }

    document.addEventListener('keydown', restoreMenuFocus, true)
    return () => document.removeEventListener('keydown', restoreMenuFocus, true)
  }, [settingsOpen, tripMenuOpen])

  useEffect(() => {
    function handleOutsideInteraction(event) {
      if (event.type !== 'click') return

      document
        .querySelectorAll('.itinerary-collapse .ant-collapse-item-active')
        .forEach((card) => {
          if (!card.contains(event.target)) dismissCard(card)
        })
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        document
          .querySelectorAll('.itinerary-collapse .ant-collapse-item-active')
          .forEach(dismissCard)
      }
    }

    document.addEventListener('click', handleOutsideInteraction, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
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

  function updateDailyPlan(id, date, value) {
    setDraftStops((current) =>
      current.map((stop) => {
        if (stop.id !== id) return stop

        const dailyPlans = { ...(stop.dailyPlans ?? {}) }
        if (value) {
          dailyPlans[date] = value
        } else {
          delete dailyPlans[date]
        }

        return { ...stop, dailyPlans }
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
        dailyPlans: {},
      }

      return [
        ...current.slice(0, insertIndex),
        dayTrip,
        ...current.slice(insertIndex),
      ]
    })
  }

  function closeTripMenu() {
    setTripMenuOpen(false)
    window.requestAnimationFrame(() =>
      document.querySelector('.trip-menu-trigger')?.focus(),
    )
  }

  function switchTrip(tripId) {
    closeTripMenu()
    setLibrary((current) => ({ ...current, activeTripId: tripId }))
    setActiveRoute(-1)
    setSelectedPlaceId(null)
    setMapStepCursor(-1)
    setIsPlaying(false)
    setStatus({ type: 'idle', message: '' })
  }

  function addTrip() {
    closeTripMenu()
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
    closeTripMenu()

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
  }, [destination, origin, routeInputSignature])

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
    <ConfigProvider
      locale={language === 'en' ? enUS : esES}
      theme={{
        algorithm:
          resolvedTheme === 'dark'
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: resolvedTheme === 'dark' ? '#55a99e' : '#24756c',
          borderRadius: 6,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }}
    >
      <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Travesía, inicio">
          <span className="brand-mark">
            <CompassOutlined aria-hidden="true" />
          </span>
          <span>Travesía</span>
        </a>
        <label className="topbar-trip-title">
          <span className="visually-hidden">{copy.tripName}</span>
          <Input
            className="topbar-title-input"
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
            <EditOutlined />
          </span>
        </label>
        <div className="topbar-actions">
          <Dropdown
            className={`trip-menu${tripMenuOpen ? ' is-open' : ''}`}
            classNames={{ menu: 'trip-menu-overlay' }}
            trigger={['click']}
            placement="bottomRight"
            autoFocus
            open={tripMenuOpen}
            onOpenChange={setTripMenuOpen}
            menu={{
              selectedKeys: [`trip:${activeTrip.id}`],
              items: [
                {
                  key: 'trip-heading',
                  type: 'group',
                  label: copy.changeTrip,
                  children: library.trips.map((trip) => ({
                    key: `trip:${trip.id}`,
                    label: trip.title || copy.unnamedTrip,
                    icon: <span className="trip-menu-active-dot" />,
                  })),
                },
                { type: 'divider' },
                {
                  key: 'add-trip',
                  label: copy.newTrip,
                  icon: <PlusOutlined aria-hidden="true" />,
                },
                {
                  key: 'delete-trip',
                  label: copy.deleteTrip,
                  icon: <DeleteOutlined aria-hidden="true" />,
                  danger: true,
                  disabled: library.trips.length <= 1,
                },
              ],
              onClick: ({ key }) => {
                if (key.startsWith('trip:')) {
                  switchTrip(key.slice('trip:'.length))
                } else if (key === 'add-trip') {
                  addTrip()
                } else if (key === 'delete-trip') {
                  removeTrip()
                }
              },
            }}
          >
            <Button
              className="trip-menu-trigger"
              icon={<EnvironmentOutlined aria-hidden="true" />}
              aria-label={copy.trips}
              aria-expanded={tripMenuOpen}
              aria-haspopup="menu"
            >
              <span>{copy.trips}</span>
              <span className="trip-menu-count">{library.trips.length}</span>
              <DownOutlined aria-hidden="true" />
            </Button>
          </Dropdown>
          <Dropdown
            className={`settings-menu${settingsOpen ? ' is-open' : ''}`}
            trigger={['click']}
            placement="bottomRight"
            autoFocus
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            popupRender={() => (
              <div className="settings-popover" ref={settingsPanelRef}>
              <span className="settings-label">{copy.language}</span>
                <Segmented
                  className="settings-segmented"
                  aria-label={copy.language}
                  value={language}
                  options={[
                    { label: copy.spanish, value: 'es' },
                    { label: copy.english, value: 'en' },
                  ]}
                  onChange={setLanguage}
                />
              <span className="settings-label">{copy.theme}</span>
                <Segmented
                  className="settings-segmented theme-choice-row"
                  aria-label={copy.theme}
                  value={theme}
                  options={[
                    { label: <><SunOutlined aria-hidden="true" /> {copy.light}</>, value: 'light' },
                    { label: <><MoonOutlined aria-hidden="true" /> {copy.dark}</>, value: 'dark' },
                    { label: <><DesktopOutlined aria-hidden="true" /> {copy.system}</>, value: 'system' },
                  ]}
                  onChange={setTheme}
                />
              </div>
            )}
          >
            <Button
              className="settings-trigger"
              aria-label={copy.settings}
              title={copy.settings}
              aria-expanded={settingsOpen}
              icon={<SettingOutlined aria-hidden="true" />}
            />
          </Dropdown>
          <Tag className="trip-chip" icon={<CalendarOutlined aria-hidden="true" />}>
              {tripDateRange
                ? formatDateRange(
                    tripDateRange.startDate,
                    tripDateRange.endDate,
                    language,
                  )
                : copy.noDates}
          </Tag>
        </div>
      </header>

      <section
        className="summary-row"
        id="inicio"
        aria-label="Resumen del viaje"
      >
          <Card className="summary-card" size="small">
            <Statistic value={tripSummary?.days ?? 0} title={copy.days} />
          </Card>
          <div className="summary-divider" />
          <Card className="summary-card" size="small">
            <Statistic value={tripSummary?.cities ?? 0} title={copy.baseCities} />
          </Card>
          <div className="summary-divider" />
          <Card className="summary-card" size="small">
            <Statistic value={routes} title={copy.routes} />
          </Card>
      </section>

      <section className="workspace">
        <Card className="map-panel" role="region" aria-label={copy.map}
          variant="borderless" styles={{ body: { padding: 0 } }}>
          <div className="map-heading">
            <h2>{copy.map}</h2>
            <div className="map-heading-controls">
              <Button
                htmlType="button"
                type="default"
                className="map-step-button"
                onClick={() => navigateMap(-1)}
                disabled={currentMapStepIndex <= 0}
                aria-label={copy.previousStep}
                title={copy.previousStep}
                icon={<LeftOutlined aria-hidden="true" />}
              />
              <Button
                htmlType="button"
                type="primary"
                className="play-button"
                onClick={togglePlayback}
                disabled={routes === 0}
                icon={
                  isPlaying
                    ? <PauseOutlined aria-hidden="true" />
                    : <PlayCircleOutlined aria-hidden="true" />
                }
              >
                {isPlaying ? copy.pause : copy.playTrip}
              </Button>
              <Button
                htmlType="button"
                type="default"
                className="map-step-button"
                onClick={() => navigateMap(1)}
                disabled={
                  mapNavigationSteps.length === 0 ||
                  currentMapStepIndex >= mapNavigationSteps.length - 1
                }
                aria-label={copy.nextStep}
                title={copy.nextStep}
                icon={<RightOutlined aria-hidden="true" />}
              />
            </div>
          </div>

          {activeLeg && (
            <Card className="active-route-context" size="small" aria-live="polite">
              <span>
                {formatDate(activeLeg.date, language)}
              </span>
              <strong>
                {activeLeg.from.place} → {activeLeg.to.place}
              </strong>
              <small>
                {activeLeg.direction === 'return'
                  ? copy.returnToBase
                  : activeLeg.category === 'day-trip'
                    ? copy.dayTrip
                    : formatTransport(activeLeg.transport)
                      ? `${formatTransport(activeLeg.transport)} · ${copy.transfer}`
                      : copy.transfer}
              </small>
            </Card>
          )}

          {!activeLeg && selectedPlace && (
            <Card className="selected-place-context" size="small" aria-live="polite">
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
            </Card>
          )}

          {!activeLeg && !selectedPlace && (
            <Alert className="map-selection-hint" type="info" title={copy.selectHint} showIcon />
          )}

          <div className="map-type-legend" aria-label={copy.mapLegend}>
            <Tag icon={<span className="map-type-marker" aria-hidden="true" />}>
              {copy.stay}
            </Tag>
            <Tag icon={<span className="map-type-route" aria-hidden="true" />}>
              {copy.transfer}
            </Tag>
            <Tag icon={<span className="map-type-day-trip" aria-hidden="true" />}>
              {copy.dayTrip}
            </Tag>
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
              <Tag className="map-legend">
                <Badge status="processing" text={copy.routeActive} />
              </Tag>
            )}
          </div>

          <div className="timeline" aria-label={copy.tripStages}>
            {resolvedStops.map((stop, index) => {
              const isActive =
                index === selectedStopIndex ||
                index === activeLeg?.timelineIndex ||
                (index === resolvedStops.length - 1 &&
                  activeRoute === routes - 1)

              return (
                <Button
                  htmlType="button"
                  type="text"
                  className={`timeline-stop${isActive ? ' is-active' : ''}`}
                  key={stop.id}
                  onClick={() => selectStop(index)}
                  block
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
                </Button>
              )
            })}
          </div>
        </Card>

        <aside className="planner-panel">
          <div className="section-heading">
            <h2>{copy.itinerary}</h2>
            <div className="section-heading-actions">
              <span className="stop-count">
                {draftStops.length} {copy.stages}
              </span>
              <Button
                htmlType="button"
                type="default"
                className="tree-control-button"
                aria-label={copy.expandAll}
                title={copy.expandAll}
                onClick={() =>
                  setTreeExpansion({
                    mode: 'all',
                    version: Date.now(),
                  })
                }
                icon={<ExpandOutlined aria-hidden="true" />}
              />
              <Button
                htmlType="button"
                type="default"
                className="tree-control-button"
                aria-label={copy.collapseAll}
                title={copy.collapseAll}
                onClick={() =>
                  setTreeExpansion({
                    mode: 'none',
                    version: Date.now(),
                  })
                }
                icon={<ShrinkOutlined aria-hidden="true" />}
              />
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
                      onUpdateDailyPlan={updateDailyPlan}
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
                          onUpdateDailyPlan={updateDailyPlan}
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
            <Button
              htmlType="button"
              type="dashed"
              className="add-button"
              onClick={addStop}
              icon={<PlusOutlined aria-hidden="true" />}
            >
              {copy.addStay}
            </Button>
          </div>

          {status.message && (
            <Alert
              className={`status-message status-message--${status.type}`}
              title={status.message}
              type={status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : 'info'}
              showIcon
              role={status.type === 'loading' ? 'status' : 'alert'}
            />
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
    </ConfigProvider>
  )
}

export default App
