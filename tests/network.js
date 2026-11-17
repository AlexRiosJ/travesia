export const OPEN_FREE_MAP_STYLE_URL =
  'https://tiles.openfreemap.org/styles/liberty'
export const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api/'

export function mockExternalRequests(page, baseURL) {
  return page.route('**/*', (route) => {
    const requestUrl = new URL(route.request().url())

    if (requestUrl.href === OPEN_FREE_MAP_STYLE_URL) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
      })
    }

    if (requestUrl.origin === new URL(PHOTON_SEARCH_URL).origin) {
      return route.fulfill({
        contentType: 'application/geo+json',
        body: JSON.stringify({ type: 'FeatureCollection', features: [] }),
      })
    }

    return requestUrl.origin === new URL(baseURL).origin
      ? route.continue()
      : route.abort()
  })
}
