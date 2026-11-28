/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/sites.test.vitest.mjs
 *	@Date: 2026-11-28T04:50:40-08:00 (1795870240)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:09-08:00 (1795870569)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, expect, test } from "vitest";
import { createUnifi } from "@cldmv/lib-unifi";
import { officialRoutes, legacyRoutes, mockFetch, CONTROLLER } from "./helpers/routes.mjs";

const API_KEY = { apiKey: "doc-api-key" };
const LEGACY_CREDS = { legacy: { username: "digby", password: "doc-password" } };

describe("sites.list", () => {
	test("official: the site overview rows, normalized", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		const sites = await unifi.sites.list();
		expect(sites).toEqual([
			{ id: "d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c", name: "Default", internalReference: "default" },
			{ id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", name: "Lab", internalReference: "lab" }
		]);
		expect(fetch.calls.some((call) => call.pathname === "/api/auth/login")).toBe(false);
		await unifi.slothlet.shutdown();
	});

	test("legacy: the stat/sites rows normalized (the _id and attr_hidden_id become the ids)", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const sites = await unifi.sites.list();
		expect(sites).toEqual([{ id: "5e5e5e5e5e5e5e5e5e5e5e5e", name: "Default", internalReference: "default" }]);
		await unifi.slothlet.shutdown();
	});

	test("no surface answers: capability error", async () => {
		const fetch = mockFetch(legacyRoutes({ login: "none" }));
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		await expect(unifi.sites.list()).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE", capability: "sites" });
		await unifi.slothlet.shutdown();
	});
});
