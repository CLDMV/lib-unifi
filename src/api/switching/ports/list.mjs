/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/switching/ports/list.mjs
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
 * @fileoverview `switching.ports.list()` — the site's switch port profiles, the legacy
 * `rest/portconf` rows unifi-cli's port_config row carries (name, the port
 * masks and the profile's forwarding/poe settings). Legacy-only — the
 * official Integration API exposes port STATE through the device detail
 * (`devices.get`), not the profile store.
 *
 * @returns {Promise<object[]>} the rows as the legacy controller answers them
 * @throws {CapabilityError} when the legacy path is unavailable
 */
export default async function list() {
	return legacyRead("switching.ports", "port_config");
}
