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

Release builds should inject an identifier so the running service can be verified:

```sh
CGO_ENABLED=0 go build -trimpath \
  -ldflags "-X main.buildVersion=<release> -X main.buildCommit=<commit> -X main.buildAt=<utc-time>" \
  -o pocketbase-<release> .
```

`GET /api/easybake/health` returns `status`, `version`, `commit`, and `buildAt`.
The roast-batch transaction endpoints reject unknown payload fields instead of silently dropping them.

## Deployment

`deploy.sh` and `deploy_test.sh` build and deploy the extension together with the BFF and frontend. They configure a sibling candidate binary, restart only the selected PocketBase service, verify the health version, and remove the release override to roll back if verification fails.

Deploy staging before production. The BFF routes `/api/roast-batches` to these endpoints and must be deployed with the same release.
