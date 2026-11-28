/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/dryrun.test.vitest.mjs
 *	@Date: 2026-11-28T04:53:10-08:00 (1795870390)
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
import {
	officialRoutes,
	legacyRoutes,
	mockFetch,
	CONTROLLER,
	DEVICE_ID,
	WLAN_ID,
	POLICY_ID,
	ZONE_ID,
	ACL_ID,
	MATCHING_ID,
	VOUCHER_ID,
	SITE_ID
} from "./helpers/routes.mjs";

/**
 * @fileoverview The dry-run sweep (plan §6.2: EVERY write takes `{ dryRun: true }`
 * and sends nothing). One case per write leaf, on the path the leaf writes on —
 * official, legacy, or the official path of a dual-path write. Each case:
 * compose a fresh instance, call the write with `{ dryRun: true }`, then assert
 * that every request the library sent was a GET or a login POST, that the
 * answer is the documented dry-run envelope, and that it carries no credential
 * value and no session header.
 */

const SITE = `sites/${SITE_ID}`;

/** [leaf, call, writePathShape] — call is () => unifi.<leaf>(...args, { dryRun: true }). */
const OFFICIAL_WRITES = [
	["networks.create", (u, o) => u.networks.create({ name: "New net", management: "GATEWAY", vlanId: 30 }, o)],
	["networks.delete", (u, o) => u.networks.delete("66666666-7777-4888-8999-000000000000", o)],
	["networks.update", (u, o) => u.networks.update("11111111-2222-4333-8444-555555555555", { dns: ["192.0.2.53"] }, o)],
	["wlans.create", (u, o) => u.wlans.create({ name: "Guest", type: "STANDARD" }, o)],
	["wlans.update", (u, o) => u.wlans.update(WLAN_ID, { name: "Homelab", type: "STANDARD" }, o)],
	["wlans.delete", (u, o) => u.wlans.delete(WLAN_ID, o)],
	["clients.guest.authorize", (u, o) => u.clients.guest.authorize("a1b2c3d4-1111-4222-8333-444455556666", { timeLimitMinutes: 60 }, o)],
	["clients.guest.unauthorize", (u, o) => u.clients.guest.unauthorize("a1b2c3d4-1111-4222-8333-444455556666", o)],
	["devices.adopt", (u, o) => u.devices.adopt({ macAddress: "00:00:5e:00:53:aa", ignoreDeviceLimit: false }, o)],
	["devices.forget", (u, o) => u.devices.forget(DEVICE_ID, o)],
	["devices.action", (u, o) => u.devices.action(DEVICE_ID, { action: "RESTART" }, o)],
	["devices.port.action", (u, o) => u.devices.port.action(DEVICE_ID, 1, { action: "POWER_CYCLE" }, o)],
	["firewall.policies.create", (u, o) => u.firewall.policies.create({ name: "New policy", action: { type: "ALLOW" } }, o)],
	["firewall.policies.update", (u, o) => u.firewall.policies.update(POLICY_ID, { name: "Allow IoT to NTP", action: { type: "ALLOW" } }, o)],
	["firewall.policies.patch", (u, o) => u.firewall.policies.patch(POLICY_ID, { loggingEnabled: true }, o)],
	["firewall.policies.delete", (u, o) => u.firewall.policies.delete(POLICY_ID, o)],
	[
		"firewall.policies.ordering.set",
		(u, o) => u.firewall.policies.ordering.set({ orderedFirewallPolicyIds: { beforeSystemDefined: [], afterSystemDefined: [] } }, o)
	],
	["firewall.zones.create", (u, o) => u.firewall.zones.create({ name: "Lab zone", networkIds: [] }, o)],
	["firewall.zones.update", (u, o) => u.firewall.zones.update(ZONE_ID, { name: "Internal", networkIds: [] }, o)],
	["firewall.zones.delete", (u, o) => u.firewall.zones.delete(ZONE_ID, o)],
	["firewall.acl.create", (u, o) => u.firewall.acl.create({ name: "New rule", type: "IP", action: "ALLOW" }, o)],
	["firewall.acl.update", (u, o) => u.firewall.acl.update(ACL_ID, { name: "Block printer internet", type: "IP", action: "BLOCK" }, o)],
	["firewall.acl.delete", (u, o) => u.firewall.acl.delete(ACL_ID, o)],
	["firewall.acl.ordering.set", (u, o) => u.firewall.acl.ordering.set({ orderedAclRuleIds: [] }, o)],
	["firewall.matching.create", (u, o) => u.firewall.matching.create({ name: "New list", type: "IPV4" }, o)],
	["firewall.matching.update", (u, o) => u.firewall.matching.update(MATCHING_ID, { name: "NTP servers", type: "IPV4" }, o)],
	["firewall.matching.delete", (u, o) => u.firewall.matching.delete(MATCHING_ID, o)],
	[
		"dns.records.create",
		(u, o) => u.dns.records.create({ type: "A_RECORD", enabled: true, domain: "printer.example.com", ipv4Address: "192.0.2.50" }, o)
	],
	[
		"dns.records.update",
		(u, o) =>
			u.dns.records.update(
				"a1b2c3d4-0000-4000-8000-0000000000aa",
				{ type: "A_RECORD", enabled: true, domain: "printer.example.com", ipv4Address: "192.0.2.50" },
				o
			)
	],
	["dns.records.delete", (u, o) => u.dns.records.delete("a1b2c3d4-0000-4000-8000-0000000000aa", o)],
	["dns.forward.set", (u, o) => u.dns.forward.set({ domain: "printer.example.com", target: "192.0.2.53" }, o)],
	["dns.forward.set (PUT branch)", (u, o) => u.dns.forward.set({ domain: "homelab.example.com", target: "192.0.2.54" }, o)],
	["hotspot.vouchers.create", (u, o) => u.hotspot.vouchers.create({ name: "guest", count: 1 }, o)],
	["hotspot.vouchers.delete (one)", (u, o) => u.hotspot.vouchers.delete(VOUCHER_ID, o)],
	["hotspot.vouchers.delete (all)", (u, o) => u.hotspot.vouchers.delete(o)]
];

