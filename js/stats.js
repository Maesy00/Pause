/*
 * stats.js — statistiques sur les envies, dessinées en SVG fait main
 * (pas de librairie externe) : quand, pourquoi, ce qui marche, par semaine.
 */

const Stats = (() => {
  // Barres verticales simples ; values = [{ label, value, highlight }].
  function columns(values, { height = 96, showLabels = (i) => true } = {}) {
    const max = Math.max(1, ...values.map((v) => v.value));
    const width = 300;
    const gap = values.length > 12 ? 2 : 6;
    const barWidth = (width - gap * (values.length - 1)) / values.length;
    const bars = values
      .map((v, i) => {
        const h = v.value === 0 ? 2 : Math.max(4, (v.value / max) * height);
        const x = i * (barWidth + gap);
        return `<rect x="${x.toFixed(1)}" y="${(height - h).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, barWidth / 2).toFixed(1)}" class="${v.value === 0 ? "bar-empty" : v.highlight ? "bar-strong" : "bar"}"><title>${escapeHtml(v.title || v.label)} : ${v.value}</title></rect>`;
      })
      .join("");
    const labels = values
      .map((v, i) => (showLabels(i) ? `<text x="${(i * (barWidth + gap) + barWidth / 2).toFixed(1)}" y="${height + 16}" text-anchor="middle">${escapeHtml(v.label)}</text>` : ""))
      .join("");
    return `<svg class="chart" viewBox="0 0 ${width} ${height + 20}" role="img" preserveAspectRatio="none">${bars}${labels}</svg>`;
  }

  // Barres horizontales avec libellé et valeur.
  // absolute : la largeur est le ratio lui-même (un taux), pas relative au plus grand.
  function rows(items, { absolute = false } = {}) {
    const max = absolute ? 1 : Math.max(...items.map((i) => i.ratio), 0.0001);
    return `<ul class="hbars">${items
      .map(
        (item) => `
        <li>
          <div class="hbar-head"><span class="hbar-label">${escapeHtml(item.label)}</span><span class="hbar-value tabular">${escapeHtml(item.value)}</span></div>
          <div class="hbar-track"><span class="hbar-fill${item.category ? ` fill-${item.category}` : ""}" style="width:${Math.round((item.ratio / max) * 100)}%"></span></div>
        </li>`
      )
      .join("")}</ul>`;
  }

  function byHour(cravings) {
    const counts = Array(24).fill(0);
    cravings.forEach((c) => (counts[new Date(c.createdAt).getHours()] += 1));
    const peak = Math.max(...counts);
    return columns(
      counts.map((value, hour) => ({ label: `${hour}h`, title: `${hour}h – ${hour + 1}h`, value, highlight: value === peak && peak > 0 })),
      { showLabels: (i) => i % 6 === 0 }
    );
  }

  function byNeed(cravings) {
    const total = cravings.length;
    return rows(
      NEEDS.map((need) => {
        const count = cravings.filter((c) => c.need === need.id).length;
        const label = need.short.charAt(0).toUpperCase() + need.short.slice(1);
        return { label, value: `${count} · ${Math.round((count / total) * 100)} %`, ratio: count / total };
      }).sort((a, b) => b.ratio - a.ratio)
    );
  }

  function whatWorks(cravings) {
    const answered = cravings.filter((c) => c.outcome && c.suggestion);
    if (answered.length === 0) return `<p class="muted">Réponds à « C'est passé ? » après une envie pour voir ce qui marche le mieux pour toi.</p>`;
    const bySuggestion = {};
    answered.forEach((c) => {
      bySuggestion[c.suggestion] = bySuggestion[c.suggestion] || { passed: 0, total: 0 };
      bySuggestion[c.suggestion].total += 1;
      if (c.outcome === "passed") bySuggestion[c.suggestion].passed += 1;
    });
    return rows(
      Object.entries(bySuggestion)
        .map(([name, s]) => ({
          label: name,
          value: `${Math.round((s.passed / s.total) * 100)} % · ${s.passed}/${s.total}`,
          ratio: s.passed / s.total,
          rate: s.passed / s.total,
          total: s.total,
          category: Activities.categoryOf(name),
        }))
        .sort((a, b) => b.rate - a.rate || b.total - a.total),
      { absolute: true }
    );
  }

  function byWeek(cravings) {
    const current = DateUtil.weekStart(DateUtil.today());
    const weeks = Array.from({ length: 8 }, (_, i) => DateUtil.addDays(current, (i - 7) * 7));
    const counts = weeks.map((start) => cravings.filter((c) => DateUtil.weekStart(DateUtil.toKey(new Date(c.createdAt))) === start).length);
    return columns(
      weeks.map((start, i) => ({
        label: i === 7 ? "Cette sem." : DateUtil.format(start, { day: "numeric", month: "numeric" }),
        title: `Semaine du ${DateUtil.short(start)}`,
        value: counts[i],
        highlight: i === 7,
      })),
      { showLabels: (i) => i % 2 === 1 }
    );
  }

  return { byHour, byNeed, whatWorks, byWeek };
})();
