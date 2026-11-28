/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /tests/networks.test.vitest.mjs
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
import { officialRoutes, legacyRoutes, mockFetch, CONTROLLER, OFFICIAL_ROOT, SITE_ID } from "./helpers/routes.mjs";

describe("networks.list", () => {
	test("official path: the overview plus each network's details, normalized", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		const networks = await unifi.networks.list();
		expect(networks).toEqual([
			{
				id: "11111111-2222-4333-8444-555555555555",
				name: "Default",
				vlan: 1,
				cidr: "192.0.2.1/24",
				gateway: "192.0.2.1",
				dhcp: { range: null, leaseSec: 86400 },
				dns: { servers: [], domain: "homelab.cldmv.net" },
				kind: "gateway"
			},
			{
				id: "66666666-7777-4888-8999-000000000000",
				name: "IoT",
				vlan: 20,
				cidr: "198.51.100.1/24",
				gateway: "198.51.100.1",
				dhcp: { range: null, leaseSec: 3600 },
				dns: { servers: ["192.0.2.53", "192.0.2.54"], domain: "iot.cldmv.net" },
				kind: "gateway"
			}
		]);
		await unifi.slothlet.shutdown();
	});

	test("legacy path: networkconf rows normalized, WAN dropped, servers only when dhcpd_dns_enabled", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const networks = await unifi.networks.list();
		expect(networks.map((network) => network.name)).toEqual(["Default", "IoT"]);
		expect(networks[0]).toMatchObject({
			id: "11111111222243338444555555555555",
			vlan: null, // vlan_enabled false: not a VLAN network
			cidr: "192.0.2.1/24",
			gateway: "192.0.2.1",
			dhcp: { range: ["192.0.2.100", "192.0.2.199"], leaseSec: 86400 },
			dns: { servers: ["192.0.2.166", "192.0.2.1"], domain: "homelab.cldmv.net" },
			kind: "corporate"
		});
		expect(networks[1].dns).toEqual({ servers: [], domain: "iot.cldmv.net" });
		expect(networks[1].vlan).toBe(20);
		await unifi.slothlet.shutdown();
	});

	test("neither path: CAPABILITY_UNAVAILABLE", async () => {
		const fetch = mockFetch([]);
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		await expect(unifi.networks.list()).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE", capability: "networks" });
		await unifi.slothlet.shutdown();
	});
});

describe("networks.update", () => {
	test("official dry run: the PUT body is the detail minus id/metadata with the DNS override replaced — and nothing is sent", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		const plan = await unifi.networks.update("11111111-2222-4333-8444-555555555555", { dns: ["192.0.2.166"] }, { dryRun: true });

		expect(plan.dryRun).toBe(true);
		expect(plan.capability).toBe("official");
		expect(plan.request.method).toBe("PUT");
		expect(plan.request.url).toBe(`${CONTROLLER}${OFFICIAL_ROOT}/sites/${SITE_ID}/networks/11111111-2222-4333-8444-555555555555`);
		expect(plan.request.body).toEqual({
			name: "Default",
			vlanId: 1,
			enabled: true,
			management: "GATEWAY",
			dhcpGuarding: false,
			ipv4Configuration: {
				hostIpAddress: "192.0.2.1",
				prefixLength: 24,
				autoScaleEnabled: false,
				dhcpConfiguration: {
					mode: "SERVER",
					domainName: "homelab.cldmv.net",
					leaseTimeSeconds: 86400,
					dhcpEnabled: true,
					dnsServerIpAddressesOverride: ["192.0.2.166"]
				}
			}
		});
		// A dry run answers the request without sending it.
		expect(fetch.calls.filter((call) => call.method === "PUT")).toHaveLength(0);
		await unifi.slothlet.shutdown();
	});

	test("official write: PUTs and reports the changed settings", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		const result = await unifi.networks.update("11111111-2222-4333-8444-555555555555", {
			dns: ["192.0.2.166"],
			domain: "Homelab.CLDmv.net."
		});
		expect(result).toMatchObject({
			ok: true,
			capability: "official",
			id: "11111111-2222-4333-8444-555555555555",
			changed: { dns: ["192.0.2.166"], domain: "Homelab.CLDmv.net." }
		});
		const put = fetch.calls.find((call) => call.method === "PUT");
		expect(put).toBeTruthy();
		const body = JSON.parse(put.body);
		expect(body.ipv4Configuration.dhcpConfiguration.dnsServerIpAddressesOverride).toEqual(["192.0.2.166"]);
		// The controller's own normalization: trimmed, trailing dot stripped, lowercased.
		expect(body.ipv4Configuration.dhcpConfiguration.domainName).toBe("homelab.cldmv.net");
		// Identity and metadata never ride the write body.
		expect(body.id).toBeUndefined();
		expect(body.metadata).toBeUndefined();
		await unifi.slothlet.shutdown();
	});

	test("legacy dry run: the partial networkconf body, with credentials out of the answer", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const plan = await unifi.networks.update(
			"11111111222243338444555555555555",
			{ dns: ["192.0.2.166"], domain: "homelab.cldmv.net" },
			{ dryRun: true }
		);
		expect(plan.dryRun).toBe(true);
		expect(plan.capability).toBe("legacy");
		expect(plan.request.method).toBe("PUT");
		expect(plan.request.url).toBe(`${CONTROLLER}/proxy/network/api/s/default/rest/networkconf/11111111222243338444555555555555`);
		expect(plan.request.body).toEqual({
			dhcpd_dns_enabled: true,
			dhcpd_dns_1: "192.0.2.166",
			dhcpd_dns_2: "",
			dhcpd_dns_3: "",
			dhcpd_dns_4: "",
			domain_name: "homelab.cldmv.net"
		});
		expect(JSON.stringify(plan)).not.toContain("doc-password");
		expect(JSON.stringify(plan)).not.toContain("Cookie");
		await unifi.slothlet.shutdown();
	});

	test("legacy write: an empty dns list disables the custom servers", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { legacy: { username: "digby", password: "doc-password" } }
		});
		const result = await unifi.networks.update("11111111222243338444555555555555", { dns: [] });
		expect(result.ok).toBe(true);
		const put = fetch.calls.find((call) => call.method === "PUT");
		expect(JSON.parse(put.body)).toEqual({ dhcpd_dns_enabled: false, dhcpd_dns_1: "", dhcpd_dns_2: "", dhcpd_dns_3: "", dhcpd_dns_4: "" });
		await unifi.slothlet.shutdown();
	});

	test("validation: a bad dns entry or domain is a ValidationError", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { apiKey: "doc-api-key" } });
		await expect(unifi.networks.update("11111111-2222-4333-8444-555555555555", { dns: ["not-an-ip"] })).rejects.toMatchObject({
			code: "VALIDATION_DNS_SERVER"
		});
		await expect(unifi.networks.update("11111111-2222-4333-8444-555555555555", { domain: "" })).rejects.toMatchObject({
			code: "VALIDATION_DOMAIN"
		});
		await expect(unifi.networks.update("", { dns: [] })).rejects.toSatisfy((err) => isUnifiError(err, "VALIDATION_ID_REQUIRED"));
		await unifi.slothlet.shutdown();
	});
});
