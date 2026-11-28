/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/lib/probe.mjs
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

import { context } from "@cldmv/slothlet/runtime";
import { clearAllSites, clearProbeCache, getProbeCache, setProbeCache, setSite, getSite } from "./session.mjs";
import { login } from "./auth/login.mjs";
import { legacyRequest } from "./transport/request.mjs";
import { officialInfo, officialRequest, resolveOfficialSiteId } from "./transport/official.mjs";
import { getSiteData } from "./sites.mjs";

/**
 * @fileoverview The capability probe — the port of unifi-cli's endpoint-type
 * detection (`lib/api/util/controller.mjs`) reshaped into the
 * `dns.forward: official | legacy | none` surface the plan's §4.2 consumes.
 *
 * Probing rules, in order of preference:
 *
 * 1. **Official Integration API** (needs `credentials.apiKey`): `GET /info`
 *    proves the surface; the site-scoped reads prove each capability
 *    (`/networks`, `/clients`, `/dns/policies`). Forward-domain forwarding is
 *    a `FORWARD_DOMAIN` type on the official `/dns/policies` collection, so a
 *    reachable policies endpoint classifies `dns.forward: "official"`.
 * 2. **Legacy controller API** (needs legacy credentials): login, then the
 *    endpoint-type detection from unifi-cli (`stat/sysinfo` version >= 7.4 ->
 *    `unifi_os_v2`, else `unifi_os_v1`; `stat/sites`; the Protect bootstrap;
 *    final fallback `legacy`), and the UDM/NVR probes on `/proxy/network/api`
 *    and `/proxy/protect/api`. `rest/networkconf` and `stat/sta` prove the
 *    networks/clients reads, `rest/user/{id}` the fixed-IP write. Static DNS
 *    records live on `v2/api/site/{site}/static-dns` (UniFi OS) or
 *    `api/s/{site}/rest/static-dns` (older) — a reachable static-dns
 *    collection classifies `dns.records: "legacy"`, and classifies
 *    `dns.forward: "legacy"` only when the Network application version is
 *    known to carry Forward Domain (>= 9), else `"none"`.
 * 3. **None**: neither surface answered, or no credentials were given.
 */

/** Parses "10.2.105" into a comparable major, or null. */
function majorOf(version) {
	const match = /^\s*(\d+)/.exec(String(version ?? ""));
	return match ? Number(match[1]) : null;
}

/**
 * True when a legacy GET answered 2xx with a body. A dedicated helper so each
 * capability read reads as one line.
 */
async function legacyProbe(endpoint, siteKey) {
	try {
		const body = await legacyRequest({ endpoint, method: "GET", siteKey, relogin: false });
		return body !== null && body !== undefined;
	} catch {
		return false;
	}
}

/**
 * True when an official site-scoped GET answered 2xx.
 */
