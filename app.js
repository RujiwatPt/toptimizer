const people = [
  { id: "person-15", name: "อชิ(Achi)" },
  { id: "person-06", name: "อะตอม(Atom)" },
  { id: "person-08", name: "แชมป์(Champ)" },
  { id: "person-07", name: "ชาลี(Charlie)" },
  { id: "person-17", name: "โชกุน(Chokun)" },
  { id: "person-02", name: "สิทธ์(Cid)" },
  { id: "person-19", name: "เอิร์ธ(Earth)" },
  { id: "person-18", name: "เฟิร์ส(First)" },
  { id: "person-24", name: "ฟลุค(fluke)" },
  { id: "person-14", name: "ฟลู๊ค(Fulke)" },
  { id: "person-12", name: "ฮิวโก้(Hugo)" },
  { id: "person-11", name: "จันทร์เจ้า(Janjao)" },
  { id: "person-16", name: "จิม(Jim)" },
  { id: "person-09", name: "ข้าวปั้น(Khawpun)" },
  { id: "person-03", name: "หลวง(Luang)" },
  { id: "person-25", name: "น้องจิม(N' JIM)" },
  { id: "person-10", name: "เนเน่(Nene)" },
  { id: "person-20", name: "เเพม(Pam)" },
  { id: "person-13", name: "ภีม(Peem)" },
  { id: "person-01", name: "พจน์(Poj)" },
  { id: "person-05", name: "ปอ(Por)" },
  { id: "person-21", name: "เรน(Rain)" },
  { id: "person-04", name: "ไทม์(Time)" },
  { id: "person-23", name: "วิน(Wind)" },
  { id: "person-22", name: "ยู้(Yuu)" },
  { id: "person-26", name: "AJ'Art" },
  { id: "person-27", name: "AJ'Looksorn" },
  { id: "person-28", name: "AJ'Lee" },
  { id: "person-29", name: "AJ'Best" },
  { id: "person-30", name: "AJ'Mon" },
  { id: "person-31", name: "AJ'Baifern" },
];

