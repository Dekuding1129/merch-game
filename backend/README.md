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

- `GET /api/health` — confirms demo mode, memory-only storage, and disabled payments.
- `GET /api/products` — returns the trusted product catalog and prices.
- `POST /api/checkout/quote` — validates cart items and delivery details, then creates a temporary demo checkout reference.
- `GET /api/orders/:id` — reads back a demo checkout without returning personal details.
- `GET /api/locations/countries` — returns GeoNames countries.
- `GET /api/locations/regions?country=PH` — returns administrative regions.
- `GET /api/locations/cities?country=PH&region=...&q=cat` — returns searchable cities.
- `GET /api/locations/postal-codes?country=PH&region=...&city=Catbalogan` — returns postal codes.

The frontend loads countries from the backend, loads regions after country selection, offers searchable city suggestions after region selection, and loads postal-code choices after city selection.

## Important limits

- No payment is taken.
- No order is fulfillable.
- Personal information exists only in server memory and disappears when the process stops.
- This is not production security or a public checkout endpoint.
- Before launch, add HTTPS, authentication/abuse protection, a real database, and a payment provider webhook.
- GeoNames attribution is required; see `backend/GEONAMES_ATTRIBUTION.md`.

## Phone testing

1. Connect the phone and computer to the same Wi-Fi.
2. Find the computer's local IPv4 address.
3. Open the frontend on the phone using `http://COMPUTER_IP:8000/?api=http://COMPUTER_IP:8787`.
4. Press BUY and submit the delivery form. The browser will call the backend on port `8787`.
5. If Windows Firewall blocks access, allow the chosen ports on the private network only.
