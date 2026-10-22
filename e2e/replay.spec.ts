import { expect, test } from '@playwright/test';

test.describe('Waypoint replay mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Waypoint', { exact: true })).toBeVisible();
    await expect(page.getByText('Departure Verdict Rationale')).toBeVisible();
  });

  test('renders a normal verdict with Plan B and timeline', async ({ page }) => {
    await expect(page.getByText('Comfortable', { exact: true })).toBeVisible();
    await expect(page.getByText('Plan B Alternative')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Plan B Fallback' })).toBeVisible();
  });

  test('updates the verdict for a delay scenario', async ({ page }) => {
    await page.getByRole('button', { name: 'Delay', exact: true }).click();

    await expect(page.getByText('Tight Margin', { exact: true })).toBeVisible();
    await expect(page.getByText('Signal Malfunction at Christopher St')).toBeVisible();
  });

  test('promotes a fallback route during a reroute scenario', async ({ page }) => {
    await page.getByRole('button', { name: 'Reroute', exact: true }).click();

    await expect(page.getByText('Reroute Recommended', { exact: true })).toBeVisible();
    await expect(page.getByText('Service Suspended Hoboken to 33rd')).toBeVisible();
  });

  test('answers a chat question from the replay snapshot', async ({ page }) => {
    const input = page.getByPlaceholder('Ask Waypoint anything about your commute...');
    await input.fill('Can I grab coffee and still make it?');
    await input.press('Enter');

    await expect(page.getByText(/5-minute coffee stop/i)).toBeVisible();
    await expect(page.getByText(/Feed Freshness/i)).toBeVisible();
  });

  test('persists an updated arrive-by time', async ({ page }) => {
    await page.getByRole('button', { name: 'Commute Preferences' }).click();
    await expect(page.getByText('Commute Preferences', { exact: true })).toBeVisible();

    await page.locator('input[type="time"]').fill('08:30');
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText('Target Arrival: 08:30 AM')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Target Arrival: 08:30 AM')).toBeVisible();
  });

  test('selects custom stops from the searchable transit catalog', async ({ page }) => {
    const stopSearches = page.locator('input[type="search"]');

    await stopSearches.nth(0).fill('Journal Square');
    await page.getByRole('button', { name: 'Journal Square Transportation Center' }).click();
    await stopSearches.nth(1).fill('World Trade Center');
    await page.getByRole('button', { name: 'World Trade Center' }).click();

    await expect(stopSearches.nth(0)).toHaveValue('Journal Square Transportation Center');
    await expect(stopSearches.nth(1)).toHaveValue('World Trade Center');
  });

  test('shows upcoming departures when planning from the current time', async ({ page }) => {
    await page.getByRole('button', { name: 'Depart now' }).click();
    await expect(page.getByText(/Upcoming .* departures/)).toBeVisible();
  });
});
