import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "/asahino-tera-vrm/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
      },
    },
  },
});
