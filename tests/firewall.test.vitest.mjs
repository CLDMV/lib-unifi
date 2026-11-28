/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/firewall.test.vitest.mjs
 *	@Date: 2026-11-28T04:51:20-08:00 (1795870280)
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
import { officialRoutes, mockFetch, CONTROLLER, POLICY_ID, ZONE_ID, ACL_ID, MATCHING_ID } from "./helpers/routes.mjs";

const API_KEY = { apiKey: "doc-api-key" };
const SITE = "d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c";

/** Composes an official-path instance and returns { unifi, fetch }. */
async function official() {
	const fetch = mockFetch(officialRoutes());
	const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
	return { unifi, fetch };
}

describe("firewall.policies", () => {
	test("list and get answer the Integration API rows", async () => {
		const { unifi, fetch } = await official();
		const policies = await unifi.firewall.policies.list();
		expect(policies).toHaveLength(1);
		expect(policies[0]).toMatchObject({ id: POLICY_ID, name: "Allow IoT to NTP" });
		const policy = await unifi.firewall.policies.get(POLICY_ID);
		expect(policy.action).toMatchObject({ type: "ALLOW" });
		expect(fetch.calls.filter((call) => call.pathname.endsWith("/firewall/policies"))).toHaveLength(1);
		await unifi.slothlet.shutdown();
	});

	test("create, patch, update and delete send the documented verbs", async () => {
		const { unifi, fetch } = await official();
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		await unifi.firewall.policies.create({ name: "New policy", action: { type: "BLOCK" }, enabled: true });
		await unifi.firewall.policies.patch(POLICY_ID, { loggingEnabled: true });
		await unifi.firewall.policies.update(POLICY_ID, { name: "New policy", action: { type: "BLOCK" }, enabled: false });
		await unifi.firewall.policies.delete(POLICY_ID);
		const newCalls = fetch.calls.slice(callsBefore);
		expect(newCalls.map((call) => `${call.method} ${call.pathname.replace(`${SITE}/`, "")}`)).toEqual([
			"POST /proxy/network/integration/v1/sites/firewall/policies",
			`PATCH /proxy/network/integration/v1/sites/firewall/policies/${POLICY_ID}`,
			`PUT /proxy/network/integration/v1/sites/firewall/policies/${POLICY_ID}`,
			`DELETE /proxy/network/integration/v1/sites/firewall/policies/${POLICY_ID}`
		]);
		expect(JSON.parse(newCalls[1].body)).toEqual({ loggingEnabled: true });
		await unifi.slothlet.shutdown();
	});

	test("ordering reads and writes", async () => {
		const { unifi, fetch } = await official();
		const ordering = await unifi.firewall.policies.ordering.get();
		expect(ordering).toMatchObject({ orderedFirewallPolicyIds: { afterSystemDefined: [POLICY_ID] } });
		await unifi.firewall.policies.ordering.set({ orderedFirewallPolicyIds: { beforeSystemDefined: [], afterSystemDefined: [POLICY_ID] } });
		const put = fetch.calls.find((call) => call.method === "PUT" && call.pathname.endsWith("/firewall/policies/ordering"));
		expect(put).toBeTruthy();
		await unifi.slothlet.shutdown();
	});
});

describe("firewall.zones", () => {
	test("list and get answer the zone rows", async () => {
		const { unifi } = await official();
		const zones = await unifi.firewall.zones.list();
		expect(zones).toHaveLength(2);
		expect(zones[0]).toMatchObject({ id: ZONE_ID, name: "Internal" });
		await unifi.slothlet.shutdown();
	});

	test("create, update and delete send exactly one write each", async () => {
		const { unifi, fetch } = await official();
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		await unifi.firewall.zones.create({ name: "Lab zone", networkIds: [] });
		await unifi.firewall.zones.update(ZONE_ID, { name: "Internal", networkIds: ["11111111-2222-4333-8444-555555555555"] });
		await unifi.firewall.zones.delete(ZONE_ID);
		const newCalls = fetch.calls.slice(callsBefore);
		expect(newCalls.map((call) => call.method)).toEqual(["POST", "PUT", "DELETE"]);
		await unifi.slothlet.shutdown();
	});
});

describe("firewall.acl", () => {
	test("list, get and ordering answer the ACL rows", async () => {
		const { unifi } = await official();
		const rules = await unifi.firewall.acl.list();
		expect(rules).toHaveLength(1);
		expect(rules[0]).toMatchObject({ id: ACL_ID, action: "BLOCK" });
		expect((await unifi.firewall.acl.get(ACL_ID)).name).toBe("Block printer internet");
		expect(await unifi.firewall.acl.ordering.get()).toMatchObject({ orderedAclRuleIds: [ACL_ID] });
		await unifi.slothlet.shutdown();
	});

	test("create, update, delete and ordering.set", async () => {
		const { unifi, fetch } = await official();
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		await unifi.firewall.acl.create({ name: "New rule", type: "IP", action: "ALLOW", enabled: true });
		await unifi.firewall.acl.update(ACL_ID, { name: "Block printer internet", type: "IP", action: "BLOCK", enabled: false });
		await unifi.firewall.acl.delete(ACL_ID);
		await unifi.firewall.acl.ordering.set({ orderedAclRuleIds: [] });
		const newCalls = fetch.calls.slice(callsBefore);
		expect(newCalls.map((call) => call.method)).toEqual(["POST", "PUT", "DELETE", "PUT"]);
		await unifi.slothlet.shutdown();
	});
});

describe("firewall.matching (traffic matching lists)", () => {
	test("list and get answer the TML rows", async () => {
		const { unifi } = await official();
		const lists = await unifi.firewall.matching.list();
		expect(lists).toHaveLength(1);
		expect(lists[0]).toMatchObject({ id: MATCHING_ID, name: "NTP servers", type: "IPV4" });
		await unifi.slothlet.shutdown();
	});

	test("create, update and delete", async () => {
		const { unifi, fetch } = await official();
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		await unifi.firewall.matching.create({ name: "New list", type: "IPV4" });
		await unifi.firewall.matching.update(MATCHING_ID, { name: "NTP servers", type: "IPV4", subnets: ["192.0.2.53/32"] });
		await unifi.firewall.matching.delete(MATCHING_ID);
		const newCalls = fetch.calls.slice(callsBefore);
		expect(newCalls.map((call) => call.method)).toEqual(["POST", "PUT", "DELETE"]);
		await unifi.slothlet.shutdown();
	});
});
