const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of ["simulink/lessons.js", "simulink/guide.js"]) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, "..", f), "utf8"), sandbox);
  }
  return {
    data: sandbox.window.SIMULINK_LESSONS,
    guide: sandbox.window.SIMULINK_GUIDE,
    examples: sandbox.window.SIMULINK_EXAMPLES,
  };
}

test("every lesson has a beginner guide with required sections", () => {
  const { data, guide } = load();
  const lessons = [];
  data.phases.forEach((p) => p.items.forEach((l) => lessons.push(l)));
  assert.equal(lessons.length, 43);
  for (const l of lessons) {
    const g = guide[l.id];
    assert.ok(g, `missing guide ${l.id}`);
    for (const key of ["hook", "goal", "concepts", "math", "steps", "watch", "pitfall", "quiz"]) {
      assert.ok(g[key], `${l.id} missing ${key}`);
    }
    assert.ok(g.concepts.length >= 2, `${l.id} concepts < 2`);
    assert.ok(g.steps.length >= 3, `${l.id} steps < 3`);
  }
});

test("every lesson has either an interactive demo or a worked example", () => {
  const { data, examples } = load();
  const missing = [];
  data.phases.forEach((p) => p.items.forEach((l) => {
    if (!l.demo && !(examples[l.id] && examples[l.id].length > 40)) missing.push(l.id);
  }));
  assert.deepEqual(missing, [], `no demo/example: ${missing.join(", ")}`);
});
