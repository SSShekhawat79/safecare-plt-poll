import { SESSION, QUESTIONS } from "../../lib/questions.mjs";
import { db, getState, tally, checkPin, json } from "../../lib/store.mjs";

// Presenter only: everything for the end-of-session report.
export default async (req) => {
  const err = checkPin(req);
  if (err) return json({ error: err }, 401);
  const s = await getState();
  const items = await Promise.all(
    QUESTIONS.map(async (q) => ({
      question: q,
      tally: await tally(s.sessionId, q),
      summary: await db().get(`summary/${s.sessionId}/${q.id}`, { type: "json" }),
    }))
  );
  const overall = await db().get(`summary/${s.sessionId}/_all`, { type: "json" });
  return json({ session: SESSION, sessionId: s.sessionId, items, overall });
};

export const config = { path: "/api/report", method: "GET" };
