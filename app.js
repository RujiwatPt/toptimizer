const people = [
  "Poj",
  "Cid",
  "Luang",
  "Time",
  "Por",
  "Atom",
  "Charlie",
  "Champ",
  "Khawpun",
  "Nene",
  "Janjao",
  "Hugo",
  "Peem",
  "Fulke",
  "Achi",
  "Jim",
  "Chokun",
  "First",
  "Earth",
  "Pam",
  "Rain",
  "Yuu",
  "Wind",
  "fluke",
  "N' JIM",
].map((name, index) => ({
  id: `person-${String(index + 1).padStart(2, "0")}`,
  name,
}));

const statuses = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "Todo" },
  { id: "in-progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

const storageKey = "toptimizer-task-manager-v1";
const selectedProjectKey = "toptimizer-selected-project";

const defaultState = {
  selectedProjectId: "",
  projects: [],
  tasks: [],
};

let state = { ...defaultState };
let draggedTaskId = "";
let suppressTaskClickUntil = 0;
let supabaseClient = null;
let isSharedMode = false;

const projectList = document.querySelector("#projectList");
const memberList = document.querySelector("#memberList");
const memberCount = document.querySelector("#memberCount");
const projectTitle = document.querySelector("#projectTitle");
const storageBadge = document.querySelector("#storageBadge");
const board = document.querySelector("#board");
const totalTasks = document.querySelector("#totalTasks");
const activeTasks = document.querySelector("#activeTasks");
const doneTasks = document.querySelector("#doneTasks");
const unassignedTasks = document.querySelector("#unassignedTasks");
const searchInput = document.querySelector("#searchInput");
const newProjectButton = document.querySelector("#newProjectButton");
const newTaskButton = document.querySelector("#newTaskButton");
const deleteProjectButton = document.querySelector("#deleteProjectButton");
const projectDialog = document.querySelector("#projectDialog");
const projectForm = document.querySelector("#projectForm");
const taskDialog = document.querySelector("#taskDialog");
const taskForm = document.querySelector("#taskForm");
const assigneeSelect = document.querySelector("#assigneeSelect");
const statusSelect = document.querySelector("#statusSelect");
const deleteTaskButton = document.querySelector("#deleteTaskButton");
const taskDialogMode = document.querySelector("#taskDialogMode");
const taskDialogTitle = document.querySelector("#taskDialogTitle");
const commentsPanel = document.querySelector("#commentsPanel");
const commentList = document.querySelector("#commentList");
const commentInput = document.querySelector("#commentInput");
const commentCount = document.querySelector("#commentCount");
const addCommentButton = document.querySelector("#addCommentButton");

async function init() {
  state = loadLocalState();
  setupSupabase();
  render();

  if (!isSharedMode) return;

  setBusy(true);
  try {
    await loadSharedState();
    render();
  } catch (error) {
    showStorageError(error, "Could not load shared workspace. Using local browser storage for now.");
    isSharedMode = false;
    updateStorageBadge();
    state = loadLocalState();
    render();
  } finally {
    setBusy(false);
    render();
  }
}

function setupSupabase() {
  const config = window.TOPTIMIZER_CONFIG || {};
  const hasConfig = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  const hasClient = Boolean(window.supabase?.createClient);

  if (hasConfig && hasClient) {
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    isSharedMode = true;
  }

  updateStorageBadge();
}

function updateStorageBadge() {
  storageBadge.textContent = isSharedMode ? "Shared Supabase workspace" : "Local browser mode";
}

function loadLocalState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    const localState =
      parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.tasks)
        ? normalizeState({ ...defaultState, ...parsed })
        : { ...defaultState };
    localState.selectedProjectId = localStorage.getItem(selectedProjectKey) || localState.selectedProjectId;
    return localState;
  } catch {
    return { ...defaultState };
  }
}

async function loadSharedState() {
  const [{ data: projects, error: projectsError }, { data: tasks, error: tasksError }, { data: comments, error: commentsError }] =
    await Promise.all([
      supabaseClient.from("projects").select("*").order("created_at", { ascending: false }),
      supabaseClient.from("tasks").select("*").order("created_at", { ascending: false }),
      supabaseClient.from("comments").select("*").order("created_at", { ascending: true }),
    ]);

  if (projectsError || tasksError || commentsError) {
    throw projectsError || tasksError || commentsError;
  }

  const commentsByTask = buildCommentsByTask(comments || []);
  state = normalizeState({
    selectedProjectId: localStorage.getItem(selectedProjectKey) || "",
    projects: (projects || []).map(mapProjectFromRow),
    tasks: (tasks || []).map((task) => ({
      ...mapTaskFromRow(task),
      comments: commentsByTask.get(task.id) || [],
    })),
  });
}

