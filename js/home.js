/*
 * home.js — onglet Accueil : le bouton « J'ai envie de scroller »,
 * le suivi de la dernière envie, la ligne du défi le plus proche et
 * les statistiques sur les envies.
 */

const Home = (() => {
  const panel = document.getElementById("tab-home");
  // Envie de cette ouverture de l'app : on ne la redemande qu'à la prochaine
  // ouverture (le bouton « C'est passé » permet de répondre tout de suite).
  let activeCravingId = null;

  function onReopen() {
    activeCravingId = null;
  }

  function needOf(id) {
    return NEEDS.find((n) => n.id === id);
  }

  function pendingCraving() {
    const cravings = Storage.getCravings();
    const last = cravings[cravings.length - 1];
    if (!last || last.outcome || last.id === activeCravingId) return null;
    return last;
  }

  async function answer(craving, outcome) {
    await Storage.updateCraving(craving.id, { outcome });
    showToast(outcome === "passed" ? "Noté. Belle pause." : "Noté. C'est une info, pas un échec.");
    render();
  }

  function render() {
    const today = DateUtil.today();
    const pending = pendingCraving();
    const challenge = Rules.nearestChallengeLine();
    const cravings = Storage.getCravings();
    const weekAgo = Date.now() - 7 * 86400000;
    const lastWeek = cravings.filter((c) => new Date(c.createdAt).getTime() > weekAgo);

    panel.innerHTML = `
      <header class="page-header">
        <p class="page-eyebrow">${DateUtil.long(today)}</p>
        <h1 class="large-title">Accueil</h1>
      </header>

      ${pending ? `
        <section class="card followup">
          <p class="followup-question">Ta dernière envie (${DateUtil.time(pending.createdAt)}, ${escapeHtml(needOf(pending.need).short)}) est passée ?</p>
          <div class="followup-actions">
            <button type="button" class="btn btn-secondary" data-outcome="passed">Oui</button>
            <button type="button" class="btn btn-secondary" data-outcome="scrolled">Non, j'ai scrollé</button>
          </div>
        </section>` : ""}

      <section class="hero">
        <button type="button" class="scroll-button" id="scroll-button">
          <span class="scroll-button-glow" aria-hidden="true"></span>
          <span class="scroll-button-title">J'ai envie de scroller</span>
          <span class="scroll-button-subtitle">On prend une minute ensemble</span>
        </button>
        ${challenge ? `
          <button type="button" class="challenge-line" id="challenge-line">
            ${icon(challenge.kind === "race" ? "flag" : "sparkle", "icon icon-inline")}
            <span class="tabular">${escapeHtml(challenge.text)}</span>
          </button>` : ""}
      </section>

      <section class="group">
        <h3 class="group-header">Tes envies</h3>
        ${cravings.length === 0 ? `
          <div class="card"><p class="muted">Tes statistiques apparaîtront ici après tes premières envies. Chaque appui sur le bouton compte, quelle que soit la suite.</p></div>
        ` : `
          <div class="card">
            <div class="big-stat">
              <span class="big-number">${lastWeek.length}</span>
              <span class="big-caption">envie${lastWeek.length > 1 ? "s" : ""} ces 7 derniers jours</span>
            </div>
          </div>
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
        `}
      </section>

      <button type="button" class="link-button link-centered link-muted" id="sign-out-btn">Se déconnecter</button>
    `;

    if (pending) {
      panel.querySelectorAll("[data-outcome]").forEach((btn) =>
        btn.addEventListener("click", () => answer(pending, btn.dataset.outcome))
      );
    }
    panel.querySelector("#scroll-button").addEventListener("click", startCraving);
    const line = panel.querySelector("#challenge-line");
    if (line) line.addEventListener("click", () => App.go("challenges"));
    panel.querySelector("#sign-out-btn").addEventListener("click", () => supabaseClient.auth.signOut());
  }

  /* --- Le parcours « J'ai envie de scroller » --- */

  function startCraving() {
    const planned = Rules.plannedNow();
    const state = { craving: null, suggestions: [], current: null, learning: false };

    Sheet.open({
      title: "Une envie de scroller",
      onClose() {
        App.renderAll();
      },
      render(body, sheet) {
        if (!state.craving) renderNeedStep(body, sheet, state, planned);
        else renderSuggestionStep(body, sheet, state);
      },
    });
  }

  // Étape 1 : l'activité prévue (s'il y en a une), puis un seul appui pour dire de quoi on a besoin.
  function renderNeedStep(body, sheet, state, planned) {
    if (planned) {
      body.appendChild(html(`
        <div class="card reminder cat-${planned.plan.category}">
          <span class="reminder-label">${planned.slot.reminder}, tu avais prévu :</span>
          <span class="reminder-activity">${categoryDot(planned.plan.category)}${escapeHtml(planned.plan.activity)}</span>
        </div>
      `));
    }
    body.appendChild(html(`<p class="sheet-question">De quoi as-tu besoin ?</p>`));
    const choices = html(`<div class="need-choices"></div>`);
    NEEDS.forEach((need) => {
      const btn = html(`<button type="button" class="need-button">${escapeHtml(need.label)}</button>`);
      btn.addEventListener("click", async () => {
        choices.querySelectorAll("button").forEach((b) => (b.disabled = true));
        state.suggestions = Rules.suggestionsFor(need.id);
        state.current = state.suggestions[0];
        const craving = await Storage.addCraving({ need: need.id, suggestion: state.current });
        if (!craving) {
          choices.querySelectorAll("button").forEach((b) => (b.disabled = false));
          return;
        }
        state.craving = craving;
        activeCravingId = craving.id;
        sheet.setTitle("Et si tu essayais…");
        sheet.rerender();
      });
      choices.appendChild(btn);
    });
    body.appendChild(choices);
  }

  // Étape 2 : une alternative mise en avant, d'autres idées, puis « C'est passé ».
  function renderSuggestionStep(body, sheet, state) {
    const name = state.current;
    const category = Activities.categoryOf(name);
    const isBreathing = name === BREATHING;

    const main = html(`
      <div class="card suggestion cat-${category}">
        <span class="suggestion-kind">${isBreathing ? "3 minutes" : CATEGORIES[category].label}</span>
        <span class="suggestion-name">${escapeHtml(name)}</span>
        <div class="suggestion-extra"></div>
      </div>
    `);
    const extra = main.querySelector(".suggestion-extra");
    if (isBreathing) {
      const start = html(`<button type="button" class="btn btn-primary btn-block">${icon("wind", "icon icon-inline")} Commencer</button>`);
      start.addEventListener("click", () => {
        Breathing.start({
          onEnd(completed) {
            if (completed) showToast("Trois minutes rien que pour toi.");
          },
        });
      });
      extra.appendChild(start);
    } else if (name === TODO_ACTIVITY) {
      renderTodoPreview(extra, { onChange: () => sheet.rerender() });
    }
    body.appendChild(main);

    const others = (state.learning ? Rules.suggestionsFor(null, { learning: true }) : state.suggestions).filter((s) => s !== name);
    if (others.length) {
      const group = html(`
        <section class="group">
          <h3 class="group-header">${state.learning ? "Apprendre quelque chose" : "Autres idées"}</h3>
          <div class="list"></div>
        </section>
      `);
      const list = group.querySelector(".list");
      others.forEach((other) => {
        const row = html(`
          <button type="button" class="row row-button">
            ${categoryDot(Activities.categoryOf(other))}
            <span class="row-label">${escapeHtml(other)}</span>
          </button>
        `);
        row.addEventListener("click", async () => {
          state.current = other;
          sheet.rerender();
          await Storage.updateCraving(state.craving.id, { suggestion: other });
        });
        list.appendChild(row);
      });
      body.appendChild(group);
    }

    // Le soir en semaine, seules les activités Détente sont proposées ; l'apprentissage reste à portée.
    if (DateUtil.isWeekdayEvening()) {
      const toggle = html(`<button type="button" class="link-button link-centered">${state.learning ? "Revenir aux idées détente" : "Plutôt envie d'apprendre ?"}</button>`);
      toggle.addEventListener("click", () => {
        state.learning = !state.learning;
        sheet.rerender();
      });
      body.appendChild(toggle);
    }

    const actions = html(`
      <div class="sheet-actions">
        <button type="button" class="btn btn-primary btn-block" data-action="passed">C'est passé</button>
        <button type="button" class="btn btn-quiet btn-block" data-action="later">Je verrai plus tard</button>
      </div>
    `);
    actions.querySelector('[data-action="passed"]').addEventListener("click", async () => {
      await Storage.updateCraving(state.craving.id, { outcome: "passed" });
      showToast("Bien joué. Belle pause.");
      sheet.close();
    });
    actions.querySelector('[data-action="later"]').addEventListener("click", () => sheet.close());
    body.appendChild(actions);
  }

  return { render, onReopen };
})();
