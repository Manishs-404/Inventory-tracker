const me = requireRole("supplier");
const state = { products: [], orders: [] };

const ordersBody = document.getElementById("orders-body");
const productsBody = document.getElementById("products-body");

async function load() {
  await attempt(async () => {
    const [products, orders] = await Promise.all([
      api("/api/supplier/products"),
      api("/api/supplier/orders"),
    ]);
    state.products = products;
    state.orders = orders;
    render();
  });
}

function render() {
  renderStats();
  renderOrders();
  renderProducts();
}

function renderStats() {
  const pending = state.orders.filter((o) => o.status === "pending").length;
  const delivered = state.orders.filter((o) => o.status === "delivered").length;
  const units = state.products.reduce((sum, p) => sum + p.stock, 0);

  const stat = (label, value, warn) =>
    h("div", { class: `stat ${warn ? "warn" : ""}` },
      h("div", { class: "label" }, label),
      h("div", { class: "value" }, value));

  document.getElementById("stats").replaceChildren(
    stat("Pending orders", pending, pending > 0),
    stat("Delivered orders", delivered),
    stat("Products", state.products.length),
    stat("Units in stock", units.toLocaleString("en-IN"))
  );
}

/* ---------- Orders ---------- */

function renderOrders() {
  // Pending first, then newest
  const sorted = [...state.orders].sort((a, b) => {
    const pa = a.status === "pending" ? 0 : 1;
    const pb = b.status === "pending" ? 0 : 1;
    return pa - pb || new Date(b.createdAt) - new Date(a.createdAt);
  });

  ordersBody.replaceChildren(...sorted.map(orderRow));
  document.getElementById("orders-empty").classList.toggle("hidden", sorted.length > 0);
}

function orderRow(order) {
  const stock = order.product ? order.product.stock : null;
  const short = order.status === "pending" && stock !== null && stock < order.quantity;

  let actions = null;
  if (order.status === "pending") {
    actions = h("td", { class: "actions" },
      h("button", {
        class: "btn good small",
        disabled: short || stock === null,
        title: short ? `Only ${stock} in stock - restock first` : "",
        onclick: () => updateOrder(order._id, "delivered"),
      }, "Deliver"),
      h("button", {
        class: "btn danger small",
        onclick: () => {
          const note = prompt("Reason for rejecting (optional):");
          if (note !== null) updateOrder(order._id, "rejected", note);
        },
      }, "Reject"));
  } else {
    actions = h("td", {}, order.note ? h("span", { class: "sub" }, order.note) : null);
  }

  return h("tr", {},
    h("td", {}, fmtDate(order.createdAt)),
    h("td", {}, order.user ? order.user.name : "Deleted user",
      order.user ? h("span", { class: "sub" }, order.user.email) : null),
    h("td", {}, order.productName, h("span", { class: "sub" }, order.sku)),
    h("td", { class: "num-right" }, order.quantity),
    h("td", { class: "num-right" }, stock === null ? "-" : stock,
      short ? h("span", { class: "sub", style: "color:var(--bad)" }, "not enough") : null),
    h("td", { class: "num-right" }, money(order.quantity * order.unitPrice)),
    h("td", {}, badge(order.status, order.status[0].toUpperCase() + order.status.slice(1))),
    actions);
}

async function updateOrder(id, status, note = "") {
  await attempt(async () => {
    await api(`/api/supplier/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    });
    toast(status === "delivered" ? "Order delivered - stock updated" : "Order rejected");
    await load();
  });
}

/* ---------- Products ---------- */

function renderProducts() {
  productsBody.replaceChildren(...state.products.map(productRow));
  document.getElementById("products-empty").classList.toggle("hidden", state.products.length > 0);
}

function productRow(product) {
  const priceInput = h("input", {
    type: "number", min: 0, step: "0.01", value: product.price, class: "num",
    "aria-label": `Price of ${product.name}`,
    onchange: () =>
      attempt(async () => {
        await api(`/api/supplier/products/${product._id}`, {
          method: "PATCH",
          body: JSON.stringify({ price: priceInput.value }),
        });
        toast("Price updated");
        await load();
      }),
  });

  const addInput = h("input", {
    type: "number", min: 1, step: 1, value: 50, class: "num",
    "aria-label": `Units to add to ${product.name}`,
  });

  return h("tr", {},
    h("td", {}, product.name, h("span", { class: "sub" }, product.sku)),
    h("td", {}, priceInput),
    h("td", { class: "num-right" }, product.stock === 0 ? badge("out", "Out of stock") : product.stock),
    h("td", {}, h("div", { class: "cell-group" }, addInput,
      h("button", {
        class: "btn small",
        onclick: () =>
          attempt(async () => {
            await api(`/api/supplier/products/${product._id}/restock`, {
              method: "POST",
              body: JSON.stringify({ quantity: addInput.value }),
            });
            toast(`Added ${addInput.value} units to ${product.name}`);
            await load();
          }),
      }, "Add"))),
    h("td", {}, h("button", {
      class: "btn danger small",
      onclick: () => {
        if (!confirm(`Delete "${product.name}"?`)) return;
        attempt(async () => {
          await api(`/api/supplier/products/${product._id}`, { method: "DELETE" });
          toast("Product deleted");
          await load();
        });
      },
    }, "Delete")));
}

document.getElementById("product-form").addEventListener("submit", (e) => {
  e.preventDefault();
  attempt(async () => {
    await api("/api/supplier/products", {
      method: "POST",
      body: JSON.stringify({
        name: document.getElementById("p-name").value,
        sku: document.getElementById("p-sku").value,
        price: document.getElementById("p-price").value,
        stock: document.getElementById("p-stock").value,
      }),
    });
    e.target.reset();
    toast("Product added");
    await load();
  });
});

document.getElementById("refresh").addEventListener("click", async () => {
  await load();
  toast("Refreshed");
});

if (me) load();
