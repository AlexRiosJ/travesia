import { expect, test } from '@playwright/test'
import {
  mockExternalRequests,
  OPEN_FREE_MAP_STYLE_URL,
} from './network'

test.beforeEach(async ({ page, baseURL }) => {
  await mockExternalRequests(page, baseURL)
})

test('uses OpenFreeMap for the basemap', async ({ page }) => {
  const styleRequest = page.waitForRequest(OPEN_FREE_MAP_STYLE_URL)

  await page.goto('./')

  await styleRequest
  await expect(page.locator('.leaflet-gl-layer')).toHaveCount(1)
  await expect(page.locator('.leaflet-tile-container')).toHaveCount(0)
})

test('shows labels only for the selected place or active route endpoints', async ({
  page,
}) => {
  await page.goto('./')
  const map = page.locator('.leaflet-map')
  const labels = map.locator('.place-label')

  await expect(labels).toHaveCount(0)
  await expect(page.locator('.status-message--success')).toBeVisible()

  const routeSelectors = page.locator('.transfer-line-button')
  await routeSelectors.nth(0).click()
  await expect(labels).toHaveCount(2)
  await expect(labels.nth(0)).toContainText('Seattle')
  await expect(labels.nth(1)).toContainText('Guadalajara')

  await routeSelectors.nth(1).click()
  await expect(labels).toHaveCount(2)
  await expect(labels).toContainText(['Guadalajara', 'Ciudad de México'])

  const destinationLabel = labels.filter({ hasText: 'Ciudad de México' })
  const [markerBounds, labelBounds] = await Promise.all([
    destinationLabel.evaluate((label) =>
      document
        .querySelector(`[aria-describedby="${label.id}"] .place-marker`)
        .getBoundingClientRect()
        .toJSON(),
    ),
    destinationLabel.evaluate((label) => label.getBoundingClientRect().toJSON()),
  ])
  expect(
    Math.abs(
      markerBounds.x +
        markerBounds.width / 2 -
        (labelBounds.x + labelBounds.width / 2),
    ),
  ).toBeLessThan(1)

  await map.locator('.place-marker').nth(2).evaluate((marker) => {
    marker.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
    )
  })
  await expect(labels).toHaveCount(1)
  await expect(labels).toContainText('Tequila')
})

test('clears route labels when playback completes', async ({ page }) => {
  await page.clock.install()
  await page.goto('./')
  await page.clock.runFor(800)
  await expect(page.locator('.status-message--success')).toBeVisible()

  const map = page.locator('.leaflet-map')
  const labels = map.locator('.place-label')
  const routeCount = Number(
    await page
      .locator('.summary-card .ant-statistic-content-value')
      .nth(2)
      .textContent(),
  )

  await page.locator('.play-button').click()
  await expect(labels).toHaveCount(2)

  for (let route = 0; route < routeCount - 1; route += 1) {
    await page.clock.runFor(2800)
    await expect(labels).toHaveCount(2)
  }

  await page.clock.runFor(2800)
  await expect(labels).toHaveCount(0)
})
