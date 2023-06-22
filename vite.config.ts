import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

import { importComponents } from "./plugins/importComponents";

import crossOriginIsolation from "vite-plugin-cross-origin-isolation";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        tsconfigPaths(), //
        svelte(),
        importComponents(),
        crossOriginIsolation(),
    ],
});
