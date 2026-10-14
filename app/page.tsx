"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ChatResponse,
  Field,
  Language,
  Profile,
  ProgrammeCard,
} from "@/lib/types";

type Message = {
  role: "user" | "assistant";
  content: string;
  language: Language;
  time?: string;
  choices?: string[];
  programmes?: ProgrammeCard[];
};

const GREETING: Message = {
  role: "assistant",
  content:
    "Hi there! 👋 I'm your Study Advisor. I'll help you find a summer programme that fits your interests, budget and English level.\nأهلاً! سأساعدك في اختيار برنامج صيفي. يمكنك الكتابة بالعربية أو الإنجليزية.",
  language: "en",
  choices: ["Hi!", "مرحبا"],
};

// Buttons of the server's fallback reply are handled here instead of being sent to the model.
const RESTART = new Set(["Start over", "ابدأ من جديد"]);
const RETRY = new Set(["Try again", "حاول مرة أخرى"]);

const looksArabic = (text: string): Language =>
  /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
const now = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const FIELDS: Record<
  Field,
  { emoji: string; en: string; ar: string; banner: string }
> = {
  computing: {
    emoji: "💻",
    en: "Computing",
    ar: "الحوسبة",
    banner: "from-sky-400 to-indigo-600",
  },
  engineering: {
    emoji: "⚙️",
    en: "Engineering",
    ar: "الهندسة",
    banner: "from-slate-400 to-slate-700",
  },
  medicine: {
    emoji: "🩺",
    en: "Medicine",
    ar: "الطب",
    banner: "from-rose-400 to-red-600",
  },
  humanities: {
    emoji: "📚",
    en: "Humanities",
    ar: "العلوم الإنسانية",
    banner: "from-amber-400 to-orange-600",
  },
  business: {
    emoji: "📈",
    en: "Business",
    ar: "الأعمال",
    banner: "from-emerald-400 to-teal-600",
  },
  design: {
    emoji: "🎨",
    en: "Design",
    ar: "التصميم",
    banner: "from-fuchsia-400 to-purple-600",
  },
  law: {
    emoji: "⚖️",
    en: "Law",
    ar: "القانون",
    banner: "from-yellow-400 to-amber-700",
  },
  science: {
    emoji: "🔬",
    en: "Science",
    ar: "العلوم",
    banner: "from-lime-400 to-green-600",
  },
};

const COUNTRIES_AR: Record<string, string> = {
  UK: "المملكة المتحدة",
  Germany: "ألمانيا",
  Ireland: "أيرلندا",
  Qatar: "قطر",
  USA: "الولايات المتحدة",
  Malaysia: "ماليزيا",
  Netherlands: "هولندا",
  Canada: "كندا",
  Norway: "النرويج",
};

// A decorative icon for a choice button (display only; the label sent is unchanged).
function choiceIcon(choice: string): string {
  const lower = choice.toLowerCase();
  if (/^(hi|hello|hey|مرحب|أهلا|اهلا|السلام)/i.test(choice)) return "👋";
  for (const [key, f] of Object.entries(FIELDS)) {
    if (lower.includes(key) || choice.includes(f.ar)) return f.emoji;
  }
  if (/ielts|english|آيلتس|ايلتس|إنجليز|انجليز/i.test(choice)) return "🗣️";
  if (/scholar|منحة|منح/i.test(choice)) return "🏅";
  if (/\d|budget|limit|qar|usd|eur|gbp|ميزان|ريال|حد/i.test(choice))
    return "💰";
  return "";
}

