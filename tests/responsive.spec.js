import { expect, test } from '@playwright/test'
import { mockExternalRequests } from './network'

test.beforeEach(async ({ page, baseURL }) => {
  await mockExternalRequests(page, baseURL)
})

for (const language of ['en', 'es']) {
  for (const theme of ['light', 'dark']) {
    test(`itinerary fits responsive layouts in ${language} with ${theme} theme`, async ({ page, isMobile }) => {
      if (isMobile) await page.setViewportSize({ width: 320, height: 844 })
      await page.addInitScript(({ language, theme }) => {
        localStorage.setItem('rumbo-language', language)
        localStorage.setItem('rumbo-theme', theme)
      }, { language, theme })
      await page.goto('./')
      const card = page.locator('.stop-node:not(.is-nested)').first()
      const header = card.locator(':scope > .ant-collapse-header')
      await header.click()
      const originalPlace = await card.locator('.place-fields input').first().inputValue()
      const longPlace = 'San Cristóbal de las Casas, Chiapas, México'
      await card.locator('.place-fields input').first().fill(longPlace)
      await card.locator('.is-nested > .ant-collapse-header').first().click()
      await expect(page.locator('.itinerary-collapse .ant-collapse-header').first())
        .toHaveCSS('display', 'grid')

      const layoutIssues = await page.locator('.itinerary-collapse .ant-collapse-header').evaluateAll(
        (headers) => headers.flatMap((header) => {
          const title = header.querySelector('.ant-collapse-title')
          const icon = header.querySelector('.ant-collapse-expand-icon')
          const titleRect = title.getBoundingClientRect()
          const iconRect = icon.getBoundingClientRect()
          const headerRect = header.getBoundingClientRect()
          return [
            titleRect.right > iconRect.left,
            iconRect.right > headerRect.right,
            title.scrollWidth > title.clientWidth,
          ].filter(Boolean)
        }),
      )
      expect(layoutIssues).toEqual([])
      const heading = card.locator('.stop-node-summary strong').first()
      await expect(heading).toHaveText(longPlace)
      expect(await heading.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      await card.locator('.place-fields input').first().fill(originalPlace)

      const connector = page.locator('.transfer-connector').first()
      const transport = connector.getByRole('textbox')
      await transport.fill('Train / Tren')
      await expect(connector).toHaveJSProperty('scrollWidth', await connector.evaluate((el) => el.clientWidth))
      expect((await connector.boundingBox()).height).toBeLessThanOrEqual(80)
      await expect.poll(() => page.evaluate(() => {
        const library = JSON.parse(localStorage.getItem('rumbo-trip-library-v1'))
        return library.trips.find((trip) => trip.id === library.activeTripId).resolvedOrigin?.transport
      })).toBe('Train / Tren')
      await connector.getByRole('button').click()
      await expect(page.locator('.active-route-context')).toContainText('Train / Tren')
      await expect(transport).toHaveValue('Train / Tren')
      await page.reload()
      await expect(page.locator('.transfer-connector').first().getByRole('textbox'))
        .toHaveValue('Train / Tren')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  }
}
