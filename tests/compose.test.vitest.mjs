/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /tests/compose.test.vitest.mjs
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
import { isUnifiError } from "../src/lib/errors.mjs";
import { officialRoutes, legacyRoutes, mockFetch, CONTROLLER } from "./helpers/routes.mjs";

describe("createUnifi composition", () => {
	test("composes the library's own slothlet instance and returns it as the api", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });

		// The returned object IS the api: every leaf is reachable and callable.
		expect(typeof unifi.capabilities).toBe("function");
		expect(typeof unifi.networks.list).toBe("function");
		expect(typeof unifi.networks.update).toBe("function");
		expect(typeof unifi.clients.list).toBe("function");
		expect(typeof unifi.clients.fixed.ip.set).toBe("function");
		expect(typeof unifi.dns.records.list).toBe("function");
		expect(typeof unifi.dns.forward.list).toBe("function");
		expect(typeof unifi.dns.forward.set).toBe("function");

		// The slothlet management surface rides along.
		expect(typeof unifi.slothlet.context.get).toBe("function");
		await unifi.slothlet.shutdown();
	});

	test("leaves work end-to-end through the composed api", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });

		const caps = await unifi.capabilities();
		expect(caps.networks).toBe("official");
		expect(caps.dns.forward).toBe("official");

		const networks = await unifi.networks.list();
		expect(networks.map((network) => network.name)).toEqual(["Default", "IoT"]);

		const clients = await unifi.clients.list({ active: true });
		expect(clients).toHaveLength(2);
		expect(clients[0]).toMatchObject({ mac: "00:00:5e:00:53:01", ip: "192.0.2.10", hostname: "printer" });

		await unifi.slothlet.shutdown();
	});

	test("composing twice gives two isolated instances (no shared sessions or probes)", async () => {
		const officialFetch = mockFetch(officialRoutes());
		const legacyFetch = mockFetch(legacyRoutes());
		const official = await createUnifi({ baseUrl: CONTROLLER, fetch: officialFetch, credentials: { apiKey: "doc-api-key" } });
		const legacy = await createUnifi({
			baseUrl: CONTROLLER,
			fetch: legacyFetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});

		const officialCaps = await official.capabilities();
		expect(officialCaps.networks).toBe("official");

		// The second instance probes on its own and classifies legacy — the
		// first instance's cached probe is not visible to it.
		const legacyCaps = await legacy.capabilities();
		expect(legacyCaps.networks).toBe("legacy");
		expect(legacyFetch.calls.some((call) => call.pathname === "/api/auth/login")).toBe(true);

		await official.slothlet.shutdown();
		await legacy.slothlet.shutdown();
	});

	test("no credentials composes; capabilities report none without probing", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch });
		const caps = await unifi.capabilities();
		expect(caps).toMatchObject({
			networks: "none",
			clients: "none",
			fixedIp: "none",
			dns: { records: "none", forward: "none" }
		});
		// Nothing was sent: with no credentials there is nothing to probe.
		expect(fetch.calls).toHaveLength(0);
		await unifi.slothlet.shutdown();
	});

	test("factory validation: missing baseUrl and non-function fetch are ConfigErrors", async () => {
		await expect(createUnifi({ fetch: () => {} })).rejects.toMatchObject({ code: "CONFIG_BASE_URL_REQUIRED" });
		await expect(createUnifi({ baseUrl: CONTROLLER })).rejects.toMatchObject({ code: "CONFIG_FETCH_REQUIRED" });
	});

	test("the factory is async and its errors are library errors", async () => {
		await expect(createUnifi({ baseUrl: "https://192.0.2.1", fetch: "nope" })).rejects.toSatisfy((err) =>
			isUnifiError(err, "CONFIG_FETCH_REQUIRED")
		);
	});
});
