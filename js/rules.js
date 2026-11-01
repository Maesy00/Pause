/*
 * rules.js — les règles qui relient les onglets entre eux :
 * défis (compte à rebours, archivage des courses, jours pratiqués),
 * état des activités planifiées et passage automatique en « Fait ».
 */

const Rules = (() => {
  /* --- Défis --- */

  // Une course passe dans les archives le lendemain de sa date.
  function isRaceArchived(race) {
    return race.raceDate < DateUtil.today();
  }

  function activeRaces() {
    return Storage.getChallenges()
      .filter((c) => c.kind === "race" && !isRaceArchived(c))
      .sort((a, b) => (a.raceDate < b.raceDate ? -1 : 1));
  }

  function activeLearnings() {
    return Storage.getChallenges().filter((c) => c.kind === "learning" && !c.archivedAt);
  }

  function archivedChallenges() {
    return Storage.getChallenges()
      .filter((c) => (c.kind === "race" ? isRaceArchived(c) : c.archivedAt))
      .sort((a, b) => (archiveDate(a) > archiveDate(b) ? -1 : 1));
  }

  function archiveDate(challenge) {
    return challenge.kind === "race" ? challenge.raceDate : challenge.archivedAt.slice(0, 10);
  }

  function daysUntil(race) {
    return DateUtil.daysBetween(DateUtil.today(), race.raceDate);
  }

  function countdownLabel(race) {
    const days = daysUntil(race);
    return days === 0 ? "Aujourd'hui" : `J-${days}`;
  }

  function practiceCount(challenge) {
    return Storage.getPracticeDays().filter((d) => d.challengeId === challenge.id).length;
  }

  function daysLabel(count) {
    return `${count} jour${count > 1 ? "s" : ""}`;
  }

  function racesOn(date) {
    return Storage.getChallenges().filter((c) => c.kind === "race" && c.raceDate === date);
  }

  /* --- État des activités planifiées --- */

  function slotHasEnded(date, slotId, now = new Date()) {
    const end = DateUtil.fromKey(date);
    end.setHours(SLOTS.find((s) => s.id === slotId).end);
    return now >= end;
  }

  // "done" : faite · "missed" : créneau passé sans être validée (ou marquée « Pas fait ») ·
  // "upcoming" : pas encore passée.
  function planState(plan) {
    if (plan.status === "done") return "done";
    if (plan.status === "not_done" || slotHasEnded(plan.date, plan.slot)) return "missed";
    return "upcoming";
  }

  // Activités passées qui attendent une réponse (sur les 14 derniers jours).
  function plansToValidate() {
    const since = DateUtil.addDays(DateUtil.today(), -14);
    const order = SLOTS.map((s) => s.id);
    return Storage.getPlans()
      .filter((p) => !p.status && p.date >= since && slotHasEnded(p.date, p.slot))
      .sort((a, b) => (a.date === b.date ? order.indexOf(a.slot) - order.indexOf(b.slot) : a.date < b.date ? -1 : 1));
  }

  /* --- Automatismes « Fait » --- */

  // Après un changement de statut dans Ma semaine : un apprentissage marqué
  // « Fait » compte un jour (une seule fois par jour) pour les défis liés.
  async function afterPlanStatusChange(plan) {
    if (plan.category !== "apprentissage") return;
    const challenges = activeLearnings().filter((c) => c.activity === plan.activity);
    for (const challenge of challenges) {
      const existing = Storage.getPracticeDays().find((d) => d.challengeId === challenge.id && d.date === plan.date);
      if (plan.status === "done") {
        await Storage.addPracticeDay(challenge.id, plan.date, "auto");
      } else if (existing && existing.source === "auto") {
        const stillDone = Storage.getPlans().some(
          (p) => p.date === plan.date && p.activity === plan.activity && p.status === "done"
        );
        if (!stillDone) await Storage.removePracticeDay(existing.id);
      }
    }
  }

  function tasksDoneOn(date) {
    return Storage.getTasks().some((t) => t.doneAt && DateUtil.toKey(new Date(t.doneAt)) === date);
  }

  // Cocher au moins une tâche passe l'activité « To-Do List » du jour en « Fait ».
  async function syncTodoActivity(date = DateUtil.today()) {
    if (!tasksDoneOn(date)) return;
    const plans = Storage.getPlans().filter((p) => p.date === date && p.activity === TODO_ACTIVITY && p.status !== "done");
    for (const plan of plans) await Storage.setPlanStatus(plan.id, "done");
  }

  return {
    activeRaces,
    activeLearnings,
    archivedChallenges,
    archiveDate,
    daysUntil,
    countdownLabel,
    practiceCount,
    daysLabel,
    racesOn,
    planState,
    plansToValidate,
    afterPlanStatusChange,
    syncTodoActivity,
  };
})();
