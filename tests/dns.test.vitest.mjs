/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /tests/dns.test.vitest.mjs
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
import { officialRoutes, legacyRoutes, mockFetch, CONTROLLER, OFFICIAL_ROOT, SITE_ID } from "./helpers/routes.mjs";

describe("dns.records.list", () => {
	test("official path: the dns/policies page, normalized", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		const records = await unifi.dns.records.list();
		expect(records).toHaveLength(4);
		expect(records[0]).toEqual({
			id: "p1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
			type: "A_RECORD",
			enabled: true,
			domain: "printer.iot.cldmv.net",
			ttl: 300,
			data: { ipv4Address: "198.51.100.50" },
			origin: "USER_DEFINED"
		});
		expect(records[1]).toMatchObject({ type: "FORWARD_DOMAIN", domain: "homelab.cldmv.net", data: { ipAddress: "192.0.2.166" } });
		expect(records[3]).toMatchObject({ type: "CNAME_RECORD", enabled: false, ttl: 0 });
		await unifi.slothlet.shutdown();
	});

	test("legacy path: static-dns rows, normalized", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const records = await unifi.dns.records.list();
		expect(records).toHaveLength(3);
		expect(records[0]).toEqual({
			id: "s1a2b3c4d5e64f7a8b9c0d1e2f3a4b5c",
			type: "forward",
			enabled: true,
			domain: "homelab.cldmv.net",
			ttl: null,
			data: { value: "192.0.2.166" },
			origin: null
		});
		await unifi.slothlet.shutdown();
	});
});

describe("dns.forward.list", () => {
	test("official path: only the FORWARD_DOMAIN policies, as { domain, target }", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		const forwards = await unifi.dns.forward.list();
		expect(forwards).toEqual([
			{ domain: "homelab.cldmv.net", target: "192.0.2.166", id: "p2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d", enabled: true }
		]);
		await unifi.slothlet.shutdown();
	});

	test("legacy path: only the forward rows", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const forwards = await unifi.dns.forward.list();
		expect(forwards).toEqual([
			{ domain: "homelab.cldmv.net", target: "192.0.2.166", id: "s1a2b3c4d5e64f7a8b9c0d1e2f3a4b5c", enabled: true }
		]);
		await unifi.slothlet.shutdown();
	});

	test("dns.forward none: an empty list (an absent store holds no rules)", async () => {
		const fetch = mockFetch(legacyRoutes({ sysinfo: "sysinfo-7.3" }));
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const forwards = await unifi.dns.forward.list();
		expect(forwards).toEqual([]);
		await unifi.slothlet.shutdown();
	});
});

describe("dns.forward.set", () => {
	test("official dry run: a POST body with the FORWARD_DOMAIN type — and nothing sent", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		const plan = await unifi.dns.forward.set({ domain: "Test.Homelab.CLDmv.net.", target: "192.0.2.53" }, { dryRun: true });
		expect(plan.dryRun).toBe(true);
		expect(plan.capability).toBe("official");
		expect(plan.existing).toBe(null); // no enabled forward rule for that domain yet
		expect(plan.request.method).toBe("POST");
		expect(plan.request.url).toBe(`${CONTROLLER}${OFFICIAL_ROOT}/sites/${SITE_ID}/dns/policies`);
		expect(plan.request.body).toEqual({ type: "FORWARD_DOMAIN", enabled: true, domain: "test.homelab.cldmv.net", ipAddress: "192.0.2.53" });
		expect(fetch.calls.filter((call) => call.method === "POST")).toHaveLength(0);
		await unifi.slothlet.shutdown();
	});

	test("official write: replaces an existing forward rule for the same domain with a PUT", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		const result = await unifi.dns.forward.set({ domain: "homelab.cldmv.net", target: "198.51.100.166" });
		expect(result).toMatchObject({
			ok: true,
			capability: "official",
			domain: "homelab.cldmv.net",
			target: "198.51.100.166",
			created: false,
			id: "p2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d"
		});
		const put = fetch.calls.find((call) => call.method === "PUT");
		expect(put.pathname).toBe(`${OFFICIAL_ROOT}/sites/${SITE_ID}/dns/policies/p2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d`);
		expect(JSON.parse(put.body)).toEqual({
			type: "FORWARD_DOMAIN",
			enabled: true,
			domain: "homelab.cldmv.net",
			ipAddress: "198.51.100.166"
		});
		await unifi.slothlet.shutdown();
	});

	test("legacy dry run: a static-dns forward row body", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const plan = await unifi.dns.forward.set({ domain: "tail935f4f.ts.net", target: "100.64.178.0" }, { dryRun: true });
		expect(plan.dryRun).toBe(true);
		expect(plan.capability).toBe("legacy");
		expect(plan.request.method).toBe("POST");
		expect(plan.request.body).toEqual({ enabled: true, key: "tail935f4f.ts.net", record_type: "forward", value: "100.64.178.0" });
		expect(fetch.calls.filter((call) => call.method === "POST" && !call.pathname.includes("login"))).toHaveLength(0);
		await unifi.slothlet.shutdown();
	});

	test("legacy write: replaces an existing forward row with a PUT", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const result = await unifi.dns.forward.set({ domain: "HOMELAB.cldmv.net", target: "192.0.2.53" });
		expect(result).toMatchObject({
			ok: true,
			capability: "legacy",
			domain: "homelab.cldmv.net",
			created: false,
			id: "s1a2b3c4d5e64f7a8b9c0d1e2f3a4b5c"
		});
		const put = fetch.calls.find((call) => call.method === "PUT");
		expect(put.pathname).toBe("/proxy/network/v2/api/site/default/static-dns/s1a2b3c4d5e64f7a8b9c0d1e2f3a4b5c");
		await unifi.slothlet.shutdown();
	});

	test("legacy write: creates when no forward row exists for the domain", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const result = await unifi.dns.forward.set({ domain: "0.0.10.in-addr.arpa", target: "192.0.2.166" });
		expect(result).toMatchObject({ ok: true, created: true });
		const post = fetch.calls.find((call) => call.method === "POST" && call.pathname.includes("static-dns"));
		expect(post).toBeTruthy();
		expect(JSON.parse(post.body)).toEqual({ enabled: true, key: "0.0.10.in-addr.arpa", record_type: "forward", value: "192.0.2.166" });
		await unifi.slothlet.shutdown();
	});

	test("dns.forward none: CAPABILITY_UNAVAILABLE with the console-update hint", async () => {
		const fetch = mockFetch(legacyRoutes({ sysinfo: "sysinfo-7.3" }));
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		await expect(unifi.dns.forward.set({ domain: "homelab.cldmv.net", target: "192.0.2.53" })).rejects.toMatchObject({
			code: "CAPABILITY_UNAVAILABLE",
			capability: "dns.forward",
			hint: expect.stringContaining("9.x")
		});
		await unifi.slothlet.shutdown();
	});

	test("validation: bad domain and bad target", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		await expect(unifi.dns.forward.set({ domain: "https://homelab.cldmv.net", target: "192.0.2.53" })).rejects.toMatchObject({
			code: "VALIDATION_DOMAIN"
		});
		await expect(unifi.dns.forward.set({ domain: "homelab.cldmv.net", target: "homelab.cldmv.net" })).rejects.toMatchObject({
			code: "VALIDATION_TARGET"
		});
		await unifi.slothlet.shutdown();
	});
});
