import { test, expect } from '@playwright/test';

test('published runtime selects a complete release even when an old unversioned engine is cached', async ({ page }) => {
  const loaded = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { const url = new URL(request.url()); if (/\.(js|css)$/.test(url.pathname)) loaded.push(url); });
  // A returning browser may have the original engine for ten minutes. The new
  // UI must select its own version instead of importing that stale module.
  await page.route(url => url.pathname.endsWith('/engine.js') && !url.search, route => route.fulfill({
    contentType: 'application/javascript', body: 'throw new Error("The old engine was selected");'
  }));
  await page.goto('./');
  await page.locator('#start-campaign').click();
  await expect(page.locator('#app')).toBeVisible();
  await page.locator('#neocom [data-view="overview"]').click();
  await expect(page.locator('[data-cohort]')).toHaveCount(6);
  expect(loaded.some(url => url.pathname.endsWith('/engine.js'))).toBe(true);
  const versions = new Set(loaded.map(url => url.searchParams.get('v')));
  expect(versions.has(null)).toBe(false);
  expect(versions.size).toBe(1);
  expect(errors).toEqual([]);
});
