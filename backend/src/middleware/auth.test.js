const test = require("node:test");
const assert = require("node:assert/strict");
const { authorize, isSessionExpired } = require("./auth");

function response() {
  return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
}

test("role authorization denies employees from protected administrative data", () => {
  const res = response();
  let nextCalled = false;
  authorize("admin", "hr")({ user: { role: "employee" } }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "Insufficient permissions");
  assert.equal(nextCalled, false);
});

test("role authorization permits HR access to BioTime routes", () => {
  const res = response();
  let nextCalled = false;
  authorize("admin", "hr")({ user: { role: "hr" } }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, null);
  assert.equal(nextCalled, true);
});

test("session is not expired while within the inactivity window", () => {
  const now = Date.now();
  const recent = new Date(now - 5 * 60 * 1000).toISOString();
  assert.equal(isSessionExpired(recent, now, 30 * 60 * 1000), false);
});

test("session is expired after 30 minutes of inactivity", () => {
  const now = Date.now();
  const stale = new Date(now - 31 * 60 * 1000).toISOString();
  assert.equal(isSessionExpired(stale, now, 30 * 60 * 1000), true);
});

test("session with no recorded activity is treated as valid", () => {
  assert.equal(isSessionExpired(null, Date.now(), 30 * 60 * 1000), false);
});
