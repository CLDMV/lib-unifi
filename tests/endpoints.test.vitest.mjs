/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/endpoints.test.vitest.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
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
import { endpoints, resolveEndpoint } from "../src/lib/endpoints.mjs";
import { buildUrlWithParams, ensureHttpsUrl, joinSiteUrl, resolveUrl } from "../src/lib/url.mjs";
import { netmaskToPrefix, officialNetworkUpdateBody, legacyNetworkUpdateBody } from "../src/lib/normalize/network.mjs";
import { isIpv4, normalizeMac, resolveClientId } from "../src/lib/normalize/client.mjs";
import { isDomainName, isIpLiteral, officialPolicyFromRow, legacyStaticDnsFromRow } from "../src/lib/normalize/dns-record.mjs";
import { size } from "../src/lib/util.mjs";

describe("endpoint table", () => {
	test("substitutes {site} and {id} and leaves unknown slots in place", () => {
		expect(resolveEndpoint("network", "legacy", "client_update", { site: "default", id: "abc123" })).toBe("api/s/default/rest/user/abc123");
		expect(resolveEndpoint("network", "unifi_os_v2", "static_dns_list", { site: "default" })).toBe("v2/api/site/default/static-dns");
		expect(resolveEndpoint("network", "legacy", "device_detail", { site: "default" })).toBe("api/s/default/stat/device/{id}");
	});

	test("falls back across versions, then across types, and throws when nothing carries the key", () => {
		// unifi_os_v1 carries the pre-v2 static-DNS surface (the rest collection).
		expect(resolveEndpoint("network", "unifi_os_v1", "static_dns_list", { site: "default" })).toBe("api/s/default/rest/static-dns");
		// The fallback still applies: site_info is absent from unifi_os_v2 and found in unifi_os_v1.
		expect(resolveEndpoint("network", "unifi_os_v2", "site_info", { site: "default" })).toBe("api/s/default/stat/sysinfo");
		expect(() => resolveEndpoint("network", "legacy", "no_such_key", {})).toThrow(/no_such_key/);
	});

	test("the merged table keeps unifi-cli's legacy rows as written", () => {
		expect(endpoints.network.legacy).toMatchObject({
			sites_list: "api/stat/sites",
			device_list: "api/s/{site}/stat/device",
			client_list: "api/s/{site}/stat/sta",
			client_update: "api/s/{site}/rest/user/{id}",
			network_config: "api/s/{site}/rest/networkconf",
			port_config: "api/s/{site}/rest/portconf",
			radius_list: "api/s/{site}/rest/account",
			admin_list: "api/s/{site}/rest/admin"
		});
		// sysinfo belongs to the unifi_os_v1 table, not legacy (the plan's note).
		expect(endpoints.network.legacy).not.toHaveProperty("site_info");
		expect(endpoints.network.unifi_os_v1.site_info).toBe("api/s/{site}/stat/sysinfo");
	});

	test("the RADIUS and admin rows carry all three versions as written", () => {
		expect(endpoints.network.unifi_os_v2).toMatchObject({
			radius_list: "v2/api/site/{site}/radius/users",
			radius_add: "v2/api/site/{site}/radius/users/batch_add",
			radius_update: "v2/api/site/{site}/radius/users/batch_update",
			radius_delete: "v2/api/site/{site}/radius/users/{id}",
			admin_list: "v2/api/site/{site}/user",
			admin_detail: "v2/api/site/{site}/user/{id}"
		});
		expect(endpoints.network.unifi_os_v1).toMatchObject({
			radius_list: "api/s/{site}/rest/radiususer",
			radius_add: "api/s/{site}/rest/radiususer",
			radius_update: "api/s/{site}/rest/radiususer/{id}",
			radius_delete: "api/s/{site}/rest/radiususer/{id}"
		});
	});

	test("the util helpers port unifi-cli's size()", () => {
		expect(size("hello")).toBe(5);
		expect(size([1, 2, 3])).toBe(3);
		expect(size(new Map([["a", 1]]))).toBe(1);
		expect(size({ a: 1, b: 2 })).toBe(2);
	});
});

describe("url building", () => {
	const siteData = {
		host: "192.0.2.1",
		host_url: "https://192.0.2.1",
		site: "default",
		api: { prefix: "/proxy/network/", endpointType: "network", endpointVersion: "unifi_os_v2" }
	};

	test("resolves an endpoint key to the full URL", () => {
		expect(resolveUrl(siteData, "client_list", {})).toBe("https://192.0.2.1/proxy/network/api/s/default/stat/sta");
	});

	test("an absolute URL is returned as-is; a bare host gets https", () => {
		expect(resolveUrl(siteData, "https://other.example.test/api", {})).toBe("https://other.example.test/api");
		expect(ensureHttpsUrl("192.0.2.1")).toBe("https://192.0.2.1");
		expect(ensureHttpsUrl("http://192.0.2.1")).toBe("http://192.0.2.1");
	});

	test("joins the site base with a path, normalizing slashes", () => {
		expect(joinSiteUrl({ host_url: "https://192.0.2.1/", api: { prefix: "/proxy/network/" } }, "api/stat/sites")).toBe(
			"https://192.0.2.1/proxy/network/api/stat/sites"
		);
	});

	test("appends query params, encoded", () => {
		expect(buildUrlWithParams("https://192.0.2.1/api", { offset: 0, limit: 200, filter: "a b" })).toBe(
			"https://192.0.2.1/api?offset=0&limit=200&filter=a+b"
		);
		expect(buildUrlWithParams("https://192.0.2.1/api", {})).toBe("https://192.0.2.1/api");
	});
});