function buildCommentsByTask(rows) {
  const topLevel = new Map();
  const repliesByParent = new Map();

  rows.forEach((row) => {
    const comment = mapCommentFromRow(row);
    if (row.parent_id) {
      repliesByParent.set(row.parent_id, [...(repliesByParent.get(row.parent_id) || []), comment]);
    } else {
      topLevel.set(row.id, { ...comment, taskId: row.task_id });
    }
  });

  topLevel.forEach((comment) => {
    comment.replies = repliesByParent.get(comment.id) || [];
  });

  return [...topLevel.values()].reduce((map, comment) => {
    const nextComment = { id: comment.id, body: comment.body, createdAt: comment.createdAt, replies: comment.replies };
    map.set(comment.taskId, [...(map.get(comment.taskId) || []), nextComment]);
    return map;
  }, new Map());
}

function normalizeState(nextState) {
  return {
    ...nextState,
    tasks: nextState.tasks.map((task) => ({
      ...task,
      comments: Array.isArray(task.comments)
        ? task.comments.map((comment) => ({
            ...comment,
            replies: Array.isArray(comment.replies) ? comment.replies : [],
          }))
        : [],
    })),
  };
}

function saveState() {
  localStorage.setItem(selectedProjectKey, state.selectedProjectId || "");
  localStorage.setItem(storageKey, JSON.stringify(state));
}

async function persistProject(project) {
  if (!isSharedMode) return;
  const { error } = await supabaseClient.from("projects").upsert(mapProjectToRow(project));
  if (error) throw error;
}

async function removeProject(projectId) {
  if (!isSharedMode) return;
  const { error } = await supabaseClient.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}

async function persistTask(task) {
  if (!isSharedMode) return;
  const { error } = await supabaseClient.from("tasks").upsert(mapTaskToRow(task));
  if (error) throw error;
}

async function removeTask(taskId) {
  if (!isSharedMode) return;
  const { error } = await supabaseClient.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

async function persistComment(taskId, comment, parentId = null) {
  if (!isSharedMode) return;
  const { error } = await supabaseClient.from("comments").insert({
    id: comment.id,
    task_id: taskId,
    parent_id: parentId,
    body: comment.body,
    created_at: comment.createdAt,
  });
  if (error) throw error;
}

async function updateTaskStatus(taskId, statusId, updatedAt) {
  if (!isSharedMode) return;
  const { error } = await supabaseClient.from("tasks").update({ status: statusId, updated_at: updatedAt }).eq("id", taskId);
  if (error) throw error;
}

function mapProjectFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    createdAt: row.created_at,
  };
}

function mapProjectToRow(project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description || "",
    created_at: project.createdAt,
  };
}

function mapTaskFromRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description || "",
    assigneeId: row.assignee_id || "",
    priority: row.priority,
    status: row.status,
    dueDate: row.due_date || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments: [],
  };
}

