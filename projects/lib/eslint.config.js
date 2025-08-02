import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends("../../eslint.config.js"),
  {
    ignores: ["!**/*", "node_modules/"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: [
          "projects/lib/tsconfig.lib.json",
          "projects/lib/tsconfig.spec.json",
        ],
        createDefaultProgram: true,
      },
    },
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        { type: "attribute", prefix: "lib", style: "camelCase" },
      ],
      "@angular-eslint/component-selector": [
        "error",
        { type: "element", prefix: "lib", style: "kebab-case" },
      ],
    },
  },
  {
    files: ["**/*.html"],
    rules: {},
  },
];
