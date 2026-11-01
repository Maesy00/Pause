/*
 * activities.js — catalogue fixe de l'app : catégories, activités de
 * départ, déclencheurs, créneaux, et petits utilitaires de dates.
 * Les activités ajoutées à la main viennent de Storage.
 */

const CATEGORIES = {
  sport: { label: "Sport" },
  detente: { label: "Détente" },
  apprentissage: { label: "Apprentissage" },
};

const CATEGORY_ORDER = ["sport", "detente", "apprentissage"];

const BREATHING = "Respiration guidée";
const TODO_ACTIVITY = "To-Do List";

const DEFAULT_ACTIVITIES = [
  { name: "Course à pied", category: "sport" },
  { name: "Natation", category: "sport" },
  { name: "Vélo", category: "sport" },
  { name: "Renforcement", category: "sport" },
  { name: "Yoga/Pilates", category: "sport" },
  { name: BREATHING, category: "detente" },
  { name: "Méditation", category: "detente" },
  { name: "Skincare", category: "detente" },
  { name: "Promenade", category: "detente" },
  { name: "Mots fléchés", category: "detente" },
  { name: "Sudoku", category: "detente" },
  { name: "Tricot/Crochet", category: "detente" },
  { name: "Lecture", category: "detente" },
  { name: "Film/Série", category: "detente" },
  { name: TODO_ACTIVITY, category: "detente" },
  { name: "Échecs", category: "apprentissage" },
  { name: "Couture", category: "apprentissage" },
  { name: "Piano", category: "apprentissage" },
];

// Anciens noms d'activités renommées : les envies et la grille déjà enregistrées
// sont lues sous le nouveau nom (voir Storage), sans modifier la base.
const RENAMED_ACTIVITIES = {
  "Marche dans le quartier": "Promenade",
  "Tricot ou crochet": "Tricot/Crochet",
  "Film ou épisode choisi à l'avance": "Film/Série",
  "Avancer ma to-do list": TODO_ACTIVITY,
};

function currentActivityName(name) {
  return RENAMED_ACTIVITIES[name] || name;
}

// Déclencheurs proposés quand on appuie sur « J'ai envie de scroller ».
const TRIGGERS = [
  { id: "ennui", label: "Ennui", short: "l'ennui", icon: "hourglass" },
  { id: "fatigue", label: "Fatigue", short: "la fatigue", icon: "battery" },
  { id: "stress", label: "Stress", short: "le stress", icon: "bolt" },
  { id: "reflexe", label: "Réflexe", short: "le réflexe", icon: "phone" },
];

// Raison affichée pour une envie : son déclencheur.
function cravingReason(craving) {
  return TRIGGERS.find((t) => t.id === craving.trigger) || { id: "aucun", label: "Sans déclencheur", short: "une envie", icon: "phone" };
}

const SLOTS = [
  { id: "matin", label: "Matin", short: "Matin", end: 11 },
  { id: "midi", label: "Midi", short: "Midi", end: 14 },
  { id: "apres_midi", label: "Après-midi", short: "Aprèm", end: 18 },
  { id: "soir", label: "Soir", short: "Soir", end: 29 },
];

const RACE_DISCIPLINES = ["Course à pied", "Trail", "Triathlon", "Vélo", "Natation", "Duathlon", "Swimrun"];

const Activities = {
  all() {
    const known = new Set(DEFAULT_ACTIVITIES.map((a) => a.name.toLowerCase()));
    const custom = Storage.getActivities()
      .filter((a) => !known.has(a.name.toLowerCase()))
      .map((a) => ({ name: a.name, category: a.category }));
    return [...DEFAULT_ACTIVITIES, ...custom];
  },

  byCategory(category) {
    return Activities.all().filter((a) => a.category === category);
  },

  categoryOf(name) {
    const found = Activities.all().find((a) => a.name === name);
    return found ? found.category : "detente";
  },
};

/* --- Dates : tout est en heure locale, au format AAAA-MM-JJ --- */

const DateUtil = {
  toKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  },

  fromKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  },

  today() {
    return DateUtil.toKey(new Date());
  },

  addDays(key, days) {
    const date = DateUtil.fromKey(key);
    date.setDate(date.getDate() + days);
    return DateUtil.toKey(date);
  },

  // Lundi de la semaine contenant ce jour.
  weekStart(key) {
    const date = DateUtil.fromKey(key);
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    return DateUtil.toKey(date);
  },

  daysBetween(fromKey, toKey) {
    return Math.round((DateUtil.fromKey(toKey) - DateUtil.fromKey(fromKey)) / 86400000);
  },

  format(key, options) {
    return DateUtil.fromKey(key).toLocaleDateString("fr-FR", options);
  },

  long(key) {
    return DateUtil.format(key, { weekday: "long", day: "numeric", month: "long" });
  },

  short(key) {
    return DateUtil.format(key, { day: "numeric", month: "short" });
  },

  time(iso) {
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  },
};
