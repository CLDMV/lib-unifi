/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/lib/normalize/dns-record.mjs
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
 * @fileoverview DNS record normalizers and request builders for the two API
 * paths.
 *
 * The official surface is the Integration API's `/dns/policies` collection,
 * polymorphic on `type`: `A_RECORD`, `AAAA_RECORD`, `CNAME_RECORD`,
 * `MX_RECORD`, `TXT_RECORD`, `SRV_RECORD`, `FORWARD_DOMAIN`. The legacy
 * surface is the static-DNS collection (`v2/api/site/{site}/static-dns` on
 * UniFi OS, `api/s/{site}/rest/static-dns` on older controllers) with rows
 * `{ _id, enabled, key, record_type, value }`.
 *
 * Both normalize onto `record { id, type, enabled, domain, ttl, data, origin }`.
 */

/** Official policy types. */
export const OFFICIAL_TYPES = ["A_RECORD", "AAAA_RECORD", "CNAME_RECORD", "MX_RECORD", "TXT_RECORD", "SRV_RECORD", "FORWARD_DOMAIN"];

/** The official type discriminator for a Forward Domain policy. */
export const FORWARD_DOMAIN_TYPE = "FORWARD_DOMAIN";

/** The legacy static-DNS record type spelling for a forward rule. */
export const LEGACY_FORWARD_TYPE = "forward";

/**
 * Normalizes one official DNS policy.
 * @param {object} policy
 * @returns {object|null}
 */
export function officialPolicyFromRow(policy) {
	if (!policy || typeof policy !== "object" || typeof policy.type !== "string") return null;
	const data = {};
	switch (policy.type) {
		case "A_RECORD":
			data.ipv4Address = policy.ipv4Address ?? null;
			break;
		case "AAAA_RECORD":
			data.ipv6Address = policy.ipv6Address ?? null;
			break;
		case "CNAME_RECORD":
			data.targetDomain = policy.targetDomain ?? null;
			break;
		case "MX_RECORD":
			data.mailServerDomain = policy.mailServerDomain ?? null;
			data.priority = policy.priority ?? null;
			break;
		case "TXT_RECORD":
			data.text = policy.text ?? null;
			break;
		case "SRV_RECORD":
			data.service = policy.service ?? null;
			data.protocol = policy.protocol ?? null;
			data.serverDomain = policy.serverDomain ?? null;
			data.port = policy.port ?? null;
			data.priority = policy.priority ?? null;
			data.weight = policy.weight ?? null;
			break;
		case "FORWARD_DOMAIN":
			data.ipAddress = policy.ipAddress ?? null;
			break;
		default:
			Object.assign(data, policy);
			delete data.id;
			delete data.type;
			delete data.enabled;
			delete data.domain;
			delete data.ttlSeconds;
			delete data.metadata;
	}
	return {
		id: policy.id ?? null,
		type: policy.type,
		enabled: policy.enabled === true,
		domain: policy.domain ?? null,
		ttl: Number.isFinite(policy.ttlSeconds) ? policy.ttlSeconds : null,
		data,
		origin: policy.metadata?.origin ?? null
	};
}

/**
 * Normalizes one legacy static-DNS row.
 * @param {object} row
 * @returns {object|null}
 */
export function legacyStaticDnsFromRow(row) {
	if (!row || typeof row !== "object") return null;
	return {
		id: row._id ?? null,
		type: row.record_type ?? null,
		enabled: row.enabled === true,
		domain: row.key ?? null,
		ttl: Number.isFinite(row.ttl) ? row.ttl : null,
		data: { value: row.value ?? null },
		origin: null
	};
}

/**
 * Builds the official POST/PUT body for a Forward Domain policy.
 * @param {{ domain: string, target: string, enabled?: boolean }} forward
 * @returns {object}
 */
export function officialForwardPolicyBody(forward) {
	return {
		type: FORWARD_DOMAIN_TYPE,
		enabled: forward.enabled !== false,
		domain: String(forward.domain).trim().replace(/\.$/, "").toLowerCase(),
		ipAddress: String(forward.target).trim()
	};
}

/**
 * Builds the legacy static-DNS body for a forward rule.
 * @param {{ domain: string, target: string, enabled?: boolean }} forward
 * @returns {object}
 */
export function legacyForwardBody(forward) {
	return {
		enabled: forward.enabled !== false,
		key: String(forward.domain).trim().replace(/\.$/, "").toLowerCase(),
		record_type: LEGACY_FORWARD_TYPE,
		value: String(forward.target).trim()
	};
}

/**
 * True when a domain string is a plain domain name (no scheme, no slash, at
 * least one dot-separated label). Reverse zones like `1.0.10.in-addr.arpa` are
 * domains like any other and pass.
 * @param {string} domain
 * @returns {boolean}
 */
export function isDomainName(domain) {
	if (typeof domain !== "string") return false;
	const value = domain.trim().replace(/\.$/, "").toLowerCase();
	if (value === "" || value.length > 253) return false;
	return value.split(".").every((label) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

/**
 * True when a target is an IP literal (IPv4 or IPv6) — the address the
 * gateway forwards the domain's queries to.
 * @param {string} target
 * @returns {boolean}
 */
export function isIpLiteral(target) {
	if (typeof target !== "string") return false;
	const value = target.trim();
	if (isIpv4Literal(value)) return true;
	// A loose IPv6 check: hex groups and colons, optionally zone-free, with at
	// least two colons or the :: shorthand. Full validation happens in the
	// URL/addr parser below when the request is built.
	if (!/^[0-9a-f:]+$/i.test(value)) return false;
	const groups = value.split(":");
	if (groups.length < 3) return false;
	return value.includes("::") || groups.length === 8;
}

function isIpv4Literal(value) {
	const octets = value.split(".");
	if (octets.length !== 4) return false;
	return octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255);
}
