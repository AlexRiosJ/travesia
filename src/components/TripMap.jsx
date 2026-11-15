import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import { buildStopLabels } from '../utils/stopLabels'
import { buildMapGeometry } from '../utils/mapGeometry'
import { UI_COPY } from '../i18n'

const ROUTE_COLORS = ['#e85d3f', '#277c72', '#d99927', '#6253a3', '#27628a']
const DEFAULT_CENTER = [23.6345, -102.5528]
const CATEGORY_COLORS = {
  'day-trip': '#d99927',
}

function MapController({ boundsPoints, routes, activeRoute }) {
  const map = useMap()

  useEffect(() => {
    if (!boundsPoints.length) return

    const bounds = L.latLngBounds(boundsPoints)
    map.fitBounds(bounds.pad(0.18), {
      animate: true,
      duration: 0.8,
      maxZoom: 6,
      padding: [40, 40],
    })
  }, [boundsPoints, map])

  useEffect(() => {
    const activePoints = routes[activeRoute]
    if (!activePoints) return

    const bounds = L.latLngBounds(activePoints)
    const distance = L.latLng(activePoints[0]).distanceTo(
      L.latLng(activePoints.at(-1)),
    )
    map.flyToBounds(bounds.pad(0.55), {
      animate: true,
      duration: 1.1,
      maxZoom: distance < 300000 ? 9 : 6,
      padding: [60, 60],
    })
  }, [activeRoute, map, routes])

  return null
}

function getBearing(from, to) {
  const startLat = (from[0] * Math.PI) / 180
  const endLat = (to[0] * Math.PI) / 180
  const deltaLng = ((to[1] - from[1]) * Math.PI) / 180
  const y = Math.sin(deltaLng) * Math.cos(endLat)
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng)

  return (Math.atan2(y, x) * 180) / Math.PI
}

function MovingArrow({ points, color }) {
  const map = useMap()

  useEffect(() => {
    const segments = points.slice(0, -1).map((point, index) => ({
      from: point,
      to: points[index + 1],
      length: L.latLng(point).distanceTo(L.latLng(points[index + 1])),
    }))
    const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0)
    const icon = L.divIcon({
      className: 'arrow-marker-shell',
      html: `<span class="moving-arrow" style="--arrow-color:${color};--bearing:0deg">➤</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    })
    const marker = L.marker(points[0], {
      icon,
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(map)
    let frame
    let startedAt
    const duration = 2600

    function animate(timestamp) {
      if (!startedAt) startedAt = timestamp
      const progress = ((timestamp - startedAt) % duration) / duration
      const eased = 0.5 - Math.cos(progress * Math.PI) / 2
      const targetDistance = totalLength * eased
      let coveredDistance = 0
      let activeSegment = segments.at(-1)

      for (const segment of segments) {
        if (coveredDistance + segment.length >= targetDistance) {
          activeSegment = segment
          break
        }
        coveredDistance += segment.length
      }

      const segmentProgress =
        activeSegment.length === 0
          ? 0
          : (targetDistance - coveredDistance) / activeSegment.length
      const position = [
        activeSegment.from[0] +
          (activeSegment.to[0] - activeSegment.from[0]) * segmentProgress,
        activeSegment.from[1] +
          (activeSegment.to[1] - activeSegment.from[1]) * segmentProgress,
      ]

      marker.setLatLng(position)
      marker
        .getElement()
        ?.querySelector('.moving-arrow')
        ?.style.setProperty(
          '--bearing',
          `${getBearing(activeSegment.from, activeSegment.to)}deg`,
        )
      frame = window.requestAnimationFrame(animate)
    }

    frame = window.requestAnimationFrame(animate)
    return () => {
      window.cancelAnimationFrame(frame)
      marker.remove()
    }
  }, [color, map, points])

  return null
}

function TripMap({
  stops,
  origin,
  destination,
  language,
  legs,
  activeRoute,
  selectedPlaceId,
  onSelectRoute,
  onSelectPlace,
}) {
  const copy = UI_COPY[language] ?? UI_COPY.es
  const activeLeg = legs[activeRoute]
  const mapPlaces = useMemo(
    () => {
      const stopLabels = buildStopLabels(stops)

      return [
        ...(origin
          ? [{ ...origin, markerLabel: 'A', endpointLabel: copy.origin }]
          : []),
        ...stops.map((stop, stopIndex) => ({
          ...stop,
          stopIndex,
          markerLabel: stopLabels.get(stopIndex),
        })),
        ...(destination
          ? [
              {
                ...destination,
                markerLabel: 'B',
                endpointLabel: copy.destination,
              },
            ]
          : []),
      ]
    },
    [copy.destination, copy.origin, destination, origin, stops],
  )
  const { places: displayPlaces, routes, boundsPoints } = useMemo(
    () => buildMapGeometry(mapPlaces, legs),
    [legs, mapPlaces],
  )
  const activeColor =
    CATEGORY_COLORS[activeLeg?.category] ??
    ROUTE_COLORS[activeRoute % ROUTE_COLORS.length]

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={4}
      minZoom={2}
      scrollWheelZoom
      zoomControl
      className="leaflet-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {legs.map((leg, index) => (
        <Polyline
          key={leg.id}
          positions={routes[index]}
          pathOptions={{
            color:
              CATEGORY_COLORS[leg.category] ??
              ROUTE_COLORS[index % ROUTE_COLORS.length],
            weight: 3,
            opacity: 0.4,
            dashArray: leg.category === 'day-trip' ? '3 9' : '5 10',
            lineCap: 'round',
          }}
          className="route-line"
          eventHandlers={{ click: () => onSelectRoute(index) }}
        />
      ))}

      {routes[activeRoute] && (
        <Polyline
          positions={routes[activeRoute]}
          pathOptions={{
            color: activeColor,
            weight: 5,
            opacity: 0.95,
            dashArray: '13 12',
            lineCap: 'round',
          }}
          className="route-line route-line--active"
          eventHandlers={{ click: () => onSelectRoute(activeRoute) }}
        />
      )}

      {displayPlaces.map((stop) => {
        const isActive =
          stop.id === activeLeg?.from.id || stop.id === activeLeg?.to.id
        const isSelected = stop.id === selectedPlaceId
        const markerIcon = L.divIcon({
          className: 'place-marker-shell',
          html: `<span class="place-marker${stop.endpointLabel ? ' is-endpoint' : ''}${stop.category === 'day-trip' ? ' is-day-trip' : ''}${isSelected ? ' is-selected' : ''}${isActive ? ' is-active' : ''}"><b>${stop.markerLabel}</b></span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        })

        return (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={markerIcon}
            eventHandlers={{ click: () => onSelectPlace(stop.id) }}
          >
            {(isSelected || isActive) && (
              <Tooltip
                permanent
                direction="top"
                offset={[0, -18]}
                className="place-label"
              >
                {stop.place}
                {stop.endpointLabel
                  ? ` · ${stop.endpointLabel}`
                  : stop.category === 'day-trip'
                    ? ` · ${copy.dayTrip}`
                    : ''}
              </Tooltip>
            )}
          </Marker>
        )
      })}

      {routes[activeRoute] && (
        <MovingArrow
          points={routes[activeRoute]}
          color={activeColor}
        />
      )}

      <MapController
        boundsPoints={boundsPoints}
        routes={routes}
        activeRoute={activeRoute}
      />
    </MapContainer>
  )
}

export default TripMap
