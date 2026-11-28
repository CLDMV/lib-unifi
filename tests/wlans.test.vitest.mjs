/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/wlans.test.vitest.mjs
 *	@Date: 2026-11-28T04:51:53-08:00 (1795870313)
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
import { officialRoutes, legacyRoutes, mockFetch, CONTROLLER, WLAN_ID } from "./helpers/routes.mjs";

const API_KEY = { apiKey: "doc-api-key" };
const LEGACY_CREDS = { legacy: { username: "digby", password: "doc-password" } };

describe("wlans (the Integration API's wifi/broadcasts)", () => {
	test("list and get answer the broadcast rows", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		const wlans = await unifi.wlans.list();
		expect(wlans).toHaveLength(1);
		expect(wlans[0]).toMatchObject({ id: WLAN_ID, name: "Homelab", type: "STANDARD" });
		const wlan = await unifi.wlans.get(WLAN_ID);
		expect(wlan.securityConfiguration.type).toBe("WPA2_PERSONAL");
		await unifi.slothlet.shutdown();
	});

	test("create, update and delete send one write each", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		await unifi.wlans.create({ name: "Guest", type: "STANDARD", enabled: true });
		await unifi.wlans.update(WLAN_ID, { name: "Homelab", type: "STANDARD", enabled: true });
		await unifi.wlans.delete(WLAN_ID);
		const newCalls = fetch.calls.slice(callsBefore);
		expect(newCalls.map((call) => call.method)).toEqual(["POST", "PUT", "DELETE"]);
		expect(JSON.parse(newCalls[0].body)).toMatchObject({ name: "Guest" });
		await unifi.slothlet.shutdown();
	});

	test("legacy-only: capability error (no WLAN rows on the legacy table)", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		await expect(unifi.wlans.list()).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE", capability: "wlans" });
		await unifi.slothlet.shutdown();
	});
});
