/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/lib/normalize/client.mjs
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
 * @fileoverview Client normalizers for the two API paths, onto
 *   `client { mac, ip, hostname, network, fixed, active }`.
 *
 * The legacy connected-client rows come from `stat/sta`; the legacy client
 * config records (fixed IPs, offline clients) come from `rest/user`. The
 * official rows come from the Integration API's connected-clients page.
 */

const MAC_PATTERN = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i;

/**
 * Normalizes a MAC address to the controller's lowercase colon form.
 * @param {string} mac
 * @returns {string|null} normalized, or null when not a MAC
 */
export function normalizeMac(mac) {
	if (typeof mac !== "string") return null;
	const cleaned = mac.trim().toLowerCase().replace(/-/g, ":");
	return MAC_PATTERN.test(cleaned) ? cleaned : null;
}

/**
 * Validates an IPv4 address (the only form `fixed_ip` accepts).
 * @param {string} ip
 * @returns {boolean}
 */
export function isIpv4(ip) {
	if (typeof ip !== "string") return false;
	const octets = ip.trim().split(".");
	if (octets.length !== 4) return false;
	return octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255);
}

/**
 * Normalizes one legacy `stat/sta` connected-client row.
 * @param {object} row
 * @returns {object|null}
 */
export function legacyClientFromStaRow(row) {
	if (!row || typeof row !== "object" || !row.mac) return null;
	return {
		mac: normalizeMac(row.mac),
		ip: row.ip ?? null,
		hostname: row.hostname ?? row.name ?? null,
		network: row.network ?? row.last_connection_network_name ?? null,
		fixed: row.use_fixedip === true && row.fixed_ip ? row.fixed_ip : false,
		active: true,
		id: row._id ?? null
	};
}

/**
 * Normalizes one legacy `rest/user` client config record.
 * @param {object} row
 * @returns {object|null}
 */
export function legacyClientRecordFromUserRow(row) {
	if (!row || typeof row !== "object" || !row.mac) return null;
	return {
		mac: normalizeMac(row.mac),
		ip: row.fixed_ip ?? row.last_ip ?? null,
		hostname: row.name ?? row.hostname ?? null,
		network: row.last_connection_network_name ?? null,
		fixed: row.use_fixedip === true && row.fixed_ip ? row.fixed_ip : false,
		active: false,
		id: row._id ?? null
	};
}

/**
 * Normalizes one official connected-client row.
 * @param {object} row
 * @returns {object|null}
 */
export function officialClientFromRow(row) {
	if (!row || typeof row !== "object") return null;
	return {
		mac: normalizeMac(row.macAddress),
		ip: row.ipAddress ?? null,
		hostname: row.hostname ?? row.name ?? null,
		network: row.networkId ?? null,
		fixed: false,
		active: true,
		id: row.id ?? null
	};
}

/**
 * Finds the controller `_id` for a MAC across the legacy client records
 * (`rest/user`) and the connected clients (`stat/sta`) — the fixed-IP write
 * targets `rest/user/{id}`, so the record id is preferred.
 *
 * @param {object[]} records `rest/user` rows
 * @param {object[]} staRows `stat/sta` rows
 * @param {string} mac normalized MAC
 * @returns {string|null}
 */
export function resolveClientId(records, staRows, mac) {
	const wanted = normalizeMac(mac);
	if (!wanted) return null;
	const inRecords = records.find((row) => normalizeMac(row?.mac) === wanted);
	if (inRecords?._id) return inRecords._id;
	const inSta = staRows.find((row) => normalizeMac(row?.mac) === wanted);
	return inSta?._id ?? null;
}
