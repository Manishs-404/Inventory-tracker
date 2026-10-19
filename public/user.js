const me = requireRole("user");
const state = { inventory: [], catalog: [], orders: [] };

const inventoryBody = document.getElementById("inventory-body");
const ordersBody = document.getElementById("orders-body");
const productSelect = document.getElementById("a-product");

async function load() {
  await attempt(async () => {
    const [inventory, catalog, orders] = await Promise.all([
      api("/api/user/inventory"),
      api("/api/user/catalog"),
      api("/api/user/orders"),
    ]);
    state.inventory = inventory;
    state.catalog = catalog;
    state.orders = orders;
    render();
  });
}

function render() {
  renderAlert();
  renderStats();
  renderInventory();
  renderCatalog();
  renderOrders();
}

const isOut = (item) => item.quantity === 0;
// Low items that don't already have an order on the way
const needsOrder = (item) => item.product && item.lowStock && item.pendingQty === 0;

/* ---------- Alert + stats ---------- */

function renderAlert() {
  const alertEl = document.getElementById("alert");
  const lowItems = state.inventory.filter((i) => i.product && i.lowStock);
  const toOrder = state.inventory.filter(needsOrder);

  if (lowItems.length === 0) {
    alertEl.classList.add("hidden");
    return;
  }

  const names = lowItems
    .map((i) => `${i.product.name} (${i.quantity} left${i.pendingQty ? `, ${i.pendingQty} on order` : ""})`)
    .join(", ");

  alertEl.replaceChildren(
    h("div", {},
      h("strong", {}, `${lowItems.length} item${lowItems.length > 1 ? "s" : ""} running low`),
      h("span", {}, names)),
    toOrder.length
      ? h("button", { class: "btn small", onclick: () => orderAllLow(toOrder) },
          `Order all low items (${toOrder.length})`)
      : h("span", {}, "All low items already have orders on the way."));
  alertEl.classList.remove("hidden");
}

function renderStats() {
  const low = state.inventory.filter((i) => i.product && i.lowStock).length;
  const pending = state.orders.filter((o) => o.status === "pending").length;

  const stat = (label, value, warn) =>
    h("div", { class: `stat ${warn ? "warn" : ""}` },
      h("div", { class: "label" }, label),
      h("div", { class: "value" }, value));

  document.getElementById("stats").replaceChildren(
    stat("Items tracked", state.inventory.length),
    stat("Running low", low, low > 0),
    stat("Orders on the way", pending)
  );
}

/* ---------- Inventory ---------- */

function renderInventory() {
  // Most urgent first: out of stock, then low, then the rest
  const rank = (i) => (isOut(i) ? 0 : i.lowStock ? 1 : 2);
  const sorted = [...state.inventory].sort((a, b) => rank(a) - rank(b));

  inventoryBody.replaceChildren(...sorted.map(inventoryRow));
  document.getElementById("inventory-empty").classList.toggle("hidden", sorted.length > 0);
}

