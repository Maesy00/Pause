/*
 * home.js — onglet Accueil : le bouton « J'ai envie de scroller » (on note
 * le déclencheur), les envies du jour (modifiables), la question de suivi
 * à l'ouverture suivante, et les statistiques sur les envies.
 */

const Home = (() => {
  const panel = document.getElementById("tab-home");
  // Envies enregistrées pendant cette ouverture de l'app : on ne demande
  // « est-ce passé ? » qu'à l'ouverture suivante.
  const openedCravingIds = new Set();
  let promptedThisOpening = false;

  function onReopen() {
    openedCravingIds.clear();
    promptedThisOpening = false;
  }

  function dayOf(craving) {
    return DateUtil.toKey(new Date(craving.createdAt));
  }

  function dayLabel(key) {
    const today = DateUtil.today();
    if (key === today) return "Aujourd'hui";
    if (key === DateUtil.addDays(today, -1)) return "Hier";
    const label = DateUtil.long(key);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function formatNumber(value) {
    return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  }

  /* --- Question de suivi, à l'ouverture suivante --- */

  function pendingCraving() {
    const cravings = Storage.getCravings();
    const last = cravings[cravings.length - 1];
    if (!last || last.outcome || openedCravingIds.has(last.id)) return null;
    return last;
  }

  function promptPending() {
    if (promptedThisOpening || Sheet.isOpen() || Dialog.isOpen()) return;
    const pending = pendingCraving();
    if (!pending) return;
    promptedThisOpening = true;
    Dialog.open({
      eyebrow: `${dayLabel(dayOf(pending))} à ${DateUtil.time(pending.createdAt)}`,
      title: "Ta dernière envie est passée ?",
      message: `Tu avais noté : <strong>${escapeHtml(cravingReason(pending).short)}</strong>.`,
      actions: [
        { label: "Oui, c'est passé", style: "primary", onClick: () => answer(pending, "passed") },
        { label: "Non, j'ai scrollé", style: "secondary", onClick: () => answer(pending, "scrolled") },
        { label: "Plus tard", style: "quiet" },
      ],
    });
  }

  async function answer(craving, outcome) {
    await Storage.updateCraving(craving.id, { outcome });
    showToast(outcome === "passed" ? "Noté. Belle pause." : "Noté. C'est une info, pas un échec.");
    App.renderAll();
  }

  /* --- Affichage --- */

  // Envies du jour, et moyenne par jour sur les 30 jours précédents
  // (sur moins de jours tant que l'app a moins de 30 jours d'historique).
  function dailyStats(cravings) {
    const today = DateUtil.today();
    const todayCount = cravings.filter((c) => dayOf(c) === today).length;
    if (cravings.length === 0) return { todayCount, average: null };
    const daysOfHistory = DateUtil.daysBetween(dayOf(cravings[0]), today);
    if (daysOfHistory === 0) return { todayCount, average: null };
    const start = DateUtil.addDays(today, -30);
    const past = cravings.filter((c) => dayOf(c) >= start && dayOf(c) < today).length;
    return { todayCount, average: past / Math.min(30, daysOfHistory) };
  }

  function outcomeTag(craving) {
    if (craving.outcome === "passed") return `<span class="tag tag-passed">Passée</span>`;
    if (craving.outcome === "scrolled") return `<span class="tag tag-scrolled">Scrollé</span>`;
    return `<span class="tag tag-pending">En attente</span>`;
  }

  function cravingRow(craving, onSaved) {
    const reason = cravingReason(craving);
    const row = html(`
      <button type="button" class="row row-button craving-row">
        <span class="badge badge-need badge-sm">${icon(reason.icon)}</span>
        <span class="row-label">
          ${escapeHtml(reason.label)}
          <span class="row-detail tabular">${DateUtil.time(craving.createdAt)}</span>
        </span>
        ${outcomeTag(craving)}
      </button>
    `);
    row.addEventListener("click", () => openCravingEditor(craving, onSaved));
    return row;
  }

  function render() {
    const today = DateUtil.today();
    const cravings = Storage.getCravings();
    const todays = cravings.filter((c) => dayOf(c) === today).reverse();
    const { todayCount, average } = dailyStats(cravings);

    panel.innerHTML = `
      <header class="page-header">
        <p class="page-eyebrow">${DateUtil.long(today)}</p>
        <h1 class="large-title">Accueil</h1>
      </header>

      <section class="hero">
        <button type="button" class="scroll-button" id="scroll-button">
          <span class="orb orb-1" aria-hidden="true"></span>
          <span class="orb orb-2" aria-hidden="true"></span>
          <span class="orb orb-3" aria-hidden="true"></span>
          <span class="scroll-button-icon" aria-hidden="true">${icon("pause")}</span>
          <span class="scroll-button-title">J'ai envie de scroller</span>
          <span class="scroll-button-subtitle">Note ce qui la déclenche</span>
        </button>
      </section>

      <section class="group">
        <h3 class="group-header">Aujourd'hui</h3>
        <div class="card stat-card">
          <div class="stat-main">
            <span class="big-number gradient-text">${todayCount}</span>
            <span class="big-caption">envie${todayCount > 1 ? "s" : ""} aujourd'hui</span>
          </div>
          <div class="stat-side">
            ${average === null
              ? `<span class="stat-side-caption">La moyenne sur 30 jours apparaîtra dès demain.</span>`
              : `<span class="stat-side-value tabular">${formatNumber(average)}</span>
                 <span class="stat-side-caption">par jour en moyenne sur les 30 derniers jours</span>`}
          </div>
        </div>
        <div class="list list-spaced" id="today-cravings"></div>
        ${cravings.length ? `<button type="button" class="link-button link-centered" id="history-btn">Tout l'historique ${icon("chevronRight", "icon icon-inline")}</button>` : ""}
      </section>

      ${cravings.length ? `
        <section class="group">
          <h3 class="group-header">Tes envies</h3>
          <div class="card">
            <h4 class="card-title">Quand elles arrivent</h4>
            ${Stats.byHour(cravings)}
          </div>
          <div class="card">
            <h4 class="card-title">Ce qui les déclenche</h4>
            ${Stats.byReason(cravings)}
          </div>
          <div class="card">
            <h4 class="card-title">Quand l'envie passe</h4>
            <p class="card-caption">Part des envies passées sans scroller, selon le déclencheur</p>
            ${Stats.passRate(cravings)}
          </div>
          <div class="card">
            <h4 class="card-title">Par semaine</h4>
            ${Stats.byWeek(cravings)}
          </div>
        </section>` : ""}

      <button type="button" class="link-button link-centered link-muted" id="sign-out-btn">Se déconnecter</button>
    `;

    const list = panel.querySelector("#today-cravings");
    if (todays.length === 0) {
      list.appendChild(html(`<div class="row row-muted">Aucune envie pour l'instant aujourd'hui.</div>`));
    }
    todays.forEach((craving) => list.appendChild(cravingRow(craving)));

    panel.querySelector("#scroll-button").addEventListener("click", startCraving);
    const historyBtn = panel.querySelector("#history-btn");
    if (historyBtn) historyBtn.addEventListener("click", openHistory);
    panel.querySelector("#sign-out-btn").addEventListener("click", () => supabaseClient.auth.signOut());
  }

  /* --- Historique et modification d'une envie --- */

  function openHistory() {
    Sheet.open({
      title: "Historique des envies",
      render(body) {
        const byDay = {};
        Storage.getCravings()
          .slice()
          .reverse()
          .forEach((c) => (byDay[dayOf(c)] = byDay[dayOf(c)] || []).push(c));
        Object.entries(byDay).forEach(([day, cravings]) => {
          const group = html(`
            <section class="group">
              <h3 class="group-header">${dayLabel(day)} · ${cravings.length}</h3>
              <div class="list"></div>
            </section>
          `);
          const list = group.querySelector(".list");
          cravings.forEach((c) => list.appendChild(cravingRow(c, openHistory)));
          body.appendChild(group);
        });
      },
    });
  }

  function triggerList(selected, onPick) {
    const list = html(`<div class="list"></div>`);
    TRIGGERS.forEach((trigger) => {
      const row = html(`
        <button type="button" class="row row-button">
          <span class="badge badge-need badge-sm">${icon(trigger.icon)}</span>
          <span class="row-label">${escapeHtml(trigger.label)}</span>
          ${trigger.id === selected ? `<span class="row-check">${icon("check")}</span>` : ""}
        </button>
      `);
      row.addEventListener("click", () => onPick(trigger.id));
      list.appendChild(row);
    });
    return list;
  }

  function openCravingEditor(craving, onSaved) {
    const draft = {
      trigger: craving.trigger,
      outcome: craving.outcome,
      time: DateUtil.time(craving.createdAt).replace("h", ":"),
    };

    Sheet.open({
      title: "Modifier l'envie",
      leading: { label: "Annuler", onClick: (sheet) => sheet.close() },
      trailing: null,
      render(body, sheet) {
        const form = html(`
          <form>
            <div class="list">
              <label class="row"><span class="row-label">Heure</span><input class="row-input align-right" type="time" name="time" required></label>
            </div>
            <section class="group">
              <h3 class="group-header">Déclencheur</h3>
              <div data-slot="triggers"></div>
            </section>
            <section class="group">
              <h3 class="group-header">Est-elle passée ?</h3>
              <div data-slot="outcome"></div>
            </section>
            <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
            <button type="button" class="btn btn-quiet btn-block" data-action="delete">Supprimer cette envie</button>
          </form>
        `);
        form.elements.time.value = draft.time;
        form.elements.time.addEventListener("change", () => (draft.time = form.elements.time.value));

        form.querySelector('[data-slot="triggers"]').appendChild(
          triggerList(draft.trigger, (id) => {
            draft.trigger = id;
            sheet.rerender();
          })
        );

        form.querySelector('[data-slot="outcome"]').appendChild(
          segmented(
            [
              { value: "passed", label: "Oui" },
              { value: "scrolled", label: "J'ai scrollé" },
              { value: null, label: "En attente" },
            ],
            draft.outcome,
            (value) => {
              draft.outcome = value;
              sheet.rerender();
            }
          )
        );

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const date = new Date(craving.createdAt);
          const [hours, minutes] = draft.time.split(":").map(Number);
          date.setHours(hours, minutes);
          await Storage.updateCraving(craving.id, {
            trigger: draft.trigger,
            outcome: draft.outcome,
            createdAt: date.toISOString(),
          });
          sheet.close();
          App.renderAll();
          if (onSaved) onSaved();
        });

        form.querySelector('[data-action="delete"]').addEventListener("click", async () => {
          if (!confirm("Supprimer cette envie ? Elle ne comptera plus dans tes statistiques.")) return;
          await Storage.deleteCraving(craving.id);
          sheet.close();
          App.renderAll();
        });

        body.appendChild(form);
      },
    });
  }

  /* --- « J'ai envie de scroller » : un appui pour noter le déclencheur --- */

  function startCraving() {
    const pressedAt = new Date().toISOString();

    Sheet.open({
      title: "Une envie de scroller",
      leading: { label: "Annuler", onClick: (sheet) => sheet.close() },
      trailing: null,
      onClose: () => App.renderAll(),
      render(body, sheet) {
        body.appendChild(html(`<p class="sheet-question">Qu'est-ce qui la déclenche ?</p>`));
        const choices = html(`<div class="need-choices"></div>`);
        TRIGGERS.forEach((trigger) => {
          const btn = html(`
            <button type="button" class="need-button">
              <span class="badge badge-need">${icon(trigger.icon)}</span>
              <span>${escapeHtml(trigger.label)}</span>
            </button>
          `);
          btn.addEventListener("click", async () => {
            choices.querySelectorAll("button").forEach((b) => (b.disabled = true));
            const craving = await Storage.addCraving({ trigger: trigger.id, createdAt: pressedAt });
            if (!craving) {
              choices.querySelectorAll("button").forEach((b) => (b.disabled = false));
              return;
            }
            openedCravingIds.add(craving.id);
            sheet.close();
            showToast("C'est noté. Je te demanderai à ta prochaine visite si l'envie est passée.");
          });
          choices.appendChild(btn);
        });
        body.appendChild(choices);
      },
    });
  }

  return { render, onReopen, promptPending };
})();
