/*
 * ui.js — composants d'interface façon iOS partagés par les onglets :
 * feuille qui monte du bas (Sheet), contrôle segmenté, toast, choix
 * d'une activité, aperçu de 3 tâches, respiration guidée.
 */

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function html(markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

const ICONS = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevronRight: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  chevronLeft: '<path d="M15 5.5L8.5 12l6.5 6.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  flag: '<path d="M5.5 21V4"/><path d="M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
  sparkle: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8z"/>',
  wind: '<path d="M3.5 9h10a3 3 0 1 0-3-3"/><path d="M3.5 13h14a3 3 0 1 1-3 3"/><path d="M3.5 17h6"/>',
};

function icon(name, className = "icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

function categoryDot(category) {
  return `<span class="dot dot-${category}" aria-hidden="true"></span>`;
}

/* --- Toast : petit message doux en bas de l'écran --- */

let toastTimer = null;

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("visible"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => (toast.hidden = true), 250);
  }, 2600);
}

/* --- Feuille qui monte du bas de l'écran --- */

const Sheet = (() => {
  let current = null;

  function open({ title, render, onClose }) {
    if (current) close(true);

    const overlay = html(`
      <div class="sheet-overlay">
        <div class="sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
          <div class="sheet-grabber" aria-hidden="true"></div>
          <header class="sheet-header">
            <h2 class="sheet-title">${escapeHtml(title)}</h2>
            <button type="button" class="sheet-close">OK</button>
          </header>
          <div class="sheet-body"></div>
        </div>
      </div>
    `);

    const sheet = overlay.querySelector(".sheet");
    const body = overlay.querySelector(".sheet-body");
    const instance = {
      body,
      setTitle(text) {
        overlay.querySelector(".sheet-title").textContent = text;
      },
      rerender() {
        body.innerHTML = "";
        render(body, instance);
      },
      close: () => close(),
      onClose,
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    overlay.querySelector(".sheet-close").addEventListener("click", () => close());
    enableDragToClose(sheet);

    document.getElementById("sheet-root").appendChild(overlay);
    document.body.classList.add("sheet-open");
    current = { overlay, instance };
    render(body, instance);
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("open")));
    return instance;
  }

  function close(immediate = false) {
    if (!current) return;
    const { overlay, instance } = current;
    current = null;
    document.body.classList.remove("sheet-open");
    overlay.classList.remove("open");
    if (immediate) overlay.remove();
    else setTimeout(() => overlay.remove(), 320);
    if (instance.onClose) instance.onClose();
  }

  // Tirer la poignée vers le bas ferme la feuille, comme sur iOS.
  function enableDragToClose(sheet) {
    let startY = null;
    let delta = 0;
    const handle = sheet.querySelector(".sheet-grabber");
    const header = sheet.querySelector(".sheet-header");

    [handle, header].forEach((zone) => {
      zone.addEventListener("touchstart", (e) => {
        startY = e.touches[0].clientY;
        delta = 0;
        sheet.style.transition = "none";
      }, { passive: true });
    });

    sheet.addEventListener("touchmove", (e) => {
      if (startY === null) return;
      delta = Math.max(0, e.touches[0].clientY - startY);
      sheet.style.transform = `translateY(${delta}px)`;
    }, { passive: true });

    sheet.addEventListener("touchend", () => {
      if (startY === null) return;
      startY = null;
      sheet.style.transition = "";
      sheet.style.transform = "";
      if (delta > 110) close();
    });
  }

  return { open, close, isOpen: () => current !== null };
})();

/* --- Contrôle segmenté iOS --- */

function segmented(options, value, onChange, { small = false } = {}) {
  const control = html(`<div class="segmented${small ? " segmented-small" : ""}" role="radiogroup"></div>`);
  options.forEach((opt) => {
    const btn = html(`<button type="button" role="radio" class="segment">${escapeHtml(opt.label)}</button>`);
    const active = opt.value === value;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
    btn.addEventListener("click", () => onChange(opt.value === value && opt.toggle ? null : opt.value));
    control.appendChild(btn);
  });
  const index = options.findIndex((o) => o.value === value);
  control.style.setProperty("--count", options.length);
  control.style.setProperty("--index", Math.max(0, index));
  control.classList.toggle("has-value", index !== -1);
  return control;
}

/* --- Choix d'une activité (liste groupée par catégorie + ajout) --- */

