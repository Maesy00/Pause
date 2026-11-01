/*
 * week.js — onglet Ma semaine : le programme du jour, la grille
 * lundi → dimanche (4 créneaux par jour) et le bilan de la semaine.
 */

const Week = (() => {
  const panel = document.getElementById("tab-week");
  let weekStart = DateUtil.weekStart(DateUtil.today());

  function weekDays() {
    return Array.from({ length: 7 }, (_, i) => DateUtil.addDays(weekStart, i));
  }

  async function changeStatus(plan, status) {
    const updated = await Storage.setPlanStatus(plan.id, status);
    if (updated) await Rules.afterPlanStatusChange(updated);
    App.renderAll();
  }

  function render() {
    const today = DateUtil.today();
    const isCurrentWeek = weekStart === DateUtil.weekStart(today);
    const days = weekDays();
    const end = days[6];

    panel.innerHTML = `
      <header class="page-header"><h1 class="large-title">Ma semaine</h1></header>
      <section class="group" id="week-validate-group" hidden>
        <h3 class="group-header">À valider</h3>
        <div class="list" id="week-validate"></div>
      </section>
      <section class="group">
        <h3 class="group-header">Aujourd'hui · ${DateUtil.long(today)}</h3>
        <div id="week-today"></div>
      </section>
      <section class="group">
        <div class="week-nav">
          <button type="button" class="icon-button" id="week-prev" aria-label="Semaine précédente">${icon("chevronLeft")}</button>
          <div class="week-nav-label">
            <span>${DateUtil.short(weekStart)} – ${DateUtil.short(end)}</span>
            ${isCurrentWeek ? `<small>Cette semaine</small>` : `<button type="button" class="link-button" id="week-current">Revenir à cette semaine</button>`}
          </div>
          <button type="button" class="icon-button" id="week-next" aria-label="Semaine suivante">${icon("chevronRight")}</button>
        </div>
        <div class="card week-grid" id="week-grid"></div>
        <div class="grid-legend">
          <span><i class="legend-swatch legend-upcoming"></i>Prévue</span>
          <span><i class="legend-swatch legend-done"></i>Faite</span>
          <span><i class="legend-swatch legend-missed"></i>Pas faite</span>
        </div>
      </section>
      <section class="group">
        <h3 class="group-header">Bilan de la semaine</h3>
        <div class="card" id="week-summary"></div>
      </section>
      <section class="group">
        <h3 class="group-header">Calendrier iPhone</h3>
        <button type="button" class="card calendar-card" id="calendar-card">
          ${categoryBadge("sport", "calendar")}
          <span class="calendar-card-text">
            <span class="calendar-card-title">Sport dans Calendrier</span>
            <span class="calendar-card-caption">Tes séances de sport et tes courses, mises à jour automatiquement.</span>
          </span>
          <span class="row-chevron">${icon("chevronRight")}</span>
        </button>
      </section>
    `;

    renderToValidate(panel.querySelector("#week-validate-group"), panel.querySelector("#week-validate"));
    renderToday(panel.querySelector("#week-today"));
    renderGrid(panel.querySelector("#week-grid"), days);
    renderSummary(panel.querySelector("#week-summary"), days);

    panel.querySelector("#calendar-card").addEventListener("click", openCalendar);
    panel.querySelector("#week-prev").addEventListener("click", () => moveWeek(-7));
    panel.querySelector("#week-next").addEventListener("click", () => moveWeek(7));
    const current = panel.querySelector("#week-current");
    if (current) current.addEventListener("click", () => {
      weekStart = DateUtil.weekStart(DateUtil.today());
      render();
    });
  }

  function moveWeek(days) {
    weekStart = DateUtil.addDays(weekStart, days);
    render();
  }

  /* --- À valider : activités passées sans réponse --- */

  function renderToValidate(group, list) {
    const plans = Rules.plansToValidate();
    group.hidden = plans.length === 0;
    plans.forEach((plan) => {
      const slot = SLOTS.find((s) => s.id === plan.slot);
      const day = DateUtil.format(plan.date, { weekday: "long", day: "numeric" });
      const row = html(`
        <div class="row validate-row">
          ${activityBadge(plan.activity, "sm")}
          <div class="plan-row-text">
            <span class="row-label">${escapeHtml(plan.activity)}</span>
            <span class="row-detail">${day.charAt(0).toUpperCase() + day.slice(1)} · ${slot.label}</span>
          </div>
          <div class="validate-actions">
            <button type="button" class="validate-btn validate-yes" aria-label="Je l'ai fait">${icon("check")}</button>
            <button type="button" class="validate-btn validate-no" aria-label="Pas fait">${icon("close")}</button>
          </div>
        </div>
      `);
      row.querySelector(".validate-yes").addEventListener("click", () => {
        row.classList.add("validated-yes");
        setTimeout(() => changeStatus(plan, "done"), 250);
      });
      row.querySelector(".validate-no").addEventListener("click", () => {
        row.classList.add("validated-no");
        setTimeout(() => changeStatus(plan, "not_done"), 250);
      });
      list.appendChild(row);
    });
  }

  /* --- Aujourd'hui --- */

  function renderToday(container) {
    const today = DateUtil.today();
    const races = Rules.racesOn(today);
    const plans = SLOTS.map((slot) => Storage.planAt(today, slot.id)).filter(Boolean);
    const list = html(`<div class="list"></div>`);

    races.forEach((race) => {
      list.appendChild(html(`
        <div class="row race-row">
          <span class="race-flag">${icon("flag")}</span>
          <span class="row-label">${escapeHtml(race.name)}</span>
          <span class="row-value">Jour de course</span>
        </div>
      `));
    });

    plans.forEach((plan) => {
      const slot = SLOTS.find((s) => s.id === plan.slot);
      const row = html(`
        <div class="row plan-row state-${Rules.planState(plan)}">
          ${activityBadge(plan.activity, "sm")}
          <div class="plan-row-text">
            <span class="row-label">${escapeHtml(plan.activity)}</span>
            <span class="row-detail">${slot.label}</span>
          </div>
          <div class="validate-actions">
            <button type="button" class="validate-btn validate-yes${plan.status === "done" ? " active" : ""}" aria-label="Je l'ai fait">${icon("check")}</button>
            <button type="button" class="validate-btn validate-no${plan.status === "not_done" ? " active" : ""}" aria-label="Pas fait">${icon("close")}</button>
          </div>
        </div>
      `);
      // Toucher le bouton déjà actif annule la réponse.
      row.querySelector(".validate-yes").addEventListener("click", () => changeStatus(plan, plan.status === "done" ? null : "done"));
      row.querySelector(".validate-no").addEventListener("click", () => changeStatus(plan, plan.status === "not_done" ? null : "not_done"));
      list.appendChild(row);
      if (plan.activity === TODO_ACTIVITY && plan.status !== "done") {
        const preview = html(`<div class="row row-nested"></div>`);
        renderTodoPreview(preview, { onChange: render });
        list.appendChild(preview);
      }
    });

    if (races.length === 0 && plans.length === 0) {
      list.appendChild(html(`<div class="row row-muted">Rien de prévu aujourd'hui. C'est très bien aussi.</div>`));
    }
    container.appendChild(list);
  }

  /* --- Grille --- */

  function renderGrid(container, days) {
    const today = DateUtil.today();
    container.appendChild(html(`
      <div class="grid-row grid-head">
        <span></span>
        ${SLOTS.map((s) => `<span>${s.short}</span>`).join("")}
      </div>
    `));

    days.forEach((date) => {
      const races = Rules.racesOn(date);
      const label = DateUtil.fromKey(date).toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
      const row = html(`
        <div class="grid-day${date === today ? " is-today" : ""}">
          <div class="grid-row">
            <div class="grid-date">
              <span class="grid-weekday">${label}</span>
              <span class="grid-daynum">${DateUtil.fromKey(date).getDate()}</span>
            </div>
          </div>
          ${races.map((r) => `<div class="grid-race">${icon("flag", "icon icon-inline")}${escapeHtml(r.name)}</div>`).join("")}
        </div>
      `);
      const cells = row.querySelector(".grid-row");
      SLOTS.forEach((slot) => {
        const plan = Storage.planAt(date, slot.id);
        const state = plan ? Rules.planState(plan) : null;
        // Repère dans le coin : ✓ faite, ✕ marquée « Pas fait », ! passée sans réponse.
        const mark = !plan ? "" : state === "done" ? "check" : plan.status === "not_done" ? "close" : state === "missed" ? "alert" : "";
        const cell = html(`
          <button type="button" class="grid-cell${plan ? ` cat-${plan.category} state-${state}` : " is-empty"}"
            aria-label="${escapeHtml(`${DateUtil.long(date)}, ${slot.label} : ${plan ? plan.activity : "libre"}`)}">
            ${plan ? `<span class="grid-cell-dot dot-${plan.category}"></span><span class="grid-cell-text">${escapeHtml(plan.activity)}</span>` : ""}
            ${mark ? `<span class="grid-cell-mark mark-${mark}">${icon(mark)}</span>` : ""}
          </button>
        `);
        cell.addEventListener("click", () => openCell(date, slot));
        cells.appendChild(cell);
      });
      container.appendChild(row);
    });
  }

  function openCell(date, slot) {
    const title = `${DateUtil.format(date, { weekday: "long", day: "numeric" })} · ${slot.label}`;
    let picking = !Storage.planAt(date, slot.id);

    Sheet.open({
      title: title.charAt(0).toUpperCase() + title.slice(1),
      render(body, sheet) {
        const plan = Storage.planAt(date, slot.id);

        if (plan && !picking) {
          const current = html(`
            <div>
              <div class="list">
                <div class="row">
                  ${activityBadge(plan.activity, "sm")}
                  <span class="row-label">${escapeHtml(plan.activity)}</span>
                  <span class="row-value">${CATEGORIES[plan.category].label}</span>
                </div>
              </div>
              <div class="sheet-status"></div>
              <div class="sheet-todo"></div>
              <button type="button" class="btn btn-secondary btn-block" data-action="change">Changer d'activité</button>
              <button type="button" class="btn btn-quiet btn-block" data-action="remove">Libérer ce créneau</button>
            </div>
          `);
          const choice = html(`
            <div class="status-choice">
              <button type="button" class="status-btn status-btn-done${plan.status === "done" ? " active" : ""}">${icon("check")} Je l'ai fait</button>
              <button type="button" class="status-btn status-btn-missed${plan.status === "not_done" ? " active" : ""}">${icon("close")} Pas fait</button>
            </div>
          `);
          // Toucher le choix déjà actif l'annule (l'activité redevient « sans réponse »).
          const [doneBtn, missedBtn] = choice.querySelectorAll("button");
          doneBtn.addEventListener("click", async () => {
            await changeStatus(plan, plan.status === "done" ? null : "done");
            sheet.rerender();
          });
          missedBtn.addEventListener("click", async () => {
            await changeStatus(plan, plan.status === "not_done" ? null : "not_done");
            sheet.rerender();
          });
          current.querySelector(".sheet-status").appendChild(choice);
          if (plan.activity === TODO_ACTIVITY) renderTodoPreview(current.querySelector(".sheet-todo"), { onChange: () => sheet.rerender() });
          current.querySelector('[data-action="change"]').addEventListener("click", () => {
            picking = true;
            sheet.rerender();
          });
          current.querySelector('[data-action="remove"]').addEventListener("click", async () => {
            await Storage.removePlan(plan.id);
            sheet.close();
            App.renderAll();
          });
          body.appendChild(current);
          return;
        }

        renderActivityPicker(body, {
          selected: plan ? plan.activity : null,
          onPick: async (activity) => {
            await Storage.setPlan(date, slot.id, activity.name, activity.category);
            await Rules.syncTodoActivity(date);
            picking = false;
            App.renderAll();
            sheet.close();
          },
        });
      },
    });
  }

  /* --- Calendrier iPhone --- */

  // Le lien est créé au premier affichage, puis réutilisé.
  function openCalendar() {
    let token;
    let loading = true;
    let closed = false;

    const calendarSheet = Sheet.open({
      title: "Calendrier iPhone",
      onClose: () => (closed = true),
      render(body, sheet) {
        if (loading) {
          body.appendChild(html(`<p class="muted">Préparation du lien…</p>`));
          return;
        }
        if (!token) {
          body.appendChild(html(`<p class="muted">Le lien n'a pas pu être créé. Vérifie ta connexion et réessaie.</p>`));
          return;
        }
        const httpsUrl = `${CALENDAR_FEED_URL}?token=${token}`;
        const webcalUrl = httpsUrl.replace(/^https:/, "webcal:");
        const content = html(`
          <div>
            <p class="sheet-intro">Abonne-toi une fois : chaque séance de sport planifiée dans Ma semaine, et chacune de tes courses, apparaîtra dans l'app Calendrier, sans alerte.</p>
            <a class="btn btn-primary btn-block" href="${webcalUrl}">${icon("calendar", "icon icon-inline")} S'abonner dans Calendrier</a>
            <button type="button" class="btn btn-secondary btn-block" data-action="copy">Copier le lien</button>
            <section class="group">
              <h3 class="group-header">Bon à savoir</h3>
              <div class="list">
                <div class="row"><span class="row-label">Matin : 7 h – 11 h · Midi : 12 h – 14 h<br>Après-midi : 14 h – 18 h · Soir : 18 h – 21 h</span></div>
                <div class="row"><span class="row-label">L'iPhone actualise le calendrier toutes les heures environ (Réglages → Calendrier → Comptes).</span></div>
                <div class="row"><span class="row-label">Ce lien est personnel : il donne accès à tes séances de sport et tes courses, et à rien d'autre.</span></div>
              </div>
            </section>
            <button type="button" class="btn btn-quiet btn-block" data-action="reset">Créer un nouveau lien</button>
          </div>
        `);
        content.querySelector('[data-action="copy"]').addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(webcalUrl);
            showToast("Lien copié.");
          } catch {
            prompt("Copie ce lien :", webcalUrl);
          }
        });
        content.querySelector('[data-action="reset"]').addEventListener("click", async () => {
          if (!confirm("Créer un nouveau lien\u00a0? L'ancien abonnement cessera de se mettre à jour : il faudra te réabonner.")) return;
          token = await Storage.resetCalendarToken();
          sheet.rerender();
          if (token) showToast("Nouveau lien créé.");
        });
        body.appendChild(content);
      },
    });

    (async () => {
      token = (await Storage.getCalendarToken()) || (await Storage.createCalendarToken());
      loading = false;
      if (!closed) calendarSheet.rerender();
    })();
  }

  /* --- Bilan --- */

  function renderSummary(container, days) {
    const plans = Storage.getPlans().filter((p) => days.includes(p.date));
    const done = plans.filter((p) => p.status === "done").length;

    if (plans.length === 0) {
      container.innerHTML = `<p class="muted">Rien de planifié cette semaine. Touche une case pour y mettre une activité.</p>`;
      return;
    }

    // Activités qui « tiennent » le mieux : part des fois où elles ont été faites.
    const byActivity = {};
    plans.forEach((p) => {
      byActivity[p.activity] = byActivity[p.activity] || { name: p.activity, category: p.category, planned: 0, done: 0 };
      byActivity[p.activity].planned += 1;
      if (p.status === "done") byActivity[p.activity].done += 1;
    });
    const ranking = Object.values(byActivity)
      .filter((a) => a.done > 0)
      .sort((a, b) => b.done / b.planned - a.done / a.planned || b.done - a.done)
      .slice(0, 3);

    container.innerHTML = `
      <div class="big-stat">
        <span class="big-number">${done}<span class="big-number-total">/${plans.length}</span></span>
        <span class="big-caption">activités faites sur ${plans.length} prévue${plans.length > 1 ? "s" : ""}</span>
      </div>
      <div class="progress"><span style="width:${Math.round((done / plans.length) * 100)}%"></span></div>
      ${ranking.length ? `
        <h4 class="card-subtitle">Ce qui tient le mieux</h4>
        <ul class="plain-list">
          ${ranking.map((a) => `<li>${activityBadge(a.name, "sm")}<span class="row-label">${escapeHtml(a.name)}</span><span class="row-value tabular">${a.done}/${a.planned}</span></li>`).join("")}
        </ul>` : ""}
    `;
  }

  return { render };
})();
