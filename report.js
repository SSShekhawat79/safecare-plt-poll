(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  let pin = sessionStorage.getItem("pltPin") || "";
  let report = null;

  function bars(labels, counts, n, correct) {
    const wrap = el("div");
    labels.forEach((l, i) => {
      const c = counts[i] || 0, pct = n ? Math.round((c / n) * 100) : 0;
      const row = el("div", "bar-row" + (correct === i ? " correct" : ""));
      row.append(el("div", "lbl", l + (correct === i ? " ✓" : "")));
      const tr = el("div", "bar-track"), f = el("div", "bar-fill"); f.style.width = pct + "%"; tr.append(f); row.append(tr);
      const v = el("div", "val", String(c)); v.append(el("small", "", pct + "%")); row.append(v);
      wrap.append(row);
    });
    return wrap;
  }

  function render() {
    const out = $("out"); out.replaceChildren();
    $("title").textContent = report.session.title;
    $("sub").textContent = `${report.session.subtitle} · Session ${report.sessionId} · Report generated ${new Date().toLocaleString("en-GB")}`;

    const ov = el("section", "rsec overall");
    ov.append(el("h2", "", "AI session summary"));
    ov.append(report.overall ? el("div", "ai", report.overall.text) : el("div", "meta", "No session summary yet. Press “✨ Session summary” on the presenter screen to create one."));
    out.append(ov);

    report.items.forEach(({ question: q, tally: t, summary }, i) => {
      const s = el("section", "rsec");
      s.append(el("h2", "", `Q${i + 1}. ${q.text}`));
      let meta = `${t.n} response${t.n === 1 ? "" : "s"}`;
      if (q.type === "mcq" && q.correct !== undefined && t.n) meta += ` · ${Math.round((t.counts[q.correct] / t.n) * 100)}% correct`;
      if (q.type === "rating" && t.mean !== null) meta += ` · average ${t.mean} / 5`;
      s.append(el("div", "meta", meta));
      if (q.type === "mcq") s.append(bars(q.options, t.counts, t.n, q.correct));
      else if (q.type === "rating") s.append(bars(["1 · " + (q.labels?.[0] || "Low"), "2", "3", "4", "5 · " + (q.labels?.[1] || "High")], t.counts, t.n));
      else if (q.type === "wordcloud") { const ul = el("ul"); t.words.forEach(([w, c]) => ul.append(el("li", "", `${w} (${c})`))); s.append(ul); }
      else { const ul = el("ul"); t.responses.forEach((r) => ul.append(el("li", "", r))); s.append(ul); }
      if (summary) s.append(el("div", "ai", summary.text));
      out.append(s);
    });
  }

  function csvCell(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function downloadCsv() {
    const rows = [["Question no.", "Question", "Type", "Answer", "Count", "Correct answer?"]];
    report.items.forEach(({ question: q, tally: t }, i) => {
      if (q.type === "mcq") q.options.forEach((o, j) => rows.push([i + 1, q.text, q.type, o, t.counts[j], q.correct === undefined ? "" : q.correct === j ? "Yes" : "No"]));
      else if (q.type === "rating") t.counts.forEach((c, j) => rows.push([i + 1, q.text, q.type, j + 1, c, ""]));
      else if (q.type === "wordcloud") t.words.forEach(([w, c]) => rows.push([i + 1, q.text, q.type, w, c, ""]));
      else t.responses.forEach((r) => rows.push([i + 1, q.text, q.type, r, 1, ""]));
    });
    const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
    const a = el("a"); a.href = URL.createObjectURL(blob); a.download = `plt-poll-${report.sessionId}.csv`; a.click();
  }

  async function load() {
    if (!pin) { pin = prompt("Presenter PIN") || ""; }
    const r = await fetch("/api/report", { headers: { "x-presenter-pin": pin }, cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { $("out").replaceChildren(el("p", "note err", d.error || "Could not load the report.")); return; }
    sessionStorage.setItem("pltPin", pin);
    report = d; render();
  }
  $("print").onclick = () => window.print();
  $("csv").onclick = () => report && downloadCsv();
  $("reload").onclick = load;
  load();
})();
