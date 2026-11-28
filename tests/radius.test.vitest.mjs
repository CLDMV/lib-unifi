/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/radius.test.vitest.mjs
 *	@Date: 2026-11-28T04:52:01-08:00 (1795870321)
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
import { officialRoutes, legacyRoutes, mockFetch, CONTROLLER } from "./helpers/routes.mjs";

const API_KEY = { apiKey: "doc-api-key" };
const LEGACY_CREDS = { legacy: { username: "digby", password: "doc-password" } };

describe("radius.profiles (official read-only)", () => {
	test("list answers the profile rows", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		const profiles = await unifi.radius.profiles.list();
		expect(profiles).toHaveLength(1);
		expect(profiles[0]).toMatchObject({ id: "d9e0f1a2-b3c4-4d5e-6f7a-9b0c1d2e3f4a", name: "Default" });
		await unifi.slothlet.shutdown();
	});
});

describe("radius.users (legacy, unifi-cli's radius-sync surface)", () => {
	test("list answers the RADIUS user rows", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const users = await unifi.radius.users.list();
		expect(users).toHaveLength(1);
		expect(users[0]).toMatchObject({
			_id: "r1a2b3c4d5e6f7a8b9c0d1e2",
			name: "device-auth-1",
			tunnel_type: 13,
			tunnel_medium_type: 6,
			vlan: 20
		});
		await unifi.slothlet.shutdown();
	});

	test("create sends the batch array unifi-cli's radius-sync sends", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		const result = await unifi.radius.users.create([
			{ name: "device-auth-2", x_password: "doc-radius-pass-2", tunnel_type: 13, tunnel_medium_type: 6, vlan: 30 }
		]);
		expect(result.ok).toBe(true);
		const post = fetch.calls.slice(callsBefore).find((call) => call.method === "POST");
		expect(post.pathname).toBe("/proxy/network/v2/api/site/default/radius/users/batch_add");
		expect(JSON.parse(post.body)).toEqual([
			{ name: "device-auth-2", x_password: "doc-radius-pass-2", tunnel_type: 13, tunnel_medium_type: 6, vlan: 30 }
		]);
		await unifi.slothlet.shutdown();
	});

	test("create wraps a single object into the batch array", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		await unifi.radius.users.create({ name: "device-auth-2", x_password: "doc-radius-pass-2" });
		const post = fetch.calls.find((call) => call.method === "POST" && call.pathname.endsWith("batch_add"));
		expect(JSON.parse(post.body)).toHaveLength(1);
		await unifi.slothlet.shutdown();
	});

	test("update PUTs the row id path with the batch array", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		await unifi.radius.users.update("r1a2b3c4d5e6f7a8b9c0d1e2", [
			{
				_id: "r1a2b3c4d5e6f7a8b9c0d1e2",
				name: "device-auth-1",
				x_password: "doc-radius-pass-1",
				tunnel_type: 13,
				tunnel_medium_type: 6,
				vlan: 30
			}
		]);
		const put = fetch.calls.find((call) => call.method === "PUT" && call.pathname.includes("radius"));
		expect(put.pathname).toBe("/proxy/network/v2/api/site/default/radius/users/batch_update");
		await unifi.slothlet.shutdown();
	});

	test("delete sends DELETE to the row id", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		await unifi.radius.users.delete("r1a2b3c4d5e6f7a8b9c0d1e2");
		const del = fetch.calls.find((call) => call.method === "DELETE" && call.pathname.includes("radius"));
		expect(del.pathname).toBe("/proxy/network/v2/api/site/default/radius/users/r1a2b3c4d5e6f7a8b9c0d1e2");
		await unifi.slothlet.shutdown();
	});

	test("official-only: capability error (the Integration API carries profiles, not users)", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await expect(unifi.radius.users.list()).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE", capability: "radius.users" });
		await expect(unifi.radius.users.create([])).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
		await unifi.slothlet.shutdown();
	});
});
