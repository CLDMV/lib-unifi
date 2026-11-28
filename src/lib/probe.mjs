/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/probe.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:07-08:00 (1795870567)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { context } from "@cldmv/slothlet/runtime";
import { getProbeCache, setProbeCache } from "./session.mjs";
import { legacyRequest } from "./transport/request.mjs";
import { officialInfo, officialRequest, resolveOfficialSiteId } from "./transport/official.mjs";

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

/**
 * Parses a controller version into a comparable number the way unifi-cli does
 * (`parseFloat(version)`): "7.4.187" -> 7.4, "9.0.180" -> 9, null -> NaN. The
 * major-only parse was a regression — 7.4-7.x are UniFi OS builds and must
 * classify `unifi_os_v2`.
 * @param {string|null} version
 * @returns {number} NaN when the version is unreadable
 */
function versionNumber(version) {
	return Number.parseFloat(String(version ?? ""));
}

/**
 * unifi-cli's endpoint-version rule: Network 7.4 and later run UniFi OS.
 * @param {string|null} version
 * @returns {"unifi_os_v2"|"unifi_os_v1"}
 */
export function classifyEndpointVersion(version) {
	return versionNumber(version) >= 7.4 ? "unifi_os_v2" : "unifi_os_v1";
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
 * the session's headers, pick a data object, resolve the endpoint version.
 * Returns { data } on success, null on failure.
 */
async function legacyCheck(url) {
	return context.unifi.legacy.check(url);
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
	const legacy = context.unifi.legacy;
	try {
		await legacy.login(siteKey);
	} catch (err) {
		// The probe classifies; it does not raise. The failure reason rides the
		// report so callers can tell a refused login from an unreachable one.
		return { authError: { code: err?.code ?? "AUTH_LOGIN_FAILED", message: err?.message ?? String(err), attempts: err?.attempts ?? null } };
	}

	const meta = legacy.meta(siteKey);
	const prefix = meta.prefix;
	const base = `${(meta.hostUrl ?? context.unifi.baseUrl).replace(/\/+$/, "")}${prefix.replace(/\/+$/, "")}`;
	const site = siteKey;

	let version = null;
	let updateAvailable = null;
	let hostname = null;
	let name = null;
	let deviceType = null;
	let endpointVersion = "legacy";

	// 1. stat/sysinfo: version >= 7.4 -> unifi_os_v2, else unifi_os_v1.
	const sysinfo = await legacyCheck(`${base}/api/s/${site}/stat/sysinfo`);
	if (sysinfo?.data) {
		version = sysinfo.data.version ?? sysinfo.data.server_version ?? null;
		updateAvailable = typeof sysinfo.data.update_available === "boolean" ? sysinfo.data.update_available : null;
		hostname = sysinfo.data.hostname ?? null;
		name = sysinfo.data.name ?? null;
		deviceType = sysinfo.data.ubnt_device_type ?? sysinfo.data.device_type ?? null;
		endpointVersion = classifyEndpointVersion(version);
	}

	// 2. stat/sites (keeps unifi-cli's original assumption: unifi_os_v2).
	if (version === null) {
		const sites = await legacyCheck(`${base}/api/stat/sites`);
		if (sites?.data) {
			version = sites.data.version ?? sites.data.server_version ?? null;
			endpointVersion = "unifi_os_v2";
		}
	}

	// 3. The Protect bootstrap -> a Protect NVR, not a Network controller. The
	// NVR object lives under .nvr (not under data[0]), per unifi-cli's
	// tryProtectBootstrap pick.
	if (version === null) {
		const bootstrap = await legacyCheck(`${base}/api/bootstrap`);
		if (bootstrap?.body?.nvr) {
			version = bootstrap.body.nvr.version ?? null;
			deviceType = "nvr";
			endpointVersion = "unifi_os_v2";
		}
	}
	// 4. Nothing answered: unifi-cli's final fallback — legacy endpoints, no version.

	legacy.setMeta(siteKey, { endpointType: "network", endpointVersion, version, hostname, name, deviceType });

	// --- UDM/NVR probes (unifi-cli's util.controller.detectDeviceType) ---
	const config = context.unifi;
	const hostUrl = (meta.hostUrl ?? config.baseUrl).replace(/\/$/, "");
	let detectedType = "unknown";
	try {
		const networkRes = await config.fetch(`${hostUrl}/proxy/network/api`, {
			signal: AbortSignal.timeout(config.timeoutMs)
		});
		const text = await networkRes.text();
		if (networkRes.ok || text.includes("Cannot GET /api")) detectedType = "udm";
	} catch {
		/* not a UDM */
	}
	if (detectedType !== "udm") {
		try {
			const protectRes = await config.fetch(`${hostUrl}/proxy/protect/api`, {
				signal: AbortSignal.timeout(config.timeoutMs)
			});
			const text = await protectRes.text();
			if (protectRes.ok || text.includes("Cannot GET /api")) detectedType = "nvr";
		} catch {
			/* not an NVR */
		}
	}
	if (detectedType !== "unknown") legacy.setMeta(siteKey, { deviceType: detectedType });

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
				forward: staticDnsReachable && versionNumber(version) >= 9
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
		devices: "none",
		fixedIp: "none",
		dns: { records: "none", forward: "none" },
		version: null,
		applicationVersion: null,
		updateAvailable: null,
		site: null,
		// Whether the official Integration API surface is usable at all (the
		// application info and the site list answered with the given API key).
		official: false,
		endpointVersion: null,
		// Legacy auth failure (both login attempts refused).
		authError: null,
		// Official surface failure (the API key refused, or the info/site list
		// unreachable) — so a silently-degraded all-legacy instance is visible.
		officialError: null,
		// TLS pinning is the caller's fetch's business; the report only says how
		// many pins were configured (the values are never stored or reported).
		tls: { spkiPins: config.tls.spkiPins }
	};

	if (config.hasApiKey) {
		try {
			const info = await officialInfo();
			result.applicationVersion = info.applicationVersion;
			const siteId = await resolveOfficialSiteId(siteKey);
			result.site = siteId;
			result.official = true;
			const [networksOk, clientsOk, policiesOk, devicesOk] = await Promise.all([
				officialProbe("networks", siteId),
				officialProbe("clients", siteId),
				officialProbe("dns/policies", siteId),
				officialProbe("devices", siteId)
			]);
			result.networks = networksOk ? "official" : "none";
			result.clients = clientsOk ? "official" : "none";
			result.devices = devicesOk ? "official" : "none";
			result.dns.records = policiesOk ? "official" : "none";
			result.dns.forward = policiesOk ? "official" : "none";
			if (info.applicationVersion) result.version = info.applicationVersion;
		} catch (err) {
			// The official surface answered nothing usable — fall through to
			// legacy, but say why: a refused key with working legacy credentials
			// degrades silently otherwise.
			result.officialError = {
				code: err?.status === 401 ? "OFFICIAL_UNAUTHORIZED" : err?.code === "OFFICIAL_NO_API_KEY" ? err.code : "OFFICIAL_UNREACHABLE",
				message: err?.message ?? String(err)
			};
		}
	}

	if (config.hasLegacy) {
		// The legacy probe logs in; clear any half-written session state first so
		// the login result is the only thing in the session.
		context.unifi.legacy.clearAll();
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
