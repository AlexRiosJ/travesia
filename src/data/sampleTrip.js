const KNOWN_LOCATIONS = {
  'Seattle, WA': { lat: 47.6062, lng: -122.3321 },
  Seattle: { lat: 47.6062, lng: -122.3321 },
  'Guadalajara, México': { lat: 20.6597, lng: -103.3496 },
  'Tequila, Jalisco': { lat: 20.8853, lng: -103.8357 },
  'Ciudad de México': { lat: 19.4326, lng: -99.1332 },
  'Monterrey, México': { lat: 25.6866, lng: -100.3161 },
  Tokyo: { lat: 35.6762, lng: 139.6503 },
  Hiroshima: { lat: 34.3853, lng: 132.4553 },
  Miyajima: { lat: 34.2959, lng: 132.3198 },
  Osaka: { lat: 34.6937, lng: 135.5023 },
  Himeji: { lat: 34.8151, lng: 134.6853 },
  Kyoto: { lat: 35.0116, lng: 135.7681 },
  Nara: { lat: 34.6851, lng: 135.8048 },
  Uji: { lat: 34.8845, lng: 135.7997 },
  Fuji: { lat: 35.3606, lng: 138.7274 },
  Kamakura: { lat: 35.3192, lng: 139.5467 },
  Roma: { lat: 41.9028, lng: 12.4964 },
  Rome: { lat: 41.9028, lng: 12.4964 },
  Vaticano: { lat: 41.9029, lng: 12.4534 },
  'Museos Vaticanos': { lat: 41.9065, lng: 12.4536 },
  París: { lat: 48.8566, lng: 2.3522 },
  Paris: { lat: 48.8566, lng: 2.3522 },
  'Torre Eiffel': { lat: 48.8584, lng: 2.2945 },
}

export const SAMPLE_STOPS = [
  {
    id: 'guadalajara-arrival',
    place: 'Guadalajara, México',
    startDate: '2027-03-13',
    endDate: '2027-03-15',
    category: 'stay',
    transport: '',
    dailyPlans: {},
  },
  {
    id: 'tequila-day-trip',
    place: 'Tequila, Jalisco',
    startDate: '2027-03-14',
    endDate: '2027-03-14',
    category: 'day-trip',
    transport: '',
    dailyPlans: {},
  },
  {
    id: 'mexico-city',
    place: 'Ciudad de México',
    startDate: '2027-03-16',
    endDate: '2027-03-18',
    category: 'stay',
    transport: '',
    dailyPlans: {},
  },
  {
    id: 'monterrey',
    place: 'Monterrey, México',
    startDate: '2027-03-18',
    endDate: '2027-03-18',
    category: 'stay',
    transport: '',
    dailyPlans: {},
  },
  {
    id: 'guadalajara-return',
    place: 'Guadalajara, México',
    startDate: '2027-03-19',
    endDate: '2027-03-19',
    category: 'stay',
    transport: '',
    dailyPlans: {},
  },
]

export function resolveSampleStops() {
  return SAMPLE_STOPS.map((stop) => ({
    ...stop,
    ...findKnownLocation(stop.place),
  }))
}

export function findKnownLocation(place) {
  const normalizedPlace = place.trim().toLocaleLowerCase('es')
  const entry = Object.entries(KNOWN_LOCATIONS).find(
    ([knownPlace]) =>
      knownPlace.trim().toLocaleLowerCase('es') === normalizedPlace,
  )

  if (!entry) return null

  return {
    ...entry[1],
    displayName: entry[0],
  }
}

export function createEmptyStop(previousStop) {
  const fallbackDate = previousStop?.endDate || '2027-03-20'

  return {
    id: crypto.randomUUID(),
    place: '',
    startDate: fallbackDate,
    endDate: fallbackDate,
    category: 'stay',
    transport: '',
    dailyPlans: {},
  }
}
