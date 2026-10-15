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
