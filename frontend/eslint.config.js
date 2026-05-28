import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "dev-dist", "coverage", "playwright-report"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "import-x": importX,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: { attributes: false },
        },
      ],
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
  // Override zone: shadcn primitives — locked from Phase 4.
  {
    files: ["src/components/ui/**"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  // Override zone: root config files using CommonJS require().
  {
    files: ["tailwind.config.ts", "postcss.config.js", "vite.config.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override zone: test files — relaxed for mock typing and intentional fire-and-forget.
  {
    files: ["src/**/__tests__/**", "src/**/*.{test,spec}.{ts,tsx}", "e2e/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  // Override zone: React contexts intentionally co-export their hooks alongside
  // the Provider component (`useAuth` with `AuthProvider`, etc.). Fast-refresh
  // limitation does not apply to context modules — splitting them creates
  // gratuitous file churn for no DX win. LeadStream.tsx exports a helper
  // (`getLeadCountForICP`) alongside its panel for the same single-call-site
  // reason.
  {
    files: ["src/contexts/**", "src/components/customers/LeadStream.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  // eslint-config-prettier MUST come last to disable conflicting stylistic rules.
  eslintConfigPrettier,
);
