# Deployed pilot status

URL: https://panako.51.79.240.127.sslip.io
Server application: /home/ubuntu/panako-intelligence
Service: panako.service (systemd), loopback port 3100, Caddy HTTPS proxy.
Credentials are not in this repository. Local operator login is stored in C:\Users\Dylan\.config\panako\admin-login.txt. Server environment is under /home/ubuntu/.config/panako/production.env with restrictive permissions.

Verified from external client: HTTPS root 200; unauthenticated dashboard API 401; login 200 with session cookie; authenticated dashboard API 200 with 249 stores and 262 projects. Chromium login and dashboard navigation passed, no page errors. Build executed on VPS. Existing Caddy upstream routes preserved; pre-change backup /etc/caddy/Caddyfile.before-panako.

Final local checks: strict TypeScript passed, 20 JavaScript tests passed, production build passed. Earlier Python real workbook tests: 3 groups passed. Dependency audit: zero vulnerabilities at last audit.

Production authentication is a single-admin pilot: scrypt password hash, signed expiring HttpOnly Secure SameSite cookie, same-origin mutation check and global login rate limit. It is not Supabase Auth or full ten-role enterprise RBAC. Data repository is single-instance atomic JSON, not PostgreSQL/PostGIS. Proposed SQL is not applied. Full import preview/correction/commit, private object storage, stage approvals/documents, advanced spatial analysis, evidence verification and tenant isolation remain outstanding. Do not describe this deployment as the entire master prompt completed.

Recent integrated fixes: project create/status editing UI, channel filters derived from projects, completed/on-hold KPI status filtering, formula-safe CSV, candidate weighted ranking and deterministic tie breaks. Reports/testing-report.md contains earlier checkpoint limitations and is superseded by this status for these fixes.
