# scheduler9000

A TypeScript/Express API wrapping Appointo (Shopify appointment booking) for
two actions — retrieving available slots and creating appointments — plus
webhook support so other systems can be notified when a booking is created.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment file and (optionally) add your Appointo API token:
   ```bash
   cp .env.example .env
   ```
   Leave `APPOINTO_API_TOKEN` empty to run against mock data — every endpoint
   works fully without a real token.

3. Start the dev server:
   ```bash
   npm run dev
   ```
   The console will confirm which mode you're in:
   ```
   scheduler9000 listening on port 3000
   Mode: MOCK
   ```

## Testing

Start the server first (`npm run dev`), then run these against it.

### 1. Get available slots

```bash
curl -X POST localhost:3000/api/appointments/slots \
  -H "Content-Type: application/json" \
  -d '{"appointment_id":299,"start_date":"2026-08-26"}'
```

Expect a `200` with `source: "mock"` (or `"live"` if `APPOINTO_API_TOKEN` is
set) and a list of slots.

Validation check — omit `start_date`:
```bash
curl -X POST localhost:3000/api/appointments/slots \
  -H "Content-Type: application/json" \
  -d '{"appointment_id":299}'
```
Expect a `400` with `error: "validation_error"`.

### 2. Create an appointment

```bash
curl -X POST localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"appointment_id":299,"timestring":"2026-08-26T09:00:00+02:00","email":"jane@example.com","name":"Jane Doe","phone":"555-1234","quantity":1}'
```

Expect a `201` with the created booking. Note `timestring` in the response
is normalized to UTC (`2026-08-26T07:00:00.000Z`) regardless of the offset
sent in the request — confirms the server-side normalization is working,
not just trusting client input.

Validation check — malformed request:
```bash
curl -X POST localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"appointment_id":299,"timestring":"2026-08-26 09:00","email":"not-an-email"}'
```
Expect a `400` with `error: "validation_error"` and details on each failing
field (missing `name`, invalid `email`, invalid `timestring` format).

### 3. Webhook flow — happy path

1. Open https://webhook.site in a browser — it gives you a unique URL
   instantly, no signup needed.

2. Subscribe that URL:
   ```bash
   curl -X POST localhost:3000/api/webhooks/subscribe \
     -H "Content-Type: application/json" \
     -d '{"url":"https://webhook.site/your-unique-id"}'
   ```
   Expect a `201` echoing back the subscribed URL.

3. Create an appointment (as in step 2 above).

4. Switch to the webhook.site tab — a new request should appear within a
   second or two, showing the `booking.created` event with the full
   booking payload in the body.

### 4. Webhook flow — failure case

Subscribe a URL that doesn't exist, to confirm delivery failures are
caught and logged rather than crashing the server or failing the booking
request:

```bash
curl -X POST localhost:3000/api/webhooks/subscribe \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:9999/nowhere"}'
```

Create an appointment again. Expect:
- The `POST /api/appointments` response still returns `201` normally
  (the booking succeeds even though the webhook delivery will fail)
- The server console logs a delivery failure, e.g.
  `Webhook delivery to http://localhost:9999/nowhere failed: ...`

This confirms webhook dispatch is fire-and-forget and doesn't block or
fail the core API response — a broken subscriber can't take down booking
creation.

## Technical decisions

- **Mock/live switch, no code branching per environment**: `isLive()` checks
  for `APPOINTO_API_TOKEN`. If absent, endpoints return realistic mock data
  shaped like Appointo's documented responses; if present, the same
  endpoints call the real Appointo API. This means the API is fully testable
  without credentials, and switching to production is a one-line env change.

- **Validation with Zod**: request bodies are validated with Zod schemas
  rather than manual checks, giving both runtime validation and inferred
  TypeScript types from a single source of truth.

- **Server-side timezone normalization**: `timestring` accepts any ISO8601
  offset from the client but is transformed to UTC inside the Zod schema
  before use, rather than trusting the client to send UTC. Malformed dates
  fail validation via a custom `ctx.addIssue` check rather than silently
  becoming `Invalid Date`.

- **Webhook support built independently of Appointo**: Appointo's own API
  does not expose a native webhook registration endpoint — even Zapier/
  Pipedream integrations poll `GET /bookings` rather than receiving pushed
  events. So webhook delivery here is implemented on top of this service:
  `POST /api/webhooks/subscribe` registers a URL, and every successful
  booking triggers an HTTP POST to all registered subscribers.

- **Fire-and-forget webhook dispatch**: delivery failures are caught and
  logged, not thrown, so one broken/slow subscriber can't fail or delay the
  booking API response to the caller.

## Known trade-offs / what I'd change for production

- Webhook subscribers are stored in memory and are lost on restart; a real
  deployment would persist them in a database (e.g. Postgres) and use a
  queue (e.g. BullMQ) with retry/backoff for delivery reliability instead
  of a single fire-and-forget attempt.
- No signature verification on outgoing webhooks in the current version —
  a production version would HMAC-sign payloads so subscribers can verify
  authenticity.
