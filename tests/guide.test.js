const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of [
    "simulink/lessons.js",
    ...fs
      .readdirSync(path.resolve(__dirname, "..", "simulink", "guide"))
      .filter((x) => x.endsWith(".js"))
      .map((x) => "simulink/guide/" + x),
  ]) {
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
  data.phases.forEach((p) =>
    p.items.forEach((l) => {
      if (!l.demo && !(examples[l.id] && examples[l.id].length > 40)) missing.push(l.id);
    })
  );
  assert.deepEqual(missing, [], `no demo/example: ${missing.join(", ")}`);
});

test("English guide covers 43 lessons and contains no Chinese", () => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "..", "simulink/lessons.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "..", "simulink/guide-en.js"), "utf8"), sandbox);
  const guide = sandbox.window.SIMULINK_GUIDE_EN;
  assert.equal(Object.keys(guide).length, 43);
  for (const id of ["t01", "t12", "t24", "t32", "t43"]) assert.ok(guide[id], id);
  assert.equal(
    (fs.readFileSync(path.resolve(__dirname, "..", "simulink/guide-en.js"), "utf8").match(/[\u4e00-\u9fff]/g) || [])
      .length,
    0
  );
});

test("English guide page contains 43 lessons and no Chinese", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "..", "landing/en/guide.html"), "utf8");
  assert.equal((html.match(/<details class="lesson"/g) || []).length, 43);
  assert.equal((html.match(/[\u4e00-\u9fff]/g) || []).length, 0);
});
