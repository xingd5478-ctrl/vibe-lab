/* Simulink page UI: tabs, controls, phase links. */
(function () {
  const { $, DATA, diagram, links } = window.SimApp;
  const DEMOS = window.SIMULINK_DEMOS;
  let current = "first-order";

  function fmtVal(v) {
    const a = Math.abs(v);
    if (a >= 10) return v.toFixed(0);
    if (a >= 1) return v.toFixed(1);
    if (a >= 0.01) return v.toFixed(2);
    return v.toFixed(3);
  }

  function buildControls(params, onChange) {
    const box = $("controls");
    box.innerHTML = "";
    params.forEach((d) => {
      if (d.type === "toggle") {
        if (window.LabKit) {
          box.appendChild(window.LabKit.toggle(d.label, d.value, onChange, { id: "p-" + d.id }));
          return;
        }
        const lab = document.createElement("label");
        lab.className = "ctl toggle";
        lab.innerHTML = `<input type="checkbox" id="p-${d.id}" ${d.value ? "checked" : ""}> ${d.label}`;
        box.appendChild(lab);
        lab.querySelector("input").addEventListener("change", onChange);
        return;
      }
      if (d.type === "buttons") {
        if (window.LabKit && window.LabKit.buttons) {
          box.appendChild(
            window.LabKit.buttons(d.label, d.options, d.value, (v) => {
              d.value = v;
              onChange();
            })
          );
          return;
        }
        const div = document.createElement("div");
        div.className = "ctl buttons";
        const head = document.createElement("div");
        head.className = "ctl-head";
        const label = document.createElement("span");
        label.textContent = d.label || "";
        head.appendChild(label);
        div.appendChild(head);
        const row = document.createElement("div");
        row.className = "btn-row";
        d.options.forEach((o) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = o.label;
          if (d.value === o.value) b.setAttribute("aria-pressed", "true");
          b.addEventListener("click", () => {
            d.value = o.value;
            row.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
            b.setAttribute("aria-pressed", "true");
            onChange();
          });
          row.appendChild(b);
        });
        div.appendChild(row);
        box.appendChild(div);
        return;
      }
      if (window.LabKit && window.LabKit.slider) {
        box.appendChild(
          window.LabKit.slider(d.label, d.min, d.max, d.step, d.value, onChange, {
            id: "p-" + d.id,
            valueId: "v-" + d.id,
          })
        );
        return;
      }
      const div = document.createElement("div");
      div.className = "ctl";
      div.innerHTML =
        `<div class="ctl-head"><span>${d.label}</span><b id="v-${d.id}">${fmtVal(d.value)}</b></div>` +
        `<input type="range" id="p-${d.id}" min="${d.min}" max="${d.max}" step="${d.step}" value="${d.value}" aria-label="${d.label}">`;
      box.appendChild(div);
      div.querySelector("input").addEventListener("input", onChange);
    });
  }

  function readParams(params) {
    const p = {};
    params.forEach((d) => {
      if (d.type === "buttons") {
        p[d.id] = d.value;
        return;
      }
      const el = $("p-" + d.id);
      p[d.id] = d.type === "toggle" ? el.checked : parseFloat(el.value);
    });
    return p;
  }

  function refresh() {
    const demo = DEMOS[current];
    const p = readParams(demo.params);
    demo.params.forEach((d) => {
      const v = $("v-" + d.id);
      if (v) v.textContent = fmtVal(p[d.id]);
    });
    demo.render(p);
    links(demo.lesson);
  }

  function selectDemo(id) {
    current = id;
    const demo = DEMOS[id];
    $("demo-title").textContent = demo.title;
    $("demo-note").innerHTML = demo.note;
    document.querySelectorAll("#tabs button").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.demo === id));
    });
    diagram(demo.diagram);
    buildControls(demo.params, refresh);
    refresh();
  }

  function buildTabs() {
    const box = $("tabs");
    const order = Object.keys(DEMOS).sort(
      (a, b) => parseInt(DEMOS[a].lesson.slice(1), 10) - parseInt(DEMOS[b].lesson.slice(1), 10)
    );
    order.forEach((id) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.demo = id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === current));
      b.textContent = `${DEMOS[id].lesson.toUpperCase()} · ${DEMOS[id].title.split(" · ")[1]}`;
      b.addEventListener("click", () => selectDemo(id));
      box.appendChild(b);
    });
  }

  function buildPhases() {
    const box = $("phases");
    if (!box) return;
    DATA.phases.forEach((ph) => {
      const b = document.createElement("a");
      b.className = "phase-link";
      b.href = `course.html?id=${ph.items[0].id}`;
      b.innerHTML = `<b>${ph.title}</b><span>${ph.items.length} 课 · ${ph.range}</span>`;
      box.appendChild(b);
    });
  }

  buildPhases();
  buildTabs();
  const hash = location.hash.replace(/^#/, "");
  const byLesson = Object.keys(DEMOS).find((id) => DEMOS[id].lesson === hash);
  selectDemo(byLesson || (DEMOS[hash] ? hash : "signal"));
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", refresh);
  }
  window.addEventListener("resize", () => {
    clearTimeout(window.__simT);
    window.__simT = setTimeout(() => {
      diagram(DEMOS[current].diagram);
      refresh();
    }, 120);
  });
})();
