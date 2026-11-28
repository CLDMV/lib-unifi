/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/internals.test.vitest.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:44:13-08:00 (1795866253)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, expect, test } from "vitest";
import { normalizeConfig } from "../src/lib/config.mjs";
import { buildUrlWithParams, joinSiteUrl, resolveUrl } from "../src/lib/url.mjs";
import {
	isDomainName,
	isIpLiteral,
	legacyForwardBody,
	legacyStaticDnsFromRow,
	officialForwardPolicyBody,
	officialPolicyFromRow
} from "../src/lib/normalize/dns-record.mjs";
import {
	isIpv4,
	legacyClientFromStaRow,
	legacyClientRecordFromUserRow,
	normalizeMac,
	officialClientFromRow
} from "../src/lib/normalize/client.mjs";
import { legacyNetworkFromRow, netmaskToPrefix, officialNetworkFromDetail } from "../src/lib/normalize/network.mjs";
import {
	clearAllSites,
	clearSite,
	clearProbeCache,
	getProbeCache,
	getSite,
	recentErrors,
	recordError,
	setProbeCache,
	setSite
} from "../src/lib/session.mjs";

describe("config normalization", () => {
	const base = { baseUrl: "https://192.0.2.1", fetch: () => {} };

	test("schemeless baseUrls get https and trailing slashes are trimmed", () => {
		expect(normalizeConfig({ ...base, baseUrl: "192.0.2.1" }).baseUrl).toBe("https://192.0.2.1");
		expect(normalizeConfig({ ...base, baseUrl: "http://192.0.2.1/" }).baseUrl).toBe("http://192.0.2.1");
		expect(normalizeConfig({ ...base, baseUrl: "https://192.0.2.1/" }).origin).toBe("https://192.0.2.1");
	});

	test("an unusable baseUrl is a ConfigError", () => {
		expect(() => normalizeConfig({ ...base, baseUrl: "https://[" })).toThrow();
	});

	test("credentials are trimmed; blanks become null; site defaults", () => {
		const config = normalizeConfig({
			...base,
			site: " lab ",
			credentials: { apiKey: " key ", legacy: { username: " u ", password: "" } }
		});
		expect(config.site).toBe("lab");
		expect(config.credentials.apiKey).toBe("key");
		expect(config.credentials.legacy.username).toBe("u");
		expect(config.credentials.legacy.password).toBe("");
	});

	test("the empty-credentials case composes and tls pins ride through", () => {
		const config = normalizeConfig({ ...base, tls: { spkiPins: ["pin"] } });
		expect(config.credentials.apiKey).toBe(null);
		expect(config.tls.spkiPins).toEqual(["pin"]);
	});

	test("timeouts and the official base have documented defaults and accept overrides", () => {
		const defaults = normalizeConfig(base);
		expect(defaults.timeoutMs).toBe(10000);
		expect(defaults.loginTimeoutMs).toBe(8000);
		expect(defaults.officialBase).toBe("/proxy/network/integration/v1");
		const custom = normalizeConfig({ ...base, timeoutMs: 5, loginTimeoutMs: 6, officialBase: "/integration/v1" });
		expect(custom.timeoutMs).toBe(5);
		expect(custom.loginTimeoutMs).toBe(6);
		expect(custom.officialBase).toBe("/integration/v1");
		// Non-positive / non-numeric values fall back to the defaults.
		const bad = normalizeConfig({ ...base, timeoutMs: -1, loginTimeoutMs: "nope" });
		expect(bad.timeoutMs).toBe(10000);
		expect(bad.loginTimeoutMs).toBe(8000);
	});
});