function mapTaskToRow(task) {
  return {
    id: task.id,
    project_id: task.projectId,
    title: task.title,
    description: task.description || "",
    assignee_id: task.assigneeId || null,
    priority: task.priority,
    status: task.status,
    due_date: task.dueDate || null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

function mapCommentFromRow(row) {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    replies: [],
  };
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getSelectedProject() {
  return state.projects.find((project) => project.id === state.selectedProjectId);
}

function getPerson(personId) {
  return people.find((person) => person.id === personId);
}

function render() {
  updateStorageBadge();
  renderPeople();
  renderProjects();
  renderBoard();
}

function renderPeople() {
  memberCount.textContent = people.length;
  memberList.innerHTML = people
    .map(
      (person) => `
        <div class="member-pill">
          <span class="avatar">${getInitials(person.name)}</span>
          <span title="${escapeHtml(person.name)}">${escapeHtml(person.name)}</span>
        </div>
      `,
    )
    .join("");
}

function renderProjects() {
  if (state.projects.length === 0) {
    projectList.innerHTML = `<div class="empty-projects">No projects yet. Create one when you are ready.</div>`;
    projectTitle.textContent = "Create a project";
    newTaskButton.disabled = true;
    deleteProjectButton.disabled = true;
    return;
  }

  if (!getSelectedProject()) {
    state.selectedProjectId = state.projects[0].id;
    saveState();
  }

  newTaskButton.disabled = false;
  deleteProjectButton.disabled = false;
  projectList.innerHTML = state.projects
    .map((project) => {
      const count = state.tasks.filter((task) => task.projectId === project.id).length;
      const activeClass = project.id === state.selectedProjectId ? " is-active" : "";
      return `
        <button class="project-button${activeClass}" type="button" data-project-id="${project.id}">
          <strong>${escapeHtml(project.name)}</strong>
          <span>${count} task${count === 1 ? "" : "s"}</span>
        </button>
      `;
    })
    .join("");

  const selectedProject = getSelectedProject();
  projectTitle.textContent = selectedProject ? selectedProject.name : "Create a project";
}

function renderBoard() {
  const selectedProject = getSelectedProject();
  const query = searchInput.value.trim().toLowerCase();
  const projectTasks = selectedProject
    ? state.tasks.filter((task) => task.projectId === selectedProject.id)
    : [];
  const visibleTasks = query
    ? projectTasks.filter((task) => `${task.title} ${task.description}`.toLowerCase().includes(query))
    : projectTasks;

  totalTasks.textContent = projectTasks.length;
  activeTasks.textContent = projectTasks.filter((task) => task.status !== "done").length;
  doneTasks.textContent = projectTasks.filter((task) => task.status === "done").length;
  unassignedTasks.textContent = projectTasks.filter((task) => !task.assigneeId).length;

  if (!selectedProject) {
    board.innerHTML = `<div class="empty-board">Create a project first, then add tasks and assign them to your team.</div>`;
    return;
  }

  board.innerHTML = statuses
    .map((status) => {
      const tasks = visibleTasks.filter((task) => task.status === status.id);
      return `
        <section class="column" aria-label="${status.label}">
          <div class="column-header">
            <strong>${status.label}</strong>
            <span>${tasks.length}</span>
          </div>
          <div class="task-list" data-status-id="${status.id}">
            ${tasks.map(renderTaskCard).join("") || `<div class="empty-projects">No tasks</div>`}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderTaskCard(task) {
  const assignee = getPerson(task.assigneeId);
  const dueDate = task.dueDate ? formatDate(task.dueDate) : "No due date";
  const commentTotal = getCommentTotal(task);
  return `
    <button class="task-card" type="button" draggable="true" data-task-id="${task.id}">
      <div class="task-meta">
        <span class="priority ${task.priority}">${task.priority}</span>
        <span>${dueDate}</span>
      </div>
      <h3>${escapeHtml(task.title)}</h3>
      ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ""}
      <div class="task-meta">
        <span>${assignee ? escapeHtml(assignee.name) : "Unassigned"}</span>
        <span>${commentTotal} comment${commentTotal === 1 ? "" : "s"}</span>
      </div>
    </button>
  `;
}

function openProjectDialog() {
  projectForm.reset();
  projectDialog.showModal();
  projectForm.elements.name.focus();
}

function openTaskDialog(taskId = "") {
  const selectedProject = getSelectedProject();
  if (!selectedProject) return;

  populateTaskSelects();
  const task = state.tasks.find((item) => item.id === taskId);
  taskForm.reset();
  taskForm.elements.taskId.value = task ? task.id : "";
  taskForm.elements.title.value = task ? task.title : "";
  taskForm.elements.description.value = task ? task.description : "";
  taskForm.elements.assigneeId.value = task ? task.assigneeId : "";
  taskForm.elements.priority.value = task ? task.priority : "medium";
  taskForm.elements.status.value = task ? task.status : "todo";
  taskForm.elements.dueDate.value = task ? task.dueDate : "";
  deleteTaskButton.hidden = !task;
  commentsPanel.hidden = !task;
  taskDialogMode.textContent = task ? "Edit task" : "New task";
  taskDialogTitle.textContent = selectedProject.name;
  renderComments(task);
  taskDialog.showModal();
  taskForm.elements.title.focus();
}

function populateTaskSelects() {
  assigneeSelect.innerHTML = `<option value="">Unassigned</option>${people
    .map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`)
    .join("")}`;

  statusSelect.innerHTML = statuses
    .map((status) => `<option value="${status.id}">${status.label}</option>`)
    .join("");
}

async function createProject(formData) {
  const project = {
    id: makeId("project"),
    name: formData.get("name").trim(),
    description: formData.get("description").trim(),
    createdAt: new Date().toISOString(),
  };

  state.projects.unshift(project);
  state.selectedProjectId = project.id;
  saveState();
  render();

  try {
    await persistProject(project);
  } catch (error) {
    showStorageError(error, "Project was saved locally, but not to Supabase.");
  }
}

async function deleteSelectedProject() {
  const selectedProject = getSelectedProject();
  if (!selectedProject) return;

  const projectTasks = state.tasks.filter((task) => task.projectId === selectedProject.id);
  const taskCopy = projectTasks.length === 1 ? "1 task" : `${projectTasks.length} tasks`;
  const confirmed = window.confirm(
    `Delete "${selectedProject.name}" and its ${taskCopy}? This cannot be undone.`,
  );

  if (!confirmed) return;

  state.projects = state.projects.filter((project) => project.id !== selectedProject.id);
  state.tasks = state.tasks.filter((task) => task.projectId !== selectedProject.id);
  state.selectedProjectId = state.projects[0]?.id || "";
  saveState();
  render();

  try {
    await removeProject(selectedProject.id);
  } catch (error) {
    showStorageError(error, "Project was removed locally, but not from Supabase.");
  }
}

async function saveTask(formData) {
  const taskId = formData.get("taskId");
  const existingTask = state.tasks.find((task) => task.id === taskId);
  const nextTask = {
    id: existingTask ? existingTask.id : makeId("task"),
    projectId: existingTask ? existingTask.projectId : state.selectedProjectId,
    title: formData.get("title").trim(),
    description: formData.get("description").trim(),
    assigneeId: formData.get("assigneeId"),
    priority: formData.get("priority"),
    status: formData.get("status"),
    dueDate: formData.get("dueDate"),
    comments: existingTask ? existingTask.comments || [] : [],
    updatedAt: new Date().toISOString(),
    createdAt: existingTask ? existingTask.createdAt : new Date().toISOString(),
  };

  if (existingTask) {
    state.tasks = state.tasks.map((task) => (task.id === existingTask.id ? nextTask : task));
  } else {
    state.tasks.unshift(nextTask);
  }

  saveState();
  render();

  try {
    await persistTask(nextTask);
  } catch (error) {
    showStorageError(error, "Task was saved locally, but not to Supabase.");
  }
}

async function deleteCurrentTask() {
  const taskId = taskForm.elements.taskId.value;
  if (!taskId) return;
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  saveState();
  taskDialog.close();
  render();

  try {
    await removeTask(taskId);
  } catch (error) {
    showStorageError(error, "Task was removed locally, but not from Supabase.");
  }
}

async function moveTaskToStatus(taskId, statusId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || task.status === statusId) return;

  const updatedAt = new Date().toISOString();
  state.tasks = state.tasks.map((item) =>
    item.id === taskId ? { ...item, status: statusId, updatedAt } : item,
  );
  saveState();
  renderBoard();
  renderProjects();

  try {
    await updateTaskStatus(taskId, statusId, updatedAt);
  } catch (error) {
    showStorageError(error, "Status changed locally, but not in Supabase.");
  }
}

function getCurrentDialogTask() {
  const taskId = taskForm.elements.taskId.value;
  return state.tasks.find((task) => task.id === taskId);
}

function getCommentTotal(task) {
  return (task.comments || []).reduce((total, comment) => total + 1 + (comment.replies || []).length, 0);
}

function renderComments(task = getCurrentDialogTask()) {
  if (!task) {
    commentList.innerHTML = "";
    commentCount.textContent = "0";
    return;
  }

  const comments = task.comments || [];
  commentCount.textContent = getCommentTotal(task);
  commentInput.value = "";
  commentList.innerHTML =
    comments
      .map(
        (comment) => `
          <article class="comment" data-comment-id="${comment.id}">
            <div class="comment-body">
              <p>${escapeHtml(comment.body)}</p>
              <time>${formatDateTime(comment.createdAt)}</time>
            </div>
            <div class="reply-list">
              ${(comment.replies || [])
                .map(
                  (reply) => `
                    <div class="comment reply">
                      <div class="comment-body">
                        <p>${escapeHtml(reply.body)}</p>
                        <time>${formatDateTime(reply.createdAt)}</time>
                      </div>
                    </div>
                  `,
                )
                .join("")}
            </div>
            <div class="reply-composer">
              <textarea rows="2" maxlength="320" placeholder="Reply"></textarea>
              <button type="button" class="ghost-button" data-reply-button>Reply</button>
            </div>
          </article>
        `,
      )
      .join("") || `<div class="empty-projects">No comments yet</div>`;
}

async function addComment() {
  const body = commentInput.value.trim();
  const task = getCurrentDialogTask();
  if (!task || !body) return;

  const comment = {
    id: makeId("comment"),
    body,
    createdAt: new Date().toISOString(),
    replies: [],
  };

  state.tasks = state.tasks.map((item) =>
    item.id === task.id
      ? { ...item, comments: [...(item.comments || []), comment], updatedAt: new Date().toISOString() }
      : item,
  );
  saveState();
  renderBoard();
  renderComments();

  try {
    await persistComment(task.id, comment);
  } catch (error) {
    showStorageError(error, "Comment was saved locally, but not to Supabase.");
  }
}

async function addReply(commentId, body) {
  const task = getCurrentDialogTask();
  if (!task || !body) return;

  const reply = {
    id: makeId("reply"),
    body,
    createdAt: new Date().toISOString(),
  };

  state.tasks = state.tasks.map((item) => {
    if (item.id !== task.id) return item;
    return {
      ...item,
      comments: (item.comments || []).map((comment) =>
        comment.id === commentId
          ? { ...comment, replies: [...(comment.replies || []), reply] }
          : comment,
      ),
      updatedAt: new Date().toISOString(),
    };
  });
  saveState();
  renderBoard();
  renderComments();

  try {
    await persistComment(task.id, reply, commentId);
  } catch (error) {
    showStorageError(error, "Reply was saved locally, but not to Supabase.");
  }
}

function setBusy(isBusy) {
  [newProjectButton, newTaskButton, deleteProjectButton, addCommentButton].forEach((button) => {
    button.disabled = isBusy;
  });
}

function showStorageError(error, fallbackMessage) {
  console.error(error);
  window.alert(`${fallbackMessage}\n\n${error.message || error}`);
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitials(name) {
  return name
    .replace(/[^a-zA-Z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clearDragState() {
  draggedTaskId = "";
  board.querySelectorAll(".task-list.is-drop-target").forEach((list) => {
    list.classList.remove("is-drop-target");
  });
  board.querySelectorAll(".task-card.is-dragging").forEach((card) => {
    card.classList.remove("is-dragging");
  });
}

newProjectButton.addEventListener("click", openProjectDialog);
newTaskButton.addEventListener("click", () => openTaskDialog());
deleteProjectButton.addEventListener("click", deleteSelectedProject);
searchInput.addEventListener("input", renderBoard);
addCommentButton.addEventListener("click", addComment);
commentInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    addComment();
  }
});

projectList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-project-id]");
  if (!button) return;
  state.selectedProjectId = button.dataset.projectId;
  saveState();
  render();
});

board.addEventListener("click", (event) => {
  if (Date.now() < suppressTaskClickUntil) return;
  const button = event.target.closest("[data-task-id]");
  if (!button) return;
  openTaskDialog(button.dataset.taskId);
});

board.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-task-id]");
  if (!card) return;

  draggedTaskId = card.dataset.taskId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedTaskId);
  card.classList.add("is-dragging");
});

