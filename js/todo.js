/*
 * todo.js — onglet To Do List : tâches à faire, tâches faites
 * (7 jours, puis archivées) et archives.
 */

const Todo = (() => {
  const panel = document.getElementById("tab-todo");

  // Cocher / décocher une tâche. Cocher fait aussi passer l'activité
  // « To-Do List » du jour en « Fait » (voir Rules.syncTodoActivity).
  async function toggle(task) {
    const doneAt = task.doneAt ? null : new Date().toISOString();
    const updated = await Storage.updateTask(task.id, { doneAt });
    if (updated && doneAt) await Rules.syncTodoActivity();
    App.renderAll();
  }

  function render() {
    const tasks = Storage.getTasks();
    const todo = tasks.filter((t) => !t.doneAt);
    const done = tasks
      .filter((t) => t.doneAt && !t.archivedAt)
      .sort((a, b) => (a.doneAt > b.doneAt ? -1 : 1));
    const archivedCount = tasks.filter((t) => t.archivedAt).length;

    panel.innerHTML = `
      <header class="page-header"><h1 class="large-title">To Do List</h1></header>
      <section class="group">
        <div class="list" id="todo-list"></div>
      </section>
      <section class="group" id="todo-done-group" ${done.length ? "" : "hidden"}>
        <h3 class="group-header">Faites</h3>
        <div class="list" id="todo-done"></div>
      </section>
      ${archivedCount ? `<button type="button" class="link-button link-centered" id="todo-archives">Archives (${archivedCount})</button>` : ""}
    `;

    const list = panel.querySelector("#todo-list");
    todo.forEach((task) => list.appendChild(taskRow(task)));

    const addRow = html(`
      <form class="row task-row task-add">
        <span class="task-plus">${icon("plus")}</span>
        <input class="row-input" name="title" placeholder="Nouvelle tâche" autocomplete="off" maxlength="120" enterkeyhint="done">
      </form>
    `);
    addRow.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = addRow.elements.title;
      const title = input.value.trim();
      if (!title) return;
      input.value = "";
      await Storage.addTask(title);
      render();
      panel.querySelector(".task-add input").focus();
    });
    list.appendChild(addRow);

    const doneList = panel.querySelector("#todo-done");
    done.forEach((task) => doneList.appendChild(taskRow(task)));

    const archivesBtn = panel.querySelector("#todo-archives");
    if (archivesBtn) archivesBtn.addEventListener("click", openArchives);
  }

  function taskRow(task) {
    const row = html(`
      <div class="row task-row${task.doneAt ? " is-done" : ""}">
        <button type="button" class="task-check" aria-label="${task.doneAt ? "Décocher" : "Cocher"} « ${escapeHtml(task.title)} »"></button>
        <button type="button" class="task-title">
          <span class="row-label">${escapeHtml(task.title)}</span>
          ${task.doneAt ? `<span class="row-detail">Faite le ${DateUtil.short(DateUtil.toKey(new Date(task.doneAt)))}</span>` : ""}
        </button>
      </div>
    `);
    row.querySelector(".task-check").addEventListener("click", () => {
      row.classList.add(task.doneAt ? "unchecking" : "checking");
      setTimeout(() => toggle(task), 320);
    });
    row.querySelector(".task-title").addEventListener("click", () => openEditor(task));
    return row;
  }

  function openEditor(task) {
    Sheet.open({
      title: "Modifier la tâche",
      render(body, sheet) {
        const form = html(`
          <form>
            <div class="list">
              <label class="row"><input class="row-input" name="title" maxlength="120" required></label>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
            <button type="button" class="btn btn-quiet btn-block" data-action="delete">Supprimer la tâche</button>
          </form>
        `);
        form.elements.title.value = task.title;
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const title = form.elements.title.value.trim();
          if (!title) return;
          await Storage.updateTask(task.id, { title });
          sheet.close();
          App.renderAll();
        });
        form.querySelector('[data-action="delete"]').addEventListener("click", async () => {
          if (!confirm("Supprimer définitivement cette tâche ?")) return;
          await Storage.deleteTask(task.id);
          sheet.close();
          App.renderAll();
        });
        body.appendChild(form);
      },
    });
  }

  function openArchives() {
    const archived = Storage.getTasks()
      .filter((t) => t.archivedAt)
      .sort((a, b) => (a.doneAt > b.doneAt ? -1 : 1));
    Sheet.open({
      title: "Tâches archivées",
      render(body) {
        const list = html(`<div class="list"></div>`);
        archived.forEach((task) => {
          list.appendChild(html(`
            <div class="row">
              <span class="row-label">${escapeHtml(task.title)}</span>
              <span class="row-value">${DateUtil.short(DateUtil.toKey(new Date(task.doneAt)))}</span>
            </div>
          `));
        });
        body.appendChild(list);
      },
    });
  }

  return { render, toggle };
})();
