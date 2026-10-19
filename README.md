# StockFlow - Inventory Management System

A small full-stack app with two kinds of accounts:

- **Supplier** - publishes products with a price and stock, restocks them, and delivers or rejects orders.
- **User** - tracks their own inventory with a *reorder point* per item. When stock drops to or below it, the item is flagged **Low** and the user can order from the supplier in one click (or order all low items at once).

**Stack:** HTML, CSS, vanilla JavaScript · Node.js + Express · MongoDB (Mongoose) · JWT auth

## How it works

```
Supplier adds products ──► User adds them to their inventory with a reorder point
                                   │
                    stock <= reorder point  ──► "Low" alert
                                   │
                         User places an order (pending)
                                   │
              Supplier delivers ──► supplier stock  - qty
                                    user inventory  + qty
              or rejects / user cancels
```

Delivering is race-safe: the order is claimed atomically (so it can't be delivered twice) and supplier stock is only decremented if enough is left. If not, the order goes back to pending with an error.

## Project structure

```
├── server.js            # Express app + MongoDB connection
├── config.js            # Env vars
├── seed.js              # Demo accounts and data
├── models/              # User, Product, InventoryItem, Order
├── routes/              # auth.js, supplier.js, user.js
├── middleware/auth.js   # JWT + role check
├── utils/validate.js    # Input parsing helpers
└── public/              # Frontend
    ├── index.html, auth.js        # Sign in / register
    ├── supplier.html, supplier.js # Supplier dashboard
    ├── user.html, user.js         # User dashboard
    ├── common.js, style.css
```

## Run it

1. Install Node.js 18+ and MongoDB (local) or create a free MongoDB Atlas cluster.
2. Install and configure:
   ```bash
   npm install
   cp .env.example .env     # then set MONGO_URI and JWT_SECRET
   ```
3. (Optional) load demo data:
   ```bash
   npm run seed
   ```
4. Start:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000

Demo logins after seeding (password `demo1234`): `supplier@demo.com` and `user@demo.com`.
Open the two in separate browser profiles (or one in a private window) to play both sides at once.

## API

All routes except register/login need `Authorization: Bearer <token>`.

| Method | Endpoint | Who | Description |
|---|---|---|---|
| POST | `/api/auth/register` | anyone | `{ name, email, password, role }` role = `supplier` or `user` |
| POST | `/api/auth/login` | anyone | `{ email, password }` |
| GET | `/api/auth/me` | any | Current account |
| GET/POST | `/api/supplier/products` | supplier | List / create products |
| PATCH/DELETE | `/api/supplier/products/:id` | supplier | Edit price/name/stock, delete |
| POST | `/api/supplier/products/:id/restock` | supplier | `{ quantity }` adds stock |
| GET | `/api/supplier/orders` | supplier | Orders received |
| PATCH | `/api/supplier/orders/:id` | supplier | `{ status: "delivered" \| "rejected", note }` |
| GET | `/api/user/catalog` | user | All supplier products |
| GET/POST | `/api/user/inventory` | user | List (with `lowStock`, `pendingQty`) / add item |
| PATCH/DELETE | `/api/user/inventory/:id` | user | Edit stock, reorder point, order qty / remove |
| GET/POST | `/api/user/orders` | user | List / place `{ productId, quantity }` |
| PATCH | `/api/user/orders/:id/cancel` | user | Cancel a pending order |

## Ideas to extend

- Email or push alerts when stock goes low
- Order history charts, CSV export
- Multiple suppliers per product with price comparison
- Auto-reorder when stock hits the reorder point
- Deploy on Render / Railway with MongoDB Atlas

## License

MIT
