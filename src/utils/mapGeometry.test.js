import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMapGeometry } from './mapGeometry.js'
import { buildRouteLegs } from './routeLegs.js'
import { findKnownLocation, resolveSampleStops } from '../data/sampleTrip.js'

function place(name, id = name, category = 'stay') {
  return { id, place: name, category, ...findKnownLocation(name) }
}

function assertPoint(actual, expected) {
  assert.ok(Math.abs(actual[0] - expected.lat) < 1e-8)
  assert.ok(Math.abs(actual[1] - expected.lng) < 1e-8)
}

function assertConnected(geometry, legs) {
  assert.equal(geometry.routes.length, legs.length)
  legs.forEach((leg, index) => {
    const points = geometry.routes[index]
    assertPoint(points[0], geometry.places.find(({ id }) => id === leg.from.id))
    assertPoint(points.at(-1), geometry.places.find(({ id }) => id === leg.to.id))
    points.forEach(([lat, lng], pointIndex) => {
      assert.ok(Number.isFinite(lat) && Number.isFinite(lng))
      if (pointIndex) {
        assert.ok(Math.abs(lng - points[pointIndex - 1][1]) < 180)
      }
      assert.ok(geometry.boundsPoints.some(
        (point) => point[0] === lat && point[1] === lng,
      ))
    })
  })
}

test('Seattle-Japan-Seattle uses one world copy without mutating stored coordinates', () => {
  const origin = place('Seattle', 'origin')
  const destination = place('Seattle', 'destination')
  const stops = ['Tokyo', 'Hiroshima', 'Osaka', 'Kyoto', 'Fuji', 'Tokyo']
    .map((name, index) => place(name, `stop-${index}`))
  const places = [origin, ...stops, destination]
  const legs = buildRouteLegs(stops, origin, destination)
  const before = structuredClone({ places, legs })
  const geometry = buildMapGeometry(places, legs)

  assertConnected(geometry, legs)
  assert.equal(geometry.routes.length, 7)
  assertPoint(geometry.boundsPoints[0], geometry.places.at(-1))
  const longitudes = geometry.boundsPoints.map((point) => point[1])
  assert.ok(Math.max(...longitudes) - Math.min(...longitudes) < 110)
  assert.ok(Math.max(...geometry.boundsPoints.map((point) => point[0])) > 50)
  assert.deepEqual({ places, legs }, before)
})

test('ordinary Mexico round trip preserves marker coordinates and both day-trip legs', () => {
  const origin = place('Seattle', 'origin')
  const destination = place('Seattle', 'destination')
  const stops = resolveSampleStops()
  const places = [origin, ...stops, destination]
  const legs = buildRouteLegs(stops, origin, destination)
  const geometry = buildMapGeometry(places, legs)

  assertConnected(geometry, legs)
  assert.deepEqual(geometry.places, places)
  const outboundIndex = legs.findIndex((leg) => leg.category === 'day-trip')
  assert.equal(legs[outboundIndex + 1].direction, 'return')
  assertPoint(geometry.routes[outboundIndex][0], stops[0])
  assertPoint(geometry.routes[outboundIndex + 1].at(-1), stops[0])
})

for (const [fromLng, toLng] of [[179, -179], [-179, 179], [539, -179]]) {
  test(`antimeridian day trip and return stay connected (${fromLng} to ${toLng})`, () => {
    const base = { id: 'base', lat: 20, lng: fromLng, category: 'stay' }
    const excursion = { id: 'excursion', lat: 25, lng: toLng, category: 'day-trip' }
    const stops = [base, excursion]
    const legs = buildRouteLegs(stops)
    const geometry = buildMapGeometry(stops, legs)

    assertConnected(geometry, legs)
    assert.equal(legs.length, 2)
    const longitudes = geometry.boundsPoints.map((point) => point[1])
    assert.ok(Math.max(...longitudes) - Math.min(...longitudes) < 3)
  })
}

test('identical locations and a single marker produce finite geometry', () => {
  const stops = [place('Tokyo', 'first'), place('Tokyo', 'second')]
  const legs = buildRouteLegs(stops)
  assertConnected(buildMapGeometry(stops, legs), legs)
  assert.deepEqual(buildMapGeometry([stops[0]], []).boundsPoints, [
    [stops[0].lat, stops[0].lng],
  ])
})

test('empty map has no routes or bounds', () => {
  assert.deepEqual(buildMapGeometry([], []), {
    places: [], routes: [], boundsPoints: [],
  })
})
