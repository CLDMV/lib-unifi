/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/transport/official.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T06:10:32-08:00 (1795875032)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { context } from "@cldmv/slothlet/runtime";
import { ApiError, TransportError } from "../errors.mjs";
import { parseOfficialError } from "../auth-client.mjs";

export { parseOfficialError };

/**
 * @fileoverview The official UniFi Network Integration API transport
 * (`/proxy/network/integration/v1`, `X-API-KEY` header, page envelopes,
 * ProblemDetails-style error bodies). The request engine itself (the API key
 * header, the fetch, the error parsing) lives in the per-instance auth closure
 * (`src/lib/auth-client.mjs`) — the API key never leaves it. This module is
 * the leaves' window onto that closure, plus the URL/paths and the list-page
 * walker.
 *
 * Shapes grounded in UniFi's published API reference and in independent
 * client implementations of the same surface (see each fixture's `_source`).
 */

/** The Integration API's maximum page size; larger values are silently clamped. */
export const PAGE_LIMIT = 200;

/**
 * Builds an official API path, path-escaping every id segment.
 * @param {...string} segments
 * @returns {string}
 */
export function officialPath(...segments) {
	const cleaned = segments.map((segment) => {
		const value = String(segment ?? "");
		if (value === "" || value.includes("/")) {
			throw new Error(`official path segment is empty or contains a slash: ${JSON.stringify(value)}`);
		}
		return encodeURIComponent(value);
	});
	return cleaned.length ? `/${cleaned.join("/")}` : "";
}

/**
 * The full URL for an official API call.
 * @param {string} path path under the Integration API root, e.g. "/info"
 * @param {Record<string, string|number>} [query]
 * @returns {string}
 */
export function officialUrl(path, query) {
	const config = context.unifi;
	const base = `${config.baseUrl}${config.officialBase}`;
	const qs = query
		? Object.entries(query)
				.filter(([, v]) => v !== undefined && v !== null)
				.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
				.join("&")
		: "";
	return qs ? `${base}${path}?${qs}` : `${base}${path}`;
}

/**
 * Makes one official API request through the instance's auth closure.
 *
 * @param {{ method?: string, path: string, query?: Record<string, string|number>, body?: object|null }} params
 * @returns {Promise<any>} parsed JSON, or null for an empty body
 * @throws {CapabilityError} when no API key was given ("OFFICIAL_NO_API_KEY")
 * @throws {ApiError} when the controller answers non-2xx
 * @throws {TransportError} when the fetch itself fails
 */
export async function officialRequest(params) {
	return context.unifi.official.request(params);
}

/**
 * Pages through an official list endpoint until every item has been fetched,
 * with the sanity checks that keep a partial page from being mistaken for a
 * complete listing (missing page fields, an empty page before totalCount,
 * a totalCount that drifts between pages, repeated ids).
 *
 * @param {string} path list endpoint path
 * @param {{ maxPages?: number, idOf?: (item: any) => string }} [options]
 *   `idOf` enables the repeated-id check; pass null to skip it.
 * @returns {Promise<any[]>} every item across the pages
 * @throws {ApiError} on any non-2xx page
 * @throws {TransportError} when a page is not a trustworthy listing
 */
export async function officialList(path, options = {}) {
	const { maxPages = 50, idOf = (item) => item?.id } = options;
	const items = [];
	const seen = new Set();
	let total = -1;

	for (let page = 0; page < maxPages; page++) {
		const offset = items.length;
		const body = await officialRequest({ method: "GET", path, query: { offset, limit: PAGE_LIMIT } });
		if (
			!body ||
			typeof body !== "object" ||
			!Array.isArray(body.data) ||
			typeof body.totalCount !== "number" ||
			typeof body.count !== "number"
		) {
			throw new TransportError("TRANSPORT_PAGE_INCOMPLETE", `list page at offset ${offset} of ${path} has no data/totalCount/count`);
		}
		if (total >= 0 && body.totalCount !== total) {
			throw new TransportError("TRANSPORT_PAGE_DRIFT", `totalCount changed from ${total} to ${body.totalCount} while paging ${path}`);
		}
		total = body.totalCount;
		if (body.count !== body.data.length) {
			throw new TransportError(
				"TRANSPORT_PAGE_INCOMPLETE",
				`page at offset ${offset} of ${path} reports count ${body.count} for ${body.data.length} items`
			);
		}
		if (body.data.length === 0 && offset < total) {
			throw new TransportError("TRANSPORT_PAGE_INCOMPLETE", `empty page at offset ${offset} of ${total} while paging ${path}`);
		}
		for (const item of body.data) {
			if (idOf) {
				const id = idOf(item);
				if (id === undefined || id === null || id === "") {
					throw new TransportError("TRANSPORT_PAGE_INCOMPLETE", `page at offset ${offset} of ${path} contains an item without an id`);
				}
				if (seen.has(id)) {
					throw new TransportError("TRANSPORT_PAGE_REPEAT", `page at offset ${offset} of ${path} repeats id ${id}`);
				}
				seen.add(id);
			}
			items.push(item);
		}
		if (items.length >= total) return items;
	}
	throw new TransportError("TRANSPORT_PAGE_DRIFT", `listing ${path} did not complete within ${maxPages} pages`);
}

/**
 * Reads the Integration API's application info (`GET /info`).
 * @returns {Promise<{ applicationVersion: string|null }>}
 */
export async function officialInfo() {
	const body = await officialRequest({ method: "GET", path: "/info" });
	return { applicationVersion: typeof body?.applicationVersion === "string" ? body.applicationVersion : null };
}

/**
 * Resolves the site reference (internalReference or id, case-insensitive) to
 * the site UUID the site-scoped official endpoints take.
 *
 * @param {string} [siteRef] defaults to the configured site
 * @returns {Promise<string>} the site UUID
 * @throws {ApiError} 404-shaped when no site matches
 */
export async function resolveOfficialSiteId(siteRef) {
	const config = context.unifi;
	const ref = siteRef || config.site;
	const sites = await officialList("/sites", { idOf: (s) => s?.id });
	const match = sites.find((s) => s?.id?.toLowerCase() === ref.toLowerCase() || s?.internalReference === ref);
	if (!match) {
		const available = sites
			.map((s) => s?.internalReference)
			.filter(Boolean)
			.join(", ");
		const error = new ApiError(404, null, `no site matching ${JSON.stringify(ref)} on the official API; have ${available || "(none)"}`);
		throw error;
	}
	return match.id;
}
