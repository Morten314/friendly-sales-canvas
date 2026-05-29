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
    settings: {
      "import-x/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.app.json",
        },
      },
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
      // NOTE: "internal" (the `@/*` alias, now resolvable via the import-x/resolver
      // added in Phase 4a) is ordered LAST, after the relative groups. This matches
      // the repo's pre-existing, consistent convention (external → relative → `@/`)
      // and keeps Phase 4a additive — pinning the resolver-induced reclassification
      // in config rather than reordering source imports (Plan 21a Task 5 Step 3).
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "parent", "sibling", "index", "internal"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      // Phase 4a — cross-zone dependency boundaries (require the import-x/resolver above).
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/shared",
              from: "./src/features",
              message:
                "src/shared must not import from src/features — shared is consumed by features, not the reverse.",
            },
            {
              target: "./src/components/ui",
              from: "./src/features",
              message: "src/components/ui (shadcn primitives) must not import from src/features.",
            },
            {
              target: "./src/components/ui",
              from: "./src/shared",
              message: "src/components/ui (shadcn primitives) must not import from src/shared.",
            },
          ],
        },
      ],
      "import-x/no-cycle": "error",
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
    files: [
      "src/contexts/**",
      "src/components/customers/LeadStream.tsx",
      "src/shared/**",
      "src/features/**",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  // eslint-config-prettier MUST come last to disable conflicting stylistic rules.
  eslintConfigPrettier,
);
