/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/crud.mjs
 *	@Date: 2026-11-28T04:42:29-08:00 (1795869749)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:06-08:00 (1795870566)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";
import { CapabilityError, ValidationError } from "./errors.mjs";
import { officialList, officialRequest, officialUrl, resolveOfficialSiteId } from "./transport/official.mjs";
import { legacyRequest, legacyUrl, envelopeData } from "./transport/request.mjs";

/**
 * @fileoverview The shared collection operations behind the thin leaves. Every
 * write takes `{ dryRun: true }` and answers
 * `{ dryRun: true, capability, request: { method, url, body } }` without
 * sending anything; dry-run answers never carry credentials (the request's
 * headers are not included). Reads page through the official list envelope
 * (`officialList`) or answer the legacy `data` array (`legacyRead`).
 *
 * Capability gates: an official-only leaf needs the probed official surface
 * (`capabilities().official === true`); a legacy-only leaf needs the probed
 * legacy session (`capabilities().endpointVersion !== null`). Dual-path leaves
 * resolve per capability in the leaf itself.
 */

/**
 * The probed capability report.
 * @returns {Promise<object>}
 */
async function caps() {
	return self.capabilities();
}

/**
 * The official-surface gate: the probed report must say the official surface
 * is usable.
 * @param {string} capability leaf capability name, e.g. "firewall.policies"
 * @param {object} [report] a cached capability report (skips the probe)
 * @returns {Promise<object>} the capability report
 */
export async function officialGate(capability, report) {
	const report_ = report ?? (await caps());
	if (report_.official !== true) {
		throw new CapabilityError(
			"CAPABILITY_UNAVAILABLE",
			`the ${capability} surface is official-Integration-API only and the official path is unavailable (no API key, or the controller refused it)`,
			{
				capability,
				hint: report_.officialError
					? `the official probe failed: ${report_.officialError.message}`
					: "give createUnifi an apiKey the controller accepts"
			}
		);
	}
	return report_;
}

/**
 * Resolves the official site id, throwing CapabilityError when the official
 * surface is not usable.
 * @param {string} capability
 * @param {object} [report] a cached capability report (skips the probe)
 * @returns {Promise<string>} the site UUID
 */
export async function officialSiteId(capability, report) {
	const report_ = await officialGate(capability, report);
	return report_.site ?? (await resolveOfficialSiteId());
}

/**
 * A legacy surface gate: the probe must have logged in (endpointVersion set).
 * @param {string} capability
 * @param {object} [report]
 * @returns {Promise<object>} the capability report
 */
export async function requireLegacy(capability, report) {
	const report_ = report ?? (await caps());
	if (report_.endpointVersion === null) {
		throw new CapabilityError(
			"CAPABILITY_UNAVAILABLE",
			`the ${capability} surface is legacy-controller-API only and the legacy path is unavailable (no legacy credentials, or the login was refused)`,
			{
				capability,
				hint: report_.authError ? `the legacy login failed: ${report_.authError.message}` : "pass credentials.legacy to createUnifi"
			}
		);
	}
	return report_;
}

/**
 * The official path for a site-scoped collection, path-escaped —
 * `/sites/{siteId}/<relative>`, the shape every site-scoped Integration API
 * endpoint carries.
 * @param {string} siteId
 * @param {string} relative e.g. "firewall/policies" or "firewall/policies/{id}"
 * @param {Record<string,string>} [vars] {id} substitutions
 * @returns {string}
 */
function siteScopedPath(siteId, relative, vars = {}) {
	const segments = ["sites", siteId, ...relative.split("/")].map((segment) => {
		if (/^\{.+\}$/.test(segment)) {
			const key = segment.slice(1, -1);
			const substituted = vars[key];
			if (substituted === undefined || substituted === null || String(substituted).includes("/")) {
				throw new ValidationError("VALIDATION_ID_REQUIRED", `the ${key} path segment is required`);
			}
			return encodeURIComponent(String(substituted));
		}
		return segment;
	});
	return `/${segments.join("/")}`;
}

