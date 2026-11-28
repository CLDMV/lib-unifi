/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/endpoints.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:06-08:00 (1795870566)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The legacy endpoint template table, merged from unifi-cli's
 * two copies (`lib/api/map/map.mjs` and the older standalone
 * `lib/endpointMap.mjs`) — lib-unifi keeps one. Every row unifi-cli carries
 * stays as written: the device/client rows, `networkconf`, `stat/sites`,
 * `portconf`, the RADIUS user rows (all three versions) and the admin rows,
 * plus the Protect `camera_*` rows — the leaves the full-scope build exposes
 * lift them (Protect itself stays out of scope; its rows stay in the table so
 * a later version lifts them without re-porting, per PLAN §6.2).
 *
 * One correction against the merge: `stat/sysinfo` (`site_info`) belongs to
 * the `unifi_os_v1` table, not `legacy` — the plan's port table says so
 * explicitly, and the probe reads it from the version table it classified.
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
			// RADIUS users (the UniFi OS v2 surface unifi-cli's radius-sync drives).
			radius_list: "v2/api/site/{site}/radius/users",
			radius_add: "v2/api/site/{site}/radius/users/batch_add",
			radius_update: "v2/api/site/{site}/radius/users/batch_update",
			radius_delete: "v2/api/site/{site}/radius/users/{id}",
			// Controller login accounts (not RADIUS).
			admin_list: "v2/api/site/{site}/user",
			admin_detail: "v2/api/site/{site}/user/{id}",
			// Devices (the slim inventory page).
			device_list_mini: "v2/api/site/{site}/device",
			// Local DNS records (the v2 static-DNS collection).
			static_dns_list: "v2/api/site/{site}/static-dns",
			static_dns_create: "v2/api/site/{site}/static-dns",
			static_dns_update: "v2/api/site/{site}/static-dns/{id}",
			static_dns_delete: "v2/api/site/{site}/static-dns/{id}"
		},
		unifi_os_v1: {
			// RADIUS users on the pre-v2 UniFi OS surface.
			radius_list: "api/s/{site}/rest/radiususer",
			radius_add: "api/s/{site}/rest/radiususer",
			radius_update: "api/s/{site}/rest/radiususer/{id}",
			radius_delete: "api/s/{site}/rest/radiususer/{id}",
			// The version detection row — unifi_os_v1's, not legacy's.
			site_info: "api/s/{site}/stat/sysinfo",
			// The pre-v2 static-DNS collection.
			static_dns_list: "api/s/{site}/rest/static-dns",
			static_dns_create: "api/s/{site}/rest/static-dns",
			static_dns_update: "api/s/{site}/rest/static-dns/{id}",
			static_dns_delete: "api/s/{site}/rest/static-dns/{id}"
		},
		legacy: {
			// RADIUS users on a standalone legacy controller.
			radius_list: "api/s/{site}/rest/account",
			radius_add: "api/s/{site}/rest/account",
			radius_update: "api/s/{site}/rest/account/{id}",
			radius_delete: "api/s/{site}/rest/account/{id}",
			// Controller login accounts (legacy surface).
			admin_list: "api/s/{site}/rest/admin",
			sites_list: "api/stat/sites",
			device_list: "api/s/{site}/stat/device",
			device_detail: "api/s/{site}/stat/device/{id}",
			device_stat: "api/s/{site}/stat/device",
			client_list: "api/s/{site}/stat/sta",
			client_detail: "api/s/{site}/stat/user/{id}",
			client_update: "api/s/{site}/rest/user/{id}",
			client_records: "api/s/{site}/rest/user",
			// Switch port profiles (unifi-cli's port_config row).
			port_config: "api/s/{site}/rest/portconf",
			network_config: "api/s/{site}/rest/networkconf",
			network_config_update: "api/s/{site}/rest/networkconf/{id}",
			// The pre-v2 static-DNS collection (fallback for the unifi_os_v1 rows).
			static_dns_list: "api/s/{site}/rest/static-dns",
			static_dns_create: "api/s/{site}/rest/static-dns",
			static_dns_update: "api/s/{site}/rest/static-dns/{id}",
			static_dns_delete: "api/s/{site}/rest/static-dns/{id}"
		}
	},
	protect: {
		unifi_protect_os_v2: {
			site_info: "api/bootstrap",
			site_info_v2: "v2/api/site/{site}/info",
			// The Protect camera rows stay as written (Protect is out of scope for
			// this version — the rows are kept so a later one lifts them, PLAN §6.2).
			camera_patch: "api/cameras/{id}",
			camera_reboot: "api/cameras/{id}/reboot",
			camera_resolution_scale_hd: "api/cameras/{id}/resolutionScale/HD",
			camera_resolution_scale_2k: "api/cameras/{id}/resolutionScale/2K",
			camera_resolution_scale_4k: "api/cameras/{id}/resolutionScale/4K"
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
