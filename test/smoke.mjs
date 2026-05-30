// Smoke test for Toptimizer web UI.
// - Serves the repo over a local HTTP server (so the real CSP <meta> is active).
// - Intercepts config.js to inject a TEST config (no prod Supabase, no real password).
// - Scenario A: no password + no Supabase -> exercise the full UI in localStorage mode.
// - Scenario B: a known password hash -> verify the auth gate rejects/accepts.
// Touches NO production data.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = normalize(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const TODAY = new Date().toISOString().slice(0, 10);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

// Mirror generate-config.js / app.js hashing so Scenario B uses a valid hash.
function hashPassword(pw) {
  const inner = createHash("sha256").update(`toptimizer:${pw}`).digest("hex");
  const outer = createHash("sha256").update(`verify:s:${inner}`).digest("hex");
  return `v:${outer}`;
}
const TEST_PASSWORD = "smoke-pass-123";
const TEST_HASH = hashPassword(TEST_PASSWORD);

const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(req.url.split("?")[0]);
    const file = join(ROOT, path === "/" ? "index.html" : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;
const base = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  OK   ${label}`); } else { fail++; console.log(`  FAIL ${label}`); } };

const browser = await chromium.launch();

async function newPage(configBody) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/config.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: `window.TOPTIMIZER_CONFIG = ${configBody};` }),
  );
  return { ctx, page, errors };
}

// ---------- Scenario A: full UI in local mode ----------
console.log("=== Scenario A: full UI smoke (local mode, no prod writes) ===");
{
  const { ctx, page, errors } = await newPage(
    `{ "supabaseUrl": "", "supabaseAnonKey": "", "workspacePasswordHash": "" }`,
  );
  await page.goto(base, { waitUntil: "networkidle" });

  await ok(await page.locator("#authGate").isHidden(), "gate auto-opens when no password configured");
  await page.waitForSelector("#memberList .member, #memberList > *");
  ok((await page.locator("#memberCount").textContent()).trim() === "31", "team renders 31 members");

  // Create project
  await page.click("#newProjectButton");
  await page.fill('#projectForm input[name="name"]', "Smoke Project");
  await page.click('#projectForm button[type="submit"]');
  await ok((await page.locator("#projectList").innerText()).includes("Smoke Project"), "create project");

  // Create task
  await page.click("#newTaskButton");
  await page.fill('#taskForm input[name="title"]', "Smoke Task");
  await page.selectOption('#taskForm select[name="priority"]', "high");
  await page.click('#taskForm button[type="submit"]');
  await page.waitForSelector(".task-card");
  await ok((await page.locator("#board").innerText()).includes("Smoke Task"), "create task (appears on board)");
  ok((await page.locator("#totalTasks").textContent()).trim() === "1", "stats: total tasks = 1");

  // Search filter
  await page.fill("#searchInput", "zzz-no-match");
  await ok(!(await page.locator("#board").innerText()).includes("Smoke Task"), "search filters out non-matching task");
  await page.fill("#searchInput", "Smoke");
  await ok((await page.locator("#board").innerText()).includes("Smoke Task"), "search shows matching task");
  await page.fill("#searchInput", "");

  // Open task -> add comment
  await page.click(".task-card");
  await page.waitForSelector("#taskDialog[open]");
  await ok(await page.locator("#commentsPanel").isVisible(), "comments panel visible on existing task");
  await page.fill("#commentInput", "Looks good");
  await page.click("#addCommentButton");
  await ok((await page.locator("#commentList").innerText()).includes("Looks good"), "add comment");
  ok((await page.locator("#commentCount").textContent()).trim() === "1", "comment count = 1");
  await page.locator("#taskDialog [data-close]").click();

  // Calendar view + new event
  await page.click("#calendarViewButton");
  await ok(await page.locator("#calendarView").isVisible(), "switch to calendar view");
  ok((await page.locator("#calendarGrid > *").count()) === 42, "calendar grid has 42 cells");
  await page.click("#newEventButton");
  await page.fill('#eventForm input[name="title"]', "Smoke Event");
  await page.fill('#eventForm input[name="date"]', TODAY);
  await page.click('#eventForm button[type="submit"]');
  await ok((await page.locator("#calendarGrid").innerText()).includes("Smoke Event"), "create calendar event");

  // Budget view + new entry
  await page.click("#budgetViewButton");
  await ok(await page.locator("#budgetView").isVisible(), "switch to budget view");
  await page.click("#newBudgetButton");
  await page.fill('#budgetForm input[name="label"]', "Smoke Income");
  await page.fill('#budgetForm input[name="amount"]', "100");
  await page.fill('#budgetForm input[name="date"]', TODAY);
  await page.click('#budgetForm button[type="submit"]');
  await ok((await page.locator("#budgetList").innerText()).includes("Smoke Income"), "create budget entry");
  await ok((await page.locator("#budgetIncomeTotal").textContent()).replace(/\D/g, "") !== "0", "budget income total updates");

  // Persistence across reload (localStorage)
  await page.reload({ waitUntil: "networkidle" });
  await ok((await page.locator("#projectList").innerText()).includes("Smoke Project"), "data persists across reload");

  ok(errors.length === 0, `no console/page errors (saw ${errors.length}${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""})`);
  await ctx.close();
}

// ---------- Scenario B: auth gate ----------
console.log("=== Scenario B: auth gate (wrong rejected, correct accepted) ===");
{
  const { ctx, page, errors } = await newPage(
    `{ "supabaseUrl": "", "supabaseAnonKey": "", "workspacePasswordHash": "${TEST_HASH}" }`,
  );
  await page.goto(base, { waitUntil: "networkidle" });

  await ok(await page.locator("#authGate").isVisible(), "gate shown when password configured");

  await page.fill('#authForm input[name="password"]', "wrong-password");
  await page.click('#authForm button[type="submit"]');
  await page.waitForTimeout(150);
  await ok(await page.locator("#authError").isVisible(), "wrong password shows error");
  await ok(await page.locator("#authGate").isVisible(), "wrong password keeps gate closed");

  await page.fill('#authForm input[name="password"]', TEST_PASSWORD);
  await page.click('#authForm button[type="submit"]');
  await page.waitForTimeout(150);
  await ok(await page.locator("#authGate").isHidden(), "correct password unlocks app");

  ok(errors.length === 0, `no console/page errors (saw ${errors.length}${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""})`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n=== RESULT: pass=${pass} fail=${fail} ===`);
process.exit(fail ? 1 : 0);
