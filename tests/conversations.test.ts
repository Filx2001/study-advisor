import { describe, it, expect } from "vitest";
import { converse, reply, step, call } from "./helpers/mock";
import { missingFactReply } from "../lib/fallback";
import { MAX_CHOICES, MAX_CHOICE_LENGTH } from "../lib/guards";
import type { ChatResponse, Profile } from "../lib/types";

function expectButtonRules(replies: ChatResponse[]) {
  for (const r of replies) {
    expect(r.choices.length).toBeLessThanOrEqual(MAX_CHOICES);
    for (const c of r.choices)
      expect([...c].length).toBeLessThanOrEqual(MAX_CHOICE_LENGTH);
  }
}

describe("full conversations (scripted model, real pipeline)", () => {
  it("English: asks one fact at a time, then recommends", async () => {
    const { replies, profile } = await converse([
      {
        say: "Hi",
        model: [
          reply("Hi! Which field interests you most?", [
            "Computing",
            "Business",
            "Medicine",
          ]),
        ],
      },
      {
        say: "Medicine",
        model: [
          step([call("saveFact", { interest: "medicine" })]),
          reply("What is your budget, and in which currency?", [
            "Under 5,000 QAR",
            "No limit",
          ]),
        ],
      },
      {
        say: "Under 5,000 QAR",
        model: [
          step([call("saveFact", { budget: 5000, currency: "QAR" })]),
          reply("Do you have an IELTS score?", ["No IELTS", "IELTS 6.5"]),
        ],
      },
      {
        say: "No IELTS",
        model: [
          step([call("saveFact", { noIelts: true })]),
          step([
            call("searchCatalog", {
              field: "medicine",
              maxBudget: 5000,
              budgetCurrency: "QAR",
              noIelts: true,
            }),
          ]),
          reply("This programme fits you well.", ["Thanks!"], ["P08"]),
        ],
      },
    ]);

    expect(replies.map((r) => r.language)).toEqual(["en", "en", "en", "en"]);
    // No recommendations while facts are missing.
    expect(replies.slice(0, 3).every((r) => r.programmes.length === 0)).toBe(
      true,
    );
    // "My Preferences" fills in turn by turn.
    expect(replies[1].profile.interest).toBe("medicine");
    expect(replies[2].profile).toMatchObject({ budget: 5000, currency: "QAR" });
    expect(profile).toMatchObject({
      interest: "medicine",
      budget: 5000,
      currency: "QAR",
      ielts: "none",
    });
    // Then a real catalog programme.
    expect(replies[3].programmes.map((p) => p.name)).toEqual([
      "Pre-Med Biology Bootcamp",
    ]);
    expectButtonRules(replies);
  });

  it("Arabic: the whole conversation and the card are in Arabic", async () => {
    const { replies } = await converse([
      {
        say: "مرحبا",
        model: [reply("أهلاً! ما المجال الذي يهمك أكثر؟", ["الحوسبة", "الطب"])],
      },
      {
        say: "أحب الطب",
        model: [
          step([call("saveFact", { interest: "medicine" })]),
          reply("ما ميزانيتك، وبأي عملة؟", ["أقل من 5000 ريال"]),
        ],
      },
      {
        say: "ميزانيتي 3000 ريال",
        model: [
          step([call("saveFact", { budget: 3000, currency: "QAR" })]),
          reply("هل لديك درجة آيلتس؟", ["ليس لدي آيلتس"]),
        ],
      },
      {
        say: "ليس لدي آيلتس",
        model: [
          step([call("saveFact", { noIelts: true })]),
          step([
            call("searchCatalog", {
              field: "medicine",
              maxBudget: 3000,
              budgetCurrency: "QAR",
              noIelts: true,
            }),
          ]),
          reply("هذا البرنامج مناسب لك.", ["شكرًا"], ["P08"]),
        ],
      },
    ]);

    expect(replies.every((r) => r.language === "ar")).toBe(true);
    expect(
      replies.every((r) => r.choices.every((c) => /[\u0600-\u06FF]/.test(c))),
    ).toBe(true);
    expect(replies[3].programmes[0]).toMatchObject({
      id: "P08",
      name: "معسكر الأحياء التحضيري للطب",
    });
    expectButtonRules(replies);
  });

  it("switches language when the student does, and keeps what it learned", async () => {
    const { replies, mocks } = await converse([
      {
        say: "Hi",
        model: [reply("Which field interests you most?", ["Medicine"])],
      },
      {
        say: "أحب الطب",
        model: [
          step([call("saveFact", { interest: "medicine" })]),
          reply("ما ميزانيتك، وبأي عملة؟", ["أقل من 5000 ريال"]),
        ],
      },
      {
        say: "Actually, my budget is 5000 QAR",
        model: [
          step([call("saveFact", { budget: 5000, currency: "QAR" })]),
          reply("Do you have an IELTS score?", ["No IELTS"]),
        ],
      },
    ]);

    expect(replies.map((r) => r.language)).toEqual(["en", "ar", "en"]);
    // The server told the model which language to use on each turn.
    expect(JSON.stringify(mocks[1].doGenerateCalls[0])).toContain(
      "Arabic (Modern Standard Arabic)",
    );
    expect(JSON.stringify(mocks[2].doGenerateCalls[0])).toContain(
      "every choice in English",
    );
    // Facts survive the language switch.
    expect(replies[2].profile).toMatchObject({
      interest: "medicine",
      budget: 5000,
      currency: "QAR",
    });
  });

  it("does not recommend before it knows enough, even if the model tries", async () => {
    const { replies } = await converse([
      {
        say: "Just recommend me something good",
        model: [
          step([call("searchCatalog", {})]),
          reply("Here are some great programmes!", [], ["P01", "P05"]),
        ],
      },
    ]);
    expect(replies[0]).toEqual(missingFactReply({ language: "en" }));
  });

  it("'Give me 10 options' still gets at most 3 buttons and 3 cards", async () => {
    const start: Profile = {
      language: "en",
      interest: "medicine",
      budget: "none",
      currency: "QAR",
      ielts: 7,
    };
    const tenIds = [
      "P01",
      "P02",
      "P03",
      "P04",
      "P05",
      "P06",
      "P07",
      "P08",
      "P09",
      "P10",
    ];
    const { replies } = await converse(
      [
        {
          say: "Give me 10 options",
          model: [
            step([call("searchCatalog", {})]),
            reply(
              "Here you go.",
              ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
              tenIds,
            ),
          ],
        },
      ],
      start,
    );
    expect(replies[0].choices).toHaveLength(3);
    expect(replies[0].programmes).toHaveLength(3);
  });

  it("a tiny budget still gets the closest real programmes, even if the model forgets to attach them", async () => {
    const start: Profile = {
      language: "en",
      interest: "medicine",
      budget: 100,
      currency: "QAR",
      ielts: "none",
    };
    const { replies } = await converse(
      [
        {
          say: "What can I afford?",
          model: [
            step([
              call("searchCatalog", {
                field: "medicine",
                maxBudget: 100,
                budgetCurrency: "QAR",
                noIelts: true,
              }),
            ]),
            reply("Nothing fits exactly; these are the closest options."),
          ],
        },
      ],
      start,
    );
    // Ranked by how badly each one misses: free (other field), cheap (other field), then medicine over budget.
    expect(replies[0].programmes.map((p) => p.id)).toEqual([
      "P04",
      "P11",
      "P08",
    ]);
  });
});
