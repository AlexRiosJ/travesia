const DEFAULT_PLACE_SEARCH_URL = 'https://photon.komoot.io/api/'
const PLACE_SEARCH_LIMIT = 8
const placeSearchCache = new Map()
const PLACE_TYPE_PRIORITY = {
  city: 0,
  town: 1,
  village: 2,
  locality: 3,
  district: 4,
  county: 5,
  state: 6,
  country: 7,
}

function normalizeText(value) {
  return String(value || '').trim().toLocaleLowerCase()
}

function uniqueParts(parts) {
  const seen = new Set()

  return parts.filter((part) => {
    const normalizedPart = normalizeText(part)
    if (!normalizedPart || seen.has(normalizedPart)) return false
    seen.add(normalizedPart)
    return true
  })
}

function getPlaceType(properties) {
  return properties.type || properties.osm_value || 'other'
}

function getPlaceTypePriority(placeType) {
  return PLACE_TYPE_PRIORITY[placeType] ?? 100
}

function normalizePhotonFeature(feature) {
  const properties = feature?.properties ?? {}
  const [lng, lat] = feature?.geometry?.coordinates ?? []
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const streetAddress = [properties.street, properties.housenumber]
    .filter(Boolean)
    .join(' ')
  const name = properties.name || streetAddress
  if (!name) return null

  const displayParts = uniqueParts([
    name,
    properties.name ? streetAddress : '',
    properties.district,
    properties.locality,
    properties.city,
    properties.county,
    properties.state,
    properties.country,
  ])
  const [primary, ...contextParts] = displayParts
  const displayName = displayParts.join(', ')
  const placeType = getPlaceType(properties)

  return {
    id:
      properties.osm_type && properties.osm_id
        ? `${properties.osm_type}:${properties.osm_id}`
        : `${displayName}:${lat}:${lng}`,
    name: primary,
    context: contextParts.join(', '),
    displayName,
    displayNameKey: normalizeText(displayName),
    placeType,
    lat,
    lng,
  }
}

export function normalizePhotonFeatures(features = []) {
  const matches = new Map()

  features.forEach((feature) => {
    const result = normalizePhotonFeature(feature)
    if (!result) return

    const current = matches.get(result.displayNameKey)
    if (
      !current ||
      getPlaceTypePriority(result.placeType) <
        getPlaceTypePriority(current.placeType)
    ) {
      matches.set(result.displayNameKey, result)
    }
  })

  return Array.from(matches.values())
    .slice(0, 6)
    .map(({ displayNameKey: _displayNameKey, ...result }) => result)
}

export async function searchPlaces(query, language, signal) {
  const trimmedQuery = query.trim()
  const cacheKey = `${language}:${normalizeText(trimmedQuery)}`
  const cachedResults = placeSearchCache.get(cacheKey)
  if (cachedResults) return cachedResults

  const searchUrl = new URL(
    import.meta.env?.VITE_PLACE_SEARCH_URL || DEFAULT_PLACE_SEARCH_URL,
  )
  searchUrl.search = new URLSearchParams({
    q: trimmedQuery,
    limit: String(PLACE_SEARCH_LIMIT),
    lang: language === 'es' ? 'es' : 'en',
  })

  const response = await fetch(searchUrl, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw new Error(`Place search failed with status ${response.status}.`)
  }

  const payload = await response.json()
  const results = normalizePhotonFeatures(payload.features)
  placeSearchCache.set(cacheKey, results)
  return results
}
