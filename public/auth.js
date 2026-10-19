// Already signed in? Go straight to the right dashboard.
(() => {
  const user = getUser();
  if (getToken() && user) window.location.href = homeFor(user.role);
})();

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const errorEl = document.getElementById("auth-error");
const tabs = document.querySelectorAll(".tab");

function showError(message) {
  errorEl.textContent = message || "";
  errorEl.classList.toggle("hidden", !message);
}

tabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    const isLogin = tab.dataset.tab === "login";
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    loginForm.classList.toggle("hidden", !isLogin);
    registerForm.classList.toggle("hidden", isLogin);
    showError("");
  })
);

async function submit(path, body, button) {
  showError("");
  button.disabled = true;
  try {
    const { token, user } = await api(path, { method: "POST", body: JSON.stringify(body) });
    saveSession(token, user);
    window.location.href = homeFor(user.role);
  } catch (err) {
    showError(err.message);
  } finally {
    button.disabled = false;
  }
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submit(
    "/api/auth/login",
    {
      email: document.getElementById("login-email").value,
      password: document.getElementById("login-password").value,
    },
    loginForm.querySelector("button")
  );
});

registerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submit(
    "/api/auth/register",
    {
      name: document.getElementById("reg-name").value,
      email: document.getElementById("reg-email").value,
      password: document.getElementById("reg-password").value,
      role: registerForm.querySelector("input[name=role]:checked").value,
    },
    registerForm.querySelector("button")
  );
});
