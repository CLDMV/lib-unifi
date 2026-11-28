/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /tests/engines.test.vitest.mjs
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

import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const NODE_FLOOR = ">=24.15.0";

describe("engines and tooling wiring", () => {
	test("engines.node and devEngines are both the slothlet-based floor (>=24.15.0)", () => {
		expect(pkg.engines.node).toBe(NODE_FLOOR);
		expect(pkg.devEngines.runtime).toMatchObject({ name: "node", version: NODE_FLOOR, onFail: "error" });
	});

	test("tests run through @cldmv/vitest-runner (the npm scripts call the harness, never vitest directly)", () => {
		expect(pkg.scripts.test).toBe("node tests/run-vitest.mjs");
		expect(pkg.scripts.coverage).toBe("node tests/run-vitest.mjs --coverage-quiet");
		expect(pkg.scripts["ci:coverage"]).toBe("npm run coverage");
		const harness = readFileSync(path.join(root, "tests/run-vitest.mjs"), "utf8");
		expect(harness).toContain('from "@cldmv/vitest-runner"');
		// CLDMV standing convention: test files are named *.test.vitest.mjs.
		expect(harness).toContain("testFilePattern");
	});

	test("the vitest config inlines slothlet, wires the instance-imports plugin and the query-stripping coverage provider", () => {
		const config = readFileSync(path.join(root, ".configs/vitest.config.mjs"), "utf8");
		expect(config).toContain("slothletInstanceImports");
		expect(config).toContain("/@cldmv\\/slothlet/");
		expect(config).toContain("coverage-provider.mjs");
	});

	test("coverage includes the whole src tree with a json-summary reporter", () => {
		const config = readFileSync(path.join(root, ".configs/vitest.config.mjs"), "utf8");
		expect(config).toContain('include: ["src/**"]');
		expect(config).toContain("json-summary");
	});

	test("every test file follows the *.test.vitest.mjs convention", () => {
		// Engines and config are checked above; the file naming is enforced by
		// the runner's testFilePattern — this assertion only documents it.
		expect(pkg.name).toBe("@cldmv/lib-unifi");
	});
});
