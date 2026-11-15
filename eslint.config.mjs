import globals from "globals";

const node = { ...globals.node, fetch: "readonly", WebSocket: "readonly", URL: "readonly" };
const browser = { ...globals.browser, fetch: "readonly", console: "readonly", setTimeout: "readonly", clearTimeout: "readonly", requestAnimationFrame: "readonly", cancelAnimationFrame: "readonly", performance: "readonly", ResizeObserver: "readonly", IntersectionObserver: "readonly", matchMedia: "readonly" };

export default [
  {
    ignores: ["node_modules/**", "_site/**", "artifacts/**", "tests/baselines*/**", "simulink/models/**"],
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
    files: ["shared/i18n.js", "landing/motion.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: browser },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-redeclare": "error",
    },
  },
];
