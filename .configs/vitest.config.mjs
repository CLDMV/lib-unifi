/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /.configs/vitest.config.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1764329220)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:07:00-07:00 (1764329220)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { defineConfig, mergeConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";
import { devCondition } from "@cldmv/configs/vitest.config.mjs";

// Anchor the project root to the package directory so include/exclude work no
// matter what cwd vitest is invoked from.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Tests import the package by name (`@cldmv/lib-unifi`); the `lib-unifi-dev`
// condition resolves that to `src/` in a checkout and to `dist/` without it.
const condition = devCondition({ root: new URL("..", import.meta.url) });

export default defineConfig(
	mergeConfig(condition, {
		root,
		// Keep each leaf's relative `lib/` helpers per-instance under vitest
		// (Node's own resolve hook never sees the imports vite resolves).
		// Top-level `plugins` — inside `test` it is ignored.
		plugins: [slothletInstanceImports()],
		test: {
			include: ["tests/**/*.test.vitest.mjs"],
			exclude: ["node_modules"],
			environment: "node",
			// Inline slothlet so composed leaves are attributed in coverage
			// (see slothlet docs/TESTING.md, "Fix 1: inline slothlet in your test config").
			server: { deps: { inline: [/@cldmv\/slothlet/] } },
			testTimeout: 30000,
			hookTimeout: 30000,
			// "dot" keeps CI logs to one character per test file instead of a full
			// "RUN vX.Y.Z" + per-file pass/fail block for every file. The final
			// "Test Files X passed" / "Tests Y passed" summary is unaffected.
			reporters: ["dot"],
			coverage: {
				provider: "custom",
				// The v8 provider, with the query slothlet puts on composed leaves
				// stripped from their coverage keys (see coverage-provider.mjs).
				customProviderModule: path.resolve(root, ".configs/coverage-provider.mjs"),
				include: ["src/**"],
				// The CJS shim is a require(esm) trampoline exercised by `test:cjs`, not the vitest suite.
				exclude: ["**/*.json", "src/index.cjs"],
				reporter: ["text", "html", "json-summary", "json"]
			}
		}
	})
);
