# @cldmv/lib-unifi

UniFi Network client library — one interface over the official UniFi Integration API and the legacy controller API, with a capability probe and dry-run writes. A slothlet API package: `createUnifi` composes the library's own slothlet instance over the package's `api/` and returns that api — the returned object **is** the library's slothlet api. Credentials and config enter through the factory and stay inside the library's own instance (per-instance credential isolation), so any project can use the library. It owns the protocol only — no policy, no Digby concepts.

```js
import { createUnifi } from "@cldmv/lib-unifi";
const unifi = await createUnifi({
	baseUrl: "https://10.0.0.1",
	fetch, // the fetch the library uses; it never opens sockets itself
	credentials: { apiKey, legacy: { username, password } },
	tls: { spkiPins } // carried for reporting; pinning is the injected fetch's business
});
await unifi.capabilities(); // { networks: "official"|"legacy", clients: …, fixedIp: …, dns: { records: …, forward: "official"|"legacy"|"none" }, version }
await unifi.networks.list(); // every network/VLAN: id, name, vlan, cidr, gateway, dhcp { range, leaseSec }, dns { servers, domain }, kind
await unifi.networks.update(id, { dns: ["10.0.1.166"], domain: "homelab.cldmv.net" });
await unifi.clients.list({ active: true }); // mac, ip, hostname, network, fixed
await unifi.clients.fixed.ip.set("00:00:5e:00:53:01", "192.0.2.10"); // resolves the MAC to the controller _id first
await unifi.dns.records.list();
await unifi.dns.forward.set({ domain, target }); // the Forward Domain rules
```

Every write takes `{ dryRun: true }` and answers the change it would make — `{ dryRun: true, capability, request: { method, url, body } }` — without sending anything, and never carries credentials in the answer.

## The two API paths

The **official Integration API** (`/proxy/network/integration/v1`, an API key created on the console, `X-API-KEY` header) is preferred: sites resolve to their UUID, networks read through `/sites/{siteId}/networks` with the DHCP DNS override in `ipv4Configuration.dhcpConfiguration.dnsServerIpAddressesOverride`, DNS records are `/sites/{siteId}/dns/policies` policies — `FORWARD_DOMAIN` is one of its types. The **legacy controller API** (a local account login: UniFi OS `POST /api/auth/login` with the session cookie and CSRF token, falling back to the legacy `POST /api/login` on `:8443` with the `unifises` cookie) fills in what the official API cannot do: `rest/networkconf` network configs, `stat/sta` clients, the fixed-IP write `PUT rest/user/{id}`, and the static-DNS collection (`v2/api/site/{site}/static-dns` on UniFi OS, `api/s/{site}/rest/static-dns` on older controllers).

`capabilities()` probes both and classifies each capability `official | legacy | none`. `dns.forward` is `official` when the official policies endpoint answers (Forward Domain is a policy type there), `legacy` when the legacy static-DNS collection answers **and** the Network application version is known to be 9 or later (Forward Domain needs 9.x), `none` otherwise. The fixed-IP write is a legacy-only capability. Neither credential is required at compose time — a dry-run-only caller may compose first; reads and sends fail with typed errors until one path has credentials.

## Errors

Every failure is a typed error from `src/lib/errors.mjs` — `ConfigError` (factory config), `AuthError` (legacy login; both attempts reported), `ApiError` (a non-2xx answer; carries the controller's own code), `TransportError` (fetch failures, untrustworthy list pages), `CapabilityError` (the probed capability is unavailable, with a fix-step hint), `ValidationError` (a bad MAC, IP, domain or patch). `isUnifiError(err, code?)` is the type guard. The library never exits the process.

## In a checkout

Tests run against `src/` through the `lib-unifi-dev` condition (set it once per shell with `export NODE_OPTIONS=--conditions=lib-unifi-dev`, or let the vitest config set it for the workers):

| Run                                                    | Resolves to                                            |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `node app.mjs`                                         | `dist/index.mjs` (`ERR_MODULE_NOT_FOUND` if not built) |
| `NODE_OPTIONS=--conditions=lib-unifi-dev node app.mjs` | `src/index.mjs`                                        |

`npm test` and `npm run coverage` go through `@cldmv/vitest-runner` (`tests/run-vitest.mjs`); the composed-leaf coverage is measured through the query-stripping provider in `.configs/coverage-provider.mjs`. `npm run build` builds `dist/` one file per module (slothlet scans the `api/` tree at runtime, so the build keeps it), copies `src/index.cjs` verbatim, and `npm run test:cjs` composes the built package. Fixtures under `tests/fixtures/` are hand-written from UniFi's published documentation and unifi-cli's source — each fixture's `_source` field names where its shapes come from; no fixture is captured from a live controller.

## License

Apache-2.0 — see [LICENSE](LICENSE).
