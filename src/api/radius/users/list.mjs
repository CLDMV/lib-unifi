/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/radius/users/list.mjs
 *	@Date: 2026-11-28T04:46:07-08:00 (1795869967)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:05-08:00 (1795870565)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { legacyRead } from "../../../lib/crud.mjs";

/**
 * @fileoverview `radius.users.list()` — the site's RADIUS user accounts, the legacy
 * controller path unifi-cli's radius-sync drives (`v2/api/site/{site}/radius/users`
 * on UniFi OS, `api/s/{site}/rest/radiususer` on older UniFi OS, `rest/account`
 * on a standalone legacy controller). Legacy-only — the official Integration
 * API carries profiles, not user accounts.
 *
 * @returns {Promise<object[]>} the rows as the legacy controller answers them
 * @throws {CapabilityError} when the legacy path is unavailable
 */
export default async function list() {
	return legacyRead("radius.users", "radius_list");
}
