/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/helpers/routes.mjs
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

/**
 * @fileoverview Reusable mock-fetch route sets built from the recorded
 * fixtures, one builder per API path. Each builder takes a small options
 * object so a test can silence one capability (a 404 on one endpoint classifies
 * that capability "none"/falls back) without rewriting the routes.
 *
 * Path notes: on a UniFi OS console the legacy Network app sits under
 * `/proxy/network/`, so legacy endpoints are `/proxy/network/api/s/{site}/...`
 * and the v2 static-DNS collection is `/proxy/network/v2/api/site/{site}/...`;
 * a standalone legacy controller answers on `/api/s/{site}/...` directly. The
 * official Integration API sits under `/proxy/network/integration/v1`.
 */

import {
	createMockFetch,
	fixture,
	CONTROLLER,
	OFFICIAL_ROOT,
	SITE_ID,
	LEGACY_ROOT,
	DEVICE_ID,
	CLIENT_DETAIL_ID,
	WLAN_ID,
	VOUCHER_ID,
	LAG_ID,
	STACK_ID,
	MCLAG_ID
} from "./mock-fetch.mjs";

/** The official site-scoped path prefix for the fixture site. */
const sitePath = `${OFFICIAL_ROOT}/sites/${SITE_ID}`;

/**
 * The official Integration API surface, from fixtures/official/*.
 * @param {{ info?: boolean, sites?: boolean, networks?: boolean, clients?: boolean, policies?: boolean, networksPage?: object }} [enabled]
 */
