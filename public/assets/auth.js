const authToast = document.getElementById("toast");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
let authToastTimer;

document.addEventListener("DOMContentLoaded", () => {
    loginForm?.addEventListener("submit", handleLogin);
    registerForm?.addEventListener("submit", handleRegister);
});

async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const payload = {
        email: String(formData.get("email") || "").trim(),
        password: String(formData.get("password") || "")
    };

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Đăng nhập thất bại");
        }

        saveSession(result.token, result.user);
        showAuthToast(result.message);
        window.setTimeout(() => {
            window.location.href = result.user.role === "admin" ? "/admin" : "/";
        }, 700);
    } catch (error) {
        showAuthToast(error.message || "Không thể đăng nhập");
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const formData = new FormData(registerForm);
    const payload = {
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        password: String(formData.get("password") || "")
    };

    try {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Đăng ký thất bại");
        }

        showAuthToast(result.message);
        window.setTimeout(() => {
            window.location.href = "/dang-nhap";
        }, 900);
    } catch (error) {
        showAuthToast(error.message || "Không thể đăng ký");
    }
}

function saveSession(token, user) {
    localStorage.setItem("voidx-auth-token", token);
    localStorage.setItem("voidx-auth-user", JSON.stringify(user));
}

function showAuthToast(message) {
    if (!authToast) return;
    authToast.textContent = message;
    authToast.classList.add("show");
    clearTimeout(authToastTimer);
    authToastTimer = setTimeout(() => {
        authToast.classList.remove("show");
    }, 2600);
}
