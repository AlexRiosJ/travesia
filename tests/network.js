export const OPEN_FREE_MAP_STYLE_URL =
  'https://tiles.openfreemap.org/styles/liberty'

export function mockExternalRequests(page, baseURL) {
  return page.route('**/*', (route) => {
    const requestUrl = new URL(route.request().url())

    if (requestUrl.href === OPEN_FREE_MAP_STYLE_URL) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
      })
    }

    return requestUrl.origin === new URL(baseURL).origin
      ? route.continue()
      : route.abort()
  })
}
