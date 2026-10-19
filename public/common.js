/* Shared helpers used by every page */

const TOKEN_KEY = "stockflow_token";
const USER_KEY = "stockflow_user";

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function homeFor(role) {
  return role === "supplier" ? "/supplier.html" : "/user.html";
}

function logout() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch { /* ignore */ }
  window.location.href = "/";
}

// Call at the top of a dashboard page. Redirects if not logged in as `role`.
function requireRole(role) {
  const user = getUser();
  if (!getToken() || !user) {
    window.location.href = "/";
    return null;
  }
  if (user.role !== role) {
    window.location.href = homeFor(user.role);
    return null;
  }
  document.getElementById("who").textContent = user.name;
  document.getElementById("logout").addEventListener("click", logout);
  return user;
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }

  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    logout();
    throw new Error("Session expired - please sign in again");
  }
  if (!res.ok) throw new Error((data && data.error) || "Request failed");
  return data;
}

// Tiny element builder. Text is always added as text nodes, so user input can't inject HTML.
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in el) el[key] = value;
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

const money = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

const fmtDate = (d) =>
  new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

let toastTimer;
function toast(message, type = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = h("div", { id: "toast", class: "toast hidden", role: "status" });
    document.body.append(el);
  }
  el.textContent = message;
  el.className = `toast ${type === "error" ? "error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3500);
}

function badge(kind, text) {
  return h("span", { class: `badge ${kind}` }, text);
}

// Run an async action, toast any error
async function attempt(fn) {
  try {
    return await fn();
  } catch (err) {
    toast(err.message, "error");
  }
}
