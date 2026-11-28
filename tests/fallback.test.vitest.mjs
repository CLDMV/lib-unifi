/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/fallback.test.vitest.mjs
 *	@Date: 2026-11-28T04:53:20-08:00 (1795870400)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:08-08:00 (1795870568)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, expect, test } from "vitest";
import { createUnifi } from "@cldmv/lib-unifi";
import { officialRoutes, legacyRoutes, mockFetch, CONTROLLER, SITE_ID } from "./helpers/routes.mjs";

/**
 * @fileoverview The dual-path fallback sweep: every dual-path leaf answers from
 * the legacy controller API when the official Integration API is absent, when
 * the API key is refused (401), and when the official surface is partially up
 * but the leaf's own collection answers 404. Each case runs against a fresh
 * instance and a mock that carries both surfaces.
 */

const LEGACY_CREDS = { legacy: { username: "digby", password: "doc-password" } };
const BOTH_CREDS = { apiKey: "doc-api-key", legacy: { username: "digby", password: "doc-password" } };

/** [leaf, call, legacyCheck, officialCheck] — the check sees the leaf's answer;
 * `officialCheck` (optional) runs in the collection-404 scenario, where the
 * official site list itself still answers and the leaf legitimately stays
 * official. */
const DUAL_PATH_LEAVES = [
	[
		"sites.list",
		(u) => u.sites.list(),
		(answer) => expect(answer[0]).toMatchObject({ id: "5e5e5e5e5e5e5e5e5e5e5e5e", internalReference: "default" }),
		(answer) => expect(answer[0]).toMatchObject({ id: SITE_ID, internalReference: "default" })
	],
	["networks.list", (u) => u.networks.list(), (answer) => expect(answer).toHaveLength(2)],
	[
		"networks.update",
		(u) => u.networks.update("66666666777748888999000000000000", { dns: ["192.0.2.53"] }),
		(answer) => expect(answer.ok).toBe(true)
	],
	["clients.list", (u) => u.clients.list(), (answer) => expect(answer[0]).toMatchObject({ mac: "00:00:5e:00:53:01", active: true })],
	[
		"clients.get",
		(u) => u.clients.get("u1a2b3c4d5e64f7a8b9c0d1e2f3a4b5c"),
		(answer) => expect(answer._id).toBe("u1a2b3c4d5e64f7a8b9c0d1e2f3a4b5c")
	],
	["devices.list", (u) => u.devices.list(), (answer) => expect(answer[0]).toMatchObject({ _id: "b1a2b3c4d5e6f7a8b9c0d1e2", type: "uap" })],
	["devices.get", (u) => u.devices.get("b1a2b3c4d5e6f7a8b9c0d1e2"), (answer) => expect(answer.port_table).toHaveLength(1)],
	["dns.records.list", (u) => u.dns.records.list(), (answer) => expect(answer.length).toBeGreaterThan(0)],
	[
		"dns.forward.list",
		(u) => u.dns.forward.list(),
		(answer) => expect(answer[0]).toMatchObject({ domain: "homelab.example.com", target: "192.0.2.166" })
	],
	[
		"dns.forward.set",
		(u) => u.dns.forward.set({ domain: "printer.example.com", target: "192.0.2.53" }),
		(answer) => expect(answer.created).toBe(true)
	]
];

/**
 * The mock routes for one scenario: the official surface shaped by
 * `officialFailure` ("absent" — never served; "401" — the key refused;
 * "404" — /info and /sites answer, the site-scoped collections do not), plus
 * the full legacy surface.
 */
function scenarioRoutes(officialFailure) {
	const legacy = legacyRoutes();
	if (officialFailure === "absent") return legacy;
	if (officialFailure === "401") {
		return [
			{
				path: "/proxy/network/integration/v1/info",
				status: 401,
				body: {
					statusCode: 401,
					statusName: "UNAUTHORIZED",
					code: "api.authentication.invalid-credentials",
					message: "Invalid Credentials"
				}
			},
			...legacy
		];
	}
	// Partial: the official application answers but the site-scoped collections 404.
	return [
		...officialRoutes({
			networks: false,
			clients: false,
			policies: false,
			devices: false,
			firewall: false,
			wlans: false,
			radius: false,
			vouchers: false,
			switching: false,
			vpn: false,
			wan: false,
			dpi: false,
			countries: false
		}),
		...legacy
	];
}

describe("every dual-path leaf falls back to legacy", () => {
	test.each(DUAL_PATH_LEAVES.map(([name, call, check]) => [name, call, check]))(
		"%s: official absent → legacy answers",
		async (_name, call, check) => {
			const fetch = mockFetch(scenarioRoutes("absent"));
			const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
			check(await call(unifi));
			// The legacy probe logged in; the official surface was never contacted.
			expect(fetch.calls.some((c) => c.pathname.startsWith("/proxy/network/integration"))).toBe(false);
			await unifi.slothlet.shutdown();
		}
	);

	test.each(DUAL_PATH_LEAVES.map(([name, call, check]) => [name, call, check]))(
		"%s: official 401 → legacy answers",
		async (_name, call, check) => {
			const fetch = mockFetch(scenarioRoutes("401"));
			const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: BOTH_CREDS });
			const caps = await unifi.capabilities();
			// The refused key is on the report — and the legacy surface still serves.
			expect(caps.officialError).toMatchObject({ code: "OFFICIAL_UNAUTHORIZED" });
			check(await call(unifi));
			await unifi.slothlet.shutdown();
		}
	);

	test.each(DUAL_PATH_LEAVES.map(([name, call, check, officialCheck]) => [name, call, officialCheck ?? check]))(
		"%s: official collection 404 → legacy answers",
		async (_name, call, check) => {
			const fetch = mockFetch(scenarioRoutes("404"));
			const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: BOTH_CREDS });
			check(await call(unifi));
			await unifi.slothlet.shutdown();
		}
	);
});
