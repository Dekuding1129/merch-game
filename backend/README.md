# Local demo backend

This is a free, local-only backend for testing the storefront flow before adding hosting or payments.

## Start it

From the project directory:

```bash
python3 backend/setup-geodata.py
node backend/server.js
```

The first command downloads the current GeoNames country, administrative, city, and postal-code extracts and builds `backend/data/geodata.json`. The generated data is intentionally ignored by Git. The API listens on port `8787` and binds to all local network interfaces so a phone on the same Wi-Fi can reach it.

## Endpoints

- `GET /api/health` — confirms whether Supabase or memory-only demo storage is active, with local test payments only.
- `GET /api/products` — returns the trusted product catalog and prices.
- `POST /api/checkout/quote` — validates cart items and delivery details, then saves an order to Supabase when configured.
- `GET /api/orders/:id` — reads back an order without returning personal details.
- `POST /api/payments/create-test-session` — creates a local payment session for a pending order.
- `GET /api/payments/test-session/:sessionId` — returns safe display data for the local payment page.
- `POST /api/payments/test-session/:sessionId/complete` — records `success`, `failed`, or `cancelled` locally; it never calls a payment provider.
- `GET /api/locations/countries` — returns GeoNames countries.
- `GET /api/locations/regions?country=PH` — returns administrative regions.
- `GET /api/locations/cities?country=PH&region=...&q=cat` — returns searchable cities.
- `GET /api/locations/postal-codes?country=PH&region=...&city=Catbalogan` — returns postal codes.

The frontend loads countries from the backend, loads regions after country selection, offers searchable city suggestions after region selection, and loads postal-code choices after city selection.

## Email receipts with Brevo

The local test-payment flow can send a receipt after a successful simulated payment through Brevo SMTP. Keep all email settings in the backend `.env`; never place them in frontend files.

```text
EMAIL_ENABLED=1
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-account-email
EMAIL_FROM=your-verified-sender-email
BREVO_SMTP_KEY=your-private-brevo-smtp-key
```

`BREVO_SMTP_KEY` is the SMTP key created in Brevo. `SMTP_USER` is the Brevo account login, and `EMAIL_FROM` must be one of the verified Brevo senders. Restart `node backend/server.js` after changing `.env`. A successful local payment then reports `emailSent: true` only when Brevo accepts the message. No real money is charged.

## Important limits

- No payment is taken. The payment page is a local simulator and does not call PayMongo, Stripe, Xendit, PayPal, or any other provider.
- No order is fulfillable until payment and fulfillment are added.
- With Supabase credentials configured, order records persist in Supabase; without them, the local fallback is memory-only.
- This is not production security or a public checkout endpoint.
- Before launch, add HTTPS, authentication/abuse protection, a real payment provider integration and authenticated webhook only after a separate production review.
- GeoNames attribution is required; see `backend/GEONAMES_ATTRIBUTION.md`.

## Phone testing

1. Connect the phone and computer to the same Wi-Fi.
2. Find the computer's local IPv4 address.
3. Open the frontend on the phone using `http://COMPUTER_IP:8000/?api=http://COMPUTER_IP:8787`.
4. Press BUY and submit the delivery form. The browser will call the backend on port `8787`.
5. If Windows Firewall blocks access, allow the chosen ports on the private network only.
