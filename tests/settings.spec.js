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
    test(`dismisses settings in ${language} with ${theme} theme`, async ({ page, isMobile }) => {
      await page.goto('./')
      const trigger = page.getByRole('button', { name: /Settings|Opciones/ })
      const panel = page.locator('.settings-popover')
      const interact = (locator) => isMobile ? locator.tap() : locator.click()
      const expectOpen = () => expect(trigger).toHaveAttribute('aria-expanded', 'true')
      const expectClosed = () => expect(trigger).toHaveAttribute('aria-expanded', 'false')

      await expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      await interact(trigger)
      await expectOpen()
      await expect(panel).toBeVisible()
      await expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      await interact(panel.getByText(language === 'en' ? 'English' : 'Español', {
        exact: true,
      }))
      await expectOpen()
      await expect(page.locator('html')).toHaveAttribute('lang', language)

      const themeNames = {
        es: { light: 'Claro', dark: 'Oscuro', system: 'Sistema' },
        en: { light: 'Light', dark: 'Dark', system: 'System' },
      }
      const themeRadio = panel.getByRole('radio', {
        name: themeNames[language][theme],
        exact: true,
      })
      await interact(panel.getByText(themeNames[language][theme], { exact: true }))
      await expectOpen()
      await expect(themeRadio).toBeChecked()
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        theme === 'system' ? 'light' : theme,
      )
      await expect(panel).toHaveCSS(
        'background-color',
        theme === 'dark' ? 'rgb(24, 28, 26)' : 'rgb(255, 255, 255)',
      )
      await interact(panel.locator('.settings-label').first())
      await expectOpen()

      await themeRadio.focus()
      await page.keyboard.press('Escape')
      await expectClosed()
      await expect(trigger).toBeFocused()

      await interact(trigger)
      await expectOpen()
      const mapHeading = page.getByRole('heading', {
        name: language === 'en' ? 'Map' : 'Mapa',
        exact: true,
      })
      await interact(mapHeading)
      await expectClosed()
      await expect(panel).toBeHidden()

      await interact(trigger)
      await panel.getByRole('radio', { name: 'Español', exact: true }).focus()
      const tripName = page.getByRole('textbox', {
        name: language === 'en' ? 'Trip name' : 'Nombre del viaje',
        exact: true,
      })
      await interact(tripName)
      await expectClosed()
      await expect(tripName).toBeFocused()

      await interact(trigger)
      await expectOpen()
      await interact(trigger)
      await expectClosed()
    })
  }
}

test('settings controls are keyboard accessible and Escape restores trigger focus', async ({ page }) => {
  await page.goto('./')
  const trigger = page.getByRole('button', { name: /Settings|Opciones/ })
  const panel = page.locator('.settings-popover')
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(panel.getByRole('radio', { name: 'Español', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(panel.getByRole('radio', { name: 'English', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
})

test('settings remain open when the system theme changes to dark', async ({ page }) => {
  await page.goto('./')
  const trigger = page.getByRole('button', { name: /Settings|Opciones/ })
  await trigger.click()
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
})
