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
      const tripTrigger = page.getByRole('button', { name: /Trips|Viajes/ })
      const tripPopup = page.getByRole('menu')
      const tripName = page.getByRole('textbox', {
        name: language === 'en' ? 'Trip name' : 'Nombre del viaje',
        exact: true,
      })
      const mapHeading = page.getByRole('heading', {
        name: language === 'en' ? 'Map' : 'Mapa',
        exact: true,
      })
      const outsideTarget = isMobile
        ? page.getByRole('link', { name: 'Travesía, inicio' })
        : mapHeading

      await interact(tripTrigger)
      await expect(tripPopup).toBeVisible()
      await interact(outsideTarget)
      await expect(tripTrigger).toHaveAttribute('aria-expanded', 'false')
      expect(await tripPopup.evaluate(
        (element) => element.contains(document.activeElement),
      )).toBe(false)

      await interact(tripTrigger)
      await tripPopup.getByRole('menuitem').first().focus()
      await interact(tripName)
      await expect(tripTrigger).toHaveAttribute('aria-expanded', 'false')
      await expect(tripName).toBeFocused()

      await interact(tripTrigger)
      await interact(tripPopup.getByRole('menuitem', {
        name: language === 'en' ? 'New trip' : 'Nuevo viaje',
        exact: true,
      }))
      await expect(tripTrigger).toHaveAttribute('aria-expanded', 'false')
      await expect(tripTrigger).toBeFocused()

      await interact(tripTrigger)
      await expect(tripPopup.getByRole('menuitem', {
        name: language === 'en' ? 'New trip' : 'Nuevo viaje',
        exact: true,
      }).first()).toBeVisible()
      await interact(tripPopup.getByRole('menuitem').first())
      await expect(tripTrigger).toHaveAttribute('aria-expanded', 'false')
      await expect(tripTrigger).toBeFocused()

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

      await interact(tripTrigger)
      await tripName.focus()
      await page.keyboard.press('Escape')
      await expect(tripTrigger).toHaveAttribute('aria-expanded', 'false')
    })
  }
}

test('creates, renames, switches, and deletes trips', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rumbo-language', 'en'))
  await page.goto('./')
  const tripMenu = page.getByRole('button', { name: 'Trips', exact: true })
  const tripName = page.getByRole('textbox', { name: 'Trip name', exact: true })

  await tripName.fill('Existing trip')
  await tripMenu.click()
  await page.getByRole('menuitem', { name: 'New trip', exact: true }).click()
  await expect(tripName).toHaveValue('Nuevo viaje')
  await tripName.fill('Delete me')

  await tripMenu.click()
  await page.getByRole('menuitem', { name: 'Existing trip', exact: true }).click()
  await expect(tripName).toHaveValue('Existing trip')

  await tripMenu.click()
  await page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('menuitem', {
    name: 'Delete current trip',
    exact: true,
  }).click()
  await expect(tripName).toHaveValue('Delete me')
  await expect(tripMenu).toContainText('1')
})
