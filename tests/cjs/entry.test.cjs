/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/cjs/entry.test.cjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:44:12-08:00 (1795866252)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `test:cjs` entry — composes the BUILT package. Run after
 * `npm run build` (npm test does not build), it requires dist/index.cjs, calls
 * the factory, and exercises a leaf through the composed api, so a missing or
 * misplaced file under dist/api/ fails here. Also asserts the expected
 * dist/api/** and dist/lib/** files exist.
 *
 * Usage: npm run build && npm run test:cjs
 */

const assert = require("node:assert");
const { existsSync, statSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const dist = path.join(root, "dist");

// dist/ keeps the src/ tree one file per module: the api/ folder slothlet
// scans at runtime, the lib/ internals it imports relatively, both entries.
const required = [
	"index.mjs",
	"index.cjs",
	"api/capabilities.mjs",
	"api/networks/list.mjs",
	"api/networks/update.mjs",
	"api/clients/list.mjs",
	"api/clients/fixed/ip/set.mjs",
	"api/dns/records/list.mjs",
	"api/dns/forward/list.mjs",
	"api/dns/forward/set.mjs",
	"lib/config.mjs",
	"lib/session.mjs",
	"lib/endpoints.mjs",
	"lib/url.mjs",
	"lib/sites.mjs",
	"lib/errors.mjs",
	"lib/probe.mjs",
	"lib/auth/login.mjs",
	"lib/transport/request.mjs",
	"lib/transport/official.mjs",
	"lib/normalize/network.mjs",
	"lib/normalize/client.mjs",
	"lib/normalize/dns-record.mjs"
];
for (const file of required) {
	const p = path.join(dist, file);
	assert.ok(existsSync(p) && statSync(p).isFile(), `dist/${file} is missing — the build must mirror src/ one file per module`);
}
assert.ok(
	existsSync(path.join(dist, "api/networks")) && statSync(path.join(dist, "api/networks")).isDirectory(),
	"dist/api/ must keep the directory namespaces"
);

// The shim returns the factory itself: the ESM namespace carries exactly one
// distinct value (createUnifi, default and named).
const createUnifi = require(path.join(dist, "index.cjs"));
assert.strictEqual(typeof createUnifi, "function", "require(dist) must yield the createUnifi factory");

const CONTROLLER = "https://192.0.2.1";
let called = 0;
/** A tiny fetch stub: the official surface, one route per path. */
const fetch = async (url, _) => {
	called += 1;
	const parsed = new URL(String(url));
	const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
	if (parsed.pathname.endsWith("/info")) return json({ applicationVersion: "10.5.67" });
	if (parsed.pathname.endsWith("/sites"))
		return json({
			offset: 0,
			limit: 200,
			count: 1,
			totalCount: 1,
			data: [{ id: "d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c", internalReference: "default", name: "Default" }]
		});
	if (parsed.pathname.endsWith("/networks")) return json({ offset: 0, limit: 200, count: 0, totalCount: 0, data: [] });
	if (parsed.pathname.endsWith("/clients")) return json({ offset: 0, limit: 200, count: 0, totalCount: 0, data: [] });
	if (parsed.pathname.endsWith("/dns/policies")) return json({ offset: 0, limit: 200, count: 0, totalCount: 0, data: [] });
	return new Response(JSON.stringify({ statusCode: 404, statusName: "NOT_FOUND", code: "api.not-found", message: parsed.pathname }), {
		status: 404,
		headers: { "Content-Type": "application/json" }
	});
};

(async () => {
	const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
	assert.strictEqual(typeof unifi.networks.list, "function", "the composed api carries the leaves");
	const caps = await unifi.capabilities();
	assert.strictEqual(caps.networks, "official");
	assert.strictEqual(caps.version, "10.5.67");
	const networks = await unifi.networks.list();
	assert.deepStrictEqual(networks, []);
	assert.ok(called >= 5, `expected the official reads to go through the injected fetch, got ${called} calls`);
	await unifi.slothlet.shutdown();
	console.log("test:cjs: dist/ composes and serves the api");
})().catch((err) => {
	console.error(err);
	process.exit(1);
});