function inventoryRow(item) {
  const p = item.product;
  const qty = h("input", { type: "number", min: 0, step: 1, value: item.quantity, class: "num", "aria-label": "Units in stock" });
  const level = h("input", { type: "number", min: 0, step: 1, value: item.reorderLevel, class: "num", "aria-label": "Reorder point" });
  const orderQty = h("input", { type: "number", min: 1, step: 1, value: item.reorderQuantity, class: "num", "aria-label": "Order quantity" });

  const status = isOut(item) ? badge("out", "Out of stock") : item.lowStock ? badge("low", "Low") : badge("ok", "OK");
  const rowClass = isOut(item) ? "row-out" : item.lowStock ? "row-low" : "";

  const save = () =>
    attempt(async () => {
      await api(`/api/user/inventory/${item._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          quantity: qty.value,
          reorderLevel: level.value,
          reorderQuantity: orderQty.value,
        }),
      });
      toast("Saved");
      await load();
    });

  const placeOrder = () => createOrder(p._id, orderQty.value, p.name);

  const remove = () => {
    if (!confirm("Stop tracking this item?")) return;
    attempt(async () => {
      await api(`/api/user/inventory/${item._id}`, { method: "DELETE" });
      await load();
    });
  };

  return h("tr", { class: rowClass },
    h("td", {},
      p ? p.name : "Discontinued product",
      p ? h("span", { class: "sub" }, `${p.sku} - ${p.supplier ? p.supplier.name : "Unknown supplier"} - ${money(p.price)} each`) : null),
    h("td", {}, qty),
    h("td", {}, level),
    h("td", {}, status,
      item.pendingQty ? h("span", { class: "sub" }, `${item.pendingQty} on order`) : null),
    h("td", {}, orderQty,
      p ? h("span", { class: "sub" }, p.stock < Number(item.reorderQuantity) ? `Supplier has ${p.stock}` : null) : null),
    h("td", { class: "actions" },
      h("button", { class: item.lowStock ? "btn small" : "btn ghost small", disabled: !p, onclick: placeOrder }, "Order"),
      h("button", { class: "btn ghost small", onclick: save }, "Save"),
      h("button", { class: "btn danger small", "aria-label": "Remove item", onclick: remove }, "Remove")));
}

async function createOrder(productId, quantity, name) {
  await attempt(async () => {
    await api("/api/user/orders", {
      method: "POST",
      body: JSON.stringify({ productId, quantity }),
    });
    toast(`Order placed for ${quantity} x ${name}`);
    await load();
  });
}

async function orderAllLow(items) {
  await attempt(async () => {
    for (const item of items) {
      await api("/api/user/orders", {
        method: "POST",
        body: JSON.stringify({ productId: item.product._id, quantity: item.reorderQuantity }),
      });
    }
    toast(`Placed ${items.length} order${items.length > 1 ? "s" : ""}`);
    await load();
  });
}

/* ---------- Add-from-catalog form ---------- */

function renderCatalog() {
  const tracked = new Set(state.inventory.filter((i) => i.product).map((i) => i.product._id));
  const available = state.catalog.filter((p) => !tracked.has(p._id));

  productSelect.replaceChildren(
    h("option", { value: "" }, available.length ? "Choose a product..." : "No more products to add"),
    ...available.map((p) =>
      h("option", { value: p._id },
        `${p.name} (${p.sku}) - ${p.supplier ? p.supplier.name : "?"} - ${money(p.price)}`)));
  productSelect.value = "";
}

document.getElementById("add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  attempt(async () => {
    await api("/api/user/inventory", {
      method: "POST",
      body: JSON.stringify({
        productId: productSelect.value,
        quantity: document.getElementById("a-qty").value,
        reorderLevel: document.getElementById("a-level").value,
        reorderQuantity: document.getElementById("a-reorder").value,
      }),
    });
    toast("Added to inventory");
    await load();
  });
});

/* ---------- Orders ---------- */

function renderOrders() {
  ordersBody.replaceChildren(...state.orders.map(orderRow));
  document.getElementById("orders-empty").classList.toggle("hidden", state.orders.length > 0);
}

function orderRow(order) {
  return h("tr", {},
    h("td", {}, fmtDate(order.createdAt)),
    h("td", {}, order.productName, h("span", { class: "sub" }, order.sku)),
    h("td", {}, order.supplier ? order.supplier.name : "-"),
    h("td", { class: "num-right" }, order.quantity),
    h("td", { class: "num-right" }, money(order.quantity * order.unitPrice)),
    h("td", {},
      badge(order.status, order.status[0].toUpperCase() + order.status.slice(1)),
      order.note ? h("span", { class: "sub" }, order.note) : null),
    h("td", {}, order.status === "pending"
      ? h("button", {
          class: "btn danger small",
          onclick: () =>
            attempt(async () => {
              await api(`/api/user/orders/${order._id}/cancel`, { method: "PATCH" });
              toast("Order cancelled");
              await load();
            }),
        }, "Cancel")
      : null));
}

document.getElementById("refresh").addEventListener("click", async () => {
  await load();
  toast("Refreshed");
});

if (me) load();
