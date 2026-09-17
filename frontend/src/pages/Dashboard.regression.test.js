import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const source = fs.readFileSync(path.join(process.cwd(), "frontend", "src", "pages", "Dashboard.jsx"), "utf8");

test("dashboard has a retryable error state and approved department chart data", () => {
  assert.match(source, /loadDashboard/);
  assert.match(source, /Retry/);
  assert.match(source, /dataKey="approved"/);
});
