# Deployment

Live at https://pitch.sudhanshu-dev.in (server 45.74.156.59, repo at `/root/cricket-card-game`).

## Flow
- Work on `dev`. Every push to `dev` (and every PR into `main`) runs CI: `go vet`, `go test`, web lint and build.
- Merge `dev` into `main` and push. CI runs again, then the **deploy** job SSHes to the server and the
  site is rebuilt from `origin/main`.

## How the deploy works
- GitHub secret `DEPLOY_SSH_KEY` is a key that the server only accepts for one thing: running
  `/usr/local/bin/pitch-deploy` (forced command in `/root/.ssh/authorized_keys`; no shell, no forwarding).
- `pitch-deploy` resets the repo to `origin/main` and runs [`deploy.sh`](deploy.sh), which rebuilds the
  containers with `docker-compose.prod.yml`, waits for the health check, and prunes old images.
- Secrets used by the containers live in `/root/cricket-card-game/.env` (gitignored, never in CI).

## GitHub secrets (Settings → Secrets and variables → Actions)
| Name | Value |
| --- | --- |
| `DEPLOY_HOST` | `root@45.74.156.59` |
| `DEPLOY_SSH_KEY` | contents of `~/.ssh/pitch_deploy_key` (private key) |
| `DEPLOY_KNOWN_HOSTS` | contents of `~/.ssh/pitch_known_hosts` |

## Manual deploy / rollback
```bash
ssh root@45.74.156.59 /usr/local/bin/pitch-deploy        # deploy current main
```
To roll back, revert the bad commit on `main` and push; the pipeline redeploys.

Nginx site: `/etc/nginx/sites-available/pitch` (from [`nginx-pitch.conf`](nginx-pitch.conf)); TLS via certbot (auto-renew).
