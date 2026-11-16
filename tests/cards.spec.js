import { expect, test } from '@playwright/test'
import { mockExternalRequests } from './network'

test.beforeEach(async ({ page, baseURL }) => {
  await mockExternalRequests(page, baseURL)
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
      await expect(
        page.getByRole('button', {
          name:
            language === 'en'
              ? 'View transfer from Seattle, WA to Guadalajara, México'
              : 'Ver traslado de Seattle, WA a Guadalajara, México',
          exact: true,
        }),
      ).toBeEnabled()
      const cardHeader = (card) => card.locator(':scope > .ant-collapse-header')
      const expectOpen = (card) =>
        expect(cardHeader(card)).toHaveAttribute('aria-expanded', 'true')
      const expectClosed = (card) =>
        expect(cardHeader(card)).toHaveAttribute('aria-expanded', 'false')

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
      const wizard = page.getByRole('dialog', {
        name:
          language === 'en'
            ? 'Create a new trip'
            : 'Crear un nuevo viaje',
      })
      await expect(wizard).toBeVisible()
      await wizard.getByRole('button', {
        name: language === 'en' ? 'Cancel' : 'Cancelar',
        exact: true,
      }).click()
      await expect(wizard).toBeHidden()
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
        const summary = cardHeader(card)
        const input = card.locator('input[type="text"]').first()
        await interact(summary)
        await input.fill('Edited city')
        await expectOpen(card)
        await page.keyboard.press('Escape')
        await expectClosed(card)
        await expect(summary).toBeFocused()
        await interact(summary)
        await expect(input).toHaveValue('Edited city')
        await input.focus()
        await interact(mapHeading)
        await expectClosed(card)
        await interact(summary)
        await input.focus()
        await interact(tripName)
        await expectClosed(card)
        await expect(tripName).toBeFocused()
      }

      const parent = page.locator('.stop-node:not(.is-nested)').first()
      const parentSummary = cardHeader(parent)
      const child = parent.locator('.is-nested').first()
      const childSummary = cardHeader(child)
      await interact(parentSummary)
      await interact(childSummary)
      await child.locator('input[type="text"]').fill('Edited day trip')
      await expectOpen(child)
      await expectOpen(parent)

      await interact(parent.locator('.stop-node-body > .place-fields input[type="text"]').first())
      await expectClosed(child)
      await expectOpen(parent)
      await interact(childSummary)
      await child.locator('input[type="text"]').focus()
      await page.keyboard.press('Escape')
      await expectClosed(child)
      await expectClosed(parent)
      await expect(parentSummary).toBeFocused()

      await interact(parentSummary)
      await expectOpen(parent)
      await expectClosed(child)
      await interact(mapHeading)
      await expect(page.locator('.itinerary-collapse .ant-collapse-item-active')).toHaveCount(0)

      await interact(parentSummary)
      const nextCard = page.locator('.stop-node:not(.is-nested)').nth(1)
      await interact(cardHeader(nextCard))
      await expectClosed(parent)
      await expectOpen(nextCard)
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
      await expectClosed(child)
      await expectOpen(parent)
      await parent
        .locator('.is-nested')
        .last()
        .getByRole('button', {
          name: language === 'en' ? 'Delete stop 1b' : 'Eliminar parada 1b',
          exact: true,
        })
        .click()
      await expect(parent.locator('.is-nested')).toHaveCount(childCount)
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
  const wizard = page.getByRole('dialog', { name: 'Create a new trip' })
  await wizard.getByRole('textbox', { name: 'Trip name' }).fill('Delete me')
  await wizard
    .getByRole('textbox', { name: 'Starting point: City or place' })
    .fill('Seattle, WA')
  await wizard
    .getByLabel('Starting point: Date')
    .fill('2027-04-01')
  await wizard
    .getByRole('textbox', { name: 'Final point: City or place' })
    .fill('Paris')
  await wizard.getByLabel('Final point: Date').fill('2027-04-10')
  await wizard.getByRole('button', { name: 'Continue' }).click()
  await wizard
    .getByRole('textbox', { name: 'Stay 1: City or place' })
    .fill('Tokyo')
  await wizard.getByLabel('Stay 1: Arrival').fill('2027-04-01')
  await wizard.getByLabel('Stay 1: Departure').fill('2027-04-10')
  await wizard.getByRole('button', { name: 'Finish' }).click()
  await expect(wizard).toBeHidden()
  await expect(tripName).toHaveValue('Delete me')

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

test('edits itinerary dates and transfers, toggles all cards, and saves changes', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('rumbo-language', 'en'))
  await page.goto('./')

  const activeCards = page.locator(
    '.itinerary-collapse .ant-collapse-item-active',
  )
  const expandAll = page.getByRole('button', { name: 'Expand all' })
  const collapseAll = page.getByRole('button', { name: 'Collapse all' })
  await expandAll.click()
  await expect(activeCards).toHaveCount(7)
  await collapseAll.click()
  await expect(activeCards).toHaveCount(0)

  const stayCards = page.locator('.stop-node:not(.is-nested)')
  await page.getByRole('button', { name: 'Add stay' }).click()
  await expect(stayCards).toHaveCount(5)
  await stayCards.last().locator(':scope > .ant-collapse-header').click()
  await stayCards
    .last()
    .getByRole('button', { name: 'Delete stop 5', exact: true })
    .click()
  await expect(stayCards).toHaveCount(4)

  const firstStop = page.locator('.stop-node:not(.is-nested)').first()
  await firstStop.locator(':scope > .ant-collapse-header').click()
  const arrival = firstStop.locator('input[type="date"]').first()
  await arrival.fill('2027-03-14')
  await expect(arrival).toHaveValue('2027-03-14')

  const transferControl = page.getByRole('textbox', { name: 'Transport' }).first()
  await transferControl.fill('Train')
  const transferButton = page.getByRole('button', {
    name: 'View transfer from Seattle, WA to Guadalajara, México',
  })
  await expect(transferButton).toBeEnabled()
  await transferButton.click()
  await expect(page.locator('.active-route-context')).toContainText('Seattle, WA')

  await expect
    .poll(() =>
      page.evaluate(() => {
        const { trips } = JSON.parse(
          localStorage.getItem('rumbo-trip-library-v1'),
        )
        return [
          trips[0].draftStops[0].startDate,
          trips[0].origin.transport,
        ]
      }),
    )
    .toEqual(['2027-03-14', 'Train'])

  await page.reload()
  const restoredStop = page.locator('.stop-node:not(.is-nested)').first()
  await restoredStop.locator(':scope > .ant-collapse-header').click()
  await expect(restoredStop.locator('input[type="date"]').first()).toHaveValue(
    '2027-03-14',
  )
  await expect(
    page.getByRole('textbox', { name: 'Transport' }).first(),
  ).toHaveValue('Train')
})
