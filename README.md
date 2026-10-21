# StockFlow - Inventory Management System

A full-stack web application where **suppliers publish stock** and **users order it before their own stock runs out**.

Built with HTML, CSS, JavaScript, Node.js/Express and MongoDB (Atlas).

---

## Objective

Small shops often find out an item is finished only when a customer asks for it. StockFlow's objective is to remove that surprise:

- Let a **supplier** keep a catalog of products with price and available stock.
- Let a **user** track their own inventory and set a *reorder point* for each item.
- Warn the user automatically when stock is **at or below** that point, and let them order from the supplier in one click.
- Keep both sides consistent: when the supplier delivers, the supplier's stock goes down and the user's stock goes up.

## Description

StockFlow has two kinds of accounts, each with its own dashboard.

| Role | What they can do |
|---|---|
| **Supplier** | Add products (name, SKU, price, stock), edit prices, restock, see incoming orders, **deliver** or **reject** them. Delivery is blocked if the supplier does not have enough stock. |
| **User** | Add supplier products to their inventory with a current stock and reorder point, see **Low / Out of stock** warnings, order one item or **all low items at once**, track and cancel pending orders. |

### How an order moves

```
Supplier adds products --> User tracks them with a reorder point
                                  |
                 stock <= reorder point --> "Low" alert
                                  |
                      User places order (PENDING)
                                  |
        Supplier DELIVERS --> supplier stock - qty, user stock + qty
        Supplier REJECTS  --> no stock change
        User CANCELS      --> no stock change
```

Delivery is race-safe: the order is claimed atomically (so it cannot be delivered twice) and supplier stock is reduced only if enough is left.

![Architecture](docs/architecture.png)

## Tools and Technologies

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript (Fetch API) |
| Backend | Node.js 18+, Express 4 |
| Database | MongoDB Atlas with Mongoose 8 |
| Authentication | JSON Web Tokens (`jsonwebtoken`), password hashing with `bcryptjs` |
| Configuration | `dotenv` |
| Tools | Git and GitHub, VS Code, npm, Postman / browser DevTools |

## Project Structure

```
inventory-system/
├── server.js              # Express app + MongoDB connection
├── config.js              # Environment variables
├── seed.js                # Demo accounts and sample data
├── models/                # User, Product, InventoryItem, Order (Mongoose schemas)
├── routes/
│   ├── auth.js            # register, login, me
│   ├── supplier.js        # products, restock, incoming orders
│   └── user.js            # catalog, inventory, orders
├── middleware/auth.js     # JWT check + role check
├── utils/validate.js      # Input validation helpers
├── public/                # Frontend
│   ├── index.html, auth.js          # Login / register
│   ├── supplier.html, supplier.js   # Supplier dashboard
│   ├── user.html, user.js           # User dashboard
│   ├── common.js, style.css
├── screenshots/           # Output screenshots used below
├── docs/                  # Architecture, data model and workflow diagrams
├── .env.example           # Template for environment variables
└── package.json
```

## Execution Steps

### 1. Prerequisites

- [Node.js](https://nodejs.org) 18 or newer (`node -v` to check)
- A MongoDB database: a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster, or MongoDB installed locally

### 2. Get the code

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root (copy `.env.example`):

```bash
cp .env.example .env          # Windows: copy .env.example .env
```

Fill in:

```
PORT=3000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/stockflow?retryWrites=true&w=majority
JWT_SECRET=<any long random string>
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For a local MongoDB use `MONGO_URI=mongodb://127.0.0.1:27017/stockflow`.

### 5. (Optional) Load demo data

```bash
npm run seed
```

### 6. Start the server

```bash
npm run dev        # auto-restarts on changes; use "npm start" for a plain run
```

You should see `MongoDB connected` and `StockFlow running at http://localhost:3000`.

### 7. Use the app

Open **http://localhost:3000**. Demo logins after seeding (password `demo1234`):

| Role | Email |
|---|---|
| Supplier | `supplier@demo.com` |
| User | `user@demo.com` |

Open the two accounts in separate browser windows (one normal, one private) to play both sides:

1. As the **user**, click **Order all low items**.
2. As the **supplier**, click **Refresh**, then **Deliver** on the orders.
3. As the **user**, click **Refresh** and see the stock go up and the warning disappear.



## API Reference

All routes except register/login need the header `Authorization: Bearer <token>`.

| Method | Endpoint | Who | Description |
|---|---|---|---|
| POST | `/api/auth/register` | anyone | `{ name, email, password, role }` where role is `supplier` or `user` |
| POST | `/api/auth/login` | anyone | `{ email, password }` |
| GET | `/api/auth/me` | any | Current account |
| GET / POST | `/api/supplier/products` | supplier | List / create products |
| PATCH / DELETE | `/api/supplier/products/:id` | supplier | Edit price, name, stock / delete |
| POST | `/api/supplier/products/:id/restock` | supplier | `{ quantity }` adds stock |
| GET | `/api/supplier/orders` | supplier | Orders received |
| PATCH | `/api/supplier/orders/:id` | supplier | `{ status: "delivered" \| "rejected", note }` |
| GET | `/api/user/catalog` | user | All supplier products |
| GET / POST | `/api/user/inventory` | user | List (with `lowStock`, `pendingQty`) / add item |
| PATCH / DELETE | `/api/user/inventory/:id` | user | Edit stock, reorder point, order quantity / remove |
| GET / POST | `/api/user/orders` | user | List / place `{ productId, quantity }` |
| PATCH | `/api/user/orders/:id/cancel` | user | Cancel a pending order |

## Future Scope

- Email or push notifications for low stock
- Auto-reorder when stock reaches the reorder point
- Multiple suppliers per product with price comparison
- Sales/usage charts and CSV export

## Author

Manish, final-year Computer Science and Engineering, New Horizon College of Engineering, Bengaluru.

## License

MIT
