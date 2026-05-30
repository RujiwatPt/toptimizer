const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const configPath = path.join(rootDir, "config.js");

function parseEnv(source) {
  return source.split(/\r?\n/).reduce((env, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return env;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return env;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    return env;
  }, {});
}

// Produces a double-hash stored in config.js.
// inner = sha256("toptimizer:<password>")  — stored in sessionStorage on auth
// outer = sha256("verify:s:<inner_hex>")   — stored in config.js
// Reading config.js gives only the outer hash; you cannot reverse it to forge
// the sessionStorage value, so config.js exposure cannot bypass the gate.
function hashPassword(password) {
  if (!password) return "";
  const inner = createHash("sha256").update(`toptimizer:${password}`).digest("hex");
  const outer = createHash("sha256").update(`verify:s:${inner}`).digest("hex");
  return `v:${outer}`;
}

const env = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, "utf8")) : {};
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const workspacePassword =
  process.env.WORKSPACE_PASSWORD || env.WORKSPACE_PASSWORD || "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env",
  );
}

const config = `window.TOPTIMIZER_CONFIG = ${JSON.stringify(
  {
    supabaseUrl,
    supabaseAnonKey,
    workspacePasswordHash: hashPassword(workspacePassword),
  },
  null,
  2,
)};\n`;

fs.writeFileSync(configPath, config);
console.log("Generated config.js from .env");
