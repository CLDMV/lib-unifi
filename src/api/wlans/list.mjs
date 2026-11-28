/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/wlans/list.mjs
 *	@Date: 2026-11-28T04:46:07-08:00 (1795869967)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:06-08:00 (1795870566)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { officialRead } from "../../lib/crud.mjs";

/**
 * @fileoverview `wlans.list()` — every WLAN the site broadcasts, as the Integration API's
 * `wifi/broadcasts` collection answers them (the Integration API's name for
 * the WLANs: one broadcast per SSID with its security and network references).
 *
 * @returns {Promise<object[]>} the collection as the official Integration API
 *   answers it (each page merged; the rows are the API's own shape)
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function list() {
	return officialRead("wlans", "wifi/broadcasts", { topLevel: false, idOf: (item) => item?.id });
}
