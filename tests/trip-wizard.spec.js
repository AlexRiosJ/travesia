import { expect, test } from '@playwright/test'
import { mockExternalRequests, PHOTON_SEARCH_URL } from './network'

test.beforeEach(async ({ page, baseURL }) => {
  await mockExternalRequests(page, baseURL)
  await page.addInitScript(() => localStorage.setItem('rumbo-language', 'en'))
})

test('creates a trip from endpoints and multiple stays', async ({ page }) => {
  await page.goto('./')

  const tripMenu = page.getByRole('button', { name: 'Trips', exact: true })
  await tripMenu.click()
  await page.getByRole('menuitem', { name: 'New trip', exact: true }).click()

  const wizard = page.getByRole('dialog', { name: 'Create a new trip' })
  await expect(wizard).toBeVisible()
  await wizard.getByRole('textbox', { name: 'Trip name' }).fill('World cities')
  await wizard
    .getByRole('combobox', { name: 'Starting point: City or place' })
    .fill('Seattle, WA')
  await wizard.getByLabel('Starting point: Date').fill('2027-04-01')
  await wizard
    .getByRole('combobox', { name: 'Final point: City or place' })
    .fill('Paris')
  await wizard.getByLabel('Final point: Date').fill('2027-04-10')
  await wizard.getByRole('button', { name: 'Continue' }).click()

  await wizard
    .getByRole('combobox', { name: 'Stay 1: City or place' })
    .fill('Tokyo')
  await wizard.getByLabel('Stay 1: Arrival').fill('2027-04-01')
  await wizard.getByLabel('Stay 1: Departure').fill('2027-04-05')
  await wizard.getByRole('button', { name: 'Add another stay' }).click()
  await wizard
    .getByRole('combobox', { name: 'Stay 2: City or place' })
    .fill('Paris')
  await wizard.getByLabel('Stay 2: Arrival').fill('2027-04-05')
  await wizard.getByLabel('Stay 2: Departure').fill('2027-04-10')
  await wizard.getByRole('button', { name: 'Finish' }).click()

  await expect(wizard).toBeHidden()
  await expect(page.getByRole('textbox', { name: 'Trip name' })).toHaveValue(
    'World cities',
  )
  await expect(page.locator('.stop-node:not(.is-nested)')).toHaveCount(2)
  await expect(page.getByText('Map updated automatically.')).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.locator('.timeline-stop')).toHaveCount(2)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const library = JSON.parse(
          localStorage.getItem('rumbo-trip-library-v1'),
        )
        const trip = library.trips.find(
          (candidate) => candidate.id === library.activeTripId,
        )
        return {
          title: trip.title,
          origin: trip.origin.place,
          destination: trip.destination.place,
          stays: trip.draftStops.map((stay) => stay.place),
        }
      }),
    )
    .toEqual({
      title: 'World cities',
      origin: 'Seattle, WA',
      destination: 'Paris',
      stays: ['Tokyo', 'Paris'],
    })
})

test('cancels without creating a trip', async ({ page }) => {
  await page.goto('./')

  const tripMenu = page.getByRole('button', { name: 'Trips', exact: true })
  await tripMenu.click()
  await page.getByRole('menuitem', { name: 'New trip', exact: true }).click()

  const wizard = page.getByRole('dialog', { name: 'Create a new trip' })
  await wizard.getByRole('textbox', { name: 'Trip name' }).fill('Discard me')
  await wizard.getByRole('button', { name: 'Cancel', exact: true }).click()

  await expect(wizard).toBeHidden()
  await expect(tripMenu).toContainText('1')
  await expect(page.getByRole('textbox', { name: 'Trip name' })).toHaveValue(
    'México 2027',
  )
})

test('selects an exact destination from possible place matches', async ({
  page,
}) => {
  await page.route(`${PHOTON_SEARCH_URL}**`, (route) =>
    route.fulfill({
      contentType: 'application/geo+json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-3.1646067, 40.6326979],
            },
            properties: {
              osm_type: 'R',
              osm_id: 342800,
              osm_value: 'city',
              type: 'city',
              name: 'Guadalajara',
              county: 'Guadalajara',
              state: 'Castile-La Mancha',
              country: 'Spain',
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-103.338396, 20.6720375],
            },
            properties: {
              osm_type: 'N',
              osm_id: 1663173902,
              osm_value: 'city',
              type: 'city',
              name: 'Guadalajara',
              county: 'Guadalajara',
              state: 'Jalisco',
              country: 'Mexico',
            },
          },
        ],
      }),
    }),
  )
  await page.goto('./')

  await page.getByRole('button', { name: 'Trips', exact: true }).click()
  await page.getByRole('menuitem', { name: 'New trip', exact: true }).click()

  const wizard = page.getByRole('dialog', { name: 'Create a new trip' })
  await wizard
    .getByRole('combobox', { name: 'Starting point: City or place' })
    .fill('Seattle')
  await wizard.getByLabel('Starting point: Date').fill('2027-04-01')
  const destinationInput = wizard.getByRole('combobox', {
    name: 'Final point: City or place',
  })
  await destinationInput.fill('Guadalajara')

  const visiblePopup = page.locator('.place-autocomplete-popup:visible')
  const spainOption = visiblePopup
    .locator('.ant-select-item-option')
    .filter({ hasText: 'Castile-La Mancha, Spain' })
  const mexicoOption = visiblePopup
    .locator('.ant-select-item-option')
    .filter({ hasText: 'Jalisco, Mexico' })
  await expect(spainOption).toBeVisible()
  await expect(mexicoOption).toBeVisible()
  await mexicoOption.click()
  await expect(destinationInput).toHaveValue('Guadalajara, Jalisco, Mexico')

  await wizard.getByLabel('Final point: Date').fill('2027-04-05')
  await wizard.getByRole('button', { name: 'Continue' }).click()
  await wizard
    .getByRole('combobox', { name: 'Stay 1: City or place' })
    .fill('Tokyo')
  await wizard.getByLabel('Stay 1: Arrival').fill('2027-04-01')
  await wizard.getByLabel('Stay 1: Departure').fill('2027-04-05')
  await wizard.getByRole('button', { name: 'Finish' }).click()

  await expect
    .poll(() =>
      page.evaluate(() => {
        const library = JSON.parse(
          localStorage.getItem('rumbo-trip-library-v1'),
        )
        const trip = library.trips.find(
          (candidate) => candidate.id === library.activeTripId,
        )
        return {
          place: trip.destination.place,
          displayName: trip.destination.displayName,
          lat: trip.destination.lat,
          lng: trip.destination.lng,
        }
      }),
    )
    .toEqual({
      place: 'Guadalajara, Jalisco, Mexico',
      displayName: 'Guadalajara, Jalisco, Mexico',
      lat: 20.6720375,
      lng: -103.338396,
    })
})
