/* 43 课阅读器：按需从 GitHub raw 读取 .m，解析注释/代码并展示结果图 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const DATA = window.SIMULINK_LESSONS;
  const REPO = DATA.repo;
  const CDN = "https://cdn.jsdelivr.net/gh/xingd5478-ctrl/simulink-control-tutorial@main/";
  const RAW = "https://raw.githubusercontent.com/xingd5478-ctrl/simulink-control-tutorial/main/";
  const LOCAL = "course-src/";
  const LOCAL_IMG = "course-img/";
  const MULTI = { t16: 4, t17: 2, t19: 3, t21: 2, t22: 3, t24: 2 };

  const lessons = [];
  DATA.phases.forEach((ph) => ph.items.forEach((l) => lessons.push({ ...l, phase: ph.title })));
  const byId = {};
  lessons.forEach((l) => {
    byId[l.id] = l;
  });
  const LEVELS = DATA.levels || { core: [], concept: [] };
  const levelOf = (id) => (LEVELS.core.includes(id) ? "core" : LEVELS.concept.includes(id) ? "concept" : "ok");
  const LEVEL_LABEL = { core: "精读", concept: "概念", ok: "合格" };

  const cache = new Map();
  let current = null;
  const PROGRESS_KEY = "vibe-course-read-v1";
  const QUIZ_KEY = "vibe-course-quiz-v1";
  let read = new Set();
  let lastRead = null;
  let quizStats = { attempted: {}, wrong: {} };
  try {
    quizStats = JSON.parse(localStorage.getItem(QUIZ_KEY) || "{}");
  } catch (e) {}
  if (!quizStats.attempted) quizStats.attempted = {};
  if (!quizStats.wrong) quizStats.wrong = {};
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    if (Array.isArray(saved.ids)) read = new Set(saved.ids);
    lastRead = saved.last || null;
  } catch (e) {
    /* private mode */
  }

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ids: [...read], last: lastRead }));
    } catch (e) {}
  }

  function updateProgress() {
    const count = $("progress-count");
    if (!count) return;
    count.textContent = read.size + " / " + lessons.length;
    const fill = $("progress-fill");
    if (fill) fill.style.width = Math.round((read.size / lessons.length) * 100) + "%";
    const track = document.querySelector("#course-progress .progress-track");
    if (track) track.setAttribute("aria-valuenow", String(read.size));
    const cont = $("continue-link");
    if (cont) {
      if (lastRead && byId[lastRead]) {
        cont.hidden = false;
        cont.href = "course.html?id=" + lastRead;
        cont.textContent = "继续 " + lastRead.toUpperCase() + " →";
      } else cont.hidden = true;
    }
    document.querySelectorAll(".lesson").forEach((b) => b.classList.toggle("read", read.has(b.dataset.id)));
  }

  function markRead(id) {
    if (!byId[id]) return;
    read.add(id);
    lastRead = id;
    saveProgress();
    updateProgress();
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function parseM(text) {
    const lines = text.split(/\r?\n/);
    const sections = [];
    let cur = { title: "", notes: [], code: [] };
    const flush = () => {
      if (cur.title || cur.notes.length || cur.code.some((l) => l.trim())) sections.push(cur);
      cur = { title: "", notes: [], code: [] };
    };
    for (const line of lines) {
      if (/^\s*%%/.test(line)) {
        flush();
        cur.title = line.replace(/^\s*%%\s*/, "").trim();
      } else if (/^\s*%/.test(line)) {
        cur.notes.push(line.replace(/^\s*%\s?/, ""));
      } else {
        cur.code.push(line);
      }
    }
    flush();
    return sections.filter((s) => s.notes.some((l) => l.trim()) || s.code.some((l) => l.trim()));
  }

  function notesBlock(lines) {
    const frag = document.createDocumentFragment();
    let buf = [];
    const flush = () => {
      const text = buf.join("\n").trim();
      if (text) {
        const p = el("p", "reader-p");
        p.textContent = text;
        frag.appendChild(p);
      }
      buf = [];
    };
    for (const l of lines) {
      if (!l.trim()) flush();
      else buf.push(l);
    }
    flush();
    return frag;
  }

  function codeBlock(lines) {
    const pre = el("pre", "reader-code");
    const code = el("code", "", lines.join("\n"));
    pre.appendChild(code);
    return pre;
  }

  function imageList(lesson) {
    const base = lesson.file.replace(/\.m$/, "");
    const n = MULTI[lesson.id] || 1;
    const out = [];
    for (let i = 1; i <= n; i++) out.push(`${base}_fig${i}.png`);
    return out;
  }

  function introFor(lesson) {
    const intro = el("div", "reader-intro");
    intro.appendChild(el("p", "reader-p", `本课目标：${lesson.desc}`));
    const links = el("div", "links");
    const a1 = el("a", "", `${lesson.file}（GitHub）`);
    a1.href = `${REPO}/blob/main/${lesson.file}`;
    a1.target = "_blank";
    a1.rel = "noreferrer";
    const dl = el("a", "dl", `下载 ${lesson.model}`);
    dl.href = `models/${lesson.model}`;
    dl.setAttribute("download", lesson.model);
    const a2 = el("a", "", "模型原始仓库");
    a2.href = `${REPO}/tree/main/models`;
    a2.target = "_blank";
    a2.rel = "noreferrer";
    links.appendChild(a1);
    links.appendChild(dl);
    links.appendChild(a2);
    if (lesson.demo) {
      const demo = el("a", "dl", "打开交互实验 →");
      demo.href = `index.html#${lesson.id}`;
      links.appendChild(demo);
    }
    const fb = el("a", "", "这节没看懂？反馈");
    const title = encodeURIComponent(`[课程反馈] ${lesson.id} ${lesson.title}`);
    const body = encodeURIComponent(`课程：${lesson.id} ${lesson.title}\n页面：${location.href}\n\n我卡在：\n\n`);
    fb.href = `https://github.com/xingd5478-ctrl/vibe-lab/issues/new?title=${title}&body=${body}`;
    fb.target = "_blank";
    fb.rel = "noreferrer";
    links.appendChild(fb);
    intro.appendChild(links);
    intro.appendChild(
      el("p", "hint", "模型已托管在本站（MIT），下载后用 MATLAB/Simulink 打开；浏览器不能直接运行 .slx。")
    );
    return intro;
  }

  function guideFor(lesson) {
    const g = window.SIMULINK_GUIDE && window.SIMULINK_GUIDE[lesson.id];
    if (!g) return null;
    const wrap = el("section", "guide");
    wrap.appendChild(el("h3", "", "新手讲义 · 一步一步看懂"));
    wrap.appendChild(el("p", "guide-hook", g.hook));
    const goal = el("p", "guide-goal");
    goal.appendChild(el("b", "", "本课目标："));
    goal.appendChild(document.createTextNode(g.goal));
    wrap.appendChild(goal);

    if (g.blocks) {
      const flow = el("div", "flow");
      g.blocks.forEach((b, i) => {
        if (i) flow.appendChild(el("span", "flow-arrow", "→"));
        flow.appendChild(el("span", "flow-chip", b));
      });
      wrap.appendChild(flow);
    }

    wrap.appendChild(el("h4", "", "关键概念"));
    const grid = el("div", "guide-grid");
    g.concepts.forEach(([t, d]) => {
      const c = el("div", "guide-card");
      c.appendChild(el("b", "", t));
      c.appendChild(el("p", "", d));
      grid.appendChild(c);
    });
    wrap.appendChild(grid);

    wrap.appendChild(el("h4", "", "公式 / 怎么读"));
    wrap.appendChild(el("div", "guide-math", g.math));

    wrap.appendChild(el("h4", "", "在 Simulink 里怎么做"));
    const ol = el("ol", "guide-list");
    g.steps.forEach((s) => ol.appendChild(el("li", "", s)));
    wrap.appendChild(ol);

    wrap.appendChild(el("h4", "", "运行后看什么"));
    wrap.appendChild(el("p", "guide-goal", g.watch));

    wrap.appendChild(el("h4", "", "新手容易踩的坑"));
    wrap.appendChild(el("p", "guide-warn", g.pitfall));

    const examples = window.SIMULINK_EXAMPLES || {};
    if (examples[lesson.id]) {
      wrap.appendChild(el("h4", "", "小例子"));
      wrap.appendChild(el("p", "guide-goal", examples[lesson.id]));
    }

    const cases = window.SIMULINK_CASES || {};
    const c = cases[lesson.id];
    if (c) {
      wrap.appendChild(el("h4", "", "完整算例"));
      wrap.appendChild(el("p", "guide-goal", c.setup));
      wrap.appendChild(el("div", "guide-math", "期望：" + c.expected));
      wrap.appendChild(el("h4", "", "常见错误"));
      const errs = el("ol", "guide-list");
      c.errors.forEach((x) => errs.appendChild(el("li", "", x)));
      wrap.appendChild(errs);
      wrap.appendChild(el("h4", "", "自测答案"));
      const qa = el("div", "guide-quiz");
      c.answers.forEach((a, i) => {
        const d = document.createElement("details");
        d.appendChild(el("summary", "", "答案 " + (i + 1)));
        d.appendChild(el("p", "", a));
        qa.appendChild(d);
      });
      wrap.appendChild(qa);
    }

    wrap.appendChild(el("h4", "", "自测"));
    const quiz = el("div", "guide-quiz");
    g.quiz.forEach(([q, a]) => {
      const d = document.createElement("details");
      d.appendChild(el("summary", "", q));
      d.appendChild(el("p", "", a));
      quiz.appendChild(d);
    });
    wrap.appendChild(quiz);
    return wrap;
  }

  function saveQuiz() {
    try {
      localStorage.setItem(QUIZ_KEY, JSON.stringify(quizStats));
    } catch (e) {}
  }

  function updateQuizPanel() {
    const attempted = Object.keys(quizStats.attempted).length;
    const wrong = Object.keys(quizStats.wrong).length;
    const correct = Math.max(0, attempted - wrong);
    if ($("quiz-count")) $("quiz-count").textContent = `${correct} / ${attempted}`;
    if ($("quiz-summary"))
      $("quiz-summary").textContent = attempted
        ? `已做 ${attempted} 课，答对 ${correct}，错 ${wrong}。`
        : "还没有做题。";
    const book = $("wrong-book");
    const list = $("wrong-list");
    if (!book || !list) return;
    book.hidden = wrong === 0;
    if ($("wrong-count")) $("wrong-count").textContent = String(wrong);
    list.innerHTML = "";
    Object.keys(quizStats.wrong)
      .sort()
      .forEach((id) => {
        const b = el("button", "", `${id.toUpperCase()} · ${byId[id] ? byId[id].title : ""} →`);
        b.type = "button";
        b.addEventListener("click", () => load(id));
        list.appendChild(b);
      });
  }

  function recordQuiz(lesson, ok) {
    quizStats.attempted[lesson.id] = true;
    if (ok) delete quizStats.wrong[lesson.id];
    else quizStats.wrong[lesson.id] = true;
    saveQuiz();
    updateQuizPanel();
  }

  function selfCheck(lesson) {
    const wrap = el("section", "self-check");
    wrap.appendChild(el("h3", "", "本课自测"));
    const pool = lessons.filter((l) => l.id !== lesson.id && l.phase === lesson.phase);
    const distractors = pool.slice(0, 2);
    const opts = [lesson.desc].concat(distractors.map((l) => l.desc));
    const seed = lesson.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const answer = seed % opts.length;
    if (answer) {
      const tmp = opts[0];
      opts[0] = opts[answer];
      opts[answer] = tmp;
    }
    const q = el("p", "self-q", `本课（${lesson.id} · ${lesson.title}）的核心目标是？`);
    wrap.appendChild(q);
    opts.forEach((opt, i) => {
      const lab = el("label", "self-opt");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "self-" + lesson.id;
      input.value = String(i);
      lab.appendChild(input);
      lab.appendChild(document.createTextNode(" " + opt));
      wrap.appendChild(lab);
    });
    const btn = el("button", "self-btn", "检查");
    btn.type = "button";
    const result = el("p", "hint self-result", "");
    btn.addEventListener("click", () => {
      const sel = document.querySelector(`input[name="self-${lesson.id}"]:checked`);
      if (!sel) {
        result.textContent = "先选一个答案。";
        return;
      }
      const ok = Number(sel.value) === answer;
      result.textContent = ok ? "答对了。" : "再读一遍本课目标。";
      recordQuiz(lesson, ok);
    });
    wrap.appendChild(btn);
    wrap.appendChild(result);
    return wrap;
  }

  function render(lesson, text) {
    const body = $("lesson-body");
    $("lesson-title").textContent = `${lesson.id} · ${lesson.title}`;
    $("lesson-phase").textContent = `${lesson.phase} · ${LEVEL_LABEL[levelOf(lesson.id)]}`;
    $("lesson-num").textContent = lesson.desc;
    $("lesson-status").textContent = "";
    body.innerHTML = "";
    body.appendChild(introFor(lesson));
    const guide = guideFor(lesson);
    if (guide) body.appendChild(guide);

    const imgs = el("div", "reader-figs");
    imageList(lesson).forEach((name, i) => {
      const fig = el("figure", "reader-fig");
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = LOCAL_IMG + name;
      img.alt = `${lesson.title} 结果图 ${i + 1}`;
      img.addEventListener("error", () => {
        const stage = img.dataset.stage || "0";
        if (stage === "0") {
          img.dataset.stage = "1";
          img.src = CDN + "docs/images/" + name;
        } else if (stage === "1") {
          img.dataset.stage = "2";
          img.src = RAW + "docs/images/" + name;
        } else {
          fig.remove();
        }
      });
      const cap = el("figcaption", "", `docs/images/${name}`);
      fig.appendChild(img);
      fig.appendChild(cap);
      imgs.appendChild(fig);
    });
    body.appendChild(imgs);
    body.appendChild(selfCheck(lesson));

    const sections = parseM(text);
    if (!sections.length) {
      body.appendChild(el("p", "hint", "该课脚本没有可提取的注释内容，请直接打开 GitHub 源文件。"));
      return;
    }
    sections.forEach((sec, idx) => {
      const wrap = el("section", "reader-sec");
      if (sec.title) wrap.appendChild(el("h3", "", sec.title));
      if (sec.notes.some((l) => l.trim())) wrap.appendChild(notesBlock(sec.notes));
      if (sec.code.some((l) => l.trim())) {
        const det = document.createElement("details");
        det.className = "reader-codebox";
        const sum = document.createElement("summary");
        sum.textContent = `MATLAB 代码（${sec.code.filter((l) => l.trim()).length} 行）`;
        det.appendChild(sum);
        det.appendChild(codeBlock(sec.code));
        if (idx < 2) det.open = true;
        wrap.appendChild(det);
      }
      body.appendChild(wrap);
    });
  }

  function setStatus(msg) {
    const s = $("lesson-status");
    s.innerHTML = "";
    s.appendChild(document.createTextNode(msg));
  }

  async function load(id) {
    const lesson = byId[id];
    markRead(id);
    if (!lesson) {
      setStatus("未找到该课程");
      return;
    }
    current = id;
    try {
      history.replaceState(null, "", `course.html?id=${id}`);
    } catch (e) {
      location.hash = id;
    }
    document.querySelectorAll(".lesson").forEach((b) => {
      b.setAttribute("aria-current", String(b.dataset.id === id));
    });
    $("lesson-phase").textContent = `${lesson.phase} · ${LEVEL_LABEL[levelOf(id)]}`;
    $("lesson-title").textContent = `${lesson.id} · ${lesson.title}`;
    $("lesson-num").textContent = lesson.desc;
    $("lesson-body").innerHTML = "";
    renderNav(id);
    const cached = cache.get(id);
    if (cached) {
      render(lesson, cached);
      return;
    }
    $("lesson-body").appendChild(introFor(lesson));
    const guide = guideFor(lesson);
    if (guide) $("lesson-body").appendChild(guide);
    setStatus("正在读取讲义…");
    try {
      let text = null;
      for (const base of [LOCAL, CDN, RAW]) {
        try {
          const res = await fetch(base + lesson.file, { mode: "cors" });
          if (res.ok) {
            text = await res.text();
            break;
          }
        } catch (e) {
          /* try fallback */
        }
      }
      if (text === null) throw new Error("fetch failed");
      cache.set(id, text);
      render(lesson, text);
    } catch (e) {
      setStatus("读取失败（网络受限）。可点上方 GitHub 链接直接看源文件，或稍后重试。");
    }
  }

  function renderNav(id) {
    const idx = lessons.findIndex((l) => l.id === id);
    const nav = $("lesson-nav");
    nav.innerHTML = "";
    if (idx > 0) {
      const b = el("button", "", "← " + lessons[idx - 1].id);
      b.type = "button";
      b.addEventListener("click", () => load(lessons[idx - 1].id));
      nav.appendChild(b);
    }
    if (idx >= 0 && idx < lessons.length - 1) {
      const b = el("button", "", lessons[idx + 1].id + " →");
      b.type = "button";
      b.addEventListener("click", () => load(lessons[idx + 1].id));
      nav.appendChild(b);
    }
  }

  function buildList() {
    const box = $("lesson-list");
    DATA.phases.forEach((ph) => {
      box.appendChild(el("div", "phase-title", ph.title));
      ph.items.forEach((l) => {
        const b = el("button", "lesson", "");
        b.type = "button";
        b.dataset.id = l.id;
        b.dataset.text = (l.id + " " + l.title + " " + l.desc + " " + ph.title).toLowerCase();
        b.innerHTML =
          `<span class="n">${l.id}</span>${l.title}` +
          `<span class="tag ${levelOf(l.id)}">${LEVEL_LABEL[levelOf(l.id)]}</span>` +
          (l.demo ? '<span class="tag">交互</span>' : "");
        b.addEventListener("click", () => load(l.id));
        box.appendChild(b);
      });
    });
  }

  const QUIZ = [
    {
      q: "一阶系统阶跃响应达到 63.2% 的时间 approximately 是？",
      a: 1,
      opts: ["峰值时间", "时间常数 τ", "调节时间", "延迟 L"],
      why: "一阶系统在 t=τ 达到 63.2%。",
    },
    {
      q: "增大比例增益 Kp 通常会？",
      a: 2,
      opts: ["消除稳态误差", "降低超调", "加快响应但增大超调", "不影响稳定性"],
      why: "Kp 加快响应，但过大导致超调和振荡。",
    },
    {
      q: "积分作用的主要作用是？",
      a: 0,
      opts: ["消除稳态误差", "增加相位裕度", "降低噪声", "缩短采样周期"],
      why: "积分累积误差，最终消除常值稳态误差。",
    },
    {
      q: "采样周期变小通常会？",
      a: 1,
      opts: ["让系统更接近连续设计", "必然降低超调", "消除延迟", "不需要抗混叠"],
      why: "采样更快更接近连续，但成本和噪声处理不同。",
    },
    {
      q: "相位裕度很小通常意味着？",
      a: 3,
      opts: ["系统很稳定", "响应很慢", "没有稳态误差", "闭环容易振荡"],
      why: "相位裕度小，闭环阻尼弱，容易振荡。",
    },
  ];

  function renderQuiz() {
    const box = $("quiz-body");
    if (!box) return;
    QUIZ.forEach((item, i) => {
      const d = el("div", "q");
      d.appendChild(el("p", "", i + 1 + ". " + item.q));
      item.opts.forEach((opt, j) => {
        const lab = el("label", "");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "quiz-" + i;
        input.value = String(j);
        lab.appendChild(input);
        lab.appendChild(document.createTextNode(" " + opt));
        d.appendChild(lab);
      });
      box.appendChild(d);
    });
    $("quiz-check").addEventListener("click", () => {
      let score = 0;
      QUIZ.forEach((item, i) => {
        const sel = document.querySelector('input[name="quiz-' + i + '"]:checked');
        if (sel && Number(sel.value) === item.a) score++;
      });
      $("quiz-result").textContent =
        `得分 ${score} / ${QUIZ.length}。${score === QUIZ.length ? "全对。" : "回到对应章节再看一遍。"}`;
    });
  }

  $("random-lesson").addEventListener("click", () => {
    const pool = lessons.filter((l) => !read.has(l.id));
    const pick = (pool.length ? pool : lessons)[Math.floor(Math.random() * (pool.length || lessons.length))];
    if (pick) load(pick.id);
  });
  $("course-search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll(".lesson").forEach((b) => {
      b.classList.toggle("dim", q && !b.dataset.text.includes(q));
    });
  });

  buildList();
  renderQuiz();
  updateQuizPanel();
  updateProgress();
  const initial = new URLSearchParams(location.search).get("id") || location.hash.replace(/^#/, "") || "t01";
  load(initial);
})();
