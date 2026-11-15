import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === new URL(baseURL).origin
      ? route.continue()
      : route.abort(),
  )
})

for (const theme of ['light', 'dark']) {
  test(`raised controls and selected day trips remain clear with ${theme} theme`, async ({ page }) => {
    await page.addInitScript((theme) => {
      localStorage.setItem('rumbo-theme', theme)
    }, theme)
    await page.goto('./')

    const parent = page.locator('.stop-node:not(.is-nested)').first()
    await parent.locator(':scope > .ant-collapse-header').click()
    await expect(parent.locator('.is-nested').first()).toBeVisible()
    const edges = await page.locator(
      '.trip-menu-trigger, .settings-trigger, .itinerary-collapse > .ant-collapse-item',
    ).evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element)
      return {
        completeBorder: ['Top', 'Right', 'Bottom', 'Left'].every(
          (side) => parseFloat(style[`border${side}Width`]) >= 1,
        ),
        roundedCorners: ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].every(
          (corner) => parseFloat(style[`border${corner}Radius`]) > 0,
        ),
        raised: style.boxShadow !== 'none',
      }
    }))
    expect(edges.length).toBeGreaterThanOrEqual(5)
    for (const edge of edges) {
      expect(edge).toEqual({ completeBorder: true, roundedCorners: true, raised: true })
    }

    await page.locator('.timeline-stop').filter({
      has: page.locator('.timeline-category--day-trip'),
    }).first().click()
    const marker = page.locator('.place-marker.is-day-trip.is-selected')
    await expect(marker).toBeVisible()
    const contrast = await marker.evaluate((element) => {
      const style = getComputedStyle(element)
      const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3)
        .map((channel) => Number(channel) / 255)
        .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
      const foreground = luminance(style.color)
      const background = luminance(style.backgroundColor)
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
    })
    expect(contrast).toBeGreaterThanOrEqual(4.5)
  })
}

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
