/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/lib/endpoints.mjs
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
 * @fileoverview The legacy endpoint template table, merged from unifi-cli's
 * two copies (`lib/api/map/map.mjs` and the older standalone
 * `lib/endpointMap.mjs`) — lib-unifi keeps one. Rows lib-unifi's surfaces need
 * are kept as written from unifi-cli; rows only the CLI's device
 * classification and auto-IP tasks used (radius, admin, portconf, protect
 * camera rows) are dropped, since those pieces stay with unifi-cli.
 *
 * Paths are relative to the site's `host_url + apiPrefix` and carry `{site}` /
 * `{id}` substitution, exactly like unifi-cli's `get()`.
 */

/** Endpoint types, as unifi-cli's detection names them. */
export const ENDPOINT_TYPES = {
	network: "network",
	protect: "protect"
};

/** Endpoint versions under each type. */
export const ENDPOINT_VERSIONS = {
	network: ["unifi_os_v2", "unifi_os_v1", "legacy"],
	protect: ["unifi_protect_os_v2"]
};

export const endpoints = {
	network: {
		unifi_os_v2: {
			device_list_mini: "v2/api/site/{site}/device",
			static_dns_list: "v2/api/site/{site}/static-dns",
			static_dns_create: "v2/api/site/{site}/static-dns",
			static_dns_update: "v2/api/site/{site}/static-dns/{id}",
			static_dns_delete: "v2/api/site/{site}/static-dns/{id}"
		},
		unifi_os_v1: {
			site_info: "api/s/{site}/stat/sysinfo"
		},
		legacy: {
			sites_list: "api/stat/sites",
			device_list: "api/s/{site}/stat/device",
			device_detail: "api/s/{site}/stat/device/{id}",
			device_stat: "api/s/{site}/stat/device",
			client_list: "api/s/{site}/stat/sta",
			client_detail: "api/s/{site}/stat/user/{id}",
			client_update: "api/s/{site}/rest/user/{id}",
			client_records: "api/s/{site}/rest/user",
			network_config: "api/s/{site}/rest/networkconf",
			network_config_update: "api/s/{site}/rest/networkconf/{id}",
			site_info: "api/s/{site}/stat/sysinfo",
			static_dns_list: "api/s/{site}/rest/static-dns",
			static_dns_create: "api/s/{site}/rest/static-dns",
			static_dns_update: "api/s/{site}/rest/static-dns/{id}",
			static_dns_delete: "api/s/{site}/rest/static-dns/{id}"
		}
	},
	protect: {
		unifi_protect_os_v2: {
			site_info: "api/bootstrap",
			site_info_v2: "v2/api/site/{site}/info"
		}
	}
};

/**
 * Resolves an endpoint key to its template, falling back to the other versions
 * under the requested type when the key is not in the requested one (the
 * fallback order from unifi-cli's `get()`), then to other types.
 *
 * @param {string} apiEndPointType e.g. "network"
 * @param {string} apiEndPointVersion e.g. "unifi_os_v2"
 * @param {string} key e.g. "client_update"
 * @param {Record<string, string>} vars `{ site, id, ... }` substituted into `{name}` slots
 * @returns {string} the resolved path
 * @throws {Error} when no version under any type carries the key
 */
export function resolveEndpoint(apiEndPointType, apiEndPointVersion, key, vars = {}) {
	let template;
	const typeTable = endpoints[apiEndPointType];
	if (typeTable && typeof typeTable === "object") {
		if (typeTable[apiEndPointVersion]?.[key]) {
			template = typeTable[apiEndPointVersion][key];
		} else {
			for (const version of Object.keys(typeTable)) {
				if (typeTable[version]?.[key]) {
					template = typeTable[version][key];
					break;
				}
			}
		}
	}
	if (!template) {
		throw new Error(
			`Endpoint not found for type (${apiEndPointType}) on any version (${Object.keys(typeTable ?? {}).join(", ")}) for key "${key}"`
		);
	}
	return template.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? vars[name] : `{${name}}`));
}
