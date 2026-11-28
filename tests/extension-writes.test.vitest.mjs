/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/extension-writes.test.vitest.mjs
 *	@Date: 2026-11-28T06:10:05-08:00 (1795875005)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T06:10:34-08:00 (1795875034)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, expect, test } from "vitest";
import { createUnifi } from "@cldmv/lib-unifi";
import {
	officialRoutes,
	legacyRoutes,
	mockFetch,
	CONTROLLER,
	DEVICE_ID,
	CLIENT_DETAIL_ID,
	WLAN_ID,
	ZONE_ID,
	ACL_ID,
	MATCHING_ID,
	POLICY_ID,
	VOUCHER_ID,
	LAG_ID,
	STACK_ID,
	MCLAG_ID
} from "./helpers/routes.mjs";

const API_KEY = { apiKey: "doc-api-key" };
const LEGACY_CREDS = { legacy: { username: "digby", password: "doc-password" } };

describe("the extension leaves: validation errors before anything is sent", () => {
	test("guest authorize/unauthorize refuse a bad id or request", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await expect(unifi.clients.guest.authorize("", {})).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.clients.guest.authorize(CLIENT_DETAIL_ID, "nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.clients.guest.unauthorize("")).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		expect(fetch.calls.every((call) => call.method === "GET")).toBe(true);
		await unifi.slothlet.shutdown();
	});

	test("device writes refuse a missing id or a bad body", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await expect(unifi.devices.adopt("nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.devices.forget("")).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.devices.action("", { action: "RESTART" })).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.devices.port.action(DEVICE_ID, "port-one", { action: "POWER_CYCLE" })).rejects.toMatchObject({
			code: "VALIDATION_ID_REQUIRED"
		});
		await expect(unifi.devices.port.action(DEVICE_ID, 1, { action: "REBOOT" })).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		expect(fetch.calls.every((call) => call.method === "GET")).toBe(true);
		await unifi.slothlet.shutdown();
	});

	test("dns record writes refuse a missing id or a bad body", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await expect(unifi.dns.records.create("nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.dns.records.update("", { type: "A_RECORD" })).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.dns.records.delete("")).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		expect(fetch.calls.every((call) => call.method === "GET")).toBe(true);
		await unifi.slothlet.shutdown();
	});

	test("firewall and wlan writes refuse a missing id or a bad body", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await expect(unifi.firewall.policies.create("nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.firewall.policies.update("", {})).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.firewall.policies.patch("", {})).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.firewall.policies.delete("")).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.firewall.zones.create("nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.firewall.acl.create("nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.firewall.matching.update("", {})).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.wlans.create("nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.wlans.update("", {})).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.wlans.delete("")).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		expect(fetch.calls.every((call) => call.method === "GET")).toBe(true);
		await unifi.slothlet.shutdown();
	});

	test("clients.get and devices.statistics.latest refuse a missing id", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await expect(unifi.clients.get("")).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.devices.statistics.latest("")).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		expect(fetch.calls).toHaveLength(0);
		await unifi.slothlet.shutdown();
	});
});

