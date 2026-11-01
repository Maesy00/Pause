/*
 * home.js — onglet Accueil : le bouton « J'ai envie de scroller »,
 * les envies du jour (modifiables), la question de suivi à l'ouverture
 * suivante, et les statistiques sur les envies.
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

  function needOf(id) {
    return NEEDS.find((n) => n.id === id);
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
      message: `Tu avais besoin de <strong>${escapeHtml(needOf(pending.need).short)}</strong>${
        pending.suggestion ? ` et tu avais choisi <strong>${escapeHtml(pending.suggestion)}</strong>` : ""
      }.`,
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
    const need = needOf(craving.need);
    const row = html(`
      <button type="button" class="row row-button craving-row">
        <span class="badge badge-need badge-sm">${icon(NEED_ICONS[craving.need])}</span>
        <span class="row-label">
          ${escapeHtml(craving.suggestion || "Sans alternative")}
          <span class="row-detail tabular">${DateUtil.time(craving.createdAt)} · ${escapeHtml(need.label)}</span>
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
          <span class="scroll-button-icon" aria-hidden="true">${icon("wind")}</span>
          <span class="scroll-button-title">J'ai envie de scroller</span>
          <span class="scroll-button-subtitle">On prend une minute ensemble</span>
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
            <h4 class="card-title">Pourquoi</h4>
            ${Stats.byNeed(cravings)}
          </div>
          <div class="card">
            <h4 class="card-title">Ce qui marche</h4>
            <p class="card-caption">Part des envies passées, pour chaque alternative</p>
            ${Stats.whatWorks(cravings)}
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

  function openCravingEditor(craving, onSaved) {
    const draft = {
      need: craving.need,
      suggestion: craving.suggestion,
      outcome: craving.outcome,
      time: DateUtil.time(craving.createdAt).replace("h", ":"),
    };
    let picking = false;

    Sheet.open({
      title: "Modifier l'envie",
      leading: { label: "Annuler", onClick: (sheet) => sheet.close() },
      trailing: null,
      render(body, sheet) {
        if (picking) {
          const back = html(`<button type="button" class="link-button">${icon("chevronLeft", "icon icon-inline")} Retour</button>`);
          back.addEventListener("click", () => {
            picking = false;
            sheet.rerender();
          });
          body.appendChild(back);
          renderActivityPicker(body, {
            selected: draft.suggestion,
            onPick(activity) {
              draft.suggestion = activity.name;
              picking = false;
              sheet.rerender();
              sheet.scrollTop();
            },
          });
          return;
        }

        const form = html(`
          <form>
            <div class="list">
              <label class="row"><span class="row-label">Heure</span><input class="row-input align-right" type="time" name="time" required></label>
            </div>
            <section class="group">
              <h3 class="group-header">Besoin</h3>
              <div class="list" data-slot="needs"></div>
            </section>
            <section class="group">
              <h3 class="group-header">Alternative</h3>
              <div class="list">
                <button type="button" class="row row-button" data-action="pick">
                  ${draft.suggestion ? activityBadge(draft.suggestion, "sm") : ""}
                  <span class="row-label">${escapeHtml(draft.suggestion || "Choisir une alternative")}</span>
                  <span class="row-chevron">${icon("chevronRight")}</span>
                </button>
              </div>
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

        const needs = form.querySelector('[data-slot="needs"]');
        NEEDS.forEach((need) => {
          const row = html(`
            <button type="button" class="row row-button">
              <span class="badge badge-need badge-sm">${icon(NEED_ICONS[need.id])}</span>
              <span class="row-label">${escapeHtml(need.label)}</span>
              ${need.id === draft.need ? `<span class="row-check">${icon("check")}</span>` : ""}
            </button>
          `);
          row.addEventListener("click", () => {
            draft.need = need.id;
            sheet.rerender();
          });
          needs.appendChild(row);
        });

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

        form.querySelector('[data-action="pick"]').addEventListener("click", () => {
          picking = true;
          sheet.rerender();
          sheet.scrollTop();
        });

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const date = new Date(craving.createdAt);
          const [hours, minutes] = draft.time.split(":").map(Number);
          date.setHours(hours, minutes);
          await Storage.updateCraving(craving.id, {
            need: draft.need,
            suggestion: draft.suggestion,
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

  /* --- Le parcours « J'ai envie de scroller » --- */

  function startCraving() {
    const state = {
      pressedAt: new Date().toISOString(),
      planned: Rules.plannedNow(),
      need: null,
      suggestions: [],
      choice: null,
      group: "pour-toi",
      learning: false,
    };

    Sheet.open({
      title: "Une envie de scroller",
      leading: { label: "Annuler", onClick: (sheet) => sheet.close() },
      trailing: null,
      onClose: () => App.renderAll(),
      render(body, sheet) {
        if (!state.need) renderNeedStep(body, sheet, state);
        else renderChoiceStep(body, sheet, state);
      },
    });
  }

  // Étape 1 : l'activité prévue (s'il y en a une), puis un seul appui pour dire de quoi on a besoin.
  function renderNeedStep(body, sheet, state) {
    if (state.planned) {
      const { plan, slot } = state.planned;
      body.appendChild(html(`
        <div class="reminder">
          ${activityBadge(plan.activity)}
          <div>
            <span class="reminder-label">${slot.reminder}, tu avais prévu :</span>
            <span class="reminder-activity">${escapeHtml(plan.activity)}</span>
          </div>
        </div>
      `));
    }
    body.appendChild(html(`<p class="sheet-question">De quoi as-tu besoin ?</p>`));
    const choices = html(`<div class="need-choices"></div>`);
    NEEDS.forEach((need) => {
      const btn = html(`
        <button type="button" class="need-button">
          <span class="badge badge-need">${icon(NEED_ICONS[need.id])}</span>
          <span>${escapeHtml(need.label)}</span>
        </button>
      `);
      btn.addEventListener("click", () => {
        state.need = need.id;
        state.suggestions = Rules.suggestionsFor(need.id);
        state.choice = state.choice && state.suggestions.includes(state.choice) ? state.choice : state.suggestions[0];
        state.group = "pour-toi";
        sheet.setTitle("Et si tu essayais…");
        sheet.rerender();
        sheet.scrollTop();
      });
      choices.appendChild(btn);
    });
    body.appendChild(choices);
  }

  // Groupes d'alternatives. Le soir en semaine : seulement la détente,
  // l'apprentissage reste à un appui (« Plutôt envie d'apprendre ? »).
  function alternativeGroups(state) {
    const detente = Activities.byCategory("detente").map((a) => a.name);
    const groups = [{ id: "pour-toi", label: "Pour toi", items: state.suggestions }];
    const eveningWeekday = DateUtil.isWeekdayEvening();
    if (!eveningWeekday) groups.push({ id: "sport", label: "Sport", items: Activities.byCategory("sport").map((a) => a.name) });
    groups.push({ id: "detente", label: "Détente", items: detente });
    if (!eveningWeekday || state.learning) {
      groups.push({ id: "apprentissage", label: "Apprentissage", items: Activities.byCategory("apprentissage").map((a) => a.name) });
    }
    return groups;
  }

  // Étape 2 : l'alternative choisie en grand, toutes les autres rangées par groupe, puis « C'est parti ».
  function renderChoiceStep(body, sheet, state) {
    const need = needOf(state.need);
    const name = state.choice;
    const category = Activities.categoryOf(name);

    const needChip = html(`
      <button type="button" class="need-chip">
        ${icon(NEED_ICONS[need.id], "icon icon-inline")}
        <span>${escapeHtml(need.label)}</span>
        <span class="need-chip-change">Changer</span>
      </button>
    `);
    needChip.addEventListener("click", () => {
      state.need = null;
      sheet.setTitle("Une envie de scroller");
      sheet.rerender();
    });
    body.appendChild(needChip);

    const main = html(`
      <div class="suggestion suggestion-${category}">
        <span class="suggestion-icon">${icon(name === BREATHING ? "wind" : category)}</span>
        <span class="suggestion-kind">${name === BREATHING ? "3 minutes guidées" : CATEGORIES[category].label}</span>
        <span class="suggestion-name">${escapeHtml(name)}</span>
        <div class="suggestion-extra"></div>
      </div>
    `);
    if (name === TODO_ACTIVITY) renderTodoPreview(main.querySelector(".suggestion-extra"), { onChange: () => sheet.rerender() });
    body.appendChild(main);

    const groups = alternativeGroups(state);
    if (!groups.some((g) => g.id === state.group)) state.group = "pour-toi";
    const current = groups.find((g) => g.id === state.group);

    const section = html(`
      <section class="group">
        <h3 class="group-header">Toutes les alternatives</h3>
        <div class="chip-row" role="tablist"></div>
        <div class="list"></div>
      </section>
    `);
    const chips = section.querySelector(".chip-row");
    groups.forEach((group) => {
      const chip = html(`<button type="button" role="tab" class="chip${group.id === state.group ? " active" : ""}">${escapeHtml(group.label)}</button>`);
      chip.addEventListener("click", () => {
        state.group = group.id;
        sheet.rerender();
      });
      chips.appendChild(chip);
    });

    const list = section.querySelector(".list");
    current.items.forEach((item) => {
      const row = html(`
        <button type="button" class="row row-button${item === name ? " is-selected" : ""}">
          ${activityBadge(item, "sm")}
          <span class="row-label">${escapeHtml(item)}</span>
          ${item === name ? `<span class="row-check">${icon("check")}</span>` : ""}
        </button>
      `);
      row.addEventListener("click", () => {
        state.choice = item;
        sheet.rerender();
        sheet.scrollTop();
      });
      list.appendChild(row);
    });
    body.appendChild(section);

    if (DateUtil.isWeekdayEvening() && !state.learning) {
      const learn = html(`<button type="button" class="link-button link-centered">Plutôt envie d'apprendre ?</button>`);
      learn.addEventListener("click", () => {
        state.learning = true;
        state.group = "apprentissage";
        sheet.rerender();
      });
      body.appendChild(learn);
    }

    const footer = html(`
      <div class="sheet-footer">
        <button type="button" class="btn btn-primary btn-block">C'est parti</button>
      </div>
    `);
    const go = footer.querySelector("button");
    go.addEventListener("click", async () => {
      go.disabled = true;
      const craving = await Storage.addCraving({ need: state.need, suggestion: name, createdAt: state.pressedAt });
      if (!craving) {
        go.disabled = false;
        return;
      }
      openedCravingIds.add(craving.id);
      sheet.close();
      if (name === BREATHING) {
        Breathing.start({});
      } else {
        showToast("Bonne pause. Je te demanderai à ta prochaine visite si l'envie est passée.");
      }
    });
    body.appendChild(footer);
  }

  return { render, onReopen, promptPending };
})();
