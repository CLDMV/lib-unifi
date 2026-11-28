/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/normalize/network.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:44:11-08:00 (1795866251)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Network normalizers for the two API paths. Both map onto the
 * one shape the plan's driver contract uses:
 *
 *   `network { id, name, vlan, cidr, gateway, dhcp { range, leaseSec }, dns { servers[], domain }, kind }`
 *
 * The legacy mapper reads `rest/networkconf` rows (fields as documented for
 * the legacy controller API and as read by unifi-cli's `network_config` call);
 * the official mapper reads the Integration API network details
 * (`ipv4Configuration.dhcpConfiguration`). WAN-purpose networks are dropped on
 * the legacy path (they are not LAN networks the DNS settings apply to); the
 * official path drops non-GATEWAY-managed networks only when they carry no
 * IPv4 configuration at all.
 */

/**
 * Converts a dotted-decimal netmask to a CIDR prefix length.
 * @param {string} mask e.g. "255.255.255.0"
 * @returns {number|null}
 */
export function netmaskToPrefix(mask) {
	if (typeof mask !== "string" || !/^\d{1,3}(\.\d{1,3}){3}$/.test(mask)) return null;
	const octets = mask.split(".").map(Number);
	if (octets.some((octet) => octet < 0 || octet > 255)) return null;
	const bits = octets.reduce((acc, octet) => acc + ((octet >>> 0).toString(2).match(/1/g) ?? []).length, 0);
	// A contiguous mask only: 255.0.255.0 is not a netmask.
	let contiguous = true;
	let seenZero = false;
	for (const octet of octets) {
		const binary = (octet >>> 0).toString(2).padStart(8, "0");
		for (const bit of binary) {
			if (bit === "0") seenZero = true;
			else if (seenZero) contiguous = false;
		}
	}
	return contiguous ? bits : null;
}

/**
 * Normalizes one legacy `rest/networkconf` row.
 * @param {object} row
 * @returns {object|null} the normalized network, or null for a row lib-unifi
 *   does not report (WAN networks)
 */
export function legacyNetworkFromRow(row) {
	if (!row || typeof row !== "object") return null;
	if (row.purpose === "wan") return null;

	const prefix = netmaskToPrefix(row.ipaddr_subnet);
	const cidr = prefix !== null && row.ipaddr ? `${row.ipaddr}/${prefix}` : null;
	const servers = row.dhcpd_dns_enabled
		? [row.dhcpd_dns_1, row.dhcpd_dns_2, row.dhcpd_dns_3, row.dhcpd_dns_4].filter((ip) => typeof ip === "string" && ip !== "")
		: [];
	const dhcpEnabled = row.dhcpd_enabled === true && typeof row.dhcpd_start === "string" && typeof row.dhcpd_stop === "string";

	return {
		id: row._id ?? null,
		name: row.name ?? null,
		vlan: typeof row.vlan === "number" && row.vlan_enabled !== false ? row.vlan : null,
		cidr,
		gateway: row.ipaddr ?? null,
		dhcp: {
			range: dhcpEnabled ? [row.dhcpd_start, row.dhcpd_stop] : null,
			leaseSec: typeof row.dhcpd_leasetime === "number" ? row.dhcpd_leasetime : null
		},
		dns: {
			servers,
			domain: typeof row.domain_name === "string" ? row.domain_name : ""
		},
		kind: row.purpose ?? null
	};
}

/**
 * Normalizes one official Integration API network detail.
 * @param {object} detail the network detail as `GET /sites/{id}/networks/{networkId}` answers
 * @returns {object|null}
 */
export function officialNetworkFromDetail(detail) {
	if (!detail || typeof detail !== "object") return null;
	const v4 = detail.ipv4Configuration && typeof detail.ipv4Configuration === "object" ? detail.ipv4Configuration : null;
	const dhcp = v4?.dhcpConfiguration && typeof v4.dhcpConfiguration === "object" ? v4.dhcpConfiguration : null;
	const cidr = v4 && v4.hostIpAddress && Number.isFinite(v4.prefixLength) ? `${v4.hostIpAddress}/${v4.prefixLength}` : null;
	const servers = Array.isArray(dhcp?.dnsServerIpAddressesOverride)
		? dhcp.dnsServerIpAddressesOverride.filter((ip) => typeof ip === "string" && ip !== "")
		: [];

	return {
		id: detail.id ?? null,
		name: detail.name ?? null,
		vlan: Number.isFinite(detail.vlanId) ? detail.vlanId : null,
		cidr,
		gateway: v4?.hostIpAddress ?? null,
		dhcp: {
			range: null,
			leaseSec: Number.isFinite(dhcp?.leaseTimeSeconds) ? dhcp.leaseTimeSeconds : null
		},
		dns: {
			servers,
			domain: typeof dhcp?.domainName === "string" ? dhcp.domainName : ""
		},
		kind: typeof detail.management === "string" ? detail.management.toLowerCase() : null
	};
}

/**
 * Builds the official PUT body for a network update: the network as read,
 * without its identity and metadata, with only the DHCP DNS override and/or
 * the search domain replaced (the write shape the Integration API expects).
 *
 * @param {object} detail the network detail as read
 * @param {{ dns?: string[]|null, domain?: string|null }} patch
 * @returns {object} the PUT body
 */
export function officialNetworkUpdateBody(detail, patch) {
	const body = {};
	for (const [key, value] of Object.entries(detail ?? {})) {
		if (key !== "id" && key !== "metadata") body[key] = value;
	}
	const v4 = body.ipv4Configuration && typeof body.ipv4Configuration === "object" ? { ...body.ipv4Configuration } : {};
	const dhcp = v4.dhcpConfiguration && typeof v4.dhcpConfiguration === "object" ? { ...v4.dhcpConfiguration } : {};

	if (patch.dns !== undefined) {
		if (patch.dns === null || (Array.isArray(patch.dns) && patch.dns.length === 0)) {
			dhcp.dnsServerIpAddressesOverride = [];
		} else if (Array.isArray(patch.dns)) {
			dhcp.dnsServerIpAddressesOverride = [...patch.dns];
		}
	}
	if (patch.domain !== undefined) {
		dhcp.domainName = patch.domain === null ? "" : String(patch.domain).trim().replace(/\.$/, "").toLowerCase();
	}
	v4.dhcpConfiguration = dhcp;
	body.ipv4Configuration = v4;
	return body;
}

/**
 * Builds the legacy PUT body for a network update (a partial body is accepted).
 *
 * Legacy semantics: `dhcpd_dns_enabled: true` + `dhcpd_dns_1..4` hands the
 * given servers out; an empty/null server list sets `dhcpd_dns_enabled: false`
 * (the gateway hands out itself). `domain_name` follows the controller's own
 * normalization: trimmed, trailing dot stripped, lowercased.
 *
 * @param {{ dns?: string[]|null, domain?: string|null }} patch
 * @returns {object}
 */
export function legacyNetworkUpdateBody(patch) {
	const body = {};
	if (patch.dns !== undefined) {
		const servers = Array.isArray(patch.dns) ? patch.dns.filter((ip) => typeof ip === "string" && ip !== "") : [];
		body.dhcpd_dns_enabled = servers.length > 0;
		for (let slot = 1; slot <= 4; slot++) body[`dhcpd_dns_${slot}`] = servers[slot - 1] ?? "";
	}
	if (patch.domain !== undefined) {
		body.domain_name = patch.domain === null ? "" : String(patch.domain).trim().replace(/\.$/, "").toLowerCase();
	}
	return body;
}