describe("session state", () => {
	test("setSite deep-merges and clearSite forgets", () => {
		clearAllSites();
		setSite("default", { cookies: "a=1", api: { prefix: "/p/" } });
		setSite("default", { api: { endpointVersion: "unifi_os_v2" } });
		expect(getSite("default")).toMatchObject({ cookies: "a=1", api: { prefix: "/p/", endpointVersion: "unifi_os_v2" } });
		// Unknown sites get the default shape.
		expect(getSite("other")).toMatchObject({ cookies: null, loggedIn: false });
		clearSite("default");
		expect(getSite("default").cookies).toBe(null);
		clearAllSites();
	});

	test("the error log is bounded and copy-safe", () => {
		const before = recentErrors().length;
		for (let index = 0; index < 60; index++) recordError({ kind: "http", status: index });
		const log = recentErrors();
		expect(log.length).toBeLessThanOrEqual(50);
		expect(log.length).toBeGreaterThan(before);
		log.pop();
		expect(recentErrors().length).toBe(log.length + 1);
	});

	test("the probe cache round-trips and clears", () => {
		clearProbeCache();
		expect(getProbeCache()).toBe(null);
		setProbeCache({ networks: "official" });
		expect(getProbeCache()).toMatchObject({ networks: "official" });
		clearProbeCache();
		expect(getProbeCache()).toBe(null);
	});
});

describe("url building edge cases", () => {
	test("buildUrlWithParams falls back to manual encoding for URLs URL() cannot parse", () => {
		// A non-numeric port is something URL() refuses; the manual fallback still appends.
		const bad = "https://192.0.2.1:port/api";
		expect(buildUrlWithParams(bad, { a: "b" })).toBe(bad + "?a=b");
	});

	test("joinSiteUrl tolerates a missing prefix", () => {
		expect(joinSiteUrl({ host_url: "https://192.0.2.1", api: {} }, "api/stat/sites")).toBe("https://192.0.2.1/api/stat/sites");
	});

	test("resolveUrl honors endpoint-type overrides", () => {
		const siteData = {
			host_url: "https://192.0.2.1",
			site: "default",
			api: { prefix: "/proxy/network/", endpointType: "network", endpointVersion: "legacy" }
		};
		// The legacy endpoint version resolves the pre-v2 static-DNS surface.
		expect(resolveUrl(siteData, "static_dns_list", {})).toBe("https://192.0.2.1/proxy/network/api/s/default/rest/static-dns");
		expect(resolveUrl(siteData, "static_dns_list", {}, { endpointVersion: "unifi_os_v2" })).toBe(
			"https://192.0.2.1/proxy/network/v2/api/site/default/static-dns"
		);
	});
});

describe("dns record normalization", () => {
	test("every official type maps onto the one shape", () => {
		const rows = [
			{ id: "a", type: "AAAA_RECORD", enabled: true, domain: "v6.test", ipv6Address: "2001:db8::1", ttlSeconds: 60 },
			{
				id: "srv",
				type: "SRV_RECORD",
				enabled: true,
				domain: "cldmv.net",
				service: "_sip",
				protocol: "_tcp",
				serverDomain: "sip.cldmv.net",
				port: 5060,
				priority: 1,
				weight: 2
			},
			{ id: "txt", type: "TXT_RECORD", enabled: true, domain: "cldmv.net", text: "hello" }
		];
		const [aaaa, srv, txt] = rows.map((row) => officialPolicyFromRow(row));
		expect(aaaa).toMatchObject({ type: "AAAA_RECORD", data: { ipv6Address: "2001:db8::1" }, ttl: 60 });
		expect(srv).toMatchObject({
			type: "SRV_RECORD",
			data: { service: "_sip", protocol: "_tcp", serverDomain: "sip.cldmv.net", port: 5060, priority: 1, weight: 2 }
		});
		expect(txt).toMatchObject({ type: "TXT_RECORD", data: { text: "hello" }, ttl: null });
	});

	test("an unknown official type keeps the row's extra fields under data", () => {
		const row = officialPolicyFromRow({
			id: "x",
			type: "SOMETHING_NEW",
			enabled: false,
			domain: "x.test",
			ttlSeconds: 30,
			metadata: { origin: "SYSTEM" },
			extraField: 1
		});
		expect(row.type).toBe("SOMETHING_NEW");
		expect(row.data).toMatchObject({ extraField: 1 });
		expect(row.data.id).toBeUndefined();
		expect(row.origin).toBe("SYSTEM");
	});

	test("legacy rows without ids or types still normalize", () => {
		expect(legacyStaticDnsFromRow(null)).toBe(null);
		expect(legacyStaticDnsFromRow({ _id: "s", enabled: false, key: "a.test", record_type: "TXT", value: "t", ttl: 300 })).toMatchObject({
			ttl: 300,
			enabled: false
		});
	});

	test("forward policy bodies normalize domain and target on both paths", () => {
		expect(officialForwardPolicyBody({ domain: "Test.Example.", target: " 192.0.2.53 " })).toEqual({
			type: "FORWARD_DOMAIN",
			enabled: true,
			domain: "test.example",
			ipAddress: "192.0.2.53"
		});
		expect(legacyForwardBody({ domain: "Test.Example.", target: "192.0.2.53", enabled: false })).toEqual({
			enabled: false,
			key: "test.example",
			record_type: "forward",
			value: "192.0.2.53"
		});
	});

	test("domain and IP-literal validation edges", () => {
		expect(isDomainName("a.b")).toBe(true);
		expect(isDomainName("-bad.test")).toBe(false);
		expect(isDomainName("bad-.test")).toBe(false);
		expect(isDomainName("")).toBe(false);
		expect(isIpLiteral("::")).toBe(true);
		expect(isIpLiteral("1:2")).toBe(false);
		expect(isIpLiteral("gggg::1")).toBe(false);
		expect(isIpLiteral("2001:db8:0:0:0:0:0:1")).toBe(true);
		expect(isIpLiteral("")).toBe(false);
	});
});

