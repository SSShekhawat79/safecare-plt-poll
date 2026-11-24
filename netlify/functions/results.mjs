import { QUESTIONS, publicQuestion } from "../../lib/questions.mjs";
import { db, getState, tally, checkPin, json } from "../../lib/store.mjs";

// Presenter only: live tallies for the current question (or ?q=<id>).
export default async (req) => {
  const err = checkPin(req);
  if (err) return json({ error: err }, 401);
  const s = await getState();
  const qid = new URL(req.url).searchParams.get("q");
  const q = qid ? QUESTIONS.find((x) => x.id === qid) : QUESTIONS[s.index];
  if (!q) return json({ error: "No such question." }, 404);
  const [t, summary] = await Promise.all([
    tally(s.sessionId, q),
    db().get(`summary/${s.sessionId}/${q.id}`, { type: "json" }),
  ]);
  return json({ state: s, question: publicQuestion(q, s.revealed), correct: q.correct, tally: t, summary });
};

export const config = { path: "/api/results", method: "GET" };
