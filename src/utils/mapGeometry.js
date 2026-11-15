function longitudeNear(longitude, reference) {
  return longitude + 360 * Math.round((reference - longitude) / 360)
}

function getLongitudeReference(places) {
  if (!places.length) return 0

  const longitudes = places
    .map(({ lng }) => ((lng % 360) + 360) % 360)
    .sort((a, b) => a - b)
  let largestGap = -1
  let intervalStart = longitudes[0]

  longitudes.forEach((longitude, index) => {
    const next =
      longitudes[(index + 1) % longitudes.length] +
      (index === longitudes.length - 1 ? 360 : 0)
    if (next - longitude > largestGap) {
      largestGap = next - longitude
      intervalStart = next
    }
  })

  // Put the map's longitude seam in the largest empty gap between places.
  const center = intervalStart + (360 - largestGap) / 2
  return longitudeNear(center, places[0].lng)
}

function createGeodesic(from, to, segmentCount = 64) {
  const toVector = ({ lat, lng }) => {
    const latitude = (lat * Math.PI) / 180
    const longitude = (lng * Math.PI) / 180

    return [
      Math.cos(latitude) * Math.cos(longitude),
      Math.cos(latitude) * Math.sin(longitude),
      Math.sin(latitude),
    ]
  }

  const start = toVector(from)
  const end = toVector(to)
  const dot = Math.min(
    1,
    Math.max(-1, start.reduce((sum, value, index) => sum + value * end[index], 0)),
  )
  const angle = Math.acos(dot)
  const angleSine = Math.sin(angle)
  const points = []
  let previousLongitude = from.lng

  for (let index = 0; index <= segmentCount; index += 1) {
    const progress = index / segmentCount
    const startWeight =
      angleSine === 0 ? 1 - progress : Math.sin((1 - progress) * angle) / angleSine
    const endWeight =
      angleSine === 0 ? progress : Math.sin(progress * angle) / angleSine
    const x = startWeight * start[0] + endWeight * end[0]
    const y = startWeight * start[1] + endWeight * end[1]
    const z = startWeight * start[2] + endWeight * end[2]
    const latitude = (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI
    const longitude = longitudeNear(
      (Math.atan2(y, x) * 180) / Math.PI,
      previousLongitude,
    )

    points.push([latitude, longitude])
    previousLongitude = longitude
  }

  return points
}

export function buildMapGeometry(places, legs) {
  const reference = getLongitudeReference(places)
  const projectPlace = (place) => ({
    ...place,
    lng: longitudeNear(place.lng, reference),
  })
  const mapPlaces = places.map(projectPlace)
  const routes = legs.map((leg) =>
    createGeodesic(projectPlace(leg.from), projectPlace(leg.to)),
  )

  return {
    places: mapPlaces,
    routes,
    boundsPoints: [
      ...mapPlaces.map(({ lat, lng }) => [lat, lng]),
      ...routes.flat(),
    ],
  }
}
