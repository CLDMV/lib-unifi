/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/devices.test.vitest.mjs
 *	@Date: 2026-11-28T04:51:05-08:00 (1795870265)
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
import { officialRoutes, legacyRoutes, mockFetch, CONTROLLER, DEVICE_ID } from "./helpers/routes.mjs";

const API_KEY = { apiKey: "doc-api-key" };
const LEGACY_CREDS = { legacy: { username: "digby", password: "doc-password" } };

describe("devices.list / devices.get (dual path)", () => {
	test("official: the adopted-device overview rows", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		const devices = await unifi.devices.list();
		expect(devices).toHaveLength(3);
		expect(devices[0]).toMatchObject({ id: DEVICE_ID, macAddress: "00:00:5e:00:53:0a", model: "U7-Pro", state: "ONLINE" });
		await unifi.slothlet.shutdown();
	});

	test("legacy: the stat/device inventory rows", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const devices = await unifi.devices.list();
		expect(devices).toHaveLength(2);
		expect(devices[0]).toMatchObject({ _id: "b1a2b3c4d5e6f7a8b9c0d1e2", mac: "00:00:5e:00:53:0a", type: "uap" });
		await unifi.slothlet.shutdown();
	});

	test("official: the adopted-device detail (ports, radios, uplink)", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		const device = await unifi.devices.get(DEVICE_ID);
		expect(device.model).toBe("U7-Pro");
		expect(device.interfaces.ports[0].poe.standard).toBe("802.3at");
		expect(device.uplink.deviceId).toBe("d3c4d5e6-f7a8-4b9c-0d1e-3c4d5e6f7a8b");
		const detail = fetch.calls.find((call) => call.pathname.endsWith(`/devices/${DEVICE_ID}`));
		expect(detail).toBeTruthy();
		await unifi.slothlet.shutdown();
	});

	test("legacy: the stat/device/{id} detail row", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const device = await unifi.devices.get("b1a2b3c4d5e6f7a8b9c0d1e2");
		expect(device.port_table[0].port_idx).toBe(1);
		const detail = fetch.calls.find((call) => call.pathname.endsWith("/stat/device/b1a2b3c4d5e6f7a8b9c0d1e2"));
		expect(detail).toBeTruthy();
		await unifi.slothlet.shutdown();
	});

	test("a missing id is a validation error before anything is sent", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await expect(unifi.devices.get("")).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		expect(fetch.calls).toHaveLength(0);
		await unifi.slothlet.shutdown();
	});
});

describe("devices statistics", () => {
	test("official: the per-device latest snapshot", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		const stats = await unifi.devices.statistics.latest(DEVICE_ID);
		expect(stats).toMatchObject({ cpuUtilizationPct: 8.5, uptimeSec: 864000 });
		await unifi.slothlet.shutdown();
	});

	test("legacy: the stat/device stat rows", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const stats = await unifi.devices.statistics.list();
		expect(stats).toHaveLength(2);
		expect(stats[0]).toMatchObject({ cpu: 8.5, mem: 42.1 });
		await unifi.slothlet.shutdown();
	});

	test("official-only: statistics.latest refuses on a legacy-only controller", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		await expect(unifi.devices.statistics.latest(DEVICE_ID)).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
		await unifi.slothlet.shutdown();
	});
});

describe("devices reads and actions (official-only)", () => {
	test("pending devices and device tags read through", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		const pending = await unifi.devices.pending.list();
		expect(pending[0]).toMatchObject({ model: "U7-Pro", state: "PENDING_ADOPTION" });
		const tags = await unifi.devices.tags.list();
		expect(tags[0]).toMatchObject({ name: "always-on", deviceIds: [DEVICE_ID] });
		await unifi.slothlet.shutdown();
	});

	test("adopt, restart and power-cycle send exactly the documented request", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;

		await unifi.devices.adopt({ macAddress: "00:00:5e:00:53:aa", ignoreDeviceLimit: false });
		await unifi.devices.forget(DEVICE_ID);
		await unifi.devices.action(DEVICE_ID);
		await unifi.devices.port.action(DEVICE_ID, 1);

		const newCalls = fetch.calls.slice(callsBefore);
		expect(newCalls.map((call) => `${call.method} ${call.pathname}`)).toEqual([
			`POST /proxy/network/integration/v1/sites/d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c/devices`,
			`DELETE /proxy/network/integration/v1/sites/d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c/devices/${DEVICE_ID}`,
			`POST /proxy/network/integration/v1/sites/d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c/devices/${DEVICE_ID}/actions`,
			`POST /proxy/network/integration/v1/sites/d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c/devices/${DEVICE_ID}/interfaces/ports/1/actions`
		]);
		expect(JSON.parse(newCalls[0].body)).toEqual({ macAddress: "00:00:5e:00:53:aa", ignoreDeviceLimit: false });
		expect(JSON.parse(newCalls[2].body)).toEqual({ action: "RESTART" });
		expect(JSON.parse(newCalls[3].body)).toEqual({ action: "POWER_CYCLE" });
		await unifi.slothlet.shutdown();
	});

	test("an unknown device action is refused before anything is sent", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		const callsBefore = fetch.calls.length;
		await expect(unifi.devices.action(DEVICE_ID, { action: "FACTORY_RESET" })).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		expect(fetch.calls.length).toBe(callsBefore);
		await unifi.slothlet.shutdown();
	});
});
