import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === new URL(baseURL).origin
      ? route.continue()
      : route.abort(),
  )
})

async function setLocale(page, locale, savedLanguage) {
  await page.addInitScript(
    ({ locale, savedLanguage }) => {
      Object.defineProperty(navigator, 'language', { get: () => locale })
      Object.defineProperty(navigator, 'languages', { get: () => [locale] })
      if (
        savedLanguage &&
        sessionStorage.getItem('rumbo-language-seeded') !== 'true'
      ) {
        localStorage.setItem('rumbo-language', savedLanguage)
        sessionStorage.setItem('rumbo-language-seeded', 'true')
      }
    },
    { locale, savedLanguage },
  )
}

for (const { locale, savedLanguage, expected } of [
  { locale: 'es-ES', expected: 'es' },
  { locale: 'en-US', expected: 'en' },
  { locale: 'fr-FR', expected: 'en' },
  { locale: 'es-MX', savedLanguage: 'en', expected: 'en' },
  { locale: 'en-US', savedLanguage: 'es', expected: 'es' },
]) {
  test(`initial language for ${locale}${savedLanguage ? ` with saved ${savedLanguage}` : ''}`, async ({
    page,
  }) => {
    await setLocale(page, locale, savedLanguage)
    await page.goto('./')
    await expect(page.locator('html')).toHaveAttribute('lang', expected)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', expected)
  })
}
