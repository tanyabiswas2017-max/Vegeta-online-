# Vegeta Online

## Features
- Customer vegetable shop
- Server-side order database (SQLite)
- WhatsApp order message with Order ID
- Secure session-based admin login
- Admin product price/stock management
- Admin order status management

## Run
1. Install Node.js 18+.
2. Run `npm install`
3. Set environment variables:
   - `ADMIN_PASSWORD` = your own admin password
   - `WHATSAPP_NUMBER` = WhatsApp number with country code, e.g. `918617891012`
   - `SESSION_SECRET` = a long random secret
4. Run `npm start`
5. Customer page: `/`
6. Admin page: `/admin`

The included default admin password is `Vegeta@123`; change it using ADMIN_PASSWORD before putting the site online.

## Important
This is a deployable starter system. For production, use HTTPS and a strong SESSION_SECRET/password. The SQLite database is stored as `vegeta.db` on the server.
