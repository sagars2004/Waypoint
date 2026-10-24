import { expect, test, type Page } from '@playwright/test';

async function configureCommute(page: Page) {
  const stopSearches = page.locator('input[type="search"]');

  await stopSearches.nth(0).fill('Hoboken Terminal');
  await page.getByRole('button', { name: /Hoboken Terminal NJ Transit/ }).click();
  await stopSearches.nth(1).fill('34 St–Herald Sq');
  await page.getByRole('button', { name: /34 St–Herald Sq MTA Subway/ }).click();
  await page.locator('#depart-at-time').click();
  await page.getByRole('option', { name: '08:00 AM' }).click();
  await page.locator('#arrive-by-time').click();
  await page.getByRole('option', { name: '09:00 AM' }).click();
  await expect(page.getByText('Departure Verdict Rationale')).toBeVisible();
}

test.describe('Waypoint replay mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Waypoint', { exact: true })).toBeVisible();
    await expect(page.getByText('Select an origin, destination, departure time, and arrival target to see route results.')).toBeVisible();
  });

  test('renders a normal verdict with Plan B and timeline', async ({ page }) => {
    await configureCommute(page);
    await expect(page.getByText('Comfortable', { exact: true })).toBeVisible();
    await expect(page.getByText('Plan B Alternative')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Plan B Fallback' })).toBeVisible();
  });

  test('updates the verdict for a delay scenario', async ({ page }) => {
    await configureCommute(page);
    await page.getByRole('button', { name: 'Delay', exact: true }).click();

    await expect(page.getByText('Tight Margin', { exact: true })).toBeVisible();
    await expect(page.getByText('Signal Malfunction at Christopher St')).toBeVisible();
  });

  test('promotes a fallback route during a reroute scenario', async ({ page }) => {
    await configureCommute(page);
    await page.getByRole('button', { name: 'Reroute', exact: true }).click();

    await expect(page.getByText('Reroute Recommended', { exact: true })).toBeVisible();
    await expect(page.getByText('Service Suspended Hoboken to 33rd')).toBeVisible();
  });

  test('answers a chat question from the replay snapshot', async ({ page }) => {
    await configureCommute(page);
    const input = page.getByPlaceholder('Ask Waypoint anything about your commute...');
    await input.fill('Can I grab coffee and still make it?');
    await input.press('Enter');

    await expect(page.getByText(/5-minute coffee stop/i)).toBeVisible();
    await expect(page.getByText(/Feed Freshness/i)).toBeVisible();
  });

  test('returns to onboarding after a reload instead of showing stale results', async ({ page }) => {
    await configureCommute(page);
    await page.locator('#depart-at-time').click();
    await page.getByRole('option', { name: '08:15 AM' }).click();
    await page.locator('#arrive-by-time').click();
    await page.getByRole('option', { name: '08:30 AM' }).click();
    await expect(page.getByText('Leave 08:15 AM · Arrive by 08:30 AM')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Select an origin, destination, departure time, and arrival target to see route results.')).toBeVisible();
    await expect(page.getByText('Departure Verdict Rationale')).not.toBeVisible();
  });

  test('selects custom stops from the searchable transit catalog', async ({ page }) => {
    const stopSearches = page.locator('input[type="search"]');

    await stopSearches.nth(0).fill('Journal Square');
    await page.getByRole('button', { name: 'Journal Square Transportation Center' }).click();
    await stopSearches.nth(1).fill('World Trade Center');
    await page.getByRole('button', { name: /World Trade Center PATH/ }).click();

    await expect(stopSearches.nth(0)).toHaveValue('Journal Square Transportation Center');
    await expect(stopSearches.nth(1)).toHaveValue('World Trade Center');
    await page.locator('#depart-at-time').click();
    await page.getByRole('option', { name: '08:00 AM' }).click();
    await page.locator('#arrive-by-time').click();
    await page.getByRole('option', { name: '09:00 AM' }).click();
    await expect(page.getByText('Departure Verdict Rationale')).toBeVisible();
  });

  test('shows upcoming departures when planning from the current time', async ({ page }) => {
    await configureCommute(page);
    await page.getByRole('button', { name: 'Depart now' }).click();
    await expect(page.getByText(/Upcoming .* departures/)).toBeVisible();
  });

  test('offers a current-time action for both startup time pickers', async ({ page }) => {
    await page.locator('#depart-at-time').click();
    await expect(page.getByTestId('depart-at-time-current-time')).toBeVisible();
    await page.getByLabel('Close leave at picker').click();

    await page.locator('#arrive-by-time').click();
    await expect(page.getByTestId('arrive-by-time-current-time')).toBeVisible();
  });
});
