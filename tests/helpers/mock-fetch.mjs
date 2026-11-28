/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/helpers/mock-fetch.mjs
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
 * @fileoverview The recorded-fixture harness — the port of unifi-cli's
 * `lib/api/cache/cache.mjs` request/replay pattern. The library takes its
 * `fetch` from the factory, so a test hands in a mock that routes by method
 * and path to recorded fixture responses and records every call. There is no
 * runtime cache in the library and no capture store: fixtures are hand-written
 * (see each fixture's `_source`), never captured from a live controller.
 *
 * Every fixture value in tests/fixtures/ uses documentation addresses
 * (RFC 5737: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) and documentation
 * MACs (00:00:5e:00:53:xx).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

/**
 * Loads a fixture JSON file.
 * @param {string} name path under tests/fixtures/, without ".json"
 * @returns {any}
 */
export function fixture(name) {
	return JSON.parse(readFileSync(path.join(fixturesDir, `${name}.json`), "utf8"));
}

/**
 * Builds a mock fetch. Routes are matched in order; the first route whose
 * method and path match (and whose optional `match` predicate passes) serves
 * the response. `calls` records every request the library made, so tests can
 * assert what was sent — and that a dry run sent nothing.
 *
 * @param {Array<{
 *   method?: string,
 *   path: string|RegExp,
 *   status?: number,
 *   headers?: Record<string, string>,
 *   setCookie?: string[],
 *   body?: any,
 *   match?: (context: { url: URL, init: object }) => boolean,
 * }>} routes
 * @returns {typeof fetch & { calls: object[] }}
 */
export function createMockFetch(routes) {
	/** @type {object[]} */
	const calls = [];
	/** @type {any} */
	const mock = async (url, init = {}) => {
		const method = (init.method ?? "GET").toUpperCase();
		const parsed = new URL(String(url));
		calls.push({
			url: parsed.toString(),
			pathname: parsed.pathname,
			method,
			headers: init.headers ?? {},
			body: init.body ?? null,
			index: calls.length
		});
		for (const route of routes) {
			if (route.method && route.method.toUpperCase() !== method) continue;
			const pathMatches = typeof route.path === "string" ? parsed.pathname === route.path : route.path.test(parsed.pathname);
			if (!pathMatches) continue;
			if (route.match && !route.match({ url: parsed, init, method })) continue;
			const headers = new Headers(route.headers ?? {});
			for (const cookie of route.setCookie ?? []) headers.append("set-cookie", cookie);
			// `_source` is fixture provenance for the reader, not controller data.
			const body = route.body !== null && typeof route.body === "object" && !Array.isArray(route.body) ? { ...route.body } : route.body;
			if (body && typeof body === "object" && !Array.isArray(body)) delete body._source;
			const raw = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
			return new Response(raw, { status: route.status ?? 200, headers });
		}
		return new Response(
			JSON.stringify({
				statusCode: 404,
				statusName: "NOT_FOUND",
				code: "api.not-found",
				message: `no mock route matched ${method} ${parsed.pathname}`
			}),
			{ status: 404, headers: { "Content-Type": "application/json" } }
		);
	};
	mock.calls = calls;
	return mock;
}

/** A default documentation controller origin for fixtures. */
export const CONTROLLER = "https://192.0.2.1";

/** The official Integration API root path on a UniFi OS console. */
export const OFFICIAL_ROOT = "/proxy/network/integration/v1";

/** The site UUID the fixture official API reports for the "default" site. */
export const SITE_ID = "d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c";

/** Fixture resource ids (patterned documentation UUIDs, one per fixture row). */
export const DEVICE_ID = "b1a2b3c4-d5e6-4f7a-8b9c-1a2b3c4d5e6f";
export const CLIENT_DETAIL_ID = "a1b2c3d4-1111-4222-8333-444455556666";
export const WLAN_ID = "c8d9e0f1-a2b3-4c4d-5e6f-8a9b0c1d2e3f";
export const POLICY_ID = "f5e6f7a8-b9c0-4d1e-2f3a-5e6f7a8b9c0d";
export const ZONE_ID = "a1b2c3d4-0000-4000-8000-000000000001";
export const ACL_ID = "a6b7c8d9-e0f1-4a2b-3c4d-6f7a8b9c0d1e";
export const MATCHING_ID = "b7c8d9e0-f1a2-4b3c-4d5e-7a8b9c0d1e2f";
export const VOUCHER_ID = "a2b3c4d5-e6f7-4a8b-9c0d-2e3f4a5b6c7d";
export const LAG_ID = "b3c4d5e6-f7a8-4b9c-0d1e-3f4a5b6c7d8e";
export const STACK_ID = "c4d5e6f7-a8b9-4c0d-1e2f-4a5b6c7d8e9f";
export const MCLAG_ID = "d5e6f7a8-b9c0-4d1e-2f3a-5b6c7d8e9f0a";
export const VPN_SERVER_ID = "e0f1a2b3-c4d5-4e6f-7a8b-0c1d2e3f4a5b";
export const TUNNEL_ID = "f1a2b3c4-d5e6-4f7a-8b9c-1d2e3f4a5b6c";

/** Standard legacy UniFi OS paths. */
export const LEGACY_ROOT = "/proxy/network/api";
export const LEGACY_LOGIN = "/api/auth/login";
export const LEGACY_LOGIN_FALLBACK = "/api/login";