board.addEventListener("dragend", (event) => {
  const card = event.target.closest("[data-task-id]");
  if (card) card.classList.remove("is-dragging");
  clearDragState();
  suppressTaskClickUntil = Date.now() + 250;
});

board.addEventListener("dragover", (event) => {
  const list = event.target.closest("[data-status-id]");
  if (!list || !draggedTaskId) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  board.querySelectorAll(".task-list.is-drop-target").forEach((target) => {
    if (target !== list) target.classList.remove("is-drop-target");
  });
  list.classList.add("is-drop-target");
});

board.addEventListener("dragleave", (event) => {
  const list = event.target.closest("[data-status-id]");
  if (!list || list.contains(event.relatedTarget)) return;
  list.classList.remove("is-drop-target");
});

board.addEventListener("drop", (event) => {
  const list = event.target.closest("[data-status-id]");
  if (!list) return;

  event.preventDefault();
  const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
  suppressTaskClickUntil = Date.now() + 250;
  clearDragState();
  moveTaskToStatus(taskId, list.dataset.statusId);
});

projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createProject(new FormData(projectForm));
  projectDialog.close();
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveTask(new FormData(taskForm));
  taskDialog.close();
});

deleteTaskButton.addEventListener("click", deleteCurrentTask);

commentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-reply-button]");
  if (!button) return;

  const comment = button.closest("[data-comment-id]");
  const textarea = comment.querySelector(".reply-composer textarea");
  const body = textarea.value.trim();
  if (!body) return;

  addReply(comment.dataset.commentId, body);
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

init();