async function officialProbe(relativePath, siteId) {
	try {
		await officialRequest({
			method: "GET",
			path: `/sites/${encodeURIComponent(siteId)}/${relativePath.replace(/^\/+/, "")}`,
			query: { offset: 0, limit: 1 }
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * One legacy detection check (unifi-cli's `tryCheck` shape): fetch a URL with
 * the session's cookies, pick a data object, resolve the endpoint version.
 * Returns { data } on success, null on failure.
 */
async function legacyCheck(siteData, url) {
	const state = getSite(siteData.site);
	try {
		const res = await siteData.fetch(url, {
			headers: {
				...(state.cookies ? { "Cookie": state.cookies } : {}),
				...(state.csrfToken ? { "X-Csrf-Token": state.csrfToken } : {})
			}
		});
		if (!res.ok) return null;
		const body = await res.json();
		return { data: body?.data?.[0] ?? null, body };
	} catch {
		return null;
	}
}

/**
 * The legacy half of the probe: login, detect the endpoint type (unifi-cli's
 * detection chain: sysinfo -> sites -> protect bootstrap -> legacy fallback),
 * and classify the legacy capabilities.
 * @param {string} siteKey
 * @returns {Promise<{ legacy: object, version: string|null, updateAvailable: boolean|null, endpointVersion: string }|null>}
 *   null when the login fails.
 */
async function probeLegacy(siteKey) {
	try {
		await login(siteKey);
	} catch (err) {
		// The probe classifies; it does not raise. The failure reason rides the
		// report so callers can tell a refused login from an unreachable one.
		return { authError: { code: err?.code ?? "AUTH_LOGIN_FAILED", message: err?.message ?? String(err), attempts: err?.attempts ?? null } };
	}

	const siteData = getSiteData(siteKey);
	const prefix = siteData.api.prefix;
	const base = `${siteData.host_url.replace(/\/+$/, "")}${prefix.replace(/\/+$/, "")}`;
	const site = siteData.site;

	let version = null;
	let updateAvailable = null;
	let hostname = null;
	let name = null;
	let deviceType = null;
	let endpointVersion = "legacy";

	// 1. stat/sysinfo: version >= 7.4 -> unifi_os_v2, else unifi_os_v1.
	const sysinfo = await legacyCheck(siteData, `${base}/api/s/${site}/stat/sysinfo`);
	if (sysinfo?.data) {
		version = sysinfo.data.version ?? sysinfo.data.server_version ?? null;
		updateAvailable = typeof sysinfo.data.update_available === "boolean" ? sysinfo.data.update_available : null;
		hostname = sysinfo.data.hostname ?? null;
		name = sysinfo.data.name ?? null;
		deviceType = sysinfo.data.ubnt_device_type ?? sysinfo.data.device_type ?? null;
		const major = majorOf(version);
		endpointVersion = major !== null && major >= 7.4 ? "unifi_os_v2" : "unifi_os_v1";
	}

	// 2. stat/sites (keeps unifi-cli's original assumption: unifi_os_v2).
	if (version === null) {
		const sites = await legacyCheck(siteData, `${base}/api/stat/sites`);
		if (sites?.data) {
			version = sites.data.version ?? sites.data.server_version ?? null;
			endpointVersion = "unifi_os_v2";
		}
	}

	// 3. The Protect bootstrap -> a Protect NVR, not a Network controller. The
	// NVR object lives under .nvr (not under data[0]), per unifi-cli's
	// tryProtectBootstrap pick.
	if (version === null) {
		const bootstrap = await legacyCheck(siteData, `${base}/api/bootstrap`);
		if (bootstrap?.body?.nvr) {
			version = bootstrap.body.nvr.version ?? null;
			deviceType = "nvr";
			endpointVersion = "unifi_os_v2";
		}
	}
	// 4. Nothing answered: unifi-cli's final fallback — legacy endpoints, no version.

	setSite(siteKey, { endpointType: "network", endpointVersion, version, hostname, name, deviceType });

	// --- UDM/NVR probes (unifi-cli's util.controller.detectDeviceType) ---
	let detectedType = "unknown";
	try {
		const networkRes = await siteData.fetch(`${siteData.host_url.replace(/\/$/, "")}/proxy/network/api`);
		const text = await networkRes.text();
		if (networkRes.ok || typeof text !== "string" || text.includes("Cannot GET /api")) detectedType = "udm";
	} catch {
		/* not a UDM */
	}
	if (detectedType !== "udm") {
		try {
			const protectRes = await siteData.fetch(`${siteData.host_url.replace(/\/$/, "")}/proxy/protect/api`);
			const text = await protectRes.text();
			if (protectRes.ok || (typeof text === "string" && text.includes("Cannot GET /api"))) detectedType = "nvr";
		} catch {
			/* not an NVR */
		}
	}
	if (detectedType !== "unknown") setSite(siteKey, { deviceType: detectedType });

	// --- legacy capability reads ---
	const staticDnsReachable = await legacyProbe("static_dns_list", siteKey);
	return {
		endpointVersion,
		version,
		updateAvailable,
		legacy: {
			networks: await legacyProbe("network_config", siteKey),
			clients: await legacyProbe("client_list", siteKey),
			// The fixed-IP write (PUT rest/user/{id}) exists whenever the legacy
			// session works; it cannot be probed read-only.
			fixedIp: true,
			dns: {
				records: staticDnsReachable,
				// Forward Domain needs a 9.x Network application (plan §1); when the
				// version is unreadable the probe refuses to claim it.
				forward: staticDnsReachable && (majorOf(version) ?? 0) >= 9
			}
		}
	};
}

/**
 * Runs the full capability probe. Cached per instance;
 * `api.capabilities({ refresh: true })` re-runs it.
 * @param {{ refresh?: boolean }} [options]
 * @returns {Promise<object>} the capability report
 */
export async function runProbe(options = {}) {
	if (!options.refresh) {
		const cached = getProbeCache();
		if (cached) return cached;
	}
	const config = context.unifi;
	const siteKey = config.site;
	const result = {
		networks: "none",
		clients: "none",
		fixedIp: "none",
		dns: { records: "none", forward: "none" },
		version: null,
		applicationVersion: null,
		updateAvailable: null,
		site: null,
		endpointVersion: null,
		authError: null
	};

	if (config.credentials.apiKey) {
		try {
			const info = await officialInfo();
			result.applicationVersion = info.applicationVersion;
			const siteId = await resolveOfficialSiteId(siteKey);
			result.site = siteId;
			const [networksOk, clientsOk, policiesOk] = await Promise.all([
				officialProbe("networks", siteId),
				officialProbe("clients", siteId),
				officialProbe("dns/policies", siteId)
			]);
			result.networks = networksOk ? "official" : "none";
			result.clients = clientsOk ? "official" : "none";
			result.dns.records = policiesOk ? "official" : "none";
			result.dns.forward = policiesOk ? "official" : "none";
			if (info.applicationVersion) result.version = info.applicationVersion;
		} catch {
			// The official surface answered nothing usable — fall through to legacy.
		}
	}

	if (
		config.credentials.legacy?.username &&
		config.credentials.legacy.password !== null &&
		config.credentials.legacy.password !== undefined
	) {
		// The legacy probe logs in; clear any half-written session state first so
		// the login result is the only thing in the session.
		clearAllSites();
		const probed = await probeLegacy(siteKey);
		if (probed?.authError) {
			result.authError = probed.authError;
		}
		if (probed && !probed.authError) {
			result.endpointVersion = probed.endpointVersion;
			if (result.networks === "none" && probed.legacy.networks) result.networks = "legacy";
			if (result.clients === "none" && probed.legacy.clients) result.clients = "legacy";
			if (result.fixedIp === "none" && probed.legacy.fixedIp) result.fixedIp = "legacy";
			if (result.dns.records === "none" && probed.legacy.dns.records) result.dns.records = "legacy";
			if (result.dns.forward === "none" && probed.legacy.dns.forward) result.dns.forward = "legacy";
			if (result.version === null && probed.version) result.version = probed.version;
			if (result.updateAvailable === null && probed.updateAvailable !== null) result.updateAvailable = probed.updateAvailable;
		}
	}

	setProbeCache(result);
	return result;
}
