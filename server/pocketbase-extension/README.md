# EasyBake PocketBase Extension

This custom PocketBase binary owns atomic roast-batch inventory operations.

## Routes

- `POST /api/easybake/roast-batches/commit`
- `PATCH /api/easybake/roast-batches/{id}`
- `DELETE /api/easybake/roast-batches/{id}`

Every route requires a `users` auth token. A transaction validates record ownership, updates the latest purchase batch, and saves or deletes the roast record together. Insufficient inventory returns `409`.

## Build

Use PocketBase `v0.39.5` and Go `1.25`:

```sh
CGO_ENABLED=0 go build -trimpath -o easybake-pocketbase .
```

## Deployment

Deploy a sibling candidate binary. Configure the target systemd service with an override that points at the candidate, restart only that service, then verify `/api/easybake/health`. Keep the prior binary and remove the override to roll back.

Deploy staging before production. The BFF routes `/api/roast-batches` to these endpoints and must be deployed with the same release.