export function officialRoutes(enabled = {}) {
	const on = {
		info: true,
		sites: true,
		networks: true,
		clients: true,
		policies: true,
		devices: true,
		firewall: true,
		wlans: true,
		radius: true,
		vouchers: true,
		switching: true,
		vpn: true,
		wan: true,
		dpi: true,
		countries: true,
		...enabled
	};
	const routes = [];
	if (on.info) routes.push({ method: "GET", path: `${OFFICIAL_ROOT}/info`, body: fixture("official/info") });
	if (on.sites) routes.push({ method: "GET", path: `${OFFICIAL_ROOT}/sites`, body: fixture("official/sites") });
	if (on.networks) {
		routes.push({ method: "GET", path: `${sitePath}/networks`, body: on.networksPage ?? fixture("official/networks-page") });
		routes.push({
			method: "GET",
			path: `${sitePath}/networks/11111111-2222-4333-8444-555555555555`,
			body: fixture("official/network-default")
		});
		routes.push({
			method: "GET",
			path: `${sitePath}/networks/66666666-7777-4888-8999-000000000000`,
			body: fixture("official/network-iot")
		});
		routes.push({ method: "POST", path: `${sitePath}/networks`, body: fixture("official/network-iot") });
		routes.push({ method: "DELETE", path: new RegExp(`${sitePath}/networks/[^/]+$`), body: "" });
	}
	if (on.clients) routes.push({ method: "GET", path: `${sitePath}/clients`, body: fixture("official/clients-page") });
	if (on.policies) {
		routes.push({ method: "GET", path: `${sitePath}/dns/policies`, body: fixture("official/dns-policies-page") });
		routes.push({
			method: "GET",
			path: new RegExp(`${sitePath}/dns/policies/[^/]+$`),
			body: fixture("official/dns-policies-page").data[0]
		});
		routes.push({ method: "POST", path: `${sitePath}/dns/policies`, body: fixture("official/dns-policies-page").data[0] });
		routes.push({ method: "DELETE", path: new RegExp(`${sitePath}/dns/policies/[^/]+$`), body: "" });
	}
	// The update PUTs echo the stored object.
	if (on.networks)
		routes.push({ method: "PUT", path: new RegExp(`${sitePath}/networks/[^/]+$`), body: fixture("official/network-default") });
	if (on.policies)
		routes.push({
			method: "PUT",
			path: new RegExp(`${sitePath}/dns/policies/[^/]+$`),
			body: fixture("official/dns-policies-page").data[1]
		});
	if (on.devices) {
		routes.push({ method: "GET", path: `${sitePath}/devices`, body: fixture("official/devices-page") });
		routes.push({ method: "GET", path: `${sitePath}/devices/${DEVICE_ID}`, body: fixture("official/device-detail") });
		routes.push({ method: "GET", path: `${sitePath}/devices/${DEVICE_ID}/statistics/latest`, body: fixture("official/device-statistics") });
		routes.push({ method: "GET", path: `${sitePath}/device-tags`, body: fixture("official/device-tags") });
		routes.push({ method: "GET", path: `${OFFICIAL_ROOT}/pending-devices`, body: fixture("official/pending-devices") });
		routes.push({ method: "POST", path: `${sitePath}/devices`, body: fixture("official/device-detail") });
		routes.push({ method: "DELETE", path: new RegExp(`${sitePath}/devices/[^/]+$`), body: "" });
		routes.push({ method: "POST", path: new RegExp(`${sitePath}/devices/[^/]+/actions$`), body: "" });
		routes.push({ method: "POST", path: new RegExp(`${sitePath}/devices/[^/]+/interfaces/ports/[^/]+/actions$`), body: "" });
	}
	if (on.clients) {
		routes.push({ method: "GET", path: `${sitePath}/clients/${CLIENT_DETAIL_ID}`, body: fixture("official/clients-detail") });
		routes.push({ method: "POST", path: new RegExp(`${sitePath}/clients/[^/]+/actions$`), body: "" });
	}
	if (on.firewall) {
		routes.push({ method: "GET", path: `${sitePath}/firewall/policies`, body: fixture("official/firewall-policies-page") });
		routes.push({ method: "GET", path: `${sitePath}/firewall/policies/ordering`, body: fixture("official/firewall-policy-ordering") });
		routes.push({ method: "GET", path: `${sitePath}/firewall/zones`, body: fixture("official/firewall-zones-page") });
		routes.push({ method: "GET", path: `${sitePath}/acl-rules`, body: fixture("official/acl-rules-page") });
		routes.push({ method: "GET", path: `${sitePath}/acl-rules/ordering`, body: fixture("official/acl-ordering") });
		routes.push({ method: "GET", path: `${sitePath}/traffic-matching-lists`, body: fixture("official/traffic-matching-lists-page") });
		// The write verbs echo a stored/created row (the ordering routes must sit
		// before the id-shaped regexes so "ordering" is not read as an id).
		routes.push({
			method: "GET",
			path: new RegExp(`${sitePath}/firewall/policies/[^/]+$`),
			body: fixture("official/firewall-policies-page").data[0]
		});
		routes.push({ method: "POST", path: `${sitePath}/firewall/policies`, body: fixture("official/firewall-created") });
		routes.push({ method: "PUT", path: `${sitePath}/firewall/policies/ordering`, body: fixture("official/firewall-policy-ordering") });
		routes.push({
			method: "PUT",
			path: new RegExp(`${sitePath}/firewall/policies/[^/]+$`),
			body: fixture("official/firewall-policies-page").data[0]
		});
		routes.push({
			method: "PATCH",
			path: new RegExp(`${sitePath}/firewall/policies/[^/]+$`),
			body: fixture("official/firewall-policies-page").data[0]
		});
		routes.push({ method: "DELETE", path: new RegExp(`${sitePath}/firewall/policies/[^/]+$`), body: "" });
		routes.push({
			method: "GET",
			path: new RegExp(`${sitePath}/firewall/zones/[^/]+$`),
			body: fixture("official/firewall-zones-page").data[0]
		});
		routes.push({ method: "POST", path: `${sitePath}/firewall/zones`, body: fixture("official/firewall-zones-page").data[0] });
		routes.push({
			method: "PUT",
			path: new RegExp(`${sitePath}/firewall/zones/[^/]+$`),
			body: fixture("official/firewall-zones-page").data[0]
		});
		routes.push({ method: "DELETE", path: new RegExp(`${sitePath}/firewall/zones/[^/]+$`), body: "" });
		routes.push({ method: "GET", path: new RegExp(`${sitePath}/acl-rules/[^/]+$`), body: fixture("official/acl-rules-page").data[0] });
		routes.push({ method: "POST", path: `${sitePath}/acl-rules`, body: fixture("official/acl-rules-page").data[0] });
		routes.push({ method: "PUT", path: `${sitePath}/acl-rules/ordering`, body: fixture("official/acl-ordering") });
		routes.push({ method: "PUT", path: new RegExp(`${sitePath}/acl-rules/[^/]+$`), body: fixture("official/acl-rules-page").data[0] });
		routes.push({ method: "DELETE", path: new RegExp(`${sitePath}/acl-rules/[^/]+$`), body: "" });
		routes.push({
			method: "GET",
			path: new RegExp(`${sitePath}/traffic-matching-lists/[^/]+$`),
			body: fixture("official/traffic-matching-lists-page").data[0]
		});
		routes.push({
			method: "POST",
			path: `${sitePath}/traffic-matching-lists`,
			body: fixture("official/traffic-matching-lists-page").data[0]
		});
		routes.push({
			method: "PUT",
			path: new RegExp(`${sitePath}/traffic-matching-lists/[^/]+$`),
			body: fixture("official/traffic-matching-lists-page").data[0]
		});
		routes.push({ method: "DELETE", path: new RegExp(`${sitePath}/traffic-matching-lists/[^/]+$`), body: "" });
	}
	if (on.wlans) {
		routes.push({ method: "GET", path: `${sitePath}/wifi/broadcasts`, body: fixture("official/wifi-broadcasts-page") });
		routes.push({ method: "GET", path: `${sitePath}/wifi/broadcasts/${WLAN_ID}`, body: fixture("official/wifi-broadcast-detail") });
		routes.push({ method: "POST", path: `${sitePath}/wifi/broadcasts`, body: fixture("official/wifi-broadcast-detail") });
		routes.push({ method: "PUT", path: new RegExp(`${sitePath}/wifi/broadcasts/[^/]+$`), body: fixture("official/wifi-broadcast-detail") });
		routes.push({ method: "DELETE", path: new RegExp(`${sitePath}/wifi/broadcasts/[^/]+$`), body: "" });
	}
	if (on.radius) routes.push({ method: "GET", path: `${sitePath}/radius/profiles`, body: fixture("official/radius-profiles-page") });
	if (on.vouchers) {
		routes.push({ method: "GET", path: `${sitePath}/hotspot/vouchers`, body: fixture("official/hotspot-vouchers-page") });
		routes.push({
			method: "GET",
			path: `${sitePath}/hotspot/vouchers/${VOUCHER_ID}`,
			body: fixture("official/hotspot-vouchers-page").data[0]
		});
		routes.push({ method: "POST", path: `${sitePath}/hotspot/vouchers`, body: fixture("official/hotspot-vouchers-created") });
		routes.push({ method: "DELETE", path: `${sitePath}/hotspot/vouchers`, body: { vouchersDeleted: 2 } });
		routes.push({ method: "DELETE", path: new RegExp(`${sitePath}/hotspot/vouchers/[^/]+$`), body: { vouchersDeleted: 1 } });
	}
	if (on.switching) {
		routes.push({ method: "GET", path: `${sitePath}/switching/lags`, body: fixture("official/switching-lags-page") });
		routes.push({ method: "GET", path: `${sitePath}/switching/lags/${LAG_ID}`, body: fixture("official/lag-detail") });
		routes.push({ method: "GET", path: `${sitePath}/switching/switch-stacks`, body: fixture("official/switch-stacks-page") });
		routes.push({ method: "GET", path: `${sitePath}/switching/switch-stacks/${STACK_ID}`, body: fixture("official/switch-stack-detail") });
		routes.push({ method: "GET", path: `${sitePath}/switching/mc-lag-domains`, body: fixture("official/mc-lag-domains-page") });
		routes.push({ method: "GET", path: `${sitePath}/switching/mc-lag-domains/${MCLAG_ID}`, body: fixture("official/mc-lag-detail") });
	}
	if (on.vpn) {
		routes.push({ method: "GET", path: `${sitePath}/vpn/servers`, body: fixture("official/vpn-servers-page") });
		routes.push({ method: "GET", path: `${sitePath}/vpn/site-to-site-tunnels`, body: fixture("official/vpn-tunnels-page") });
	}
	if (on.wan) routes.push({ method: "GET", path: `${sitePath}/wans`, body: fixture("official/wans-page") });
	if (on.dpi) {
		routes.push({ method: "GET", path: `${OFFICIAL_ROOT}/dpi/applications`, body: fixture("official/dpi-applications-page") });
		routes.push({ method: "GET", path: `${OFFICIAL_ROOT}/dpi/categories`, body: fixture("official/dpi-categories-page") });
	}
	if (on.countries) routes.push({ method: "GET", path: `${OFFICIAL_ROOT}/countries`, body: fixture("official/countries-page") });
	return routes;
}

