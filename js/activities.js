/*
 * activities.js — catalogue fixe de l'app : catégories, activités de
 * départ, besoins, créneaux, et petits utilitaires de dates.
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

const NEEDS = [
  { id: "souffler", label: "Souffler", short: "souffler" },
  { id: "occuper", label: "M'occuper la tête", short: "m'occuper la tête" },
  { id: "decrocher", label: "Décrocher du travail", short: "décrocher du travail" },
  { id: "reflexe", label: "Je ne sais pas, c'est juste le réflexe", short: "juste le réflexe" },
];

// Idées proposées pour chaque besoin, de la plus évidente à la moins évidente.
// Les activités ajoutées à la main rejoignent ces listes selon leur catégorie.
const NEED_SUGGESTIONS = {
  souffler: [BREATHING, "Méditation", "Skincare", "Promenade", "Yoga/Pilates"],
  occuper: ["Mots fléchés", "Sudoku", "Tricot/Crochet", "Lecture", "Échecs", "Piano", "Couture"],
  decrocher: ["Promenade", "Course à pied", "Vélo", "Natation", "Skincare", "Film/Série"],
  reflexe: [BREATHING, "Promenade", TODO_ACTIVITY, "Méditation", "Lecture"],
};

const NEED_CUSTOM_CATEGORIES = {
  souffler: ["detente"],
  occuper: ["detente", "apprentissage"],
  decrocher: ["sport", "detente"],
  reflexe: ["detente"],
};

// end : heure de fin du créneau (29 = 5 h du matin le lendemain, la soirée court jusque-là).
const SLOTS = [
  { id: "matin", label: "Matin", short: "Matin", reminder: "Ce matin", end: 11 },
  { id: "midi", label: "Midi", short: "Midi", reminder: "Ce midi", end: 14 },
  { id: "apres_midi", label: "Après-midi", short: "Aprèm", reminder: "Cet après-midi", end: 18 },
  { id: "soir", label: "Soir", short: "Soir", reminder: "Ce soir", end: 29 },
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

  // Créneau en cours. Avant 5 h du matin, on est encore dans la soirée de la veille.
  currentSlot(now = new Date()) {
    const hour = now.getHours();
    const today = DateUtil.toKey(now);
    if (hour < 5) return { date: DateUtil.addDays(today, -1), slot: "soir" };
    if (hour < 11) return { date: today, slot: "matin" };
    if (hour < 14) return { date: today, slot: "midi" };
    if (hour < 18) return { date: today, slot: "apres_midi" };
    return { date: today, slot: "soir" };
  },

  // Soir de semaine : du lundi au vendredi, à partir de 18 h (et jusqu'à 5 h).
  isWeekdayEvening(now = new Date()) {
    const { date, slot } = DateUtil.currentSlot(now);
    const day = DateUtil.fromKey(date).getDay();
    return slot === "soir" && day >= 1 && day <= 5;
  },
};
