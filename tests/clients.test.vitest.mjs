/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/clients.test.vitest.mjs
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

describe("clients.list", () => {
	test("official path: the connected-clients page, normalized", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		const clients = await unifi.clients.list({ active: true });
		expect(clients).toEqual([
			{
				mac: "00:00:5e:00:53:01",
				ip: "192.0.2.10",
				hostname: "printer",
				network: "11111111-2222-4333-8444-555555555555",
				fixed: false,
				active: true,
				id: "c1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c"
			},
			{
				mac: "00:00:5e:00:53:02",
				ip: "198.51.100.21",
				hostname: "thermostat",
				network: "66666666-7777-4888-8999-000000000000",
				fixed: false,
				active: true,
				id: "c2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d"
			}
		]);
		await unifi.slothlet.shutdown();
	});

	test("legacy path: stat/sta rows with fixed IPs", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const clients = await unifi.clients.list({ active: true });
		expect(clients).toEqual([
			{
				mac: "00:00:5e:00:53:01",
				ip: "192.0.2.10",
				hostname: "printer",
				network: "Default",
				fixed: false,
				active: true,
				id: "c1a2b3c4d5e64f7a8b9c0d1e2f3a4b5c"
			},
			{
				mac: "00:00:5e:00:53:02",
				ip: "198.51.100.21",
				hostname: "thermostat",
				network: "IoT",
				fixed: "198.51.100.21",
				active: true,
				id: "c2b3c4d5e6f74a8b9c0d1e2f3a4b5c6d"
			}
		]);
		await unifi.slothlet.shutdown();
	});

	test("legacy active:false merges the rest/user records for offline clients", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const clients = await unifi.clients.list({ active: false });
		const macs = clients.map((client) => client.mac);
		expect(macs).toContain("00:00:5e:00:53:01");
		expect(macs).toContain("00:00:5e:00:53:02");
		expect(macs).toContain("00:00:5e:00:53:03");
		const server = clients.find((client) => client.mac === "00:00:5e:00:53:03");
		expect(server).toMatchObject({ ip: "192.0.2.166", fixed: "192.0.2.166", active: false, network: "Default" });
		await unifi.slothlet.shutdown();
	});

	test("official active:false is refused with the fix step in the error", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		await expect(unifi.clients.list({ active: false })).rejects.toMatchObject({
			code: "CAPABILITY_UNAVAILABLE",
			capability: "clients",
			hint: expect.stringContaining("legacy")
		});
		await unifi.slothlet.shutdown();
	});
});

