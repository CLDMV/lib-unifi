/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/helpers/scrub.mjs
 *	@Date: 2026-11-28T04:52:37-08:00 (1795870357)
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
 * @fileoverview The recorder's scrubber (PLAN §6.2, "Fixtures"). Everything the
 * fixture recorder writes goes through `scrub()`: MAC addresses, IPv4
 * addresses, UUID and 24-hex ids, tokens/cookies/secrets, and the name-bearing
 * string fields (hostnames, site/device/client names, domains, users) are
 * replaced with documentation-range stand-ins (RFC 5737 addresses,
 * 00:00:5e:00:53:xx MACs, patterned ids, example.com names). Replacement is
 * consistent within one run — the same source value always maps to the same
 * stand-in, so a fixture keeps its internal references.
 *
 * The scrubber is a pure function with no I/O; tests/recorder.test.vitest.mjs
 * asserts its behaviour on synthetic input.
 */

/** Keys whose string values carry names/labels worth scrubbing (substring match). */
const NAME_KEYS = /(name|hostname|user|email|comment|note|ssid|location|desc|domain|key)/i;

/** Keys whose string values are tokens or secrets (substring match). */
const SECRET_KEYS = /(token|cookie|csrf|secret|password|passwd|api[-_]?key|authorization|session)/i;

/** Documentation MAC prefix (00:00:5e:00:53:xx — RFC 7042's documentation range). */
const DOC_MAC_PREFIX = "00:00:5e:00:53:";

/** The RFC 5737 documentation IPv4 blocks, cycled through as sources run out. */
const DOC_IP_BLOCKS = [
	[192, 0, 2],
	[198, 51, 100],
	[203, 0, 113]
];

const MAC_PATTERN = /\b([0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/gi;
const IPV4_PATTERN = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const HEX24_PATTERN = /\b[0-9a-f]{24}\b/gi;
/** A domain-ish label run that is not already an RFC 2606 name. */
const DOMAIN_PATTERN = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?!com|net|org|test|example|invalid|localhost\b)[a-z]{2,}\b/gi;

/**
 * Builds one scrubbing run's replacement tables. The tables map each source
 * value to its stand-in so the same value scrubs the same way everywhere.
 * @returns {internal scrub state}
 */
export function createScrubber() {
	const macs = new Map();
	const ips = new Map();
	const uuids = new Map();
	const hexIds = new Map();
	const domains = new Map();
	let macIndex = 0;
	let ipIndex = 0;
	let uuidIndex = 0;
	let hexIndex = 0;
	let domainIndex = 0;

	const docMac = () => `${DOC_MAC_PREFIX}${(macIndex++ % 100).toString(16).padStart(2, "0")}`;
	const docIp = () => {
		const [a, b, c] = DOC_IP_BLOCKS[Math.floor(ipIndex / 254) % DOC_IP_BLOCKS.length];
		const host = (ipIndex++ % 254) + 1;
		return `${a}.${b}.${c}.${host}`;
	};
	const docUuid = () => {
		// Patterned, not random: u<index>-shaped uuid with fixed documentation nibbles.
		const hex = (uuidIndex++).toString(16).padStart(12, "0");
		return `u1a2b3c4${hex.slice(0, 1)}-d5e6-4f7a-8b9c-${hex.slice(0, 12).padEnd(12, "0")}`;
	};
	const docHex24 = () => `1a2b3c4d5e6f7a8b${(hexIndex++).toString(16).padStart(8, "0")}`.slice(0, 24);
	const docDomain = () => `record-${domainIndex++}.example.com`;

	return {
		mac(value) {
			if (!macs.has(value)) macs.set(value, docMac());
			return macs.get(value);
		},
		ip(value) {
			if (!ips.has(value)) ips.set(value, docIp());
			return ips.get(value);
		},
		uuid(value) {
			if (!uuids.has(value)) uuids.set(value, docUuid());
			return uuids.get(value);
		},
		hexId(value) {
			if (!hexIds.has(value)) hexIds.set(value, docHex24());
			return hexIds.get(value);
		},
		domain(value) {
			if (!domains.has(value)) domains.set(value, docDomain());
			return domains.get(value);
		},
		/** A scrubbed stand-in for a token/secret value. */
		secret(key) {
			return `doc-${String(key)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")}`;
		},
		/** A scrubbed stand-in for a name-bearing value. */
		name(key) {
			return `${String(key)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")}-example`;
		}
	};
}

/**
 * Scrubs one JSON value (recursively): strings are pattern-scrubbed (MACs,
 * IPs, uuids, 24-hex ids, non-documentation domains), string values under
 * name-bearing keys are replaced, and string values under token/secret keys
 * are replaced. Object identity of the shape is kept; only values change.
 *
 * @param {any} value
 * @param {ReturnType<typeof createScrubber>} [scrubber] a shared run (same source value → same stand-in)
 * @param {string} [key] the key the value sits under
 * @returns {any} the scrubbed value
 */
export function scrub(value, scrubber = createScrubber(), key = "") {
	if (typeof value === "string") {
		let out = value;
		if (SECRET_KEYS.test(key)) return scrubber.secret(key);
		if (NAME_KEYS.test(key) && out.trim() !== "") return scrubber.name(key);
		out = out.replace(MAC_PATTERN, (mac) => scrubber.mac(mac));
		out = out.replace(UUID_PATTERN, (uuid) => scrubber.uuid(uuid));
		out = out.replace(HEX24_PATTERN, (hex) => scrubber.hexId(hex));
		out = out.replace(IPV4_PATTERN, (ip) => scrubber.ip(ip));
		out = out.replace(DOMAIN_PATTERN, (domain) => scrubber.domain(domain));
		return out;
	}
	if (Array.isArray(value)) return value.map((entry) => scrub(entry, scrubber, key));
	if (value !== null && typeof value === "object") {
		const out = {};
		for (const [childKey, childValue] of Object.entries(value)) {
			out[childKey] = scrub(childValue, scrubber, childKey);
		}
		return out;
	}
	return value;
}
