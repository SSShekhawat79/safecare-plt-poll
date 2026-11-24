import { QUESTIONS } from "../../lib/questions.mjs";
import { getState, setState, checkPin, json, newSessionId } from "../../lib/store.mjs";

// Presenter only: move between questions, open/close voting, reveal answers, reset.
export default async (req) => {
  const err = checkPin(req);
  if (err) return json({ error: err }, 401);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const s = await getState();
  switch (body?.action) {
    case "check":
      return json({ ok: true, state: s });
    case "goto": {
      const i = Number(body.index);
      if (!Number.isInteger(i) || i < 0 || i >= QUESTIONS.length) return json({ error: "No such question." }, 400);
      s.index = i; s.open = true; s.revealed = false;
      break;
    }
    case "open": s.open = true; break;
    case "close": s.open = false; break;
    case "reveal": s.revealed = true; s.open = false; break;
    case "hide": s.revealed = false; break;
    case "reset":
      s.sessionId = newSessionId(); s.index = 0; s.open = true; s.revealed = false;
      break;
    default:
      return json({ error: "Unknown action." }, 400);
  }
  await setState(s);
  return json({ ok: true, state: s });
};

export const config = { path: "/api/control", method: "POST" };
