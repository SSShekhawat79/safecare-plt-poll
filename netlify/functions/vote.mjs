import { QUESTIONS } from "../../lib/questions.mjs";
import { db, getState, json } from "../../lib/store.mjs";

// Simple guard against patient-identifiable details in typed answers.
const PII_PATTERNS = [
  /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/, // NHS-number-like 10 digits
  /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/, // dates (e.g. DOB)
  /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i, // UK postcode
  /\b(mr|mrs|ms|miss)\.?\s+[a-z]+/i, // titled names
  /\bpatient\s+called\b/i,
];

export default async (req) => {
  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const { qid, voterId, answer } = body || {};
  if (typeof voterId !== "string" || !/^[a-z0-9-]{8,64}$/i.test(voterId)) return json({ error: "Invalid device id." }, 400);

  const s = await getState();
  const q = QUESTIONS[s.index];
  if (!q || q.id !== qid) return json({ error: "This question has moved on — please refresh." }, 409);
  if (!s.open) return json({ error: "Voting is closed for this question." }, 403);

  let a;
  if (q.type === "mcq") {
    if (!Number.isInteger(answer) || answer < 0 || answer >= q.options.length) return json({ error: "Please choose an option." }, 400);
    a = answer;
  } else if (q.type === "rating") {
    if (!Number.isInteger(answer) || answer < 1 || answer > 5) return json({ error: "Please choose 1 to 5." }, 400);
    a = answer;
  } else {
    const max = q.type === "wordcloud" ? 30 : 280;
    a = String(answer ?? "").replace(/\s+/g, " ").trim();
    if (!a) return json({ error: "Please type an answer." }, 400);
    if (a.length > max) return json({ error: `Please keep it under ${max} characters.` }, 400);
    if (q.type === "wordcloud" && a.split(" ").length > 3) return json({ error: "One or two words, please." }, 400);
    if (PII_PATTERNS.some((p) => p.test(a))) {
      return json({ error: "That looks like it might identify a patient. Please remove names, dates, NHS numbers or postcodes." }, 400);
    }
  }

  await db().setJSON(`votes/${s.sessionId}/${q.id}/${voterId}`, { a, t: Date.now() });
  return json({ ok: true });
};

export const config = { path: "/api/vote", method: "POST" };