const statuses = [
  { id: "todo", label: "Todo" },
  { id: "in-progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

const storageKey = "toptimizer-task-manager-v1";
const selectedProjectKey = "toptimizer-selected-project";
const commentAuthorKey = "toptimizer-comment-author";
const activeViewKey = "toptimizer-active-view";

const defaultState = {
  selectedProjectId: "",
  projects: [],
  tasks: [],
  calendarEvents: [],
};

let state = { ...defaultState };
let draggedTaskId = "";
let suppressTaskClickUntil = 0;
let activeMobileStatus = "all";
let activeView = localStorage.getItem(activeViewKey) === "calendar" ? "calendar" : "tasks";
let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let supabaseClient = null;
let isSharedMode = false;

const projectList = document.querySelector("#projectList");
const projectPanel = document.querySelector("#projectPanel");
const memberList = document.querySelector("#memberList");
const memberCount = document.querySelector("#memberCount");
const workspaceEyebrow = document.querySelector("#workspaceEyebrow");
const projectTitle = document.querySelector("#projectTitle");
const mobileProjectSelect = document.querySelector("#mobileProjectSelect");
const statusTabs = document.querySelector("#statusTabs");
const board = document.querySelector("#board");
const taskView = document.querySelector("#taskView");
const calendarView = document.querySelector("#calendarView");
const tasksViewButton = document.querySelector("#tasksViewButton");
const calendarViewButton = document.querySelector("#calendarViewButton");
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
const commentAuthorSelect = document.querySelector("#commentAuthorSelect");
const commentCount = document.querySelector("#commentCount");
const addCommentButton = document.querySelector("#addCommentButton");
const calendarMonthLabel = document.querySelector("#calendarMonthLabel");
const calendarGrid = document.querySelector("#calendarGrid");
const previousMonthButton = document.querySelector("#previousMonthButton");
const nextMonthButton = document.querySelector("#nextMonthButton");
const todayButton = document.querySelector("#todayButton");
const newEventButton = document.querySelector("#newEventButton");
const eventDialog = document.querySelector("#eventDialog");
const eventForm = document.querySelector("#eventForm");
const eventDialogMode = document.querySelector("#eventDialogMode");
const eventDialogTitle = document.querySelector("#eventDialogTitle");
const eventUserSelect = document.querySelector("#eventUserSelect");
const eventAttendeeMenu = document.querySelector("#eventAttendeeMenu");
const eventAttendeeList = document.querySelector("#eventAttendeeList");
const eventAttendeeInputs = document.querySelector("#eventAttendeeInputs");
const deleteEventButton = document.querySelector("#deleteEventButton");
let selectedEventAttendeeIds = [];

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
  document.body.dataset.storageMode = isSharedMode ? "shared" : "local";
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
  const [
    { data: projects, error: projectsError },
    { data: tasks, error: tasksError },
    { data: comments, error: commentsError },
    { data: calendarEvents, error: calendarEventsError },
  ] =
    await Promise.all([
      supabaseClient.from("projects").select("*").order("created_at", { ascending: false }),
      supabaseClient.from("tasks").select("*").order("created_at", { ascending: false }),
      supabaseClient.from("comments").select("*").order("created_at", { ascending: true }),
      supabaseClient.from("calendar_events").select("*").order("date", { ascending: true }),
    ]);

  if (projectsError || tasksError || commentsError || calendarEventsError) {
    throw projectsError || tasksError || commentsError || calendarEventsError;
  }

  const commentsByTask = buildCommentsByTask(comments || []);
  await migrateBacklogTasksToTodo(tasks || []);
  state = normalizeState({
    selectedProjectId: localStorage.getItem(selectedProjectKey) || "",
    projects: (projects || []).map(mapProjectFromRow),
    tasks: (tasks || []).map((task) => ({
      ...mapTaskFromRow(task),
      comments: commentsByTask.get(task.id) || [],
    })),
    calendarEvents: (calendarEvents || []).map(mapCalendarEventFromRow),
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
      status: normalizeTaskStatus(task.status),
      comments: Array.isArray(task.comments)
        ? task.comments.map((comment) => ({
            ...comment,
            authorId: comment.authorId || "",
            authorName: comment.authorName || "Unknown",
            replies: Array.isArray(comment.replies) ? comment.replies : [],
          }))
        : [],
    })),
    calendarEvents: Array.isArray(nextState.calendarEvents)
      ? nextState.calendarEvents.map((event) => ({
          ...event,
          userId: event.userId || "",
          attendeeIds: normalizeCalendarAttendees(event),
          date: event.date || toDateInputValue(new Date()),
          startTime: event.startTime || "",
          endTime: event.endTime || "",
          description: event.description || "",
        }))
      : [],
  };
}

function normalizeTaskStatus(status) {
  return status === "backlog" ? "todo" : status;
}

function normalizeCalendarAttendees(event) {
  const attendeeIds = Array.isArray(event.attendeeIds) ? event.attendeeIds.filter(Boolean) : [];
  const legacyUserId = event.userId ? [event.userId] : [];
  return [...new Set([...attendeeIds, ...legacyUserId])];
}

async function migrateBacklogTasksToTodo(tasks) {
  if (!isSharedMode) return;
  const backlogTaskIds = tasks.filter((task) => task.status === "backlog").map((task) => task.id);
  if (backlogTaskIds.length === 0) return;

  const { error } = await supabaseClient
    .from("tasks")
    .update({ status: "todo", updated_at: new Date().toISOString() })
    .in("id", backlogTaskIds);
  if (error) throw error;
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
    author_id: comment.authorId || null,
    author_name: comment.authorName || "Unknown",
    body: comment.body,
    created_at: comment.createdAt,
  });
  if (error) throw error;
}

async function persistCalendarEvent(event) {
  if (!isSharedMode) return;
  const { error } = await supabaseClient.from("calendar_events").upsert(mapCalendarEventToRow(event));
  if (error) throw error;
}

