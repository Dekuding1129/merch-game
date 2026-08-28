# Local demo backend

This is a free, local-only backend for testing the storefront flow before adding hosting or payments.

## Start it

From the project directory:

```bash
node backend/server.js
```

The API listens on port `8787` and binds to all local network interfaces so a phone on the same Wi-Fi can reach it.

## Endpoints

- `GET /api/health` — confirms demo mode, memory-only storage, and disabled payments.
- `GET /api/products` — returns the trusted product catalog and prices.
- `POST /api/checkout/quote` — validates cart items and delivery details, then creates a temporary demo checkout reference.
- `GET /api/orders/:id` — reads back a demo checkout without returning personal details.

## Important limits

- No payment is taken.
- No order is fulfillable.
- Personal information exists only in server memory and disappears when the process stops.
- This is not production security or a public checkout endpoint.
- Before launch, add HTTPS, authentication/abuse protection, a real database, and a payment provider webhook.

## Phone testing

1. Connect the phone and computer to the same Wi-Fi.
2. Find the computer's local IPv4 address.
3. Open the frontend on the phone using `http://COMPUTER_IP:8000/?api=http://COMPUTER_IP:8787`.
4. Press BUY and submit the delivery form. The browser will call the backend on port `8787`.
5. If Windows Firewall blocks access, allow the chosen ports on the private network only.