function profileRows(profile: Profile) {
  const budget =
    profile.budget === "none"
      ? "No limit"
      : profile.budget !== undefined
        ? `${profile.budget.toLocaleString()} ${profile.currency ?? ""}`.trim()
        : undefined;
  const english =
    profile.ielts === "none"
      ? "No IELTS"
      : profile.ielts !== undefined
        ? `IELTS ${profile.ielts}`
        : undefined;
  const scholarship =
    profile.wantsScholarship === undefined
      ? undefined
      : profile.wantsScholarship
        ? "Wanted"
        : "Not needed";

  return [
    {
      icon: "🎯",
      label: "Interest",
      value: profile.interest ? FIELDS[profile.interest].en : undefined,
    },
    { icon: "💰", label: "Budget", value: budget },
    { icon: "🗣️", label: "English", value: english },
    { icon: "🏅", label: "Scholarship", value: scholarship },
  ];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [profile, setProfile] = useState<Profile>({ language: "en" });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function restart() {
    setMessages([GREETING]);
    setProfile({ language: "en" });
    setInput("");
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    if (RESTART.has(content)) return restart();

    // "Try again": resend the last student message, dropping the failed reply.
    let base: Message[];
    if (RETRY.has(content)) {
      const lastUser = messages.map((m) => m.role).lastIndexOf("user");
      if (lastUser === -1) return;
      base = messages.slice(0, lastUser + 1);
    } else {
      base = [
        ...messages,
        { role: "user", content, language: looksArabic(content), time: now() },
      ];
    }

    setMessages(base);
    setInput("");
    setLoading(true);

    try {
      const history = base
        .filter((m) => m !== GREETING)
        .map(({ role, content }) => ({ role, content }))
        .slice(-40);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, profile }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: ChatResponse = await res.json();
      setProfile(data.profile);
      setMessages([
        ...base,
        {
          role: "assistant",
          content: data.text,
          language: data.language,
          time: now(),
          choices: data.choices,
          programmes: data.programmes,
        },
      ]);
    } catch {
      const ar = profile.language === "ar";
      setMessages([
        ...base,
        {
          role: "assistant",
          content: ar
            ? "تعذّر الاتصال بالخادم. حاول مرة أخرى."
            : "Couldn't reach the server. Please try again.",
          language: profile.language,
          time: now(),
          choices: ar ? ["حاول مرة أخرى"] : ["Try again"],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-dvh bg-linear-to-br from-indigo-100 via-slate-50 to-sky-100 lg:p-4">
      <div className="mx-auto flex h-full max-w-[1500px] overflow-hidden bg-white/70 backdrop-blur lg:rounded-3xl lg:shadow-xl lg:ring-1 lg:ring-white">
        <Sidebar profile={profile} />

        <main className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/60 px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <span className="text-2xl lg:hidden">🎓</span>
              <span className="hidden text-xl lg:inline">✨</span>
              <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                Your AI Study Advisor
              </h1>
              <span className="hidden items-center gap-1.5 text-sm text-slate-500 sm:flex">
                <span className="h-2 w-2 rounded-full bg-green-500" /> Online
              </span>
            </div>
            <button
              onClick={restart}
              aria-label="New chat"
              className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:px-4"
            >
              <span className="text-lg leading-none">⊕</span>
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </header>

          {/* Saved facts as chips on small screens (the sidebar is hidden there) */}
          <MobileProfile profile={profile} />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-6 sm:px-6">
            <div className="mx-auto max-w-5xl space-y-6">
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                const dir = m.language === "ar" ? "rtl" : "ltr";

                if (m.role === "user") {
                  return (
                    <div
                      key={i}
                      className="flex items-start justify-end gap-2 sm:gap-3"
                    >
                      <div className="flex max-w-[85%] flex-col items-end gap-1 sm:max-w-[75%]">
                        <Bubble
                          text={m.content}
                          className="rounded-tr-md bg-linear-to-br from-blue-500 to-blue-600 text-white"
                        />
                        {m.time && (
                          <span className="text-xs text-slate-400">
                            {m.time}
                          </span>
                        )}
                      </div>
                      <Avatar />
                    </div>
                  );
                }

                return (
                  <div key={i} className="flex items-start gap-2 sm:gap-3">
                    <Avatar bot />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Bubble
                        text={m.content}
                        className="max-w-full self-start rounded-tl-md bg-indigo-50/90 text-slate-800 ring-1 ring-indigo-100 sm:max-w-[85%]"
                      />
                      {m.time && (
                        <span className="text-xs text-slate-400">{m.time}</span>
                      )}

                      {m.programmes && m.programmes.length > 0 && (
                        <div
                          dir={dir}
                          className="grid gap-3 pt-1 sm:grid-cols-2 xl:grid-cols-3"
                        >
                          {m.programmes.map((p) => (
                            <ProgrammeCardView
                              key={p.id}
                              p={p}
                              lang={m.language}
                            />
                          ))}
                        </div>
                      )}

                      {/* Only the latest message offers buttons, so old choices can't be tapped. */}
                      {isLast && m.choices && m.choices.length > 0 && (
                        <div dir={dir} className="flex flex-wrap gap-2 pt-1">
                          {m.choices.map((c) => {
                            const icon = choiceIcon(c);
                            return (
                              <button
                                key={c}
                                disabled={loading}
                                onClick={() => send(c)}
                                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:text-blue-700 disabled:opacity-50 sm:text-base"
                              >
                                {icon && <span>{icon}</span>}
                                <span dir="auto">{c}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex items-start gap-2 sm:gap-3">
                  <Avatar bot />
                  <div className="flex gap-1 rounded-2xl rounded-tl-md bg-indigo-50/90 px-4 py-4 ring-1 ring-indigo-100">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="h-2 w-2 animate-bounce rounded-full bg-indigo-300"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="px-3 pb-3 pt-2 sm:px-6 sm:pb-6"
          >
            <div className="mx-auto flex max-w-5xl items-center gap-2 rounded-full bg-white py-2 pe-2 ps-5 shadow-md ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-400">
              <input
                dir="auto"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={500}
                placeholder="Type your message here… اكتب رسالتك"
                className="min-w-0 flex-1 bg-transparent py-2 text-base text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={loading || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:bg-blue-300"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22 11 13 2 9 22 2z" />
                </svg>
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ profile }: { profile: Profile }) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-6 overflow-y-auto border-r border-slate-200/70 bg-linear-to-b from-indigo-50/80 to-white/60 p-6 lg:flex">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <span className="text-5xl">🎓</span>
        <div>
          <p className="text-2xl font-extrabold leading-none text-slate-900">
            Study
          </p>
          <p className="text-2xl font-extrabold leading-tight text-blue-600">
            Advisor
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Find your perfect summer programme
          </p>
        </div>
      </div>

      {/* The only page: shown as the active item */}
      <span className="flex items-center gap-3 rounded-2xl bg-blue-100/80 px-4 py-3 font-medium text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm text-white">
          💬
        </span>
        Chat
      </span>

      <ProfilePanel profile={profile} />

      {/* Decorative card */}
      <div className="relative min-h-44 overflow-hidden rounded-3xl bg-linear-to-br from-indigo-100 to-sky-50 p-6">
        <p className="text-2xl font-bold leading-tight text-slate-900">
          Explore
          <br />
          Learn
          <br />
          Grow
        </p>
        <p className="mt-3 max-w-[58%] text-sm text-slate-600">
          Summer programmes around the world, in English and Arabic.
        </p>
        <span className="absolute -bottom-1 right-3 text-7xl">🧑‍🎓</span>
        <span className="absolute right-5 top-4 text-2xl">✨</span>
        <span className="absolute right-20 top-10 text-3xl">🌍</span>
      </div>

      <p className="mt-auto text-sm text-slate-500">
        🌐 English · العربية{" "}
        <span className="text-xs text-slate-400">(detected automatically)</span>
      </p>
    </aside>
  );
}

// Shows the facts the model saved with the saveFact tool, live.
function ProfilePanel({ profile }: { profile: Profile }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-semibold text-slate-900">My Preferences</h2>
      <p className="mb-3 text-xs text-slate-500">Saved as you chat</p>
      <ul className="space-y-2.5">
        {profileRows(profile).map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="text-slate-500">
              {r.icon} {r.label}
            </span>
            <span
              className={
                r.value ? "font-semibold text-slate-900" : "text-slate-300"
              }
            >
              {r.value ?? "—"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
        🔒 Recommendations come only from the official programme catalog,
        checked by the server.
      </p>
    </section>
  );
}

function MobileProfile({ profile }: { profile: Profile }) {
  const known = profileRows(profile).filter((r) => r.value);
  if (known.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-slate-200/70 bg-white/60 px-4 py-2 lg:hidden">
      {known.map((r) => (
        <span
          key={r.label}
          className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-900"
        >
          {r.icon} {r.value}
        </span>
      ))}
    </div>
  );
}

// Each line picks its own direction, so mixed English/Arabic text aligns correctly.
function Bubble({ text, className }: { text: string; className: string }) {
  return (
    <div
      className={`space-y-2 rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm sm:text-base ${className}`}
    >
      {text
        .split("\n")
        .filter((line) => line.trim())
        .map((line, i) => (
          <p key={i} dir="auto">
            {line}
          </p>
        ))}
    </div>
  );
}

function Avatar({ bot }: { bot?: boolean }) {
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg shadow-sm ring-2 ring-white sm:h-10 sm:w-10 ${
        bot ? "bg-indigo-100" : "bg-sky-100"
      }`}
    >
      {bot ? "🎓" : "🧑"}
    </div>
  );
}

function ProgrammeCardView({ p, lang }: { p: ProgrammeCard; lang: Language }) {
  const ar = lang === "ar";
  const field = FIELDS[p.field];
  const t = ar
    ? {
        week: "أسبوع",
        weeks: "أسابيع",
        free: "مجاني",
        scholarship: "منحة",
        taught: "لغة التدريس",
        english: "الإنجليزية",
        arabic: "العربية",
        noIelts: "لا يشترط آيلتس",
      }
    : {
        week: "week",
        weeks: "weeks",
        free: "Free",
        scholarship: "Scholarship",
        taught: "Taught in",
        english: "English",
        arabic: "Arabic",
        noIelts: "No IELTS needed",
      };
  const ielts =
    p.minIelts === null ? t.noIelts : `IELTS ${p.minIelts.toFixed(1)}+`;

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className={`relative flex h-28 items-center justify-center bg-linear-to-br ${field.banner}`}
      >
        <span className="text-5xl drop-shadow">{field.emoji}</span>
        <span className="absolute start-3 top-3 rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur">
          {ar ? field.ar : field.en}
        </span>
        {p.scholarship && (
          <span className="absolute end-3 top-3 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-green-700">
            🏅 {t.scholarship}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg">
          {p.name}
        </h3>
        <p className="text-sm text-slate-500">{p.host}</p>
        <ul className="mt-1 space-y-1.5 text-sm text-slate-700">
          <li>📍 {ar ? (COUNTRIES_AR[p.country] ?? p.country) : p.country}</li>
          <li>
            🗓️ {p.weeks} {p.weeks === 1 ? t.week : t.weeks}
          </li>
          <li>
            🗣️ {t.taught}: {p.teachingLanguage === "ar" ? t.arabic : t.english}{" "}
            · {ielts}
          </li>
        </ul>
        <p className="mt-auto pt-2 text-lg font-bold text-slate-900">
          {p.fee === 0 ? t.free : `${p.fee.toLocaleString()} ${p.currency}`}
        </p>
      </div>
    </div>
  );
}
