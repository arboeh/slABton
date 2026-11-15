import js from "@eslint/js";
import globals from "globals";

export default [
  {
    // Generated or vendored: site/ (mkdocs output), the demo copy of the bundle and its libraries.
    ignores: [
      "node_modules/", "coverage/", "dist/", ".kilocode/", "site/",
      "docs/demo-app/slabton.js", "docs/demo-app/vendor/",
    ],
  },

  js.configs.recommended,

  {
    files: ["*.config.js", "*.config.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },

  {
    files: ["docs/demo-app/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    files: ["tests/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.vitest,
        ...globals.browser,
      },
    },
  },
];