function renderActivityPicker(container, { categories = CATEGORY_ORDER, onPick, selected = null }) {
  categories.forEach((category) => {
    const group = html(`
      <section class="group">
        <h3 class="group-header">${categoryDot(category)}${CATEGORIES[category].label}</h3>
        <div class="list"></div>
      </section>
    `);
    const list = group.querySelector(".list");
    Activities.byCategory(category).forEach((activity) => {
      const row = html(`
        <button type="button" class="row row-button">
          <span class="row-label">${escapeHtml(activity.name)}</span>
          ${activity.name === selected ? `<span class="row-check">${icon("check")}</span>` : ""}
        </button>
      `);
      row.addEventListener("click", () => onPick(activity));
      list.appendChild(row);
    });
    container.appendChild(group);
  });

  // Ajout d'une activité personnalisée : nom + catégorie.
  let newCategory = categories[0];
  const form = html(`
    <form class="group add-activity">
      <h3 class="group-header">Nouvelle activité</h3>
      <div class="list">
        <label class="row"><input class="row-input" name="name" placeholder="Nom de l'activité" autocomplete="off" required maxlength="60"></label>
      </div>
      <div class="add-activity-category"></div>
      <button type="submit" class="btn btn-secondary btn-block">Ajouter</button>
    </form>
  `);
  const categorySlot = form.querySelector(".add-activity-category");
  function renderCategory() {
    categorySlot.innerHTML = "";
    if (categories.length > 1) {
      categorySlot.appendChild(
        segmented(categories.map((c) => ({ value: c, label: CATEGORIES[c].label })), newCategory, (v) => {
          newCategory = v || newCategory;
          renderCategory();
        })
      );
    }
  }
  renderCategory();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) return;
    if (Activities.all().some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      showToast("Cette activité existe déjà.");
      return;
    }
    const activity = await Storage.addActivity({ name, category: newCategory });
    if (activity) onPick(activity);
  });
  container.appendChild(form);
}

/* --- Aperçu de 3 tâches (pour « Avancer ma to-do list ») --- */

function renderTodoPreview(container, { onChange } = {}) {
  const tasks = Storage.getTasks().filter((t) => !t.doneAt).slice(0, 3);
  const block = html(`
    <div class="todo-preview">
      <div class="list"></div>
      <button type="button" class="link-button">Voir toute la liste ${icon("chevronRight", "icon icon-inline")}</button>
    </div>
  `);
  const list = block.querySelector(".list");

  if (tasks.length === 0) {
    list.appendChild(html(`<div class="row row-muted">Ta liste est vide pour l'instant.</div>`));
  }
  tasks.forEach((task) => {
    const row = html(`
      <div class="row task-row">
        <button type="button" class="task-check" aria-label="Cocher « ${escapeHtml(task.title)} »"></button>
        <span class="row-label">${escapeHtml(task.title)}</span>
      </div>
    `);
    row.querySelector(".task-check").addEventListener("click", async () => {
      row.classList.add("checking");
      await Todo.toggle(task);
      setTimeout(() => onChange && onChange(), 380);
    });
    list.appendChild(row);
  });

  block.querySelector(".link-button").addEventListener("click", () => {
    Sheet.close();
    App.go("todo");
  });
  container.appendChild(block);
}

/* --- Respiration guidée : 5 s inspiration, 5 s expiration, 3 minutes --- */

const Breathing = (() => {
  const DURATION = 180;
  let timer = null;

  function start({ onEnd }) {
    const overlay = html(`
      <div class="breathing" role="dialog" aria-label="Respiration guidée">
        <div class="breathing-stage">
          <div class="breathing-circle"></div>
          <p class="breathing-label" aria-live="polite">Inspire</p>
        </div>
        <p class="breathing-time">3:00</p>
        <div class="breathing-actions">
          <button type="button" class="btn btn-secondary btn-block breathing-stop">Terminer</button>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("open"));

    const label = overlay.querySelector(".breathing-label");
    const time = overlay.querySelector(".breathing-time");
    let elapsed = 0;

    timer = setInterval(() => {
      elapsed += 1;
      const left = DURATION - elapsed;
      time.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      if (elapsed % 5 === 0) label.textContent = Math.floor(elapsed / 5) % 2 === 0 ? "Inspire" : "Expire";
      if (left <= 0) finish(true);
    }, 1000);

    function finish(completed) {
      clearInterval(timer);
      overlay.classList.remove("open");
      setTimeout(() => overlay.remove(), 300);
      onEnd(completed);
    }

    overlay.querySelector(".breathing-stop").addEventListener("click", () => finish(false));
  }

  return { start };
})();

/* --- Grand titre iOS qui se replie dans la barre du haut --- */

const LargeTitle = (() => {
  let observer = null;

  function watch(panel) {
    const bar = document.getElementById("nav-bar");
    const title = panel.querySelector(".large-title");
    document.getElementById("nav-title").textContent = title ? title.textContent : "";
    bar.classList.remove("collapsed");
    if (observer) observer.disconnect();
    if (!title) return;
    observer = new IntersectionObserver(
      ([entry]) => bar.classList.toggle("collapsed", !entry.isIntersecting),
      { rootMargin: `-${bar.offsetHeight}px 0px 0px 0px`, threshold: 0 }
    );
    observer.observe(title);
  }

  return { watch };
})();