async function removeCalendarEvent(eventId) {
  if (!isSharedMode) return;
  const { error } = await supabaseClient.from("calendar_events").delete().eq("id", eventId);
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
    status: normalizeTaskStatus(row.status),
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
    status: normalizeTaskStatus(task.status),
    due_date: task.dueDate || null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

function mapCommentFromRow(row) {
  return {
    id: row.id,
    authorId: row.author_id || "",
    authorName: row.author_name || "Unknown",
    body: row.body,
    createdAt: row.created_at,
    replies: [],
  };
}

function mapCalendarEventFromRow(row) {
  const attendeeIds = Array.isArray(row.attendee_ids) ? row.attendee_ids : [];
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    userId: row.user_id || "",
    attendeeIds: [...new Set([...attendeeIds, row.user_id].filter(Boolean))],
    date: row.date,
    startTime: row.start_time || "",
    endTime: row.end_time || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCalendarEventToRow(event) {
  return {
    id: event.id,
    title: event.title,
    description: event.description || "",
    user_id: event.attendeeIds?.[0] || event.userId || null,
    attendee_ids: normalizeCalendarAttendees(event),
    date: event.date,
    start_time: event.startTime || null,
    end_time: event.endTime || null,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
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
  renderActiveView();
  renderCalendar();
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
  renderCommentAuthorOptions();
}

function renderCommentAuthorOptions() {
  const selectedAuthorId = localStorage.getItem(commentAuthorKey) || people[0]?.id || "";
  commentAuthorSelect.innerHTML = people
    .map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`)
    .join("");
  commentAuthorSelect.value = people.some((person) => person.id === selectedAuthorId)
    ? selectedAuthorId
    : people[0]?.id || "";
  localStorage.setItem(commentAuthorKey, commentAuthorSelect.value);
}

function renderActiveView() {
  const isCalendar = activeView === "calendar";
  document.body.dataset.activeView = activeView;
  projectPanel.hidden = isCalendar;
  taskView.hidden = isCalendar;
  calendarView.hidden = !isCalendar;
  workspaceEyebrow.textContent = isCalendar ? "Team calendar" : "Project task manager";
  projectTitle.textContent = isCalendar ? "Calendar" : getSelectedProject()?.name || "Create a project";
  tasksViewButton.classList.toggle("is-active", !isCalendar);
  calendarViewButton.classList.toggle("is-active", isCalendar);
  tasksViewButton.setAttribute("aria-selected", String(!isCalendar));
  calendarViewButton.setAttribute("aria-selected", String(isCalendar));
  searchInput.closest(".search").hidden = isCalendar;
  newTaskButton.hidden = isCalendar;
  deleteProjectButton.hidden = isCalendar;
  newEventButton.hidden = !isCalendar;
}

function renderProjects() {
  if (state.projects.length === 0) {
    projectList.innerHTML = `<div class="empty-projects">No projects yet. Create one when you are ready.</div>`;
    if (activeView !== "calendar") projectTitle.textContent = "Create a project";
    newTaskButton.disabled = true;
    deleteProjectButton.disabled = true;
    mobileProjectSelect.disabled = true;
    mobileProjectSelect.innerHTML = `<option>No projects</option>`;
    return;
  }

  if (!getSelectedProject()) {
    state.selectedProjectId = state.projects[0].id;
    saveState();
  }

  newTaskButton.disabled = false;
  deleteProjectButton.disabled = false;
  mobileProjectSelect.disabled = false;
  mobileProjectSelect.innerHTML = state.projects
    .map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`)
    .join("");
  mobileProjectSelect.value = state.selectedProjectId;
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
  if (activeView !== "calendar") {
    projectTitle.textContent = selectedProject ? selectedProject.name : "Create a project";
  }
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
  renderStatusTabs(projectTasks);

  if (!selectedProject) {
    board.innerHTML = `<div class="empty-board">Create a project first, then add tasks and assign them to your team.</div>`;
    return;
  }

  board.innerHTML = statuses
    .map((status) => {
      const tasks = visibleTasks.filter((task) => task.status === status.id);
      const mobileVisibleClass =
        activeMobileStatus === "all" || activeMobileStatus === status.id ? " is-mobile-visible" : "";
      return `
        <section class="column${mobileVisibleClass}" aria-label="${status.label}" data-column-status="${status.id}">
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

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstGridDate = new Date(year, month, 1 - firstOfMonth.getDay());
  const todayValue = toDateInputValue(new Date());
  const selectedUserId = commentAuthorSelect.value || people[0]?.id || "";
  const visibleEvents = state.calendarEvents
    .filter((event) => getCalendarAttendeeIds(event).includes(selectedUserId))
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const eventsByDate = visibleEvents.reduce((map, event) => {
    map.set(event.date, [...(map.get(event.date) || []), event]);
    return map;
  }, new Map());

  calendarMonthLabel.textContent = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(calendarCursor);

  calendarGrid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDate);
    date.setDate(firstGridDate.getDate() + index);
    const dateValue = toDateInputValue(date);
    const dayEvents = eventsByDate.get(dateValue) || [];
    const mutedClass = date.getMonth() === month ? "" : " is-muted";
    const todayClass = dateValue === todayValue ? " is-today" : "";
    const emptyClass = dayEvents.length === 0 ? " is-empty" : "";
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
    return `
      <section class="calendar-day${mutedClass}${todayClass}${emptyClass}" data-calendar-date="${dateValue}">
        <button class="calendar-day-number" type="button" data-new-event-date="${dateValue}" aria-label="Create event on ${formatFullDate(dateValue)}">
          <span class="calendar-day-name">${weekday}</span>
          ${date.getDate()}
        </button>
        <div class="calendar-events">
          ${
            dayEvents
              .map((event) => {
                const attendeeNames = getCalendarAttendeeNames(event);
                return `
                  <button class="calendar-event" type="button" data-event-id="${event.id}">
                    <strong>${escapeHtml(event.title)}</strong>
                    <span>${escapeHtml(formatEventTime(event))}${attendeeNames ? ` &middot; ${escapeHtml(attendeeNames)}` : ""}</span>
                  </button>
                `;
              })
              .join("") || ""
          }
        </div>
      </section>
    `;
  }).join("");
}

function getCalendarAttendeeIds(event) {
  return normalizeCalendarAttendees(event);
}

function getCalendarAttendeeNames(event) {
  const names = getCalendarAttendeeIds(event)
    .map((personId) => getPerson(personId)?.name)
    .filter(Boolean);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function renderStatusTabs(projectTasks) {
  const allActive = activeMobileStatus === "all" ? " is-active" : "";
  const statusButtons = statuses
    .map((status) => {
      const count = projectTasks.filter((task) => task.status === status.id).length;
      const activeClass = activeMobileStatus === status.id ? " is-active" : "";
      return `
        <button class="status-tab${activeClass}" type="button" data-mobile-status="${status.id}" role="tab" aria-selected="${activeMobileStatus === status.id}">
          <span>${status.label}</span>
          <strong>${count}</strong>
        </button>
      `;
    })
    .join("");

  statusTabs.innerHTML = `
    <button class="status-tab${allActive}" type="button" data-mobile-status="all" role="tab" aria-selected="${activeMobileStatus === "all"}">
      <span>All</span>
      <strong>${projectTasks.length}</strong>
    </button>
    ${statusButtons}
  `;
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

function openEventDialog(eventId = "", dateValue = "") {
  populateEventSelects();
  const event = state.calendarEvents.find((item) => item.id === eventId);
  const attendeeIds = event ? getCalendarAttendeeIds(event) : [commentAuthorSelect.value || people[0]?.id].filter(Boolean);
  selectedEventAttendeeIds = attendeeIds.length === people.length ? ["all"] : attendeeIds;
  eventForm.reset();
  eventForm.elements.eventId.value = event ? event.id : "";
  eventForm.elements.title.value = event ? event.title : "";
  renderEventAttendeePicker();
  eventForm.elements.date.value = event ? event.date : dateValue || toDateInputValue(new Date());
  eventForm.elements.startTime.value = event ? event.startTime : "09:00";
  eventForm.elements.endTime.value = event ? event.endTime : "10:00";
  eventForm.elements.description.value = event ? event.description : "";
  deleteEventButton.hidden = !event;
  eventDialogMode.textContent = event ? "Edit event" : "New event";
  eventDialogTitle.textContent = event ? formatFullDate(event.date) : "Calendar event";
  eventDialog.showModal();
  eventForm.elements.title.focus();
}

function populateEventSelects() {
  eventAttendeeMenu.innerHTML = `<button type="button" data-add-attendee="all">All</button>${people
    .map((person) => `<button type="button" data-add-attendee="${person.id}">${escapeHtml(person.name)}</button>`)
    .join("")}`;
  eventUserSelect.textContent = "Add invitee";
  eventAttendeeMenu.hidden = true;
}

function renderEventAttendeePicker() {
  const isAll = selectedEventAttendeeIds.includes("all");
  const attendeeIds = getSelectedEventAttendeeIds();
  eventAttendeeInputs.innerHTML = attendeeIds
    .map((personId) => `<input type="hidden" name="attendeeIds" value="${escapeHtml(personId)}" />`)
    .join("");

  if (isAll) {
    eventAttendeeList.innerHTML = `
      <span class="attendee-chip">
        All
        <button type="button" data-remove-attendee="all" aria-label="Remove All">×</button>
      </span>
    `;
    return;
  }

  eventAttendeeList.innerHTML =
    selectedEventAttendeeIds
      .map((personId) => {
        const person = getPerson(personId);
        if (!person) return "";
        return `
          <span class="attendee-chip">
            ${escapeHtml(person.name)}
            <button type="button" data-remove-attendee="${person.id}" aria-label="Remove ${escapeHtml(person.name)}">×</button>
          </span>
        `;
      })
      .join("") || `<span class="empty-attendees">No invitees yet</span>`;
}

function toggleEventAttendeeMenu() {
  eventAttendeeMenu.hidden = !eventAttendeeMenu.hidden;
}

function getSelectedEventAttendeeIds() {
  if (selectedEventAttendeeIds.includes("all")) {
    return people.map((person) => person.id);
  }
  return selectedEventAttendeeIds.filter((personId) => people.some((person) => person.id === personId));
}

function addEventAttendee(personId) {
  if (!personId) return;
  if (personId === "all") {
    selectedEventAttendeeIds = ["all"];
  } else if (!selectedEventAttendeeIds.includes("all") && !selectedEventAttendeeIds.includes(personId)) {
    selectedEventAttendeeIds = [...selectedEventAttendeeIds, personId];
  }
  eventAttendeeMenu.hidden = true;
  renderEventAttendeePicker();
}

function removeEventAttendee(personId) {
  selectedEventAttendeeIds = selectedEventAttendeeIds.filter((id) => id !== personId);
  renderEventAttendeePicker();
}

async function saveCalendarEvent(formData) {
  const eventId = formData.get("eventId");
  const existingEvent = state.calendarEvents.find((event) => event.id === eventId);
  const attendeeIds = formData.getAll("attendeeIds").filter(Boolean);
  if (attendeeIds.length === 0) {
    window.alert("Choose at least one invitee.");
    return;
  }
  const nextEvent = {
    id: existingEvent ? existingEvent.id : makeId("event"),
    title: formData.get("title").trim(),
    description: formData.get("description").trim(),
    userId: attendeeIds[0] || "",
    attendeeIds,
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    createdAt: existingEvent ? existingEvent.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existingEvent) {
    state.calendarEvents = state.calendarEvents.map((event) =>
      event.id === existingEvent.id ? nextEvent : event,
    );
  } else {
    state.calendarEvents = [...state.calendarEvents, nextEvent];
  }

  saveState();
  renderCalendar();

  try {
    await persistCalendarEvent(nextEvent);
  } catch (error) {
    showStorageError(error, "Event was saved locally, but not to Supabase.");
  }
}

async function deleteCurrentEvent() {
  const eventId = eventForm.elements.eventId.value;
  if (!eventId) return;
  state.calendarEvents = state.calendarEvents.filter((event) => event.id !== eventId);
  saveState();
  eventDialog.close();
  renderCalendar();

  try {
    await removeCalendarEvent(eventId);
  } catch (error) {
    showStorageError(error, "Event was removed locally, but not from Supabase.");
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
              <strong>${escapeHtml(comment.authorName || getPerson(comment.authorId)?.name || "Unknown")}</strong>
              <p>${escapeHtml(comment.body)}</p>
              <time>${formatDateTime(comment.createdAt)}</time>
            </div>
            <div class="reply-list">
              ${(comment.replies || [])
                .map(
                  (reply) => `
                    <div class="comment reply">
                      <div class="comment-body">
                        <strong>${escapeHtml(reply.authorName || getPerson(reply.authorId)?.name || "Unknown")}</strong>
                        <p>${escapeHtml(reply.body)}</p>
                        <time>${formatDateTime(reply.createdAt)}</time>
                      </div>
                    </div>
                  `,
                )
                .join("")}
            </div>
            <div class="reply-composer">
              <textarea rows="4" maxlength="1200" placeholder="Reply"></textarea>
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
  const author = getCommentAuthor();

  const comment = {
    id: makeId("comment"),
    authorId: author.id,
    authorName: author.name,
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
  const author = getCommentAuthor();

  const reply = {
    id: makeId("reply"),
    authorId: author.id,
    authorName: author.name,
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

function getCommentAuthor() {
  const author = getPerson(commentAuthorSelect.value) || people[0];
  localStorage.setItem(commentAuthorKey, author.id);
  return author;
}

function setBusy(isBusy) {
  [newProjectButton, newTaskButton, deleteProjectButton, addCommentButton, newEventButton].forEach((button) => {
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

function formatFullDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function formatEventTime(event) {
  const startTime = formatClockTime(event.startTime);
  const endTime = formatClockTime(event.endTime);
  if (startTime && endTime) return `${startTime}-${endTime}`;
  if (startTime) return startTime;
  return "All day";
}

function formatClockTime(value) {
  return value ? String(value).slice(0, 5) : "";
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
newEventButton.addEventListener("click", () => openEventDialog());
deleteProjectButton.addEventListener("click", deleteSelectedProject);
searchInput.addEventListener("input", renderBoard);
addCommentButton.addEventListener("click", addComment);
eventUserSelect.addEventListener("click", toggleEventAttendeeMenu);
eventAttendeeMenu.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-attendee]");
  if (!button) return;
  addEventAttendee(button.dataset.addAttendee);
});
eventAttendeeList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-attendee]");
  if (!button) return;
  removeEventAttendee(button.dataset.removeAttendee);
});
tasksViewButton.addEventListener("click", () => {
  activeView = "tasks";
  localStorage.setItem(activeViewKey, activeView);
  renderActiveView();
});
calendarViewButton.addEventListener("click", () => {
  activeView = "calendar";
  localStorage.setItem(activeViewKey, activeView);
  renderActiveView();
  renderCalendar();
});
commentAuthorSelect.addEventListener("change", () => {
  localStorage.setItem(commentAuthorKey, commentAuthorSelect.value);
  renderCalendar();
});
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

mobileProjectSelect.addEventListener("change", (event) => {
  state.selectedProjectId = event.target.value;
  saveState();
  render();
});

statusTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mobile-status]");
  if (!button) return;
  activeMobileStatus = button.dataset.mobileStatus;
  renderBoard();
});

previousMonthButton.addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  renderCalendar();
});

todayButton.addEventListener("click", () => {
  calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  renderCalendar();
});

calendarGrid.addEventListener("click", (event) => {
  const eventButton = event.target.closest("[data-event-id]");
  if (eventButton) {
    openEventDialog(eventButton.dataset.eventId);
    return;
  }

  const dateButton = event.target.closest("[data-new-event-date]");
  if (dateButton) {
    openEventDialog("", dateButton.dataset.newEventDate);
  }
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

eventForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCalendarEvent(new FormData(eventForm));
  eventDialog.close();
});

deleteTaskButton.addEventListener("click", deleteCurrentTask);
deleteEventButton.addEventListener("click", deleteCurrentEvent);

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
