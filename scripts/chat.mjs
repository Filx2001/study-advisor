// Dev helper: chat with the API from the terminal. Run: node scripts/chat.mjs
import readline from "node:readline/promises";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const messages = [];
let profile = { language: "en" };

console.log('Chat with the study advisor. Type "exit" to quit.');
while (true) {
  const text = await rl.question("\nYou: ");
  if (text.trim() === "exit") break;

  messages.push({ role: "user", content: text });
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, profile }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.log("Error:", data);
    messages.pop();
    continue;
  }

  profile = data.profile;
  messages.push({ role: "assistant", content: data.text });
  console.log("\nBot:", data.text);
  if (data.choices.length)
    console.log("Buttons:", data.choices.map((c) => `[${c}]`).join(" "));
  for (const p of data.programmes) {
    console.log(
      `  • ${p.name}: ${p.host}, ${p.country}, ${p.weeks} wk, ${p.fee} ${p.currency}${p.scholarship ? ", scholarship" : ""}`,
    );
  }
  console.log("Profile:", JSON.stringify(profile));
}
rl.close();
