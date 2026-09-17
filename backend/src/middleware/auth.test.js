const test = require("node:test");
const assert = require("node:assert/strict");
const { authorize } = require("./auth");

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
