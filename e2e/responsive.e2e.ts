import { test, expect } from "@playwright/test";

// Responsive layout on 7 screen sizes, from a small phone to a wide monitor.
const SCREENS = [
  { name: "small phone", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "phone landscape", width: 844, height: 390 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 720 },
  { name: "desktop", width: 1920, height: 1080 },
  { name: "wide monitor", width: 2560, height: 1440 },
];

for (const screen of SCREENS) {
  test(`layout fits a ${screen.name} (${screen.width}x${screen.height})`, async ({
    page,
    isMobile,
  }) => {
    test.skip(
      isMobile,
      "the screen size is set explicitly, so this runs once, in the desktop project",
    );
    await page.setViewportSize({ width: screen.width, height: screen.height });
    await page.goto("/");

    // No sideways scrolling.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // The input and the first buttons are on screen without scrolling.
    await expect(page.getByPlaceholder(/Type your message/)).toBeInViewport();
    await expect(page.getByRole("button", { name: /Hi!/ })).toBeInViewport();

    // The app uses the whole width: no empty side margins on wide screens.
    const appWidth = await page
      .locator("[data-app]")
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(appWidth).toBeGreaterThanOrEqual(screen.width - 64);

    // Text grows on very large screens instead of looking tiny.
    if (screen.width >= 2560) {
      const rootFont = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).fontSize),
      );
      expect(rootFont).toBeGreaterThanOrEqual(18);
    }

    // Where the sidebar is shown, it fits the screen without its own scrollbar.
    const sidebar = page.getByRole("complementary");
    if (await sidebar.isVisible()) {
      const fits = await sidebar.evaluate(
        (el) => el.scrollHeight <= el.clientHeight + 1,
      );
      expect(fits).toBe(true);
    }
  });
}