/** The legacy writes (each dual-path write also has an official dry-run case above). */
const LEGACY_WRITES = [
	["clients.fixed.ip.set", (u, o) => u.clients.fixed.ip.set("00:00:5e:00:53:01", "192.0.2.10", o)],
	["radius.users.create", (u, o) => u.radius.users.create([{ name: "device-auth-2", x_password: "doc-radius-pass-2" }], o)],
	[
		"radius.users.update",
		(u, o) => u.radius.users.update("r1a2b3c4d5e6f7a8b9c0d1e2", [{ _id: "r1a2b3c4d5e6f7a8b9c0d1e2", name: "device-auth-1" }], o)
	],
	["radius.users.delete", (u, o) => u.radius.users.delete("r1a2b3c4d5e6f7a8b9c0d1e2", o)],
	["dns.forward.set (legacy)", (u, o) => u.dns.forward.set({ domain: "printer.example.com", target: "192.0.2.53" }, o)]
];

describe("every write leaf: dryRun sends nothing", () => {
	test.each(OFFICIAL_WRITES.map(([name, call]) => [name, call]))(
		"official %s: the answer is the dry-run envelope and only GETs were sent",
		async (_name, call) => {
			const fetch = mockFetch(officialRoutes());
			const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
			const plan = await call(unifi, { dryRun: true });
			expect(plan.dryRun).toBe(true);
			expect(plan.capability).toBe("official");
			expect(plan.request).toMatchObject({ method: expect.any(String), url: expect.stringContaining(SITE) });
			// Every request was a read (or the login a legacy probe needs — none
			// here): no POST/PUT/PATCH/DELETE at all.
			for (const sent of fetch.calls) {
				expect(sent.method, sent.url).toBe("GET");
			}
			// No credential value and no session header in the answer.
			const rendered = JSON.stringify(plan);
			expect(rendered).not.toContain("doc-api-key");
			expect(rendered).not.toContain("Cookie");
			expect(rendered).not.toContain("X-API-KEY");
			await unifi.slothlet.shutdown();
		}
	);

	test.each(LEGACY_WRITES.map(([name, call]) => [name, call]))(
		"legacy %s: the answer is the dry-run envelope and only GETs plus the login were sent",
		async (_name, call) => {
			const fetch = mockFetch(legacyRoutes());
			const unifi = await createUnifi({
				baseUrl: CONTROLLER,
				fetch,
				credentials: { legacy: { username: "digby", password: "doc-password" } }
			});
			const plan = await call(unifi, { dryRun: true });
			expect(plan.dryRun).toBe(true);
			expect(plan.capability).toBe("legacy");
			expect(plan.request).toMatchObject({ method: expect.any(String), url: expect.stringContaining("/proxy/network/") });
			for (const sent of fetch.calls) {
				const isLogin = sent.method === "POST" && (sent.pathname === "/api/auth/login" || sent.pathname === "/api/login");
				expect(sent.method === "GET" || isLogin, sent.url).toBe(true);
			}
			const rendered = JSON.stringify(plan);
			expect(rendered).not.toContain("doc-password");
			expect(rendered).not.toContain("Cookie");
			await unifi.slothlet.shutdown();
		}
	);
});