describe("clients.fixed.ip.set", () => {
	test("resolves the MAC to the controller _id and PUTs both fixed_ip and use_fixedip", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const result = await unifi.clients.fixed.ip.set("00:00:5E:00:53:01", "192.0.2.10");
		expect(result).toMatchObject({ ok: true, mac: "00:00:5e:00:53:01", ip: "192.0.2.10", id: "u1a2b3c4d5e64f7a8b9c0d1e2f3a4b5c" });
		const put = fetch.calls.find((call) => call.method === "PUT" && call.pathname.includes("/rest/user/"));
		expect(put).toBeTruthy();
		expect(put.pathname).toBe("/proxy/network/api/s/default/rest/user/u1a2b3c4d5e64f7a8b9c0d1e2f3a4b5c");
		expect(JSON.parse(put.body)).toEqual({ fixed_ip: "192.0.2.10", use_fixedip: true });
		// The session rides the write.
		expect(put.headers.Cookie).toContain("TOKEN=doc-token-cookie");
		expect(put.headers["X-Csrf-Token"]).toBe("doc-csrf-token-0001");
		await unifi.slothlet.shutdown();
	});

	test("dry run answers the request and sends nothing", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const plan = await unifi.clients.fixed.ip.set("00:00:5e:00:53:03", "192.0.2.77", { dryRun: true });
		expect(plan.dryRun).toBe(true);
		expect(plan.capability).toBe("legacy");
		expect(plan.request.method).toBe("PUT");
		expect(plan.request.url).toBe(`${CONTROLLER}/proxy/network/api/s/default/rest/user/u2b3c4d5e6f74a8b9c0d1e2f3a4b5c6d`);
		expect(plan.request.body).toEqual({ fixed_ip: "192.0.2.77", use_fixedip: true });
		expect(fetch.calls.filter((call) => call.method === "PUT")).toHaveLength(0);
		await unifi.slothlet.shutdown();
	});

	test("a MAC known only to stat/sta still resolves (the sta row's _id)", async () => {
		const fetch = mockFetch(legacyRoutes({ userRecords: false }));
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		// Without rest/user the fixedIp capability stays legacy (login works), so
		// the write resolves the id from the connected-client row.
		const result = await unifi.clients.fixed.ip.set("00:00:5e:00:53:02", "198.51.100.21");
		expect(result.id).toBe("c2b3c4d5e6f74a8b9c0d1e2f3a4b5c6d");
		await unifi.slothlet.shutdown();
	});

	test("an unknown MAC is a 404-shaped ApiError", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		await expect(unifi.clients.fixed.ip.set("00:00:5e:00:53:ff", "192.0.2.99")).rejects.toMatchObject({ code: "API_ERROR", status: 404 });
		await unifi.slothlet.shutdown();
	});

	test("official-only deployment: CAPABILITY_UNAVAILABLE", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		await expect(unifi.clients.fixed.ip.set("00:00:5e:00:53:01", "192.0.2.10")).rejects.toMatchObject({
			code: "CAPABILITY_UNAVAILABLE",
			capability: "fixedIp"
		});
		await unifi.slothlet.shutdown();
	});

	test("validation: bad MAC and bad IP", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		await expect(unifi.clients.fixed.ip.set("not-a-mac", "192.0.2.10")).rejects.toMatchObject({ code: "VALIDATION_MAC" });
		await expect(unifi.clients.fixed.ip.set("00:00:5e:00:53:01", "999.1.1.1")).rejects.toMatchObject({ code: "VALIDATION_IP" });
		await unifi.slothlet.shutdown();
	});
});

describe("clients.list with both API paths available", () => {
	test("the official clients are enriched from the legacy records (fixed IP + network name)", async () => {
		const fetch = mockFetch([...officialRoutes(), ...legacyRoutes()]);
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { apiKey: "doc-api-key", legacy: { username: "digby", password: "doc-password" } }
		});
		const clients = await unifi.clients.list({ active: true });
		const printer = clients.find((client) => client.mac === "00:00:5e:00:53:01");
		expect(printer).toMatchObject({
			mac: "00:00:5e:00:53:01",
			fixed: "192.0.2.10",
			network: "Default",
			active: true
		});
		// A client with no legacy record keeps the official shape (networkId).
		const thermostat = clients.find((client) => client.mac === "00:00:5e:00:53:02");
		expect(thermostat).toMatchObject({ network: "66666666-7777-4888-8999-000000000000", fixed: false });
		await unifi.slothlet.shutdown();
	});

	test("active:false merges the offline clients from the legacy records", async () => {
		const fetch = mockFetch([...officialRoutes(), ...legacyRoutes()]);
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { apiKey: "doc-api-key", legacy: { username: "digby", password: "doc-password" } }
		});
		const macs = (await unifi.clients.list({ active: false })).map((client) => client.mac);
		expect(macs).toEqual(expect.arrayContaining(["00:00:5e:00:53:01", "00:00:5e:00:53:02", "00:00:5e:00:53:03"]));
		await unifi.slothlet.shutdown();
	});

	test("active:false still refuses on an official-only deployment (and before any client fetch)", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		await expect(unifi.clients.list({ active: false })).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
		// Nothing beyond the probe was sent: the check runs before the read (the
		// probe's single clients call carries offset=0&limit=1).
		const clientsCalls = fetch.calls.filter((call) => call.pathname.endsWith("/clients"));
		expect(clientsCalls.every((call) => call.url.includes("limit=1"))).toBe(true);
		await unifi.slothlet.shutdown();
	});
});
