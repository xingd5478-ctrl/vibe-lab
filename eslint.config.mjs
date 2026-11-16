import globals from "globals";

const node = { ...globals.node, fetch: "readonly", WebSocket: "readonly", URL: "readonly" };
const browser = {
  ...globals.browser,
  fetch: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  performance: "readonly",
  ResizeObserver: "readonly",
  IntersectionObserver: "readonly",
  matchMedia: "readonly",
  module: "readonly",
  IMUData: "readonly",
  SimChart: "readonly",
  SimControl: "readonly",
  IMUChart: "readonly",
  VibeI18n: "readonly",
};
const worker = { ...browser, ...globals.worker };

export default [
  {
    ignores: [
      "node_modules/**",
      "_site/**",
      "artifacts/**",
      "tests/baselines*/**",
      "simulink/models/**",
      "simulink/course-src/**",
      "simulink/course-img/**",
    ],
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: node },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-redeclare": "error",
    },
  },
  {
    files: ["landing/**/*.js", "shared/**/*.js", "imu-lab/static/**/*.js", "control-play/**/*.js", "simulink/**/*.js"],
    ignores: ["landing/sw.js", "**/*worker.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: browser },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "off",
      "no-redeclare": "error",
    },
  },
  {
    files: ["landing/sw.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...browser, ...globals.serviceworker } },
    rules: { "no-undef": "error", "no-unused-vars": "off", "no-redeclare": "error" },
  },
  {
    files: ["**/*worker.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: worker },
    rules: { "no-undef": "error", "no-unused-vars": "off", "no-redeclare": "error" },
  },
];
