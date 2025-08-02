import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends("plugin:@angular-eslint/recommended"),
  ...compat.extends("plugin:@angular-eslint/template/process-inline-templates"),
  ...compat.extends("prettier"),
  {
    ignores: ["coverage/**/*", "projects/**/*"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["tsconfig.json", "e2e/tsconfig.json"],
        createDefaultProgram: true,
      },
    },
    rules: {
      "@angular-eslint/component-selector": [
        "error",
        { prefix: "app", style: "kebab-case", type: "element" },
      ],
      "@angular-eslint/directive-selector": [
        "error",
        { prefix: "app", style: "camelCase", type: "attribute" },
      ],
    },
  },
  {
    files: ["**/*.html"],
    ...compat.extends("plugin:@angular-eslint/template/recommended")[0],
  },
];
