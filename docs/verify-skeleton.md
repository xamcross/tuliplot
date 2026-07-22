# Walking-skeleton verification

Proves the UI can call the API with credentials and receive the XSRF cookie.

## A. Start both apps locally

```bash
# Terminal 1 — API on http://localhost:8080 (needs a local Mongo or Atlas URI)
cd backend
MONGODB_URI="mongodb://localhost:27017/tuliplot?maxPoolSize=50" ./gradlew bootRun

# Terminal 2 — UI on http://localhost:4200
cd frontend
npx ng serve
```

## B. Health endpoint returns UP

```bash
curl -i http://localhost:8080/api/v1/health
```
Expect: `HTTP/1.1 200` and body `{"status":"UP"}`.

## C. XSRF-TOKEN cookie is issued (readable by JS)

```bash
curl -i -c cookies.txt http://localhost:8080/api/v1/health
```
Expect a response header `Set-Cookie: XSRF-TOKEN=...; Path=/; SameSite=Lax`
(no `HttpOnly` flag — the SPA must read it). Confirm it landed:
```bash
grep XSRF-TOKEN cookies.txt
```

## D. Credentialed CORS preflight from the UI origin

```bash
curl -i -X OPTIONS http://localhost:8080/api/v1/health \
  -H "Origin: http://localhost:4200" \
  -H "Access-Control-Request-Method: GET"
```
Expect: `HTTP/1.1 200`, `Access-Control-Allow-Origin: http://localhost:4200`,
`Access-Control-Allow-Credentials: true`.

## E. Protected route rejects anonymous callers

```bash
curl -i http://localhost:8080/api/v1/dashboard
```
Expect: `HTTP/1.1 401`.

## F. End-to-end in the browser

Open http://localhost:4200. The landing page shows **API health: UP**.
In DevTools → Network, the `health` request shows request header
`Cookie:` and `withCredentials` true; Application → Cookies shows `XSRF-TOKEN`.
This confirms the credentialed cross-origin round-trip works before auth exists.

## G. Optional: build the backend container

```bash
cd backend
docker build -t tuliplot-api:local .
docker run --rm -p 8080:8080 \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/tuliplot?maxPoolSize=50" \
  tuliplot-api:local
curl -s http://localhost:8080/api/v1/health   # -> {"status":"UP"}
```

## H. Staging DNS / domain setup (one registrable domain)

1. Register `tuliplot.com` on Cloudflare Registrar (same account as Pages).
2. **UI:** Cloudflare Pages custom domain `tuliplot.com` (see
   `deploy-frontend-cloudflare.md`).
3. **API:** `fly launch --no-deploy` (uses `backend/fly.toml`, app `api-tuliplot`),
   then `fly deploy`. Map the subdomain:
   - `fly certs add api.tuliplot.com`
   - In Cloudflare DNS add a `CNAME api → api-tuliplot.fly.dev`
     (DNS-only / grey-cloud until the Fly cert is issued).
4. **Cookies across the registrable domain:** set backend secrets
   `fly secrets set COOKIE_DOMAIN=.tuliplot.com COOKIE_SECURE=true CORS_ALLOWED_ORIGINS=https://tuliplot.com`.
   The session cookie (`TULIPSESSION`) and `XSRF-TOKEN` are then scoped to
   `.tuliplot.com`, so `tuliplot.com` (UI) and `api.tuliplot.com` (API) are
   same-site → the session cookie flows on credentialed requests.
5. Re-run checks B–F against `https://tuliplot.com` /
   `https://api.tuliplot.com/api/v1/health`.
