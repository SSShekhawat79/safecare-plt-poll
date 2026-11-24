(() => {
  const $ = (id) => document.getElementById(id);
  let pin = sessionStorage.getItem("pltPin") || "";
  let data = null;          // last /api/results payload
  let builtKey = "";        // question currently drawn
  let dismissed = "";       // summary timestamp the presenter closed
  let overlay = null;       // { title, text, big } or { thinking }
  let busy = false;

  // ---------- helpers ----------
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  function toast(t) { const d = el("div", "toast", t); document.body.appendChild(d); setTimeout(() => d.remove(), 3000); }
  async function api(path, opts = {}) {
    const r = await fetch(path, { ...opts, headers: { "content-type": "application/json", "x-presenter-pin": pin, ...(opts.headers || {}) }, cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
    return d;
  }
  const control = (action, extra = {}) => api("/api/control", { method: "POST", body: JSON.stringify({ action, ...extra }) });

  // ---------- scale the 16:9 stage to the window ----------
  function fit() {
    const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    $("stage").style.transform = `scale(${s})`;
  }
  window.addEventListener("resize", fit); fit();

  // ---------- PIN gate ----------
  async function tryPin(p) {
    pin = p;
    try { await control("check"); sessionStorage.setItem("pltPin", p); $("gate").classList.add("hidden"); start(); return true; }
    catch (e) { $("pinErr").textContent = e.message; return false; }
  }
  $("pinForm").addEventListener("submit", (e) => { e.preventDefault(); tryPin($("pin").value.trim()); });
  if (pin) tryPin(pin);

  $("joinUrl").textContent = location.host + "/vote";

  // ---------- drawing ----------
  function drawBars(container, labels, counts, n, correct, revealed) {
    if (container.childElementCount !== labels.length) {
      container.replaceChildren();
      labels.forEach((l) => {
        const row = el("div", "bar-row");
        row.append(el("div", "lbl", l));
        const track = el("div", "bar-track"); track.append(el("div", "bar-fill")); row.append(track);
        row.append(el("div", "val"));
        container.append(row);
      });
    }
    [...container.children].forEach((row, i) => {
      const c = counts[i] || 0, pct = n ? Math.round((c / n) * 100) : 0;
      row.querySelector(".bar-fill").style.width = pct + "%";
      const v = row.querySelector(".val"); v.textContent = c; const sm = el("small", "", pct + "%"); v.append(sm);
      row.classList.toggle("correct", revealed && correct === i);
      row.classList.toggle("dim", revealed && correct !== undefined && correct !== i);
    });
  }

  function drawResults() {
    const { question: q, tally: t, state: s, correct } = data;
    const key = s.sessionId + "|" + q.id;
    const box = $("results");
    if (key !== builtKey) { builtKey = key; box.replaceChildren(); overlay = null; }

    $("qnum").textContent = `Question ${s.index + 1} of ${QUESTION_TOTAL()}`;
    $("qtext").textContent = q.text;
    $("count").textContent = t.n;
    const st = $("status");
    st.className = "pill" + (s.revealed ? " revealed" : s.open ? "" : " closed");
    st.textContent = s.revealed ? "Answer revealed" : s.open ? "Voting open" : "Voting closed";
    $("toggle").textContent = s.open ? "Close voting" : "Open voting";
    $("reveal").disabled = correct === undefined;
    $("reveal").textContent = s.revealed ? "Hide answer" : "Reveal answer";
    $("prev").disabled = s.index === 0;
    $("next").disabled = s.index >= QUESTION_TOTAL() - 1;

    let content = box.querySelector(".content");
    if (!content) { content = el("div", "content"); content.style.height = "100%"; box.append(content); }

    if (q.type === "mcq") {
      drawBars(content, q.options, t.counts, t.n, correct, s.revealed);
    } else if (q.type === "rating") {
      let mean = box.querySelector(".mean");
      if (!mean) { mean = el("div", "mean"); box.insertBefore(mean, content); }
      mean.replaceChildren(el("span", "", "Average "), el("b", "", t.mean ?? "–"), el("span", "", " / 5"));
      const labels = ["1 · " + (q.labels?.[0] || "Low"), "2", "3", "4", "5 · " + (q.labels?.[1] || "High")];
      drawBars(content, labels, t.counts, t.n);
    } else if (q.type === "wordcloud") {
      content.className = "content cloud";
      content.replaceChildren();
      if (!t.words.length) content.append(el("div", "empty", "Waiting for answers…"));
      const max = t.words[0]?.[1] || 1;
      const palette = ["#0b2545", "#0f8b8d", "#3d5170", "#1f7a4d", "#8b5e34"];
      t.words.forEach(([w, c], i) => {
        const sp = el("span", "", w);
        sp.style.fontSize = Math.round(26 + (c / max) * 70) + "px";
        sp.style.color = palette[i % palette.length];
        content.append(sp);
      });
    } else {
      content.className = "content cards";
      content.replaceChildren();
      if (!t.responses.length) { content.className = "content"; content.append(el("div", "empty", "Waiting for answers…")); }
      t.responses.slice(-30).reverse().forEach((r) => content.append(el("div", "", r)));
    }
    drawOverlay();
  }

  function drawOverlay() {
    const box = $("results");
    box.querySelector(".summary")?.remove();
    let show = overlay;
    if (!show && data?.summary && data.summary.at !== dismissed) show = { title: "AI summary", text: data.summary.text, at: data.summary.at };
    if (!show) return;
    const o = el("div", "summary" + (show.big ? " big" : ""));
    const h = el("h3"); h.append(el("span", "", show.title || "AI summary"));
    const x = el("button", "", "✕ close"); x.addEventListener("click", () => { if (show.at) dismissed = show.at; overlay = null; drawOverlay(); });
    h.append(x); o.append(h);
    o.append(show.thinking ? el("div", "thinking", "✨ Analysing responses…") : el("div", "txt", show.text));
    box.append(o);
  }

  let total = 0;
  const QUESTION_TOTAL = () => total;

  async function refresh() {
    try {
      const [d, st] = await Promise.all([api("/api/results"), fetch("/api/state", { cache: "no-store" }).then((r) => r.json())]);
      total = st.total;
      $("sTitle").firstChild.textContent = st.title;
      $("sSub").textContent = st.subtitle;
      data = d;
      drawResults();
    } catch (e) { console.warn(e); }
  }

  let timer;
  function start() { refresh(); clearInterval(timer); timer = setInterval(() => { if (!busy) refresh(); }, 2000); }

  async function act(fn) {
    if (busy) return; busy = true;
    try { await fn(); await refresh(); } catch (e) { toast(e.message); } finally { busy = false; }
  }

  // ---------- controls ----------
  $("prev").onclick = () => act(() => control("goto", { index: data.state.index - 1 }));
  $("next").onclick = () => act(() => control("goto", { index: data.state.index + 1 }));
  $("toggle").onclick = () => act(() => control(data.state.open ? "close" : "open"));
  $("reveal").onclick = () => act(() => control(data.state.revealed ? "hide" : "reveal"));
  $("analyse").onclick = () => act(async () => {
    overlay = { thinking: true, title: "AI summary" }; drawOverlay();
    try { const r = await api("/api/analyse", { method: "POST", body: JSON.stringify({ qid: data.question.id }) }); overlay = null; dismissed = ""; data.summary = r.summary; }
    catch (e) { overlay = null; throw e; }
  });
  $("analyseAll").onclick = () => act(async () => {
    overlay = { thinking: true, title: "Session summary", big: true }; drawOverlay();
    try { const r = await api("/api/analyse", { method: "POST", body: JSON.stringify({ qid: "_all" }) }); overlay = { title: "Session summary", text: r.summary.text, big: true }; }
    catch (e) { overlay = null; throw e; }
  });
  $("report").onclick = () => window.open("/report", "_blank");
  $("fs").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); };
  let resetArmed = false;
  $("reset").onclick = () => {
    if (!resetArmed) { resetArmed = true; $("reset").textContent = "Click again to confirm"; setTimeout(() => { resetArmed = false; $("reset").textContent = "New session"; }, 4000); return; }
    resetArmed = false; $("reset").textContent = "New session";
    act(() => control("reset")).then(() => toast("New session started: previous results are kept in storage but no longer shown."));
  };
  document.addEventListener("keydown", (e) => {
    if (!data || e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight" || e.key === "PageDown") $("next").click();
    if (e.key === "ArrowLeft" || e.key === "PageUp") $("prev").click();
  });

  // fade controls when idle
  let idle; const ctr = $("controls");
  const wake = () => { ctr.classList.remove("faded"); clearTimeout(idle); idle = setTimeout(() => ctr.classList.add("faded"), 4000); };
  document.addEventListener("mousemove", wake); wake();
})();