describe("the extension leaves: the real sends", () => {
	test("guest authorize sends the action body; unauthorize the bare discriminator", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await unifi.clients.guest.authorize(CLIENT_DETAIL_ID, { timeLimitMinutes: 60 });
		await unifi.clients.guest.unauthorize(CLIENT_DETAIL_ID);
		const posts = fetch.calls.filter((call) => call.method === "POST");
		expect(posts.map((call) => JSON.parse(call.body).action)).toEqual(["AUTHORIZE_GUEST_ACCESS", "UNAUTHORIZE_GUEST_ACCESS"]);
		expect(JSON.parse(posts[0].body)).toMatchObject({ timeLimitMinutes: 60 });
		await unifi.slothlet.shutdown();
	});

	test("clients.get answers the official client detail", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		const client = await unifi.clients.get(CLIENT_DETAIL_ID);
		expect(client).toMatchObject({ name: "printer", type: "WIRED" });
		await unifi.slothlet.shutdown();
	});

	test("adopt, forget, restart and power-cycle send once each", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		await unifi.devices.adopt({ macAddress: "00:00:5e:00:53:aa", ignoreDeviceLimit: true });
		await unifi.devices.forget(DEVICE_ID);
		await unifi.devices.action(DEVICE_ID);
		await unifi.devices.port.action(DEVICE_ID, 1);
		const newCalls = fetch.calls.slice(callsBefore);
		expect(newCalls.map((call) => call.method)).toEqual(["POST", "DELETE", "POST", "POST"]);
		expect(JSON.parse(newCalls[0].body)).toEqual({ macAddress: "00:00:5e:00:53:aa", ignoreDeviceLimit: true });
		await unifi.slothlet.shutdown();
	});

	test("wlans create/update/delete send once each", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		await unifi.wlans.create({ name: "Guest", type: "STANDARD" });
		await unifi.wlans.update(WLAN_ID, { name: "Homelab", type: "STANDARD" });
		await unifi.wlans.delete(WLAN_ID);
		expect(fetch.calls.slice(callsBefore).map((call) => call.method)).toEqual(["POST", "PUT", "DELETE"]);
		await unifi.slothlet.shutdown();
	});

	test("dns record writes send once each", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		await unifi.dns.records.create({ type: "CNAME_RECORD", enabled: true, domain: "www.example.com", targetDomain: "example.com" });
		await unifi.dns.records.update("p1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c", {
			type: "A_RECORD",
			enabled: true,
			domain: "printer.iot.example.com",
			ipv4Address: "192.0.2.51"
		});
		await unifi.dns.records.delete("p1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c");
		expect(fetch.calls.slice(callsBefore).map((call) => call.method)).toEqual(["POST", "PUT", "DELETE"]);
		await unifi.slothlet.shutdown();
	});

	test("firewall policies create/patch/update/delete send once each", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		await unifi.firewall.policies.create({ name: "New policy", action: { type: "BLOCK" } });
		await unifi.firewall.policies.patch("f5e6f7a8-b9c0-4d1e-2f3a-5e6f7a8b9c0d", { loggingEnabled: true });
		await unifi.firewall.policies.update("f5e6f7a8-b9c0-4d1e-2f3a-5e6f7a8b9c0d", { name: "New policy", action: { type: "BLOCK" } });
		await unifi.firewall.policies.delete("f5e6f7a8-b9c0-4d1e-2f3a-5e6f7a8b9c0d");
		expect(fetch.calls.slice(callsBefore).map((call) => call.method)).toEqual(["POST", "PATCH", "PUT", "DELETE"]);
		await unifi.slothlet.shutdown();
	});

	test("vouchers create and delete send once each", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		await unifi.hotspot.vouchers.create({ name: "guest", count: 1 });
		await unifi.hotspot.vouchers.delete("a2b3c4d5-e6f7-4a8b-9c0d-2e3f4a5b6c7d");
		expect(fetch.calls.slice(callsBefore).map((call) => call.method)).toEqual(["POST", "DELETE"]);
		await unifi.slothlet.shutdown();
	});

	test("radius users create wraps and deletes by id", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		await unifi.radius.users.create({ name: "device-auth-2", x_password: "doc-radius-pass-2" });
		await unifi.radius.users.delete("r1a2b3c4d5e6f7a8b9c0d1e2");
		const newCalls = fetch.calls.slice(callsBefore);
		expect(newCalls.map((call) => `${call.method} ${call.pathname}`)).toEqual([
			"POST /proxy/network/v2/api/site/default/radius/users/batch_add",
			"DELETE /proxy/network/v2/api/site/default/radius/users/r1a2b3c4d5e6f7a8b9c0d1e2"
		]);
		expect(JSON.parse(newCalls[0].body)).toHaveLength(1);
		await unifi.slothlet.shutdown();
	});
});

describe("the single-resource reads and their validation", () => {
	test("the GET singles answer their row", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		expect((await unifi.firewall.zones.get(ZONE_ID)).name).toBe("Internal");
		expect((await unifi.firewall.acl.get(ACL_ID)).action).toBe("BLOCK");
		expect((await unifi.firewall.matching.get(MATCHING_ID)).name).toBe("NTP servers");
		expect((await unifi.firewall.policies.get(POLICY_ID)).name).toBe("Allow IoT to NTP");
		expect((await unifi.wlans.get(WLAN_ID)).name).toBe("Homelab");
		expect((await unifi.hotspot.vouchers.get(VOUCHER_ID)).code).toBe(4861409510);
		expect((await unifi.switching.lags.get(LAG_ID)).members[0].portIdxs).toEqual([23, 24]);
		expect((await unifi.switching.stacks.get(STACK_ID)).units[0].role).toBe("MASTER");
		expect((await unifi.switching.mclag.get(MCLAG_ID)).peers[0].role).toBe("PRIMARY");
		expect((await unifi.dns.records.get("p1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c")).type).toBe("A_RECORD");
		await unifi.slothlet.shutdown();
	});

	test("the write singles refuse a valid id with a bad body, and a missing id", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await expect(unifi.firewall.policies.update(POLICY_ID, "nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.firewall.policies.patch(POLICY_ID, "nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.firewall.zones.update(ZONE_ID, "nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.firewall.zones.delete("")).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.firewall.acl.update(ACL_ID, "nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.firewall.acl.delete("")).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.firewall.acl.ordering.set("nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.firewall.matching.create("nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.firewall.matching.update(MATCHING_ID, "nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.firewall.matching.delete("")).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.firewall.policies.ordering.set("nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		await expect(unifi.dns.records.get("")).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.dns.records.update("p1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c", "nope")).rejects.toMatchObject({
			code: "VALIDATION_BODY"
		});
		expect(fetch.calls.every((call) => call.method === "GET")).toBe(true);
		await unifi.slothlet.shutdown();
	});

	test("the legacy radius update refuses a missing id and a bad body", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		await expect(unifi.radius.users.update("", [])).rejects.toMatchObject({ code: "VALIDATION_ID_REQUIRED" });
		await expect(unifi.radius.users.update("r1a2b3c4d5e6f7a8b9c0d1e2", "nope")).rejects.toMatchObject({ code: "VALIDATION_BODY" });
		expect(fetch.calls.every((call) => call.method === "GET" || call.pathname === "/api/auth/login")).toBe(true);
		await unifi.slothlet.shutdown();
	});
});
