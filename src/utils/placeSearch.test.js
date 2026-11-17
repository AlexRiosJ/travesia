import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePhotonFeatures } from './placeSearch.js'

function feature({
  id,
  type,
  name = 'Guadalajara',
  state,
  country,
  coordinates,
}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: {
      osm_type: 'R',
      osm_id: id,
      osm_value: type,
      type,
      name,
      county: name,
      state,
      country,
    },
  }
}

test('formats and deduplicates Photon matches while preferring cities', () => {
  const matches = normalizePhotonFeatures([
    feature({
      id: 1,
      type: 'city',
      state: 'Castile-La Mancha',
      country: 'Spain',
      coordinates: [-3.1646067, 40.6326979],
    }),
    feature({
      id: 2,
      type: 'county',
      state: 'Jalisco',
      country: 'Mexico',
      coordinates: [-103.3356942, 20.6784455],
    }),
    feature({
      id: 3,
      type: 'city',
      state: 'Jalisco',
      country: 'Mexico',
      coordinates: [-103.338396, 20.6720375],
    }),
  ])

  assert.deepEqual(
    matches.map(({ displayName, placeType, lat, lng }) => ({
      displayName,
      placeType,
      lat,
      lng,
    })),
    [
      {
        displayName: 'Guadalajara, Castile-La Mancha, Spain',
        placeType: 'city',
        lat: 40.6326979,
        lng: -3.1646067,
      },
      {
        displayName: 'Guadalajara, Jalisco, Mexico',
        placeType: 'city',
        lat: 20.6720375,
        lng: -103.338396,
      },
    ],
  )
})
