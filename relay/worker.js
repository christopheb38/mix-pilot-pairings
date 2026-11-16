// SPDX-License-Identifier: CC0-1.0
//
// Mix Pilot sharing relay: a Cloudflare Worker that receives the transitions decks share,
// checks them, and keeps them until the pairings repository's daily merge collects them.
//
// It never touches GitHub: the repository pulls from here with a secret token, merges, checks
// and publishes. Nothing here can write to the repository, and nothing identifies a deck: the
// IP address is used only, salted and hashed per day, to cap how often one place can send.
//
//   POST /submit            body: transitions, one per line, tab-separated
//                           "From artist  From title  To artist  To title [count [date]]"
//   GET  /pending           (Authorization: Bearer PULL_TOKEN) the stored submissions
//   POST /ack               (Authorization: Bearer PULL_TOKEN) body: JSON list of keys to drop
//
// Bindings: KV namespace SUBMISSIONS; secrets PULL_TOKEN and SALT.

const MAX_BODY = 64 * 1024;        // bytes per submission
const MAX_LINES = 300;             // transitions per submission
const MAX_FIELD = 200;             // characters per artist or title
const PER_DAY = 12;                // submissions a day from one place
const KEEP_DAYS = 30;              // a submission not collected in time expires

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

async function sha256(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clean(field) {
  // one line of plain text: no control characters, single spaces, trimmed
  return field.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

// Splits "Artist - Title" when the artist field is empty (tracks without an artist tag).
function fixPair(artist, title) {
  if (!artist && title.includes(" - ")) {
    const i = title.indexOf(" - ");
    return [title.slice(0, i).trim(), title.slice(i + 3).trim()];
  }
  return [artist, title];
}

export function parseSubmission(text) {
  const out = [], seen = new Set();
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim() || line.startsWith("#")) continue;
    const f = line.split("\t");
    if (f.length < 4) continue;
    let [a1, t1, a2, t2] = f.slice(0, 4).map(clean);
    [a1, t1] = fixPair(a1, t1);
    [a2, t2] = fixPair(a2, t2);
    if (![a1, t1, a2, t2].every((x) => x.length >= 1 && x.length <= MAX_FIELD)) continue;
    const key = [a1, t1, a2, t2].join("\t").toLowerCase();
    if (seen.has(key) || (a1.toLowerCase() === a2.toLowerCase() && t1.toLowerCase() === t2.toLowerCase())) continue;
    seen.add(key);
    out.push([a1, t1, a2, t2, "1"].join("\t"));   // one deck counts once per transition
    if (out.length >= MAX_LINES) break;
  }
  return out;
}

async function submit(req, env) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) return json({ error: "too big" }, 413);
  const text = await req.text();
  if (text.length > MAX_BODY) return json({ error: "too big" }, 413);
  const lines = parseSubmission(text);
  if (!lines.length) return json({ error: "no valid transition" }, 400);

  const day = new Date().toISOString().slice(0, 10);
  const ip = req.headers.get("cf-connecting-ip") || "unknown";
  const rl = `rl:${day}:${await sha256(`${env.SALT}|${day}|${ip}`)}`;
  const used = Number((await env.SUBMISSIONS.get(rl)) || 0);
  if (used >= PER_DAY) return json({ error: "too many submissions today" }, 429);
  await env.SUBMISSIONS.put(rl, String(used + 1), { expirationTtl: 2 * 86400 });

  const key = `sub:${new Date().toISOString()}:${crypto.randomUUID().slice(0, 8)}`;
  await env.SUBMISSIONS.put(key, lines.join("\n"), { expirationTtl: KEEP_DAYS * 86400 });
  return json({ accepted: lines.length });
}

function authorized(req, env) {
  const h = req.headers.get("authorization") || "";
  return env.PULL_TOKEN && h === `Bearer ${env.PULL_TOKEN}`;
}

async function pending(req, env) {
  if (!authorized(req, env)) return json({ error: "unauthorized" }, 401);
  const out = [];
  let cursor;
  do {
    const page = await env.SUBMISSIONS.list({ prefix: "sub:", cursor, limit: 1000 });
    for (const k of page.keys) {
      const v = await env.SUBMISSIONS.get(k.name);
      if (v) out.push({ key: k.name, tsv: v });
      if (out.length >= 5000) break;
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && out.length < 5000);
  return json(out);
}

async function ack(req, env) {
  if (!authorized(req, env)) return json({ error: "unauthorized" }, 401);
  let keys;
  try { keys = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!Array.isArray(keys)) return json({ error: "want a list" }, 400);
  let n = 0;
  for (const k of keys.slice(0, 5000))
    if (typeof k === "string" && k.startsWith("sub:")) { await env.SUBMISSIONS.delete(k); n++; }
  return json({ deleted: n });
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    try {
      if (req.method === "POST" && pathname === "/submit") return await submit(req, env);
      if (req.method === "GET" && pathname === "/pending") return await pending(req, env);
      if (req.method === "POST" && pathname === "/ack") return await ack(req, env);
      if (req.method === "GET" && pathname === "/")
        return new Response("Mix Pilot sharing relay - https://github.com/christopheb38/mix-pilot-pairings\n");
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: "server error" }, 500);
    }
  },
};
