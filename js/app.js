/*
 * app.js — navigation entre les 4 onglets et rafraîchissement de l'affichage.
 */

const App = (() => {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = {
    home: { el: document.getElementById("tab-home"), view: () => Home },
    week: { el: document.getElementById("tab-week"), view: () => Week },
    challenges: { el: document.getElementById("tab-challenges"), view: () => Challenges },
    todo: { el: document.getElementById("tab-todo"), view: () => Todo },
  };
  let currentTab = "home";
  let hiddenAt = null;

  function renderAll() {
    Object.values(panels).forEach((p) => p.view().render());
    LargeTitle.watch(panels[currentTab].el);
  }

  function go(tab) {
    if (tab === currentTab) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    currentTab = tab;
    tabButtons.forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    Object.entries(panels).forEach(([id, p]) => p.el.classList.toggle("active", id === tab));
    window.scrollTo(0, 0);
    LargeTitle.watch(panels[tab].el);
  }

  function start() {
    Home.onReopen();
    renderAll();
    go("home");
  }

  tabButtons.forEach((btn) => btn.addEventListener("click", () => go(btn.dataset.tab)));

  // Revenir sur l'app (depuis l'écran d'accueil de l'iPhone) compte comme une
  // nouvelle ouverture : on recharge les données et on revient à l'accueil
  // si l'app est restée de côté plus de 5 minutes.
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }
    if (appShell.hidden || hiddenAt === null) return;
    const away = Date.now() - hiddenAt;
    hiddenAt = null;
    if (away < 60 * 1000) return;
    Home.onReopen();
    await Storage.refresh();
    if (away > 5 * 60 * 1000 && !Sheet.isOpen()) go("home");
    renderAll();
  });

  return { start, go, renderAll };
})();