describe("normalizers", () => {
	test("netmaskToPrefix handles contiguous masks and rejects others", () => {
		expect(netmaskToPrefix("255.255.255.0")).toBe(24);
		expect(netmaskToPrefix("255.255.0.0")).toBe(16);
		expect(netmaskToPrefix("255.255.255.248")).toBe(29);
		expect(netmaskToPrefix("255.0.255.0")).toBe(null);
		expect(netmaskToPrefix("nonsense")).toBe(null);
	});

	test("normalizeMac canonicalizes separators and case", () => {
		expect(normalizeMac("AA-BB-CC-DD-EE-FF")).toBe("aa:bb:cc:dd:ee:ff");
		expect(normalizeMac("00:00:5E:00:53:01")).toBe("00:00:5e:00:53:01");
		expect(normalizeMac("nope")).toBe(null);
	});

	test("isIpv4 accepts only dotted-quads in range", () => {
		expect(isIpv4("192.0.2.1")).toBe(true);
		expect(isIpv4("999.0.0.1")).toBe(false);
		expect(isIpv4("::1")).toBe(false);
	});

	test("resolveClientId prefers the rest/user record, falls back to stat/sta", () => {
		const records = [{ _id: "rec", mac: "00:00:5e:00:53:01" }];
		const staRows = [{ _id: "sta", mac: "AA:BB:CC:DD:EE:FF" }];
		expect(resolveClientId(records, staRows, "AA-BB-CC-DD-EE-FF")).toBe("sta");
		expect(resolveClientId(records, staRows, "00:00:5e:00:53:01")).toBe("rec");
		expect(resolveClientId(records, staRows, "00:00:5e:00:53:ff")).toBe(null);
	});

	test("the official update body keeps everything but id/metadata and only replaces the DHCP DNS bits", () => {
		const detail = {
			id: "net1",
			name: "Default",
			vlanId: 1,
			metadata: { origin: "USER_DEFINED" },
			ipv4Configuration: {
				hostIpAddress: "192.0.2.1",
				prefixLength: 24,
				dhcpConfiguration: { mode: "SERVER", domainName: "old", dnsServerIpAddressesOverride: ["10.9.9.9"] }
			}
		};
		const body = officialNetworkUpdateBody(detail, { dns: ["192.0.2.166"], domain: "new" });
		expect(body.id).toBeUndefined();
		expect(body.metadata).toBeUndefined();
		expect(body.name).toBe("Default");
		expect(body.ipv4Configuration.dhcpConfiguration).toEqual({
			mode: "SERVER",
			domainName: "new",
			dnsServerIpAddressesOverride: ["192.0.2.166"]
		});
		// An empty server list clears the override.
		const cleared = officialNetworkUpdateBody(detail, { dns: null });
		expect(cleared.ipv4Configuration.dhcpConfiguration.dnsServerIpAddressesOverride).toEqual([]);
	});

	test("the legacy update body maps dns onto dhcpd_dns_1..4 and normalizes the domain", () => {
		expect(legacyNetworkUpdateBody({ dns: ["192.0.2.166", "192.0.2.1"], domain: "Homelab.Example.com." })).toEqual({
			dhcpd_dns_enabled: true,
			dhcpd_dns_1: "192.0.2.166",
			dhcpd_dns_2: "192.0.2.1",
			dhcpd_dns_3: "",
			dhcpd_dns_4: "",
			domain_name: "homelab.example.com"
		});
		expect(legacyNetworkUpdateBody({ dns: [] })).toEqual({
			dhcpd_dns_enabled: false,
			dhcpd_dns_1: "",
			dhcpd_dns_2: "",
			dhcpd_dns_3: "",
			dhcpd_dns_4: ""
		});
	});

	test("dns record normalizers map both surfaces onto one shape", () => {
		expect(
			officialPolicyFromRow({
				id: "p1",
				type: "MX_RECORD",
				enabled: true,
				domain: "example.com",
				mailServerDomain: "mail.example.com",
				priority: 10,
				metadata: { origin: "USER_DEFINED" }
			})
		).toEqual({
			id: "p1",
			type: "MX_RECORD",
			enabled: true,
			domain: "example.com",
			ttl: null,
			data: { mailServerDomain: "mail.example.com", priority: 10 },
			origin: "USER_DEFINED"
		});
		expect(legacyStaticDnsFromRow({ _id: "s1", enabled: true, key: "a.b.test", record_type: "A", value: "192.0.2.5" })).toMatchObject({
			id: "s1",
			type: "A",
			domain: "a.b.test",
			data: { value: "192.0.2.5" }
		});
	});

	test("domain and IP-literal validation", () => {
		expect(isDomainName("homelab.example.com")).toBe(true);
		expect(isDomainName("1.0.10.in-addr.arpa")).toBe(true);
		expect(isDomainName("https://homelab.example.com")).toBe(false);
		expect(isDomainName("no-slashes-or-spaces allowed")).toBe(false);
		expect(isIpLiteral("192.0.2.166")).toBe(true);
		expect(isIpLiteral("100.64.178.0")).toBe(true);
		expect(isIpLiteral("2001:db8::1")).toBe(true);
		expect(isIpLiteral("homelab.example.com")).toBe(false);
	});
});
