/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/admins.test.vitest.mjs
 *	@Date: 2026-11-28T04:52:07-08:00 (1795870327)
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

const API_KEY = { apiKey: "doc-api-key" };
const LEGACY_CREDS = { legacy: { username: "digby", password: "doc-password" } };

describe("admins (legacy-only)", () => {
	test("list answers the controller login accounts", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const admins = await unifi.admins.list();
		expect(admins).toHaveLength(1);
		expect(admins[0]).toMatchObject({ _id: "m1a2b3c4d5e6f7a8b9c0d1e2", name: "admin", role: "admin" });
		await unifi.slothlet.shutdown();
	});

	test("get answers the UniFi OS v2 detail row", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const admin = await unifi.admins.get("m1a2b3c4d5e6f7a8b9c0d1e2");
		expect(admin.site_role).toBe("admin");
		const detail = fetch.calls.find((call) => call.pathname === "/proxy/network/v2/api/site/default/user/m1a2b3c4d5e6f7a8b9c0d1e2");
		expect(detail).toBeTruthy();
		await unifi.slothlet.shutdown();
	});

	test("official-only: capability error (the Integration API exposes no admin management)", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await expect(unifi.admins.list()).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE", capability: "admins" });
		await expect(unifi.admins.get("m1a2b3c4d5e6f7a8b9c0d1e2")).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
		await unifi.slothlet.shutdown();
	});

	test("a legacy (pre-UnFi-OS) surface carries the list but no single-admin read", async () => {
		const fetch = mockFetch(legacyRoutes({ sysinfo: "sysinfo-7.3" }));
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		expect((await unifi.admins.list()).length).toBe(1);
		await expect(unifi.admins.get("m1a2b3c4d5e6f7a8b9c0d1e2")).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
		await unifi.slothlet.shutdown();
	});
});
