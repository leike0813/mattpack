import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "test-dist/**",
      ".scripts-dist/**",
      "vendor/**",
      "references/**",
      ".agents/**",
      ".claude/**",
      ".codebuddy/**",
      ".kilocode/**",
      ".kimi-code/**",
      ".omp/**",
      ".opencode/**",
      ".pi/**",
      ".qwen/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended
);
