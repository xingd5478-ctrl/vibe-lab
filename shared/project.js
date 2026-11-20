/* Local-first project and handoff schema for vibe-lab.
   No accounts, no server: localStorage only, with explicit size guards. */
(function (root) {
  "use strict";
  const KEY = "vibe-lab-projects-v1";
  const HANDOFF = "vibe-lab-handoff-v1";
  const LIMIT = 180000;

  function trim(values) {
    return Array.isArray(values) ? values.slice(0, LIMIT) : values;
  }

  function makeProject(input) {
    const now = new Date().toISOString();
    return {
      version: 1,
      kind: "vibe-lab-project",
      name: input.name || "Untitled",
      createdAt: input.createdAt || now,
      updatedAt: now,
      dataset: input.dataset || null,
      model: input.model || null,
      control: input.control || null,
      notes: input.notes || "",
    };
  }

  function safeDataset(data) {
    if (!data) return null;
    return {
      t: trim(data.t),
      u: trim(data.u),
      y: trim(data.y),
      U: data.U ? data.U.map(trim) : null,
      Y: data.Y ? data.Y.map(trim) : null,
      r: data.r ? trim(data.r) : null,
      meta: data.meta ? { ...data.meta, columns: undefined, headers: data.meta.headers || null } : null,
      n: data.t ? data.t.length : 0,
    };
  }

  function save(project) {
    const list = list().filter((p) => p.id !== project.id);
    list.unshift(project);
    const text = JSON.stringify(list.slice(0, 8));
    if (text.length > 4.5e6) throw new Error("Project is too large for localStorage.");
    localStorage.setItem(KEY, text);
    return project;
  }

  function list() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function load(id) {
    return list().find((p) => p.id === id) || null;
  }

  function remove(id) {
    const list2 = list().filter((p) => p.id !== id);
    localStorage.setItem(KEY, JSON.stringify(list2));
  }

  function handoff(payload) {
    const text = JSON.stringify({ ...payload, ts: Date.now() });
    if (text.length > 4.5e6) throw new Error("Handoff payload is too large.");
    localStorage.setItem(HANDOFF, text);
  }

  function readHandoff() {
    try {
      return JSON.parse(localStorage.getItem(HANDOFF) || "null");
    } catch (e) {
      return null;
    }
  }

  function download(project) {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (project.name || "vibe-project").replace(/[^\w.-]+/g, "_") + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  root.VibeProject = { KEY, makeProject, safeDataset, save, list, load, remove, handoff, readHandoff, download };
})(typeof window !== "undefined" ? window : globalThis);