/**
 * Lists an official collection (all pages) — site-scoped by default, or one of
 * the application-level collections (`/dpi/applications`, `/countries`,
 * `/pending-devices`) with `topLevel: true`.
 * @param {string} capability
 * @param {string} relative site-scoped path under /sites/{siteId}/, or the top-level path
 * @param {{ idOf?: (item: any) => string|null, topLevel?: boolean }} [options]
 * @returns {Promise<any[]>}
 */
export async function officialRead(capability, relative, options = {}) {
	if (options.topLevel) {
		await officialGate(capability);
		return officialList(`/${relative.replace(/^\/+/, "")}`, { idOf: options.idOf ?? ((item) => item?.id) });
	}
	const siteId = await officialSiteId(capability);
	return officialList(siteScopedPath(siteId, relative), { idOf: options.idOf ?? ((item) => item?.id) });
}

/**
 * Reads one site-scoped official resource.
 * @param {string} capability
 * @param {string} relative
 * @param {Record<string,string>} vars {id} substitutions
 * @returns {Promise<any>}
 */
export async function officialGet(capability, relative, vars = {}) {
	const siteId = await officialSiteId(capability);
	return officialRequest({ method: "GET", path: siteScopedPath(siteId, relative, vars) });
}

/**
 * Writes one site-scoped official resource (POST/PUT/PATCH/DELETE), honoring
 * `dryRun` — the dry-run answer describes the request and sends nothing.
 *
 * @param {string} capability
 * @param {{ method: "POST"|"PUT"|"PATCH"|"DELETE", relative: string, vars?: Record<string,string>,
 *           body?: object|null, siteId?: string }} plan
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object|any>} the dry-run description, or `{ ok: true, capability, response }`
 */
export async function officialWrite(capability, plan, options = {}) {
	const { method, relative, vars = {}, body = null } = plan;
	const siteId = plan.siteId ?? (await officialSiteId(capability));
	const path = siteScopedPath(siteId, relative, vars);
	const url = officialUrl(path);
	if (options.dryRun) {
		return { dryRun: true, capability: "official", request: { method, url, body } };
	}
	const response = await officialRequest({ method, path, body });
	return { ok: true, capability: "official", response };
}

/**
 * Reads a legacy collection through its endpoint table key.
 * @param {string} capability
 * @param {string} endpoint endpoint key, e.g. "radius_list"
 * @param {{ variables?: Record<string,string>, endpointType?: string, endpointVersion?: string }} [options]
 * @returns {Promise<any[]>} the data rows
 */
export async function legacyRead(capability, endpoint, options = {}) {
	await requireLegacy(capability);
	const body = await legacyRequest({
		endpoint,
		method: "GET",
		variables: options.variables,
		endpointType: options.endpointType,
		endpointVersion: options.endpointVersion
	});
	return Array.isArray(body) ? body : envelopeData(body);
}

/**
 * Writes a legacy endpoint (POST/PUT/DELETE through the endpoint table),
 * honoring `dryRun`.
 *
 * @param {string} capability
 * @param {{ endpoint: string, method: "POST"|"PUT"|"DELETE", data?: object|any[]|null,
 *           variables?: Record<string,string>, endpointType?: string, endpointVersion?: string }} plan
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} the dry-run description, or
 *   `{ ok, capability: "legacy", response }` (`ok` reads the legacy `meta.rc`)
 */
export async function legacyWrite(capability, plan, options = {}) {
	await requireLegacy(capability);
	const { endpoint, method, data = null, variables = {}, endpointType, endpointVersion } = plan;
	const url = legacyUrl(endpoint, variables, { endpointType, endpointVersion });
	if (options.dryRun) {
		return { dryRun: true, capability: "legacy", request: { method, url, body: data } };
	}
	const response = await legacyRequest({ endpoint, method, data, variables, endpointType, endpointVersion });
	const ok = response?.meta?.rc ? response.meta.rc === "ok" : true;
	return { ok, capability: "legacy", response };
}
