/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /tests/capabilities.test.vitest.mjs
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
import { createUnifi } from "@cldmv/lib-unifi";
import { officialRoutes, legacyRoutes, mockFetch, CONTROLLER } from "./helpers/routes.mjs";

describe("capabilities probe", () => {
	test("official: every site-scoped surface answers", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		const caps = await unifi.capabilities();
		expect(caps).toMatchObject({
			networks: "official",
			clients: "official",
			fixedIp: "none",
			dns: { records: "official", forward: "official" },
			version: "10.5.67",
			applicationVersion: "10.5.67"
		});
		expect(caps.site).toBe("d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c");
		// The official read paths never log in to the legacy surface.
		expect(fetch.calls.some((call) => call.pathname === "/api/auth/login")).toBe(false);
		await unifi.slothlet.shutdown();
	});

	test("fixedIp is never official: the Integration API carries no client fixed-IP write", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		const caps = await unifi.capabilities();
		expect(caps.fixedIp).toBe("none");
		await unifi.slothlet.shutdown();
	});

	test("official: the dns/policies endpoint missing classifies dns forward/records none but keeps the official networks read", async () => {
		const fetch = mockFetch(officialRoutes({ policies: false }));
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		const caps = await unifi.capabilities();
		expect(caps.networks).toBe("official");
		expect(caps.dns).toMatchObject({ records: "none", forward: "none" });
		await unifi.slothlet.shutdown();
	});

	test("legacy: a 9.x UniFi OS controller classifies every legacy capability, including dns.forward", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const caps = await unifi.capabilities();
		expect(caps).toMatchObject({
			networks: "legacy",
			clients: "legacy",
			fixedIp: "legacy",
			dns: { records: "legacy", forward: "legacy" },
			version: "9.3.43",
			endpointVersion: "unifi_os_v2",
			updateAvailable: false
		});
		await unifi.slothlet.shutdown();
	});

	test("legacy: a pre-9 Network application reads records but not forward rules", async () => {
		const fetch = mockFetch(legacyRoutes({ sysinfo: "sysinfo-7.3" }));
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const caps = await unifi.capabilities();
		expect(caps.dns).toMatchObject({ records: "legacy", forward: "none" });
		// A 7.x application classifies unifi_os_v1 by unifi-cli's version rule.
		expect(caps.endpointVersion).toBe("unifi_os_v1");
		await unifi.slothlet.shutdown();
	});

	test("legacy login failure: no legacy capability is claimed", async () => {
		const fetch = mockFetch(legacyRoutes({ login: "none" }));
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const caps = await unifi.capabilities();
		expect(caps.networks).toBe("none");
		expect(caps.dns.forward).toBe("none");
		await unifi.slothlet.shutdown();
	});

	test("an invalid API key with no legacy credentials classifies none", async () => {
		const routes = [
			{
				path: "/proxy/network/integration/v1/info",
				status: 401,
				body: {
					statusCode: 401,
					statusName: "UNAUTHORIZED",
					code: "api.authentication.invalid-credentials",
					message: "Invalid Credentials"
				}
			}
		];
		const fetch = mockFetch(routes);
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "bad-key" } });
		const caps = await unifi.capabilities();
		expect(caps).toMatchObject({ networks: "none", clients: "none", dns: { records: "none", forward: "none" }, version: null });
		await unifi.slothlet.shutdown();
	});

	test("the probe result is cached; refresh probes again", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		await unifi.capabilities();
		const callsAfterFirst = fetch.calls.length;
		const cached = await unifi.capabilities();
		expect(fetch.calls.length).toBe(callsAfterFirst);
		expect(cached.version).toBe("9.3.43");
		await unifi.capabilities({ refresh: true });
		expect(fetch.calls.length).toBeGreaterThan(callsAfterFirst);
		await unifi.slothlet.shutdown();
	});
});
