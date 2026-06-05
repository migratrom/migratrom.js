import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: {
		entry: {
			index: "src/index.ts",
			"adapters/postgres": "src/adapters/postgres.ts",
			"adapters/sqlite": "src/adapters/sqlite.ts",
		},
		format: ["esm"],
		dts: true,
		sourcemap: false,
		outDir: "dist",
		outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
	},
});
