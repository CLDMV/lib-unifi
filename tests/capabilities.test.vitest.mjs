/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/capabilities.test.vitest.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:07-08:00 (1795870567)
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

	test("an invalid API key with no legacy credentials classifies none and reports the official failure", async () => {
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
		// The refused key is visible on the report — an official failure no
		// longer degrades silently.
		expect(caps.official).toBe(false);
		expect(caps.officialError).toMatchObject({ code: "OFFICIAL_UNAUTHORIZED" });
		await unifi.slothlet.shutdown();
	});

	test("the official surface failing after /info reports the failure, not a silent degradation", async () => {
		const fetch = mockFetch([
			...officialRoutes({ sites: false, networks: false, clients: false, policies: false }),
			...legacyRoutes({ udmProbe: false })
		]);
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { apiKey: "doc-api-key", legacy: { username: "digby", password: "doc-password" } }
		});
		const caps = await unifi.capabilities();
		expect(caps.networks).toBe("legacy");
		expect(caps.official).toBe(false);
		expect(caps.officialError).toMatchObject({ code: "OFFICIAL_UNREACHABLE" });
		await unifi.slothlet.shutdown();
	});

	test("legacy: the sites fallback classifies unifi_os_v2 when sysinfo is unreadable", async () => {
		const fetch = mockFetch(legacyRoutes({ sysinfo: null }));
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const caps = await unifi.capabilities();
		expect(caps.endpointVersion).toBe("unifi_os_v2");
		// The sites row carries no version, so the forward claim is refused.
		expect(caps.dns).toMatchObject({ records: "legacy", forward: "none" });
		await unifi.slothlet.shutdown();
	});

	test("legacy: the Protect bootstrap answers on an NVR, not a Network controller", async () => {
		const fetch = mockFetch(legacyRoutes({ sysinfo: null, sites: false, bootstrap: true }));
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const caps = await unifi.capabilities();
		expect(caps.endpointVersion).toBe("unifi_os_v2");
		await unifi.slothlet.shutdown();
	});

	test("legacy: nothing answers the detection chain — the legacy fallback still reads networkconf", async () => {
		const fetch = mockFetch(legacyRoutes({ sysinfo: null, sites: false, bootstrap: false }));
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const caps = await unifi.capabilities();
		expect(caps.endpointVersion).toBe("legacy");
		expect(caps.version).toBe(null);
		expect(caps.networks).toBe("legacy");
		expect(caps.dns.forward).toBe("none");
		await unifi.slothlet.shutdown();
	});

	test("official /info answers but the sites list fails — the legacy path takes over", async () => {
		const fetch = mockFetch([
			...officialRoutes({ sites: false, networks: false, clients: false, policies: false }),
			...legacyRoutes({ udmProbe: false })
		]);
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { apiKey: "doc-api-key", legacy: { username: "digby", password: "doc-password" } }
		});
		const caps = await unifi.capabilities();
		expect(caps.networks).toBe("legacy");
		expect(caps.dns.forward).toBe("legacy");
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

describe("version classification and the report extras", () => {
	// S2: the classification is unifi-cli's parseFloat(version) >= 7.4 — a
	// major-only parse regressed 7.4-7.x to unifi_os_v1.
	test.each([
		["sysinfo-7.3", "unifi_os_v1"],
		["sysinfo-7.4", "unifi_os_v2"],
		["sysinfo", "unifi_os_v2"]
	])("sysinfo %s classifies %s at the 7.4 boundary", async (fixtureName, expected) => {
		const fetch = mockFetch(legacyRoutes({ sysinfo: fixtureName }));
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const caps = await unifi.capabilities();
		expect(caps.endpointVersion).toBe(expected);
		await unifi.slothlet.shutdown();
	});

	test("configured spki pins are counted on the report (the values are never stored)", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { apiKey: "doc-api-key" },
			tls: { spkiPins: ["sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="] }
		});
		const caps = await unifi.capabilities();
		expect(caps.tls).toEqual({ spkiPins: 2 });
		expect(JSON.stringify(caps)).not.toContain("sha256/");
		// Pinning itself lives in the caller's fetch: the library never opens
		// sockets, so the fetch it calls is the one handed in.
		expect(fetch.calls.length).toBeGreaterThan(0);
		await unifi.slothlet.shutdown();
	});

	test("no tls config reports null pins", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const caps = await unifi.capabilities();
		expect(caps.tls).toEqual({ spkiPins: null });
		await unifi.slothlet.shutdown();
	});

	test("official: true marks the official surface usable; official-only leaves gate on it", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		const caps = await unifi.capabilities();
		expect(caps.official).toBe(true);
		expect(caps.officialError).toBe(null);
		// An official-only leaf works off the same report...
		const wans = await unifi.wan.list();
		expect(wans).toHaveLength(1);
		// ...and the official-only gate does not re-probe (the report is cached).
		const callsAfterCaps = fetch.calls.length;
		await unifi.firewall.zones.list();
		expect(fetch.calls.length).toBeGreaterThan(callsAfterCaps);
		await unifi.slothlet.shutdown();
	});

	test("official: false gates the official-only leaves with a capability error", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		await expect(unifi.wan.list()).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE", capability: "wan" });
		await expect(unifi.dpi.applications.list()).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
		await expect(unifi.firewall.zones.list()).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
		await unifi.slothlet.shutdown();
	});
});
