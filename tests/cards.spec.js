import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === new URL(baseURL).origin
      ? route.continue()
      : route.abort(),
  )
})

for (const language of ['es', 'en']) {
  for (const theme of ['light', 'dark', 'system']) {
    test(`dismisses trip and itinerary cards in ${language} with ${theme} theme`, async ({ page, isMobile }) => {
      await page.addInitScript(({ language, theme }) => {
        localStorage.setItem('rumbo-language', language)
        localStorage.setItem('rumbo-theme', theme)
      }, { language, theme })
      await page.goto('./')
      const interact = (locator) => isMobile ? locator.tap() : locator.click()
      const tripMenu = page.locator('.trip-menu')
      const tripSummary = tripMenu.locator('summary')
      const tripName = page.getByRole('textbox', {
        name: language === 'en' ? 'Trip name' : 'Nombre del viaje',
        exact: true,
      })
      const mapHeading = page.getByRole('heading', {
        name: language === 'en' ? 'Map' : 'Mapa',
        exact: true,
      })

      await tripSummary.focus()
      await page.keyboard.press('Enter')
      await interact(tripMenu.locator('.trip-menu-heading'))
      await expect(tripMenu).toHaveAttribute('open', '')
      await tripMenu.getByRole('button').first().focus()
      await page.keyboard.press('Escape')
      await expect(tripMenu).not.toHaveAttribute('open')
      await expect(tripSummary).toBeFocused()

      await interact(tripSummary)
      await tripMenu.getByRole('button').first().focus()
      await interact(mapHeading)
      await expect(tripMenu).not.toHaveAttribute('open')
      expect(await tripMenu.locator('.trip-menu-popover').evaluate(
        (element) => element.contains(document.activeElement),
      )).toBe(false)

      await interact(tripSummary)
      await tripMenu.getByRole('button').first().focus()
      await interact(tripName)
      await expect(tripMenu).not.toHaveAttribute('open')
      await expect(tripName).toBeFocused()

      await interact(tripSummary)
      await interact(tripMenu.getByRole('button', {
        name: language === 'en' ? 'New trip' : 'Nuevo viaje',
        exact: true,
      }))
      await expect(tripMenu).not.toHaveAttribute('open')
      await expect(tripSummary).toBeFocused()
      await expect(tripMenu.locator('.trip-menu-item')).toHaveCount(2)

      await interact(tripSummary)
      await interact(tripMenu.locator('.trip-menu-item').first())
      await expect(tripMenu).not.toHaveAttribute('open')
      await expect(tripSummary).toBeFocused()

      for (const card of [
        page.locator('.endpoint-node').first(),
        page.locator('.stop-node:not(.is-nested)').first(),
        page.locator('.endpoint-node').last(),
      ]) {
        const summary = card.locator(':scope > summary')
        const input = card.locator('input[type="text"]').first()
        await interact(summary)
        await input.fill('Edited city')
        await expect(card).toHaveAttribute('open', '')
        await page.keyboard.press('Escape')
        await expect(card).not.toHaveAttribute('open')
        await expect(summary).toBeFocused()
        await interact(summary)
        await expect(input).toHaveValue('Edited city')
        await input.focus()
        await interact(mapHeading)
        await expect(card).not.toHaveAttribute('open')
        await interact(summary)
        await input.focus()
        await interact(tripName)
        await expect(card).not.toHaveAttribute('open')
        await expect(tripName).toBeFocused()
      }

      const parent = page.locator('.stop-node:not(.is-nested)').first()
      const parentSummary = parent.locator(':scope > summary')
      const child = parent.locator('.is-nested').first()
      const childSummary = child.locator(':scope > summary')
      await interact(parentSummary)
      await interact(childSummary)
      await child.locator('input[type="text"]').fill('Edited day trip')
      await expect(child).toHaveAttribute('open', '')
      await expect(parent).toHaveAttribute('open', '')

      await interact(parent.locator(':scope > .stop-node-body input[type="text"]').first())
      await expect(child).not.toHaveAttribute('open')
      await expect(parent).toHaveAttribute('open', '')
      await interact(childSummary)
      await child.locator('input[type="text"]').focus()
      await page.keyboard.press('Escape')
      await expect(child).not.toHaveAttribute('open')
      await expect(parent).not.toHaveAttribute('open')
      await expect(parentSummary).toBeFocused()

      await interact(parentSummary)
      await expect(parent).toHaveAttribute('open', '')
      await expect(child).not.toHaveAttribute('open')
      await interact(mapHeading)
      await expect(page.locator('details[open]')).toHaveCount(0)

      await interact(parentSummary)
      const nextCard = page.locator('.stop-node:not(.is-nested)').nth(1)
      await interact(nextCard.locator(':scope > summary'))
      await expect(parent).not.toHaveAttribute('open')
      await expect(nextCard).toHaveAttribute('open', '')
      await interact(mapHeading)

      await interact(parentSummary)
      await interact(childSummary)
      const addDayTrip = parent.getByRole('button', {
        name: language === 'en' ? 'Add day trip' : 'Añadir day trip',
        exact: true,
      })
      const childCount = await parent.locator('.is-nested').count()
      await interact(addDayTrip)
      await expect(parent.locator('.is-nested')).toHaveCount(childCount + 1)
      await expect(child).not.toHaveAttribute('open')
      await expect(parent).toHaveAttribute('open', '')
      await interact(mapHeading)

      await interact(tripSummary)
      await tripName.focus()
      await page.keyboard.press('Escape')
      await expect(tripMenu).not.toHaveAttribute('open')
      await expect(tripName).toBeFocused()
    })
  }
}
