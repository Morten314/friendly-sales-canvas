# `src/components/ui/` — shadcn / Radix primitives (locked)

These are generated shadcn-ui primitives built on Radix. They are owned by **no feature**.

- **Do not** import from `@/features/**` or `@/shared/**` here — `components/ui/` sits below the app's own code (enforced by `import-x/no-restricted-paths` in `eslint.config.js`). It may import only npm packages, other `ui/` primitives, and `./utils`.
- This folder is `knip`-ignored and exempt from `react-refresh/only-export-components` (it intentionally co-exports variants and hooks).

## Name-twin warning

`ui/sidebar.tsx` **exports** `SidebarProvider` (line 730) and `useSidebar` (line 734) — the **same names** the app's own sidebar state (`src/features/shell/SidebarContext.tsx`) exports. The collision is currently _inactive_ (no file imports those names from `ui/sidebar`), but it is real. The app's sidebar hook is exposed publicly as **`useAppSidebar`** from `@/features/shell` to avoid the clash. When wiring the app's collapsible sidebar, import the **app** `SidebarProvider`/`useAppSidebar` from `@/features/shell`, not the shadcn primitives from `@/components/ui/sidebar`.
