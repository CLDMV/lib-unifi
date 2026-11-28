/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/url.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:44:12-08:00 (1795866252)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { resolveEndpoint } from "./endpoints.mjs";

/**
 * @fileoverview Endpoint key -> URL resolution over the endpoint map, ported
 * from unifi-cli's `lib/api/util/url.mjs` (`cleanEndpoint`, `ensureHttpsUrl`,
 * `buildUrlWithParams`): the base URL now comes from the factory config
 * instead of `self.config`, and site data is passed in instead of being read
 * from the config module.
 */

/**
 * Prepends "https://" when a string is a bare host.
 * @param {string} str
 * @returns {string}
 */
export function ensureHttpsUrl(str) {
	if (!/^https?:\/\//i.test(str)) {
		return "https://" + str;
	}
	return str;
}

/**
 * Appends query parameters to a URL, URL-encoding the values.
 * @param {string} url
 * @param {Record<string, string|number|boolean>} params
 * @returns {string}
 */
export function buildUrlWithParams(url, params = {}) {
	const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
	if (entries.length === 0) return url;
	try {
		const parsed = new URL(url);
		for (const [key, value] of entries) parsed.searchParams.append(key, String(value));
		return parsed.toString();
	} catch {
		const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
		return url + (url.includes("?") ? "&" : "?") + qs;
	}
}

/**
 * Joins a site's base (host + api prefix) with an already-resolved endpoint
 * path, normalizing slashes the way unifi-cli's `cleanEndpoint` did.
 *
 * @param {{ host_url: string, api: { prefix: string } }} siteData
 * @param {string} endpointPath an absolute path like "api/s/{site}/stat/sta"
 * @returns {string}
 */
export function joinSiteUrl(siteData, endpointPath) {
	const base = `${siteData.host_url.replace(/\/+$/, "")}${(siteData.api?.prefix ?? "").replace(/\/+$/, "")}`;
	return ensureHttpsUrl(`${base}/${endpointPath.replace(/^\/+/, "")}`);
}

/**
 * Resolves an endpoint key (or an absolute URL) to the full URL for a site.
 * Mirrors unifi-cli's `cleanEndpoint`: an "https?://" value is returned as-is,
 * a key is looked up in the endpoint table with `{site}`/`{id}` substitution.
 *
 * @param {{ host_url: string, site: string, api: { prefix: string, endpointType: string|null, endpointVersion: string|null } }} siteData
 * @param {string} endpoint endpoint key or absolute URL
 * @param {Record<string, string>} [variables] extra `{name}` substitutions
 * @param {{ endpointType?: string, endpointVersion?: string }} [overrides]
 * @returns {string}
 */
export function resolveUrl(siteData, endpoint, variables = {}, overrides = {}) {
	if (/^https?:\/\//i.test(endpoint)) return endpoint;
	const cleaned = endpoint.replace(/^\/+|\/+$/g, "");

	const endpointType = overrides.endpointType ?? siteData.api?.endpointType ?? "network";
	const endpointVersion = overrides.endpointVersion ?? siteData.api?.endpointVersion ?? "legacy";

	const path = resolveEndpoint(endpointType, endpointVersion, cleaned, { ...variables, site: siteData.site });
	return joinSiteUrl(siteData, path);
}
