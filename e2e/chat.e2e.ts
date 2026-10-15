import { test, expect, type Page } from "@playwright/test";
import type { ChatResponse, ProgrammeCard } from "../lib/types";

// The chat API is mocked in the browser: these tests check what the student sees.
// The server pipeline itself is covered by the Vitest tests.
async function mockChatApi(page: Page, replies: ChatResponse[]) {
  let i = 0;
  await page.route("**/api/chat", (route) =>
    route.fulfill({ json: replies[Math.min(i++, replies.length - 1)] }),
  );
}

const PREMED: Omit<ProgrammeCard, "name"> = {
  id: "P08",
  field: "medicine",
  host: "Gulf Science Centre",
  country: "Qatar",
  weeks: 3,
  fee: 2500,
  currency: "QAR",
  minIelts: null,
  scholarship: true,
  teachingLanguage: "ar",
};

test("English: tap buttons through the conversation and get a programme card", async ({
  page,
}) => {
  await mockChatApi(page, [
    {
      language: "en",
      text: "Which field interests you most?",
      choices: ["Computing", "Business", "Medicine"],
      programmes: [],
      profile: { language: "en" },
    },
    {
      language: "en",
      text: "What is your budget, and in which currency?",
      choices: ["Under 5,000 QAR"],
      programmes: [],
      profile: { language: "en", interest: "medicine" },
    },
    {
      language: "en",
      text: "This programme fits you well.",
      choices: [],
      programmes: [{ ...PREMED, name: "Pre-Med Biology Bootcamp" }],
      profile: {
        language: "en",
        interest: "medicine",
        budget: 5000,
        currency: "QAR",
        ielts: "none",
      },
    },
  ]);

  await page.goto("/");
  await page.getByRole("button", { name: /Hi!/ }).click();
  await expect(page.getByText("Which field interests you most?")).toBeVisible();

  await page.getByRole("button", { name: /Medicine/ }).click();
  // Only the latest message offers buttons: the old ones are gone.
  await expect(page.getByRole("button", { name: /Computing/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Under 5,000 QAR/ }).click();
  await expect(
    page.getByRole("heading", { name: "Pre-Med Biology Bootcamp" }),
  ).toBeVisible();
  await expect(page.getByText("No IELTS needed")).toBeVisible();
});

test("Arabic: replies and cards are right-to-left", async ({ page }) => {
  await mockChatApi(page, [
    {
      language: "ar",
      text: "هذا البرنامج مناسب لك.",
      choices: ["شكرًا"],
      programmes: [{ ...PREMED, name: "معسكر الأحياء التحضيري للطب" }],
      profile: {
        language: "ar",
        interest: "medicine",
        budget: 3000,
        currency: "QAR",
        ielts: "none",
      },
    },
  ]);

  await page.goto("/");
  await page.getByRole("button", { name: /مرحبا/ }).click();

  const bubble = page.getByText("هذا البرنامج مناسب لك.");
  await expect(bubble).toBeVisible();
  expect(await bubble.evaluate((el) => getComputedStyle(el).direction)).toBe(
    "rtl",
  );

  const title = page.getByRole("heading", {
    name: "معسكر الأحياء التحضيري للطب",
  });
  await expect(title).toBeVisible();
  expect(await title.evaluate((el) => getComputedStyle(el).direction)).toBe(
    "rtl",
  );
  await expect(page.getByText("قطر")).toBeVisible(); // country name translated
});

test("a server error shows a friendly message and a retry button", async ({
  page,
}) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 500, body: "boom" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Hi!/ }).click();
  await expect(
    page.getByText("Couldn't reach the server. Please try again."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Try again/ })).toBeVisible();
});

test("desktop: My Preferences fills in as the student answers", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the sidebar is desktop only");
  await mockChatApi(page, [
    {
      language: "en",
      text: "Do you have an IELTS score?",
      choices: [],
      programmes: [],
      profile: {
        language: "en",
        interest: "medicine",
        budget: 5000,
        currency: "QAR",
      },
    },
  ]);

  await page.goto("/");
  const sidebar = page.getByRole("complementary");
  await expect(sidebar.getByText("—", { exact: true })).toHaveCount(4); // nothing known yet

  await page.getByRole("button", { name: /Hi!/ }).click();
  await expect(sidebar.getByText("Medicine")).toBeVisible();
  await expect(sidebar.getByText("5,000 QAR")).toBeVisible();
});

test("phone: the sidebar is hidden and saved facts show as chips", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phone layout only");
  await mockChatApi(page, [
    {
      language: "en",
      text: "What is your budget, and in which currency?",
      choices: [],
      programmes: [],
      profile: { language: "en", interest: "medicine" },
    },
  ]);

  await page.goto("/");
  await expect(page.getByRole("complementary")).toBeHidden();
  await page.getByRole("button", { name: /Hi!/ }).click();
  await expect(page.getByText("🎯 Medicine")).toBeVisible();
});
