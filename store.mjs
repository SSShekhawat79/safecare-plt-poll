import { getStore } from "@netlify/blobs";
import { QUESTIONS } from "./questions.mjs";

export const db = () => getStore({ name: "plt-poll", consistency: "strong" });

export function newSessionId() {
  return new Date().toISOString().slice(0, 10) + "-" + Math.random().toString(36).slice(2, 8);
}

export async function getState() {
  const s = await db().get("state", { type: "json" });
  if (s && s.sessionId) return s;
  const fresh = { sessionId: newSessionId(), index: 0, open: true, revealed: false };
  await db().setJSON("state", fresh);
  return fresh;
}

export async function setState(s) {
  await db().setJSON("state", s);
  return s;
}

export function checkPin(req) {
  // A PRESENTER_PIN environment variable in Netlify overrides the default below.
  // Function code is never served to visitors, so the default stays private.
  const pin = Netlify.env.get("PRESENTER_PIN") || "321030";
  if (!pin) return "Presenter PIN is not configured on this site.";
  if ((req.headers.get("x-presenter-pin") || "") !== pin) return "Wrong presenter PIN.";
  return null;
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

const STOP = new Set(["the", "a", "an", "and", "of", "to", "it", "is", "i", "im", "very", "so", "bit", "quite"]);

export async function tally(sessionId, q) {
  const store = db();
  const prefix = `votes/${sessionId}/${q.id}/`;
  const { blobs } = await store.list({ prefix });
  const answers = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
  const n = answers.length;
  if (q.type === "mcq") {
    const counts = q.options.map(() => 0);
    answers.forEach((v) => { if (Number.isInteger(v.a) && v.a >= 0 && v.a < counts.length) counts[v.a]++; });
    return { n, counts };
  }
  if (q.type === "rating") {
    const counts = [0, 0, 0, 0, 0];
    let sum = 0;
    answers.forEach((v) => { if (v.a >= 1 && v.a <= 5) { counts[v.a - 1]++; sum += v.a; } });
    return { n, counts, mean: n ? Math.round((sum / n) * 10) / 10 : null };
  }
  if (q.type === "wordcloud") {
    const freq = {};
    answers.forEach((v) => {
      const w = String(v.a).toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, "").trim();
      if (w && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
    });
    const words = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 60);
    return { n, words };
  }
  // text
  return { n, responses: answers.sort((a, b) => a.t - b.t).map((v) => String(v.a)) };
}

export function findQuestion(id) {
  return QUESTIONS.find((q) => q.id === id);
}
