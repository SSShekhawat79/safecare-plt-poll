import Anthropic from "@anthropic-ai/sdk";
import { SESSION, QUESTIONS } from "../../lib/questions.mjs";
import { db, getState, tally, checkPin, json } from "../../lib/store.mjs";

const MODEL = "claude-sonnet-5-5";

const SYSTEM = `You are an experienced UK primary care educator helping a GP facilitator run a Protected Learning Time (PLT) session.
You analyse anonymous live poll results from the audience (GPs, nurses, pharmacists, practice staff) and write a short summary that is projected on screen.
Rules:
- Write in plain UK English for a clinical audience. No markdown symbols such as # or **. Use short lines; start bullet points with "• ".
- Be accurate about the numbers given. Do not invent figures. Mention how many people responded.
- For knowledge questions, say what proportion got it right, address the most common misconception, and give the correct teaching point in one line.
- For opinion, rating and free-text questions, pick out the main themes and anything worth discussing as a group.
- Never repeat anything that could identify a patient or a colleague; if a response contains such detail, ignore it.
- Keep it brief enough to read on one slide.`;

function describe(q, t) {
  const lines = [`Question (${q.type}): ${q.text}`, `Responses: ${t.n}`];
  if (q.type === "mcq") {
    q.options.forEach((o, i) => {
      const pct = t.n ? Math.round((t.counts[i] / t.n) * 100) : 0;
      lines.push(`- ${o}: ${t.counts[i]} (${pct}%)${q.correct === i ? "  <- correct answer" : ""}`);
    });
    if (q.correct === undefined) lines.push("(Opinion poll: no correct answer.)");
  } else if (q.type === "rating") {
    lines.push(`Scale 1 (${q.labels?.[0] || "low"}) to 5 (${q.labels?.[1] || "high"}). Mean: ${t.mean ?? "n/a"}`);
    t.counts.forEach((c, i) => lines.push(`- ${i + 1}: ${c}`));
  } else if (q.type === "wordcloud") {
    t.words.forEach(([w, c]) => lines.push(`- "${w}": ${c}`));
  } else {
    t.responses.forEach((r) => lines.push(`- "${r}"`));
  }
  return lines.join("\n");
}

export default async (req) => {
  const err = checkPin(req);
  if (err) return json({ error: err }, 401);
  if (!process.env.ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_API_KEY) {
    return json({ error: "AI Gateway is not active yet on this site (it needs one production deploy on a credit-based plan)." }, 503);
  }
  let body;
  try { body = await req.json(); } catch { body = {}; }
  const s = await getState();
  const scope = body?.qid || QUESTIONS[s.index].id;

  let prompt, maxTokens;
  if (scope === "_all") {
    const blocks = await Promise.all(QUESTIONS.map(async (q, i) => `Q${i + 1}. ${describe(q, await tally(s.sessionId, q))}`));
    prompt = `Session: ${SESSION.title}\n\nAll poll results:\n\n${blocks.join("\n\n")}\n\n` +
      `Write an end-of-session summary with these short sections, each with a heading line in capitals:\n` +
      `KEY FINDINGS, KNOWLEDGE GAPS, CONFIDENCE (compare any before/after ratings), THEMES FROM THE ROOM, SUGGESTED ACTIONS FOR PRACTICES, IDEAS FOR FUTURE PLT TOPICS.\n` +
      `Keep it under 300 words in total.`;
    maxTokens = 1200;
  } else {
    const q = QUESTIONS.find((x) => x.id === scope);
    if (!q) return json({ error: "No such question." }, 404);
    const t = await tally(s.sessionId, q);
    if (!t.n) return json({ error: "No responses yet to analyse." }, 400);
    prompt = `Session: ${SESSION.title}\n\n${describe(q, t)}\n\nSummarise these results for the room in under 90 words.`;
    maxTokens = 500;
  }

  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
    const summary = { text, at: new Date().toISOString() };
    await db().setJSON(`summary/${s.sessionId}/${scope}`, summary);
    return json({ ok: true, summary });
  } catch (e) {
    console.error("analyse failed", e);
    return json({ error: "The AI summary could not be generated: " + (e?.message || e) }, 502);
  }
};

export const config = { path: "/api/analyse", method: "POST" };