/** A login response for the UniFi OS endpoint (the TOKEN cookie + CSRF token). */
export function uniFiOsLoginResponse() {
	return {
		status: 200,
		setCookie: ["TOKEN=doc-token-cookie; Path=/; Secure"],
		headers: { "x-csrf-token": "doc-csrf-token-0001" },
		body: ""
	};
}

/** A login response for the legacy :8443 endpoint (the unifises cookie). */
export function legacyLoginResponse() {
	return { status: 200, setCookie: ["unifises=doc-legacy-cookie; Path=/"], headers: {}, body: "" };
}

/**
 * The legacy UniFi OS surface, from fixtures/legacy/*.
 * @param {{
 *   sysinfo?: string|null, login?: "unifi_os"|"legacy"|"none",
 *   staticDns?: boolean, networkconf?: boolean, sta?: boolean, userRecords?: boolean,
 *   udmProbe?: boolean, nvrProbe?: boolean,
 *   networkConfUpdate?: boolean, clientUpdate?: boolean, staticDnsWrite?: boolean,
 * }} [options]
 */
export function legacyRoutes(options = {}) {
	const opts = {
		sysinfo: "sysinfo",
		sites: true,
		bootstrap: false,
		login: "unifi_os",
		staticDns: true,
		networkconf: true,
		sta: true,
		userRecords: true,
		udmProbe: true,
		nvrProbe: false,
		networkConfUpdate: true,
		clientUpdate: true,
		staticDnsWrite: true,
		radiusUsers: true,
		admins: true,
		portconf: true,
		devices: true,
		...options
	};
	const routes = [];

	if (opts.login === "unifi_os") routes.push({ method: "POST", path: "/api/auth/login", ...uniFiOsLoginResponse() });
	if (opts.login === "legacy") routes.push({ method: "POST", path: "/api/login", ...legacyLoginResponse() });

	if (opts.sysinfo) {
		routes.push({ path: `${LEGACY_ROOT}/s/default/stat/sysinfo`, body: fixture(`legacy/${opts.sysinfo}`) });
		routes.push({ path: `/api/s/default/stat/sysinfo`, body: fixture(`legacy/${opts.sysinfo}`) });
	}

	if (opts.sites) {
		routes.push({ path: `${LEGACY_ROOT}/stat/sites`, body: fixture("legacy/sites") });
		routes.push({ path: `/api/stat/sites`, body: fixture("legacy/sites") });
	}
	if (opts.bootstrap) {
		routes.push({ path: `${LEGACY_ROOT}/bootstrap`, body: fixture("legacy/bootstrap") });
		routes.push({ path: `/api/bootstrap`, body: fixture("legacy/bootstrap") });
	}

	// The UDM/NVR probes answer with the "Cannot GET /api" body (unifi-cli's checkEndpoint).
	if (opts.udmProbe) routes.push({ path: "/proxy/network/api", body: "Cannot GET /api" });
	if (opts.nvrProbe) routes.push({ path: "/proxy/protect/api", body: "Cannot GET /api" });

	if (opts.networkconf) {
		routes.push({ path: `${LEGACY_ROOT}/s/default/rest/networkconf`, body: fixture("legacy/networkconf") });
		routes.push({ path: `/api/s/default/rest/networkconf`, body: fixture("legacy/networkconf") });
	}
	if (opts.networkConfUpdate) {
		routes.push({ method: "PUT", path: /\/rest\/networkconf\/[^/]+$/, body: fixture("legacy/networkconf-update-ok") });
	}
	if (opts.sta) {
		routes.push({ path: `${LEGACY_ROOT}/s/default/stat/sta`, body: fixture("legacy/sta") });
		routes.push({ path: `/api/s/default/stat/sta`, body: fixture("legacy/sta") });
		routes.push({ path: /\/stat\/user\/[^/]+$/, body: fixture("legacy/user-records").data[0] });
	}
	if (opts.userRecords) {
		routes.push({ path: `${LEGACY_ROOT}/s/default/rest/user`, body: fixture("legacy/user-records") });
		routes.push({ path: `/api/s/default/rest/user`, body: fixture("legacy/user-records") });
	}
	if (opts.clientUpdate) {
		routes.push({ method: "PUT", path: /\/rest\/user\/[^/]+$/, body: fixture("legacy/client-update-ok") });
	}

	if (opts.radiusUsers) {
		routes.push({ path: "/proxy/network/v2/api/site/default/radius/users", body: fixture("legacy/radius-users") });
		routes.push({ path: `/v2/api/site/default/radius/users`, body: fixture("legacy/radius-users") });
		routes.push({ path: `${LEGACY_ROOT}/s/default/rest/radiususer`, body: fixture("legacy/radius-users") });
		routes.push({ path: `/api/s/default/rest/radiususer`, body: fixture("legacy/radius-users") });
		routes.push({ path: `${LEGACY_ROOT}/s/default/rest/account`, body: fixture("legacy/radius-users") });
		routes.push({ path: `/api/s/default/rest/account`, body: fixture("legacy/radius-users") });
	}
	if (opts.radiusUsers) {
		routes.push({ method: "POST", path: /\/radius\/users\/batch_add$/, body: fixture("legacy/radius-user-created") });
		routes.push({ method: "PUT", path: /\/radius\/users\/batch_update$/, body: fixture("legacy/radius-user-updated") });
		routes.push({ method: "DELETE", path: /\/radius\/users\/[^/]+$/, body: fixture("legacy/radius-delete-ok") });
		routes.push({ method: "POST", path: /\/rest\/(radiususer|account)$/, body: fixture("legacy/radius-user-created") });
		routes.push({ method: "PUT", path: /\/rest\/(radiususer|account)\/[^/]+$/, body: fixture("legacy/radius-user-updated") });
		routes.push({ method: "DELETE", path: /\/rest\/(radiususer|account)\/[^/]+$/, body: fixture("legacy/radius-delete-ok") });
	}
	if (opts.admins) {
		routes.push({ path: "/proxy/network/v2/api/site/default/user", body: fixture("legacy/admins") });
		routes.push({ path: `/v2/api/site/default/user`, body: fixture("legacy/admins") });
		routes.push({ path: `${LEGACY_ROOT}/s/default/rest/admin`, body: fixture("legacy/admins") });
		routes.push({ path: `/api/s/default/rest/admin`, body: fixture("legacy/admins") });
		routes.push({ path: /\/v2\/api\/site\/default\/user\/[^/]+$/, body: fixture("legacy/admin-detail") });
	}
	if (opts.portconf) {
		routes.push({ path: `${LEGACY_ROOT}/s/default/rest/portconf`, body: fixture("legacy/portconf") });
		routes.push({ path: `/api/s/default/rest/portconf`, body: fixture("legacy/portconf") });
	}
	if (opts.devices) {
		// stat/device serves both the inventory and the stat read (one row per
		// device carrying both shapes — the real controller's single response).
		routes.push({ path: `${LEGACY_ROOT}/s/default/stat/device`, body: fixture("legacy/devices") });
		routes.push({ path: `/api/s/default/stat/device`, body: fixture("legacy/devices") });
		routes.push({ path: /\/stat\/device\/[^/]+$/, body: fixture("legacy/device-detail") });
	}

	const usesV2StaticDns = opts.sysinfo !== "sysinfo-7.3";
	const bareStaticDns = usesV2StaticDns ? "/v2/api/site/default/static-dns" : "/api/s/default/rest/static-dns";
	const proxiedStaticDns = usesV2StaticDns ? "/proxy/network/v2/api/site/default/static-dns" : `${LEGACY_ROOT}/s/default/rest/static-dns`;
	if (opts.staticDns) {
		routes.push({ path: bareStaticDns, body: fixture("legacy/static-dns") });
		routes.push({ path: proxiedStaticDns, body: fixture("legacy/static-dns") });
	}
	if (opts.staticDnsWrite) {
		routes.push({ method: "POST", path: bareStaticDns, body: fixture("legacy/static-dns-created") });
		routes.push({ method: "POST", path: proxiedStaticDns, body: fixture("legacy/static-dns-created") });
		routes.push({ method: "PUT", path: new RegExp(`${bareStaticDns}/[^/]+$`), body: fixture("legacy/static-dns-updated") });
		routes.push({ method: "PUT", path: new RegExp(`${proxiedStaticDns}/[^/]+$`), body: fixture("legacy/static-dns-updated") });
	}
	return routes;
}

/**
 * A mock fetch over a route set.
 * @param {object[]} routes
 * @returns {typeof fetch & { calls: object[] }}
 */
export function mockFetch(routes) {
	return createMockFetch(routes);
}

export { CONTROLLER, OFFICIAL_ROOT, SITE_ID, LEGACY_ROOT };

// The fixture resource ids ride along for the area tests (defined in mock-fetch).
export {
	DEVICE_ID,
	CLIENT_DETAIL_ID,
	WLAN_ID,
	POLICY_ID,
	ZONE_ID,
	ACL_ID,
	MATCHING_ID,
	VOUCHER_ID,
	LAG_ID,
	STACK_ID,
	MCLAG_ID,
	VPN_SERVER_ID,
	TUNNEL_ID
} from "./mock-fetch.mjs";
