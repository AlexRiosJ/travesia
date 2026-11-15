import {
  SAMPLE_STOPS,
  findKnownLocation,
  resolveSampleStops,
} from './sampleTrip'

export const TRIP_LIBRARY_STORAGE_KEY = 'rumbo-trip-library-v1'
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

function normalizeTransport(transport) {
  if (transport === 'unspecified' || transport === 'Por definir') return ''
  return LEGACY_TRANSPORT_LABELS[transport] || transport || ''
}

function createMexicoTrip() {
  const seattle = findKnownLocation('Seattle, WA')

  return {
    id: 'mexico-2027',
    title: 'México 2027',
    draftStops: SAMPLE_STOPS,
    resolvedStops: resolveSampleStops(),
    origin: {
      id: 'trip-origin',
      place: 'Seattle, WA',
      date: '2027-03-13',
      transport: '',
    },
    destination: {
      id: 'trip-destination',
      place: 'Seattle, WA',
      date: '2027-03-20',
      transport: '',
    },
    resolvedOrigin: {
      id: 'trip-origin',
      place: 'Seattle, WA',
      date: '2027-03-13',
      transport: '',
      ...seattle,
    },
    resolvedDestination: {
      id: 'trip-destination',
      place: 'Seattle, WA',
      date: '2027-03-20',
      transport: '',
      ...seattle,
    },
    transportDefaultsMigrated: true,
    updatedAt: new Date().toISOString(),
  }
}

function normalizeStops(stops = []) {
  return stops.map(({ period: _period, ...stop }) => ({
    ...stop,
    category:
      stop.category === 'day-trip' || stop.category === 'activity'
        ? 'day-trip'
        : 'stay',
    transport: normalizeTransport(stop.transport),
  }))
}

function createEndpoint(id, date, endpoint = {}) {
  const { period: _period, ...endpointFields } = endpoint

  return {
    id,
    place: endpointFields.place || '',
    date: endpointFields.date || date,
    transport: normalizeTransport(endpointFields.transport),
    ...(endpointFields.lat != null && endpointFields.lng != null
      ? {
          lat: endpointFields.lat,
          lng: endpointFields.lng,
          displayName:
            endpointFields.displayName || endpointFields.place,
        }
      : {}),
  }
}

