import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["lib", "generated", "node_modules"]),
  {
    files: ["**/*.{js,mjs,ts}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es6,
      },
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.dev.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "quotes": ["error", "double"],
      "indent": ["error", 2],
      "object-curly-spacing": ["error", "always"],
    },
  },
]);