describe("client and network normalization", () => {
	test("client rows without MACs are dropped; fixed flags follow use_fixedip", () => {
		expect(legacyClientFromStaRow(null)).toBe(null);
		expect(legacyClientFromStaRow({ _id: "x" })).toBe(null);
		expect(legacyClientFromStaRow({ _id: "x", mac: "00:00:5e:00:53:09", hostname: "h", use_fixedip: true, fixed_ip: null }).fixed).toBe(
			false
		);
		expect(legacyClientRecordFromUserRow({ _id: "y", mac: "bad", name: "n" })).toBe(null);
		expect(officialClientFromRow(null)).toBe(null);
		expect(
			officialClientFromRow({
				id: "z",
				macAddress: "00-00-5E-00-53-08",
				ipAddress: "192.0.2.9",
				hostname: null,
				name: "dev",
				networkId: "n1"
			})
		).toMatchObject({
			mac: "00:00:5e:00:53:08",
			hostname: "dev",
			network: "n1"
		});
	});

	test("isIpv4 and normalizeMac edges", () => {
		expect(isIpv4("0.0.0.0")).toBe(true);
		expect(isIpv4("1.2.3")).toBe(false);
		expect(isIpv4("1.2.3.4.5")).toBe(false);
		expect(normalizeMac(undefined)).toBe(null);
	});

	test("network rows normalize with missing pieces", () => {
		expect(legacyNetworkFromRow(null)).toBe(null);
		expect(legacyNetworkFromRow({ _id: "n", name: "NoNet", purpose: "corporate" })).toMatchObject({
			id: "n",
			cidr: null,
			gateway: null,
			dhcp: { range: null, leaseSec: null },
			dns: { servers: [], domain: "" },
			kind: "corporate"
		});
		// A non-contiguous netmask yields no cidr.
		expect(legacyNetworkFromRow({ _id: "n", purpose: "corporate", ipaddr: "192.0.2.1", ipaddr_subnet: "255.0.255.0" }).cidr).toBe(null);
		// vlan with vlan_enabled true is kept.
		expect(legacyNetworkFromRow({ _id: "n", purpose: "corporate", vlan: 7, vlan_enabled: true }).vlan).toBe(7);
		expect(netmaskToPrefix("0.0.0.0")).toBe(0);

		expect(officialNetworkFromDetail(null)).toBe(null);
		expect(officialNetworkFromDetail({ id: "o", name: "Bare" })).toMatchObject({
			id: "o",
			cidr: null,
			dns: { servers: [], domain: "" },
			kind: null
		});
	});
});
