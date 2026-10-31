/*
 * storage.js — seul endroit qui lit/écrit les données de Pause.
 * Parle à la base Supabase en ligne (synchronisée entre appareils).
 * Les get...() restent synchrones : elles lisent un cache local.
 * refresh() recharge tout au démarrage ; ensuite, chaque écriture met
 * à jour le cache avec la ligne renvoyée par Supabase, pour que l'app
 * reste réactive sans tout recharger à chaque coche.
 */

const Storage = (() => {
  // Les tâches faites restent visibles 7 jours dans « Faites », puis sont archivées.
  const TASK_ARCHIVE_DAYS = 7;

  let cache = { activities: [], cravings: [], plans: [], challenges: [], practiceDays: [], tasks: [] };
  let userId = null;

  function rowToActivity(row) {
    return { id: row.id, name: row.name, category: row.category };
  }

  function rowToCraving(row) {
    return {
      id: row.id,
      createdAt: row.created_at,
      need: row.need,
      suggestion: row.suggestion,
      outcome: row.outcome,
      answeredAt: row.answered_at,
    };
  }

  function rowToPlan(row) {
    return { id: row.id, date: row.date, slot: row.slot, activity: row.activity, category: row.category, status: row.status };
  }

  function rowToChallenge(row) {
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      raceDate: row.race_date,
      discipline: row.discipline,
      activity: row.activity,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
    };
  }

  function rowToPracticeDay(row) {
    return { id: row.id, challengeId: row.challenge_id, date: row.date, source: row.source };
  }

  function rowToTask(row) {
    return { id: row.id, title: row.title, createdAt: row.created_at, doneAt: row.done_at, archivedAt: row.archived_at };
  }

  async function run(query, what) {
    const { data, error } = await query;
    if (error) {
      console.error(`Erreur (${what}) :`, error.message);
      showToast("Pas de connexion pour l'instant. Réessaie dans un moment.");
      return null;
    }
    // Une suppression sans .select() ne renvoie pas de données : on renvoie [] pour la distinguer d'une erreur.
    return data ?? [];
  }

  function replaceIn(list, item) {
    const index = cache[list].findIndex((x) => x.id === item.id);
    if (index === -1) cache[list].push(item);
    else cache[list][index] = item;
  }

  function removeFrom(list, id) {
    cache[list] = cache[list].filter((x) => x.id !== id);
  }

  async function refresh() {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    userId = user ? user.id : null;
    if (!userId) return;

    const tables = ["pause_activities", "pause_cravings", "pause_plans", "pause_challenges", "pause_practice_days", "pause_tasks"];
    const results = await Promise.all(
      tables.map((table) => run(supabaseClient.from(table).select("*").order("created_at"), `lecture ${table}`))
    );
    if (results.some((r) => r === null)) return;

    const [activities, cravings, plans, challenges, practiceDays, tasks] = results;
    cache = {
      activities: activities.map(rowToActivity),
      cravings: cravings.map(rowToCraving),
      plans: plans.map(rowToPlan),
      challenges: challenges.map(rowToChallenge),
      practiceDays: practiceDays.map(rowToPracticeDay),
      tasks: tasks.map(rowToTask),
    };

    if (results.every((r) => r.length === 0)) await seedFirstUse();
    await archiveOldTasks();
  }

  // Première ouverture (aucune donnée du tout) : on crée les deux courses prévues.
  async function seedFirstUse() {
    const rows = [
      { user_id: userId, kind: "race", name: "EcoTrail de Paris, 30 km", race_date: "2027-03-20", discipline: "Trail" },
      { user_id: userId, kind: "race", name: "Triathlon de Vichy, format M", race_date: "2027-06-26", discipline: "Triathlon" },
    ];
    const data = await run(supabaseClient.from("pause_challenges").insert(rows).select(), "création des courses");
    if (data) data.map(rowToChallenge).forEach((c) => replaceIn("challenges", c));
  }

  async function archiveOldTasks() {
    const limit = Date.now() - TASK_ARCHIVE_DAYS * 86400000;
    const ids = cache.tasks.filter((t) => t.doneAt && !t.archivedAt && new Date(t.doneAt).getTime() < limit).map((t) => t.id);
    if (ids.length === 0) return;
    const data = await run(
      supabaseClient.from("pause_tasks").update({ archived_at: new Date().toISOString() }).in("id", ids).select(),
      "archivage des tâches"
    );
    if (data) data.map(rowToTask).forEach((t) => replaceIn("tasks", t));
  }

  // ---- Activités ajoutées à la main ----

  function getActivities() {
    return cache.activities;
  }

  async function addActivity({ name, category }) {
    const data = await run(
      supabaseClient.from("pause_activities").insert({ user_id: userId, name, category }).select().single(),
      "ajout d'une activité"
    );
    if (!data) return null;
    const activity = rowToActivity(data);
    replaceIn("activities", activity);
    return activity;
  }

  // ---- Envies ----

  function getCravings() {
    return cache.cravings;
  }

  async function addCraving({ need, suggestion }) {
    const data = await run(
      supabaseClient.from("pause_cravings").insert({ user_id: userId, need, suggestion }).select().single(),
      "enregistrement de l'envie"
    );
    if (!data) return null;
    const craving = rowToCraving(data);
    replaceIn("cravings", craving);
    return craving;
  }

  async function updateCraving(id, { suggestion, outcome }) {
    const fields = {};
    if (suggestion !== undefined) fields.suggestion = suggestion;
    if (outcome !== undefined) {
      fields.outcome = outcome;
      fields.answered_at = new Date().toISOString();
    }
    const data = await run(supabaseClient.from("pause_cravings").update(fields).eq("id", id).select().single(), "mise à jour de l'envie");
    if (data) replaceIn("cravings", rowToCraving(data));
  }

  // ---- Grille de la semaine ----

  function getPlans() {
    return cache.plans;
  }

  function planAt(date, slot) {
    return cache.plans.find((p) => p.date === date && p.slot === slot) || null;
  }

  async function setPlan(date, slot, activity, category) {
    const data = await run(
      supabaseClient
        .from("pause_plans")
        .upsert({ user_id: userId, date, slot, activity, category, status: null }, { onConflict: "user_id,date,slot" })
        .select()
        .single(),
      "planification"
    );
    if (!data) return null;
    const plan = rowToPlan(data);
    replaceIn("plans", plan);
    return plan;
  }

  async function setPlanStatus(id, status) {
    const data = await run(supabaseClient.from("pause_plans").update({ status }).eq("id", id).select().single(), "statut de l'activité");
    if (!data) return null;
    const plan = rowToPlan(data);
    replaceIn("plans", plan);
    return plan;
  }

  async function removePlan(id) {
    const data = await run(supabaseClient.from("pause_plans").delete().eq("id", id), "retrait de l'activité");
    if (data !== null) removeFrom("plans", id);
  }

  // ---- Défis ----

  function getChallenges() {
    return cache.challenges;
  }

  async function addChallenge({ kind, name, raceDate, discipline, activity }) {
    const row = { user_id: userId, kind, name, race_date: raceDate || null, discipline: discipline || null, activity: activity || null };
    const data = await run(supabaseClient.from("pause_challenges").insert(row).select().single(), "création du défi");
    if (!data) return null;
    const challenge = rowToChallenge(data);
    replaceIn("challenges", challenge);
    return challenge;
  }

  async function updateChallenge(id, { name, raceDate, discipline, archivedAt }) {
    const fields = {};
    if (name !== undefined) fields.name = name;
    if (raceDate !== undefined) fields.race_date = raceDate;
    if (discipline !== undefined) fields.discipline = discipline;
    if (archivedAt !== undefined) fields.archived_at = archivedAt;
    const data = await run(supabaseClient.from("pause_challenges").update(fields).eq("id", id).select().single(), "modification du défi");
    if (data) replaceIn("challenges", rowToChallenge(data));
  }

  async function deleteChallenge(id) {
    const data = await run(supabaseClient.from("pause_challenges").delete().eq("id", id), "suppression du défi");
    if (data !== null) {
      removeFrom("challenges", id);
      cache.practiceDays = cache.practiceDays.filter((d) => d.challengeId !== id);
    }
  }

  // ---- Jours pratiqués ----

  function getPracticeDays() {
    return cache.practiceDays;
  }

  async function addPracticeDay(challengeId, date, source) {
    if (cache.practiceDays.some((d) => d.challengeId === challengeId && d.date === date)) return;
    const data = await run(
      supabaseClient.from("pause_practice_days").insert({ user_id: userId, challenge_id: challengeId, date, source }).select().single(),
      "ajout d'un jour pratiqué"
    );
    if (data) replaceIn("practiceDays", rowToPracticeDay(data));
  }

  async function removePracticeDay(id) {
    const data = await run(supabaseClient.from("pause_practice_days").delete().eq("id", id), "retrait d'un jour pratiqué");
    if (data !== null) removeFrom("practiceDays", id);
  }

  // ---- To Do List ----

  function getTasks() {
    return cache.tasks;
  }

  async function addTask(title) {
    const data = await run(supabaseClient.from("pause_tasks").insert({ user_id: userId, title }).select().single(), "ajout de la tâche");
    if (!data) return null;
    const task = rowToTask(data);
    replaceIn("tasks", task);
    return task;
  }

  async function updateTask(id, { title, doneAt }) {
    const fields = {};
    if (title !== undefined) fields.title = title;
    if (doneAt !== undefined) fields.done_at = doneAt;
    const data = await run(supabaseClient.from("pause_tasks").update(fields).eq("id", id).select().single(), "modification de la tâche");
    if (!data) return null;
    const task = rowToTask(data);
    replaceIn("tasks", task);
    return task;
  }

  async function deleteTask(id) {
    const data = await run(supabaseClient.from("pause_tasks").delete().eq("id", id), "suppression de la tâche");
    if (data !== null) removeFrom("tasks", id);
  }

  return {
    refresh,
    getActivities,
    addActivity,
    getCravings,
    addCraving,
    updateCraving,
    getPlans,
    planAt,
    setPlan,
    setPlanStatus,
    removePlan,
    getChallenges,
    addChallenge,
    updateChallenge,
    deleteChallenge,
    getPracticeDays,
    addPracticeDay,
    removePracticeDay,
    getTasks,
    addTask,
    updateTask,
    deleteTask,
  };
})();
