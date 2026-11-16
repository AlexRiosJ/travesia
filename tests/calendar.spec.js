import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { mockExternalRequests } from './network'

test.beforeEach(async ({ page, baseURL }) => {
  await mockExternalRequests(page, baseURL)
})

for (const language of ['en', 'es']) {
  for (const theme of ['light', 'dark', 'system']) {
    test(`calendar and map integration in ${language} with ${theme} theme`, async ({ page }) => {
      await page.goto('./')
      await page.evaluate(({ language, theme }) => {
        localStorage.setItem('rumbo-language', language)
        localStorage.setItem('rumbo-theme', theme)
      }, { language, theme })
      await page.reload()
      await expect(page.locator('.status-message--success')).toBeVisible()
      const english = language === 'en'
      const calendar = page.getByRole('region', { name: english ? 'Calendar' : 'Calendario', exact: true })
      await expect(calendar).toHaveClass(/ant-card/)
      await expect(calendar.getByRole('heading', { level: 3 })).toHaveText(english ? 'March 2027' : 'Marzo de 2027')
      await expect(calendar.locator('.calendar-weekday')).toHaveText(
        english ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      )

      const staySegments = calendar.locator('.calendar-event')
      await expect(staySegments).toHaveCount(8)
      for (const date of ['2027-03-13', '2027-03-14', '2027-03-15']) {
        await expect(calendar.locator(`[data-date="${date}"] .calendar-event`)).toHaveCSS('grid-row-start', '1')
      }
      const overlapping = calendar.locator('[data-date="2027-03-18"] .calendar-event')
      await expect(overlapping).toHaveCount(2)
      await expect(overlapping.nth(0)).toHaveCSS('grid-row-start', '1')
      await expect(overlapping.nth(1)).toHaveCSS('grid-row-start', '2')
      await expect(calendar.locator('[data-date="2027-03-15"] .calendar-event')).toContainText('Guadalajara')

      const stay = calendar.locator('[data-date="2027-03-13"] .calendar-event')
      await stay.focus()
      await page.keyboard.press('Enter')
      await expect(stay).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.selected-place-context.ant-card')).toContainText('Guadalajara')
      await expect(page.locator('.place-label')).toHaveCount(1)

      const dayTrip = calendar.locator('.calendar-nested-event')
      await expect(dayTrip).toHaveCount(1)
      await expect(dayTrip).toContainText(english ? 'Round trip from Guadalajara' : 'Ida y vuelta desde Guadalajara')
      expect(await dayTrip.locator('.calendar-nested-content').evaluate((element) => element.clientWidth)).toBeGreaterThan(0)
      await dayTrip.focus()
      await page.keyboard.press('Space')
      await expect(dayTrip).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.selected-place-context')).toContainText('Tequila')
      await expect(page.locator('.place-label')).toHaveCount(1)

      const excursion = calendar.locator('[data-date="2027-03-14"] .calendar-movement')
      await excursion.focus()
      await page.keyboard.press('Enter')
      await expect(excursion).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.active-route-context.ant-card')).toContainText('Tequila')
      await expect(page.locator('.place-label')).toHaveCount(2)
      await expect(page.locator('.moving-arrow')).toHaveCount(1)
      await expect(page.locator('.route-line--active')).toHaveCount(1)

      await page.getByRole('button', { name: english ? 'Next step' : 'Paso siguiente', exact: true }).click()
      await expect(page.locator('.selected-place-context')).toContainText('Tequila')
      await page.getByRole('button', { name: english ? 'Next step' : 'Paso siguiente', exact: true }).click()
      await expect(page.locator('.active-route-context')).toContainText(
        english ? 'Return to base city' : 'Regreso a la ciudad base',
      )

      const downloadPromise = page.waitForEvent('download')
      await calendar.getByRole('button', { name: english ? 'Export .ics' : 'Exportar .ics' }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe('mexico-2027.ics')
      const content = await readFile(await download.path(), 'utf8')
      expect(content).toMatch(/^BEGIN:VCALENDAR\r\nVERSION:2.0\r\n/)
      expect(content).toContain('DTSTART;VALUE=DATE:20270313\r\nDTEND;VALUE=DATE:20270316')
      expect(content).toContain('DTSTART;VALUE=DATE:20270314\r\nDTEND;VALUE=DATE:20270315')
      expect(content).toContain('SUMMARY:Day trip: Tequila\\, Jalisco')
      expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(10)
      expect(content.match(/-transfer@travesia.local/g)).toHaveLength(5)
      expect(content).not.toContain('tequila-day-trip-transfer@')
      expect(content).toMatch(/END:VCALENDAR\r\n$/)

      if (theme === 'system') await page.emulateMedia({ colorScheme: 'dark' })
      await page.reload()
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
      await expect.poll(() => page.evaluate(() => ({
        language: localStorage.getItem('rumbo-language'),
        theme: localStorage.getItem('rumbo-theme'),
      }))).toEqual({ language, theme })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await expect(calendar.locator('.calendar-event').first()).toHaveClass(/ant-btn/)
      await expect(page.locator('.map-type-legend .ant-tag')).toHaveCount(3)
      await expect(page.locator('button:not(.ant-btn):not(.leaflet-marker-icon)')).toHaveCount(0)
    })
  }
}

test('empty calendar uses Ant Design feedback and disables export', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('rumbo-trip-library-v1'))
    library.trips[0].draftStops = []
    library.trips[0].resolvedStops = []
    localStorage.setItem('rumbo-trip-library-v1', JSON.stringify(library))
  })
  await page.reload()
  await expect(page.locator('.calendar-empty.ant-empty')).toBeVisible()
  await expect(page.locator('.calendar-export-button')).toBeDisabled()
  await expect(page.locator('.calendar-month')).toHaveCount(0)
})

test('preserves month-boundary continuations and localized blank event labels', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => {
    localStorage.setItem('rumbo-language', 'en')
    const library = JSON.parse(localStorage.getItem('rumbo-trip-library-v1'))
    const trip = library.trips[0]
    trip.draftStops[0].startDate = '2027-02-27'
    trip.draftStops[0].endDate = '2027-03-02'
    trip.draftStops[0].place = ''
    trip.draftStops[1].startDate = '2027-02-28'
    trip.draftStops[1].endDate = '2027-02-28'
    trip.draftStops[1].place = ''
    localStorage.setItem('rumbo-trip-library-v1', JSON.stringify(library))
  })
  await page.reload()
  await expect(page.locator('.calendar-month h3')).toHaveText(['February 2027', 'March 2027'])
  const continuation = page.locator('[data-date="2027-03-01"] .calendar-event')
  await expect(continuation).toHaveClass(/is-start/)
  await expect(continuation).toHaveCSS('grid-row-start', '1')
  await expect(continuation).toHaveText('1 New stay')
  await expect(page.locator('[data-date="2027-03-02"] .calendar-event')).toHaveClass(/is-end/)
  await expect(page.locator('.calendar-nested-event')).toContainText('New day trip')
  await expect(page.locator('.calendar-legend')).toContainText('New stay')
})
