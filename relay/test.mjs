// SPDX-License-Identifier: CC0-1.0
// Tests for the relay, with an in-memory KV:  node relay/test.mjs
import worker, { parseSubmission } from "./worker.js";

let fails = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { fails++; console.error("FAIL", what); } };

class KV {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v) { this.m.set(k, v); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix }) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
const env = { SUBMISSIONS: new KV(), PULL_TOKEN: "secret-token", SALT: "salt" };
const call = (method, path, body, headers = {}) =>
  worker.fetch(new Request("https://relay.test" + path, { method, body, headers: { "cf-connecting-ip": "1.2.3.4", ...headers } }), env);

const good = "Gala\tFreed From Desire\tEmile & Image\tLes Demons De Minuit\t3\t2026-09-25T08:40Z\n" +
             "\tYann Muller - Mourir Sur Scene\tNelly\tDilemma\n" +
             "# a comment\nbad\tline\n" +
             "A\tSame\tA\tSame\n" +
             "Gala\tFreed From Desire\tEmile & Image\tLes Demons De Minuit\n";

// parsing: artist split, date and count dropped (count 1), comments/bad/self/duplicate skipped
const p = parseSubmission(good);
check(p.length === 2, "two valid transitions, got " + p.length);
check(p[0] === "Gala\tFreed From Desire\tEmile & Image\tLes Demons De Minuit\t1", "count forced to 1, date dropped");
check(p[1].startsWith("Yann Muller\tMourir Sur Scene\tNelly\tDilemma"), "artist split from the title");

// submit
let r = await call("POST", "/submit", good);
check(r.status === 200 && (await r.json()).accepted === 2, "submit accepted 2");
r = await call("POST", "/submit", "nothing\tvalid\n");
check(r.status === 400, "invalid submission refused");
r = await call("POST", "/submit", "x".repeat(70 * 1024));
check(r.status === 413, "too big refused");

// rate limit: 12 a day from one place (one used above; the 400 and 413 do not count)
for (let i = 0; i < 11; i++) await call("POST", "/submit", good);
r = await call("POST", "/submit", good);
check(r.status === 429, "13th submission of the day refused, got " + r.status);
r = await call("POST", "/submit", good, { "cf-connecting-ip": "5.6.7.8" });
check(r.status === 200, "another place still accepted");

// pending and ack need the token
r = await call("GET", "/pending");
check(r.status === 401, "pending without token refused");
r = await call("GET", "/pending", undefined, { authorization: "Bearer wrong" });
check(r.status === 401, "pending with a wrong token refused");
r = await call("GET", "/pending", undefined, { authorization: "Bearer secret-token" });
const list = await r.json();
check(r.status === 200 && list.length === 13, "13 submissions pending, got " + list.length);
check(list.every((s) => s.key.startsWith("sub:") && s.tsv.split("\n").length === 2), "each holds its 2 lines");
check(![...env.SUBMISSIONS.m.values()].some((v) => String(v).includes("1.2.3.4")), "no IP address stored");

r = await call("POST", "/ack", JSON.stringify(list.map((s) => s.key)), { authorization: "Bearer secret-token" });
check(r.status === 200 && (await r.json()).deleted === 13, "ack deleted 13");
r = await call("GET", "/pending", undefined, { authorization: "Bearer secret-token" });
check((await r.json()).length === 0, "nothing pending after ack");
r = await call("POST", "/ack", JSON.stringify(["rl:anything"]), { authorization: "Bearer secret-token" });
check((await r.json()).deleted === 0, "ack never deletes rate-limit keys");

r = await call("GET", "/");
check(r.status === 200, "home page");
r = await call("GET", "/nope");
check(r.status === 404, "unknown path");

console.log(`${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
