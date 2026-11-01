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

  // Regroupe les envies par déclencheur.
  function groupByReason(cravings) {
    const groups = {};
    cravings.forEach((c) => {
      const reason = cravingReason(c);
      groups[reason.id] = groups[reason.id] || { label: reason.label, items: [] };
      groups[reason.id].items.push(c);
    });
    return Object.values(groups);
  }

  function byReason(cravings) {
    const total = cravings.length;
    return rows(
      groupByReason(cravings)
        .map((g) => ({ label: g.label, value: `${g.items.length} · ${Math.round((g.items.length / total) * 100)} %`, ratio: g.items.length / total }))
        .sort((a, b) => b.ratio - a.ratio)
    );
  }

  function passRate(cravings) {
    const answered = cravings.filter((c) => c.outcome);
    if (answered.length === 0) return `<p class="muted">Réponds à « Ta dernière envie est passée ? » pour voir quand l'envie passe le plus souvent.</p>`;
    return rows(
      groupByReason(answered)
        .map((g) => {
          const passed = g.items.filter((c) => c.outcome === "passed").length;
          return {
            label: g.label,
            value: `${Math.round((passed / g.items.length) * 100)} % · ${passed}/${g.items.length}`,
            ratio: passed / g.items.length,
            total: g.items.length,
          };
        })
        .sort((a, b) => b.ratio - a.ratio || b.total - a.total),
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

  return { byHour, byReason, passRate, byWeek };
})();
