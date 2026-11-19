/* Single source for the static top navigation. Imported by layout_nav and the generators. */
export const PAGES = {
  "landing/index.html": { lang: "zh", home: "./", base: "", active: "home", switch: "en/" },
  "landing/en/index.html": { lang: "en", home: "./", base: "../", active: "home", switch: "../index.html" },
  "landing/feedback.html": { lang: "zh", base: "./", active: null, switch: "en/" },
  "landing/en/lessons.html": {
    lang: "en",
    home: "./",
    base: "../",
    active: "simulink",
    switch: "../simulink/course.html",
  },
  "landing/en/guide.html": {
    lang: "en",
    home: "./",
    base: "../",
    active: "simulink",
    switch: "../simulink/course.html",
  },
  "model-lab/static/index.html": { lang: "zh", base: "../", active: "model", switch: null },
  "imu-lab/static/index.html": { lang: "zh", base: "../", active: "imu", switch: null },
  "control-play/index.html": { lang: "zh", base: "../", active: "control", switch: null },
  "simulink/index.html": { lang: "zh", base: "../", active: "simulink", switch: null },
  "simulink/course.html": { lang: "zh", base: "../", active: "simulink", switch: null },
  "about/index.html": { lang: "zh", base: "../", active: "about", switch: "en.html" },
  "about/en.html": { lang: "en", home: "../en/", base: "../", active: "about", switch: "index.html?lang=zh" },
  "about/matlab.html": { lang: "zh", base: "../", active: "about", switch: null },
  "about/matlab-en.html": { lang: "en", home: "../en/", base: "../", active: "about", switch: "matlab.html" },
};

const ZH = {
  home: "首页",
  imu: "IMU",
  model: "Model",
  control: "Control",
  simulink: "Simulink",
  about: "方法",
  lang: "EN",
};
const EN = {
  home: "Home",
  imu: "IMU",
  model: "Model",
  control: "Control",
  simulink: "Simulink",
  about: "Method",
  lang: "Chinese",
};

export function navFor(cfg) {
  const L = cfg.lang === "en" ? EN : ZH;
  const base = cfg.base;
  const home = cfg.home ?? base;
  const href = {
    home,
    imu: base + "imu/" + (cfg.lang === "en" ? "?lang=en" : ""),
    model: base + "model/",
    control: base + "control/" + (cfg.lang === "en" ? "?lang=en" : ""),
    simulink: cfg.lang === "en" ? base + "simulink/index.html?lang=en" : base + "simulink/",
    about: cfg.lang === "en" ? base + "about/en.html" : base + "about/",
  };
  const link = (key) => {
    const current = cfg.active === key ? ' aria-current="page"' : "";
    const hreflang =
      key === "lang"
        ? ` hreflang="${cfg.lang === "en" ? "zh-CN" : "en"}" lang="${cfg.lang === "en" ? "zh-CN" : "en"}"`
        : "";
    return `<a href="${href[key] ?? cfg.switch}"${current}${hreflang}>${L[key]}</a>`;
  };
  const items = ["home", "imu", "model", "control", "simulink", "about"];
  if (cfg.switch) items.push("lang");
  return `<nav class="topnav" aria-label="${cfg.lang === "en" ? "Site navigation" : "全站导航"}">
${items.map((k) => "      " + link(k)).join("\n")}
    </nav>`;
}
