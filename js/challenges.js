/*
 * challenges.js — onglet Mes défis : courses (compte à rebours),
 * apprentissages (jours pratiqués) et archives.
 */

const Challenges = (() => {
  const panel = document.getElementById("tab-challenges");

  function render() {
    const races = Rules.activeRaces();
    const learnings = Rules.activeLearnings();
    const archived = Rules.archivedChallenges();

    panel.innerHTML = `
      <header class="page-header"><h1 class="large-title">Mes défis</h1></header>
      <section class="group">
        <h3 class="group-header">Courses</h3>
        <div class="cards" id="races"></div>
      </section>
      <section class="group">
        <h3 class="group-header">Apprentissages</h3>
        <div class="cards" id="learnings"></div>
      </section>
      <button type="button" class="btn btn-primary btn-block" id="new-challenge">${icon("plus", "icon icon-inline")} Nouveau défi</button>
      <section class="group" ${archived.length ? "" : "hidden"}>
        <h3 class="group-header">Archives</h3>
        <div class="list" id="archives"></div>
      </section>
    `;

    const raceList = panel.querySelector("#races");
    if (races.length === 0) raceList.appendChild(html(`<p class="empty-card">Aucune course à venir.</p>`));
    races.forEach((race) => {
      const card = html(`
        <button type="button" class="card challenge-card cat-sport">
          <div class="challenge-text">
            <span class="challenge-meta">${escapeHtml(race.discipline || "Course")} · ${DateUtil.format(race.raceDate, { day: "numeric", month: "long", year: "numeric" })}</span>
            <span class="challenge-name">${escapeHtml(race.name)}</span>
          </div>
          <span class="challenge-figure">${Rules.countdownLabel(race)}</span>
        </button>
      `);
      card.addEventListener("click", () => openRaceEditor(race));
      raceList.appendChild(card);
    });

    const learningList = panel.querySelector("#learnings");
    if (learnings.length === 0) learningList.appendChild(html(`<p class="empty-card">Aucun apprentissage en cours.</p>`));
    learnings.forEach((challenge) => {
      const count = Rules.practiceCount(challenge);
      const card = html(`
        <button type="button" class="card challenge-card cat-apprentissage">
          <div class="challenge-text">
            <span class="challenge-meta">Apprentissage · depuis le ${DateUtil.short(challenge.createdAt.slice(0, 10))}</span>
            <span class="challenge-name">${escapeHtml(challenge.name)}</span>
          </div>
          <span class="challenge-figure">${count}<small>${count > 1 ? "jours" : "jour"}</small></span>
        </button>
      `);
      card.addEventListener("click", () => openLearning(challenge));
      learningList.appendChild(card);
    });

    panel.querySelector("#new-challenge").addEventListener("click", openCreator);

    const archiveList = panel.querySelector("#archives");
    archived.forEach((challenge) => {
      const detail = challenge.kind === "race"
        ? `${escapeHtml(challenge.discipline || "Course")} · ${DateUtil.format(challenge.raceDate, { day: "numeric", month: "short", year: "numeric" })}`
        : `${Rules.daysLabel(Rules.practiceCount(challenge))} · terminé le ${DateUtil.short(Rules.archiveDate(challenge))}`;
      archiveList.appendChild(html(`
        <div class="row">
          ${categoryBadge(challenge.kind === "race" ? "sport" : "apprentissage", challenge.kind === "race" ? "flag" : "apprentissage", "sm")}
          <div class="plan-row-text">
            <span class="row-label">${escapeHtml(challenge.name)}</span>
            <span class="row-detail">${detail}</span>
          </div>
        </div>
      `));
    });
  }

  function raceForm(race = {}) {
    const form = html(`
      <form>
        <div class="list">
          <label class="row"><span class="row-label">Nom</span><input class="row-input align-right" name="name" required maxlength="80" placeholder="EcoTrail de Paris, 30 km"></label>
          <label class="row"><span class="row-label">Date</span><input class="row-input align-right" type="date" name="date" required></label>
          <label class="row"><span class="row-label">Discipline</span><input class="row-input align-right" name="discipline" list="race-disciplines" maxlength="40" placeholder="Trail"></label>
        </div>
        <datalist id="race-disciplines">${RACE_DISCIPLINES.map((d) => `<option value="${d}">`).join("")}</datalist>
        <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
      </form>
    `);
    form.elements.name.value = race.name || "";
    form.elements.date.value = race.raceDate || "";
    form.elements.discipline.value = race.discipline || "";
    return form;
  }

  function readRaceForm(form) {
    return {
      name: form.elements.name.value.trim(),
      raceDate: form.elements.date.value,
      discipline: form.elements.discipline.value.trim(),
    };
  }

  function openRaceEditor(race) {
    Sheet.open({
      title: "Course",
      render(body, sheet) {
        const form = raceForm(race);
        form.appendChild(html(`<button type="button" class="btn btn-quiet btn-block" data-action="delete">Supprimer la course</button>`));
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const values = readRaceForm(form);
          if (!values.name || !values.raceDate) return;
          await Storage.updateChallenge(race.id, values);
          sheet.close();
          App.renderAll();
        });
        form.querySelector('[data-action="delete"]').addEventListener("click", async () => {
          if (!confirm("Supprimer définitivement cette course ?")) return;
          await Storage.deleteChallenge(race.id);
          sheet.close();
          App.renderAll();
        });
        body.appendChild(form);
      },
    });
  }

  function openLearning(challenge) {
    Sheet.open({
      title: challenge.name,
      render(body, sheet) {
        const days = Storage.getPracticeDays()
          .filter((d) => d.challengeId === challenge.id)
          .sort((a, b) => (a.date > b.date ? -1 : 1));
        const content = html(`
          <div>
            <div class="big-stat big-stat-center">
              <span class="big-number">${days.length}</span>
              <span class="big-caption">${days.length > 1 ? "jours pratiqués" : "jour pratiqué"}</span>
            </div>
            <form class="add-day">
              <div class="list">
                <label class="row"><span class="row-label">Jour</span><input class="row-input align-right" type="date" name="date" required></label>
              </div>
              <button type="submit" class="btn btn-secondary btn-block">Ajouter ce jour</button>
            </form>
            <p class="footnote">Chaque jour où « ${escapeHtml(challenge.activity)} » est marqué « Fait » dans Ma semaine compte automatiquement, une seule fois par jour.</p>
            ${days.length ? `<h3 class="group-header">Derniers jours</h3><div class="list">${days.slice(0, 7).map((d) => `
              <div class="row"><span class="row-label">${DateUtil.long(d.date)}</span><span class="row-value">${d.source === "auto" ? "Ma semaine" : "Ajouté"}</span></div>`).join("")}</div>` : ""}
            <button type="button" class="btn btn-primary btn-block" data-action="finish">Terminer le défi</button>
          </div>
        `);
        const form = content.querySelector(".add-day");
        form.elements.date.value = DateUtil.today();
        form.elements.date.max = DateUtil.today();
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const date = form.elements.date.value;
          if (days.some((d) => d.date === date)) {
            showToast("Ce jour est déjà compté.");
            return;
          }
          await Storage.addPracticeDay(challenge.id, date, "manual");
          App.renderAll();
          sheet.rerender();
        });
        content.querySelector('[data-action="finish"]').addEventListener("click", async () => {
          if (!confirm(`Terminer le défi « ${challenge.name} » ? Il rejoindra les archives avec ses ${Rules.daysLabel(days.length)}.`)) return;
          await Storage.updateChallenge(challenge.id, { archivedAt: new Date().toISOString() });
          sheet.close();
          App.renderAll();
        });
        body.appendChild(content);
      },
    });
  }

  function openCreator() {
    let kind = "race";
    Sheet.open({
      title: "Nouveau défi",
      render(body, sheet) {
        body.appendChild(
          segmented([{ value: "race", label: "Course" }, { value: "learning", label: "Apprentissage" }], kind, (value) => {
            kind = value || kind;
            sheet.rerender();
          })
        );

        if (kind === "race") {
          const form = raceForm();
          form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const values = readRaceForm(form);
            if (!values.name || !values.raceDate) return;
            await Storage.addChallenge({ kind: "race", ...values });
            sheet.close();
            App.renderAll();
          });
          body.appendChild(form);
          return;
        }

        const taken = Rules.activeLearnings().map((c) => c.activity);
        renderActivityPicker(body, {
          categories: ["apprentissage"],
          onPick: async (activity) => {
            if (taken.includes(activity.name)) {
              showToast("Ce défi est déjà en cours.");
              return;
            }
            await Storage.addChallenge({ kind: "learning", name: activity.name, activity: activity.name });
            sheet.close();
            App.renderAll();
          },
        });
      },
    });
  }

  return { render };
})();
