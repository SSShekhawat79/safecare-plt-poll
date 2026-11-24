(() => {
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  let voterId = store.get("pltVoterId");
  if (!voterId) {
    voterId = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    store.set("pltVoterId", voterId);
  }

  let state = null;
  let renderedKey = "";
  let sending = false;

  const answerKey = () => `pltAns:${state.sessionId}:${state.question.id}`;
  const myAnswer = () => store.get(answerKey());

  function msg(text, cls = "") { const m = $("msg"); m.textContent = text; m.className = "note " + cls; }

  async function send(answer) {
    if (sending) return;
    sending = true;
    msg("Sending…");
    try {
      const r = await fetch("/api/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qid: state.question.id, voterId, answer }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { msg(d.error || "Something went wrong. Please try again.", "err"); return false; }
      store.set(answerKey(), answer);
      msg("✓ Answer recorded. You can change it until voting closes.", "ok");
      markSelected();
      return true;
    } catch {
      msg("No connection. Please try again.", "err");
      return false;
    } finally { sending = false; }
  }

  function markSelected() {
    const mine = myAnswer();
    document.querySelectorAll("#answers .opt").forEach((b) => {
      b.classList.toggle("selected", Number(b.dataset.v) === mine);
    });
  }

  function render() {
    const q = state.question;
    $("title").textContent = state.title;
    $("qn").textContent = `Question ${state.index + 1} of ${state.total}`;
    $("qtext").textContent = q.text;
    $("closed").classList.toggle("hidden", state.open);
    const box = $("answers");
    box.replaceChildren();
    msg("");
    const mine = myAnswer();

    if (q.type === "mcq" || q.type === "rating") {
      const wrap = document.createElement("div");
      if (q.type === "rating") wrap.className = "scale";
      const opts = q.type === "mcq" ? q.options : ["1", "2", "3", "4", "5"];
      opts.forEach((o, i) => {
        const v = q.type === "mcq" ? i : i + 1;
        const b = document.createElement("button");
        b.className = "opt";
        b.dataset.v = v;
        b.textContent = o;
        b.disabled = !state.open;
        if (state.revealed && q.correct === i) b.classList.add("correct");
        b.addEventListener("click", () => send(v));
        wrap.appendChild(b);
      });
      box.appendChild(wrap);
      if (q.type === "rating") {
        const l = document.createElement("div");
        l.className = "scale-labels";
        const a = document.createElement("span"); a.textContent = "1 · " + (q.labels?.[0] || "Low");
        const z = document.createElement("span"); z.textContent = (q.labels?.[1] || "High") + " · 5";
        l.append(a, z);
        box.appendChild(l);
      }
      markSelected();
      if (mine !== null && mine !== undefined) msg("✓ Answer recorded.", "ok");
      if (state.revealed && q.correct !== undefined) {
        msg(mine === q.correct ? "✓ You got it right!" : "The correct answer is highlighted in green.", mine === q.correct ? "ok" : "");
      }
    } else {
      const input = q.type === "wordcloud" ? document.createElement("input") : document.createElement("textarea");
      if (q.type === "wordcloud") { input.type = "text"; input.maxLength = 30; input.placeholder = "One or two words"; }
      else { input.maxLength = 280; input.placeholder = "Type your answer (max 280 characters)"; }
      input.disabled = !state.open;
      if (typeof mine === "string") input.value = mine;
      const b = document.createElement("button");
      b.className = "submit";
      b.textContent = typeof mine === "string" ? "Update answer" : "Send";
      b.disabled = !state.open;
      b.addEventListener("click", async () => { if (await send(input.value)) b.textContent = "Update answer"; });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && q.type === "wordcloud") b.click(); });
      box.append(input, b);
      if (typeof mine === "string") msg("✓ Answer recorded. You can update it until voting closes.", "ok");
    }
  }

  async function poll() {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (r.ok) {
        state = await r.json();
        const key = [state.sessionId, state.question.id, state.open, state.revealed].join("|");
        if (key !== renderedKey) { renderedKey = key; render(); }
      }
    } catch {}
    setTimeout(poll, 2000);
  }
  poll();
})();
