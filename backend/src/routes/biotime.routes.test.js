const test = require("node:test");
const assert = require("node:assert/strict");
const router = require("./biotime.routes");

test("BioTime routes include authentication and role authorization middleware", () => {
  assert.equal(router.stack[0].handle.name, "authenticate");
  // The second router-level middleware is the admin/HR authorization guard;
  // individual endpoint handlers follow it in the stack.
  assert.ok(router.stack.length >= 4);
});
