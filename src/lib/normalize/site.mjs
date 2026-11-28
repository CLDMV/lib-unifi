/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/normalize/site.mjs
 *	@Date: 2026-11-28T04:46:18-08:00 (1795869978)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:07-08:00 (1795870567)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Site normalizers for the two API paths, onto
 *   `site { id, name, internalReference }`.
 *
 * The official rows come from the Integration API's `GET /sites` overview
 * (`{ id, internalReference, name }` — the shape `resolveOfficialSiteId`
 * matches on). The legacy rows come from `stat/sites`, where the site's id is
 * the row's `_id`, the internal reference is `attr_hidden_id` (the id the
 * controller's own site-scoped paths carry in `{site}`), and the display name
 * is `name` falling back to `desc`.
 */

/**
 * Normalizes one official site overview row.
 * @param {object} row
 * @returns {object|null}
 */
export function officialSiteFromRow(row) {
	if (!row || typeof row !== "object" || !row.id) return null;
	return {
		id: row.id,
		name: row.name ?? null,
		internalReference: row.internalReference ?? null
	};
}

/**
 * Normalizes one legacy `stat/sites` row.
 * @param {object} row
 * @returns {object|null}
 */
export function legacySiteFromRow(row) {
	if (!row || typeof row !== "object" || !row._id) return null;
	return {
		id: row._id,
		name: row.desc ?? row.name ?? null,
		internalReference: row.attr_hidden_id ?? row._id
	};
}
