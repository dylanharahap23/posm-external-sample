# Secure pilot deployment

The VPS uses Caddy and systemd. The production pilot is intentionally single-instance JSON-backed until Supabase/Postgres/Auth are integrated.

1. Create `/home/ubuntu/.config/panako/production.env`, mode 600, containing:

```
PANAKO_AUTH_SECRET=<random 32+ byte secret>
PANAKO_ADMIN_USERNAME=<operator name>
PANAKO_ADMIN_PASSWORD_HASH=<scrypt hash generated locally>
```

Do not commit this file. Do not run the app with `PANAKO_LOCAL_MODE=true` in production.

2. Install service:

```
sudo install -o root -g root -m 0644 deploy/panako.service /etc/systemd/system/panako.service
sudo install -o root -g root -m 0644 deploy/Caddyfile.panako /etc/caddy/snippets/panako.caddy
sudo systemctl daemon-reload
sudo systemctl enable --now panako
```

3. Add the snippet to Caddy's existing configuration without removing unrelated routes:

```
import /etc/caddy/snippets/panako.caddy
```

Then validate and reload:

```
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

4. Verify from an external client:

```
curl -I https://panako.51.79.240.127.sslip.io/
curl -I https://panako.51.79.240.127.sslip.io/api/data?entity=dashboard
```

The dashboard API must not be used before login. Check `journalctl -u panako -n 100 --no-pager` and `journalctl -u caddy -n 100 --no-pager` without printing environment values.

The data overlay must be backed up before upgrades. This deployment does not provide multi-user RBAC, Supabase RLS, object storage, or PostGIS; use it only as a restricted pilot.