function normalizeTrip(trip) {
  let draftStops = normalizeStops(trip.draftStops)
  let resolvedStops = normalizeStops(trip.resolvedStops)
  const firstDraft = draftStops[0]
  const lastDraft = draftStops.at(-1)
  const firstResolved = resolvedStops.find(
    (stop) => stop.id === firstDraft?.id,
  )
  const lastResolved = resolvedStops.find(
    (stop) => stop.id === lastDraft?.id,
  )
  const looksLikeRoundTripEndpoints =
    !trip.origin &&
    !trip.destination &&
    draftStops.length >= 3 &&
    firstDraft?.place.trim().toLocaleLowerCase('es') ===
      lastDraft?.place.trim().toLocaleLowerCase('es') &&
    firstDraft.startDate === firstDraft.endDate &&
    lastDraft.startDate === lastDraft.endDate
  const shouldExtractDefaultEndpoints =
    (firstDraft?.id === 'seattle-departure' &&
      lastDraft?.id === 'seattle-return') ||
    looksLikeRoundTripEndpoints

  if (shouldExtractDefaultEndpoints) {
    draftStops = draftStops.slice(1, -1)
    resolvedStops = resolvedStops.filter(
      (stop) =>
        stop.id !== firstDraft.id && stop.id !== lastDraft.id,
    )
  }

  const firstDate = draftStops[0]?.startDate || new Date().toISOString().slice(0, 10)
  const lastDate = draftStops.at(-1)?.endDate || firstDate
  const originSource =
    trip.origin ||
    (shouldExtractDefaultEndpoints
      ? {
          place: firstDraft.place,
          date: firstDraft.startDate,
          transport: firstDraft.transport,
        }
      : {})
  const destinationSource =
    trip.destination ||
    (shouldExtractDefaultEndpoints
      ? {
          place: lastDraft.place,
          date: lastDraft.endDate,
          transport: lastDraft.transport,
        }
      : {})
  const clearExampleTransports =
    trip.id === 'mexico-2027' && !trip.transportDefaultsMigrated
  const normalizedOriginSource = {
    ...originSource,
    ...(clearExampleTransports ? { transport: '' } : {}),
  }
  const normalizedDestinationSource = {
    ...destinationSource,
    ...(clearExampleTransports ? { transport: '' } : {}),
  }

  if (clearExampleTransports) {
    draftStops = draftStops.map((stop) => ({ ...stop, transport: '' }))
    resolvedStops = resolvedStops.map((stop) => ({ ...stop, transport: '' }))
  }

  return {
    ...trip,
    draftStops,
    resolvedStops,
    origin: createEndpoint('trip-origin', firstDate, normalizedOriginSource),
    destination: createEndpoint(
      'trip-destination',
      lastDate,
      normalizedDestinationSource,
    ),
    resolvedOrigin:
      trip.resolvedOrigin || (shouldExtractDefaultEndpoints && firstResolved)
      ? createEndpoint(
          'trip-origin',
          firstDate,
          trip.resolvedOrigin
            ? {
                ...trip.resolvedOrigin,
                ...(clearExampleTransports ? { transport: '' } : {}),
              }
            : {
                ...normalizedOriginSource,
                lat: firstResolved?.lat,
                lng: firstResolved?.lng,
                displayName: firstResolved?.displayName,
              },
        )
      : null,
    resolvedDestination:
      trip.resolvedDestination ||
      (shouldExtractDefaultEndpoints && lastResolved)
      ? createEndpoint(
          'trip-destination',
          lastDate,
          trip.resolvedDestination
            ? {
                ...trip.resolvedDestination,
                ...(clearExampleTransports ? { transport: '' } : {}),
              }
            : {
                ...normalizedDestinationSource,
                lat: lastResolved?.lat,
                lng: lastResolved?.lng,
                displayName: lastResolved?.displayName,
              },
        )
      : null,
    transportDefaultsMigrated: true,
  }
}

export function createBlankTrip() {
  const date = new Date().toISOString().slice(0, 10)

  return {
    id: crypto.randomUUID(),
    title: 'Nuevo viaje',
    draftStops: [
      {
        id: crypto.randomUUID(),
        place: '',
        startDate: date,
        endDate: date,
        category: 'stay',
        transport: '',
      },
    ],
    resolvedStops: [],
    origin: createEndpoint('trip-origin', date),
    destination: createEndpoint('trip-destination', date),
    resolvedOrigin: null,
    resolvedDestination: null,
    updatedAt: new Date().toISOString(),
  }
}

export function loadTripLibrary() {
  const initialTrip = createMexicoTrip()
  const fallback = {
    trips: [initialTrip],
    activeTripId: initialTrip.id,
    loadError: null,
  }

  try {
    const storedValue = localStorage.getItem(TRIP_LIBRARY_STORAGE_KEY)
    if (!storedValue) return fallback

    const stored = JSON.parse(storedValue)
    if (!Array.isArray(stored.trips) || stored.trips.length === 0) {
      throw new Error('La biblioteca guardada no contiene viajes.')
    }

    const trips = stored.trips.map(normalizeTrip)
    const activeTripId = trips.some((trip) => trip.id === stored.activeTripId)
      ? stored.activeTripId
      : trips[0].id

    return { trips, activeTripId, loadError: null }
  } catch (error) {
    console.error('No se pudo cargar la biblioteca de viajes.', error)
    return {
      ...fallback,
      loadError:
        'No pudimos leer los viajes guardados. Se abrió el ejemplo de México.',
    }
  }
}
