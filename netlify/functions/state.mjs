import { SESSION, QUESTIONS, publicQuestion } from "../../lib/questions.mjs";
import { getState, json } from "../../lib/store.mjs";

// Public: what the voters' phones need to show.
export default async () => {
  const s = await getState();
  const q = QUESTIONS[s.index];
  return json({
    title: SESSION.title,
    subtitle: SESSION.subtitle,
    sessionId: s.sessionId,
    index: s.index,
    total: QUESTIONS.length,
    open: s.open,
    revealed: s.revealed,
    question: publicQuestion(q, s.revealed),
  });
};

export const config = { path: "/api/state", method: "GET" };
