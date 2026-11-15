import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page, baseURL }) => {
  // Settings do not depend on remote map tiles, fonts, or routing services.
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === new URL(baseURL).origin
      ? route.continue()
      : route.abort(),
  )
})

for (const language of ['es', 'en']) {
  for (const theme of ['light', 'dark', 'system']) {
    test(`dismisses settings in ${language} with ${theme} theme`, async ({ page, isMobile }) => {
      await page.goto('./')
      const settings = page.locator('.settings-menu')
      const summary = settings.locator('summary')
      const interact = (locator) => isMobile ? locator.tap() : locator.click()
      const expectOpen = () => expect(settings).toHaveAttribute('open', '')
      const expectClosed = () => expect(settings).not.toHaveAttribute('open')

      await interact(summary)
      await interact(settings.getByRole('button', {
        name: language === 'en' ? 'English' : 'Español',
        exact: true,
      }))
      await expectOpen()
      await expect(page.locator('html')).toHaveAttribute('lang', language)

      const themeNames = {
        es: { light: 'Claro', dark: 'Oscuro', system: 'Sistema' },
        en: { light: 'Light', dark: 'Dark', system: 'System' },
      }
      const themeButton = settings.getByRole('button', {
        name: themeNames[language][theme],
        exact: true,
      })
      await interact(themeButton)
      await expectOpen()
      await expect(themeButton).toHaveClass('is-active')
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        theme === 'system' ? 'light' : theme,
      )
      await interact(settings.locator('.settings-label').first())
      await expectOpen()

      await themeButton.focus()
      await page.keyboard.press('Escape')
      await expectClosed()
      await expect(summary).toBeFocused()

      await interact(summary)
      await settings.getByRole('button').first().focus()
      await interact(page.getByRole('heading', {
        name: language === 'en' ? 'Map' : 'Mapa',
        exact: true,
      }))
      await expectClosed()
      expect(await settings.locator('.settings-popover').evaluate(
        (element) => element.contains(document.activeElement),
      )).toBe(false)

      await interact(summary)
      await settings.getByRole('button').first().focus()
      const tripName = page.getByRole('textbox', {
        name: language === 'en' ? 'Trip name' : 'Nombre del viaje',
        exact: true,
      })
      await interact(tripName)
      await expectClosed()
      await expect(tripName).toBeFocused()

      await interact(summary)
      await expectOpen()
      await interact(summary)
      await expectClosed()
    })
  }
}

test('supports keyboard opening, tab navigation, and Escape without trapping focus', async ({ page }) => {
  await page.goto('./')
  const settings = page.locator('.settings-menu')
  const summary = settings.locator('summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(settings).toHaveAttribute('open', '')
  await page.keyboard.press('Tab')
  await expect(settings.getByRole('button', { name: 'Español', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(settings).toHaveAttribute('open', '')
  await page.keyboard.press('Escape')
  await expect(summary).toBeFocused()
  await expect(settings).not.toHaveAttribute('open')

  await page.keyboard.press('Space')
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('Tab')
  expect(await settings.evaluate((element) => element.contains(document.activeElement))).toBe(false)
  const focusedOutside = await page.locator(':focus').elementHandle()
  await page.keyboard.press('Escape')
  await expect(settings).not.toHaveAttribute('open')
  expect(await focusedOutside.evaluate((element) => element === document.activeElement)).toBe(true)
})

test('dismisses settings when the system theme changes to dark', async ({ page }) => {
  await page.goto('./')
  const settings = page.locator('.settings-menu')
  const language = await page.locator('html').getAttribute('lang')
  await settings.locator('summary').click()
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(settings).toHaveAttribute('open', '')
  await settings.getByRole('button', {
    name: language === 'en' ? 'System' : 'Sistema',
    exact: true,
  }).focus()
  await page.keyboard.press('Escape')
  await expect(settings).not.toHaveAttribute('open')
  await expect(settings.locator('summary')).toBeFocused()
})
