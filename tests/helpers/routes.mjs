/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /tests/helpers/routes.mjs
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

import { createMockFetch, fixture, CONTROLLER, OFFICIAL_ROOT, SITE_ID, LEGACY_ROOT } from "./mock-fetch.mjs";

/** The official site-scoped path prefix for the fixture site. */
const sitePath = `${OFFICIAL_ROOT}/sites/${SITE_ID}`;

/**
 * The official Integration API surface, from fixtures/official/*.
 * @param {{ info?: boolean, sites?: boolean, networks?: boolean, clients?: boolean, policies?: boolean, networksPage?: object }} [enabled]
 */
export function officialRoutes(enabled = {}) {
	const on = { info: true, sites: true, networks: true, clients: true, policies: true, ...enabled };
	const routes = [];
	if (on.info) routes.push({ path: `${OFFICIAL_ROOT}/info`, body: fixture("official/info") });
	if (on.sites) routes.push({ path: `${OFFICIAL_ROOT}/sites`, body: fixture("official/sites") });
	if (on.networks) {
		routes.push({ path: `${sitePath}/networks`, body: on.networksPage ?? fixture("official/networks-page") });
		routes.push({ path: `${sitePath}/networks/11111111-2222-4333-8444-555555555555`, body: fixture("official/network-default") });
		routes.push({ path: `${sitePath}/networks/66666666-7777-4888-8999-000000000000`, body: fixture("official/network-iot") });
	}
	if (on.clients) routes.push({ path: `${sitePath}/clients`, body: fixture("official/clients-page") });
	if (on.policies) routes.push({ path: `${sitePath}/dns/policies`, body: fixture("official/dns-policies-page") });
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
		...options
	};
	const routes = [];

	if (opts.login === "unifi_os") routes.push({ method: "POST", path: "/api/auth/login", ...uniFiOsLoginResponse() });
	if (opts.login === "legacy") routes.push({ method: "POST", path: "/api/login", ...legacyLoginResponse() });

	if (opts.sysinfo) {
		routes.push({ path: `${LEGACY_ROOT}/s/default/stat/sysinfo`, body: fixture(`legacy/${opts.sysinfo}`) });
		routes.push({ path: `/api/s/default/stat/sysinfo`, body: fixture(`legacy/${opts.sysinfo}`) });
	}

	routes.push({ path: `${LEGACY_ROOT}/stat/sites`, body: fixture("legacy/sites") });
	routes.push({ path: `/api/stat/sites`, body: fixture("legacy/sites") });

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
	}
	if (opts.userRecords) {
		routes.push({ path: `${LEGACY_ROOT}/s/default/rest/user`, body: fixture("legacy/user-records") });
		routes.push({ path: `/api/s/default/rest/user`, body: fixture("legacy/user-records") });
	}
	if (opts.clientUpdate) {
		routes.push({ method: "PUT", path: /\/rest\/user\/[^/]+$/, body: fixture("legacy/client-update-ok") });
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
		routes.push({ method: "PUT", path: new RegExp(`${bareStaticDns}/[^/]+$`), body: fixture("legacy/static-dns-created") });
		routes.push({ method: "PUT", path: new RegExp(`${proxiedStaticDns}/[^/]+$`), body: fixture("legacy/static-dns-created") });
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
