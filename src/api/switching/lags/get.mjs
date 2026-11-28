/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/switching/lags/get.mjs
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

import { officialGet } from "../../../lib/crud.mjs";
import { ValidationError } from "../../../lib/errors.mjs";

/**
 * @fileoverview `switching.lags.get(id)` — one LAG's members and ports. Official-only.
 *
 * @param {string} id the resource id (the Integration API's `id`)
 * @returns {Promise<object>} the row as the API answers it
 * @throws {ValidationError} on a missing id
 * @throws {CapabilityError} when the official surface is unavailable
 * @throws {ApiError} 404-shaped when no resource carries that id
 */
export default async function get(id) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "the resource id is required");
	}
	return officialGet("switching.lags", "switching/lags/{id}", { id: id });
}
