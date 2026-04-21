const refs = {
    revenue: document.getElementById("stat-revenue"),
    orders: document.getElementById("stat-orders"),
    pending: document.getElementById("stat-pending"),
    subscribers: document.getElementById("stat-subscribers"),
    ordersBody: document.getElementById("orders-body"),
    subscribersList: document.getElementById("subscribers-list"),
    refreshButton: document.getElementById("refresh-orders"),
    logoutButton: document.getElementById("logout-btn"),
    adminUser: document.getElementById("admin-user"),
    toast: document.getElementById("toast")
};

const currency = new Intl.NumberFormat("vi-VN");
let toastTimer;
let authToken = localStorage.getItem("voidx-auth-token") || "";
let authUser = readStoredUser();

document.addEventListener("DOMContentLoaded", async () => {
    refs.refreshButton.addEventListener("click", loadDashboard);
    refs.logoutButton.addEventListener("click", handleLogout);
    refs.ordersBody.addEventListener("change", handleStatusChange);
    await verifySession();
});

async function verifySession() {
    if (!authToken) {
        window.location.href = "/dang-nhap";
        return;
    }

    try {
        const response = await fetch("/api/auth/me", {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Phiên đăng nhập không hợp lệ");
        }

        authUser = result.user;
        if (authUser.role !== "admin") {
            throw new Error("Bạn không có quyền vào trang quản trị");
        }

        refs.adminUser.textContent = `${authUser.name} • ${authUser.email}`;
        await loadDashboard();
    } catch (error) {
        clearSession();
        showToast(error.message || "Vui lòng đăng nhập lại");
        window.setTimeout(() => {
            window.location.href = "/dang-nhap";
        }, 700);
    }
}

async function loadDashboard() {
    try {
        const [dashboardResponse, ordersResponse, subscribersResponse] = await Promise.all([
            fetch("/api/dashboard", { headers: getAuthHeaders() }),
            fetch("/api/orders", { headers: getAuthHeaders() }),
            fetch("/api/subscribers", { headers: getAuthHeaders() })
        ]);

        if (!dashboardResponse.ok || !ordersResponse.ok || !subscribersResponse.ok) {
            throw new Error("Không thể tải dữ liệu quản trị");
        }

        const dashboard = await dashboardResponse.json();
        const orders = await ordersResponse.json();
        const subscribers = await subscribersResponse.json();

        refs.revenue.textContent = formatPrice(dashboard.revenue);
        refs.orders.textContent = String(dashboard.orderCount);
        refs.pending.textContent = String(dashboard.pendingOrders);
        refs.subscribers.textContent = String(dashboard.subscriberCount);

        renderOrders(orders);
        renderSubscribers(subscribers);
    } catch (error) {
        console.error(error);
        showToast(error.message || "Lỗi tải dashboard");
    }
}

function renderOrders(orders) {
    if (!orders.length) {
        refs.ordersBody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-admin">Chưa có đơn hàng nào được tạo.</div>
                </td>
            </tr>
        `;
        return;
    }

    refs.ordersBody.innerHTML = orders.map((order) => `
        <tr>
            <td>${order.orderCode}</td>
            <td>
                <strong>${order.customer.name}</strong><br>
                ${order.customer.phone}<br>
                <span>${order.customer.address}</span>
            </td>
            <td>
                <div class="order-items">
                    ${order.items.map((item) => `<span>${item.name} x${item.quantity}</span>`).join("")}
                </div>
            </td>
            <td>${formatPrice(order.total)}</td>
            <td>${order.status || "Chờ xác nhận"}</td>
            <td>
                <select class="status-select" data-order-code="${order.orderCode}">
                    ${renderStatusOptions(order.status)}
                </select>
            </td>
        </tr>
    `).join("");
}

function renderSubscribers(subscribers) {
    if (!subscribers.length) {
        refs.subscribersList.innerHTML = '<div class="empty-admin">Chưa có email nào đăng ký.</div>';
        return;
    }

    refs.subscribersList.innerHTML = subscribers.map((subscriber) => `
        <article class="subscriber-item">
            <strong>${subscriber.email}</strong>
            <span>${formatDate(subscriber.createdAt)}</span>
        </article>
    `).join("");
}

async function handleStatusChange(event) {
    const select = event.target.closest(".status-select");

    if (!select) {
        return;
    }

    try {
        const response = await fetch(`/api/orders/${select.dataset.orderCode}`, {
            method: "PATCH",
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status: select.value
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không cập nhật được trạng thái");
        }

        showToast(result.message);
        await loadDashboard();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Cập nhật thất bại");
    }
}

async function handleLogout() {
    try {
        await fetch("/api/auth/logout", {
            method: "POST",
            headers: getAuthHeaders()
        });
    } catch (error) {
        console.error(error);
    } finally {
        clearSession();
        window.location.href = "/dang-nhap";
    }
}

function renderStatusOptions(currentStatus) {
    const statuses = ["Chờ xác nhận", "Đang xử lý", "Đang giao", "Đã giao", "Đã hủy"];
    return statuses.map((status) => `
        <option value="${status}" ${status === currentStatus ? "selected" : ""}>${status}</option>
    `).join("");
}

function getAuthHeaders() {
    return {
        Authorization: `Bearer ${authToken}`
    };
}

function clearSession() {
    localStorage.removeItem("voidx-auth-token");
    localStorage.removeItem("voidx-auth-user");
}

function readStoredUser() {
    try {
        const raw = localStorage.getItem("voidx-auth-user");
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function formatPrice(value) {
    return `${currency.format(value || 0)} VNĐ`;
}

function formatDate(dateString) {
    if (!dateString) {
        return "Không rõ thời gian";
    }

    return new Date(dateString).toLocaleString("vi-VN");
}

function showToast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        refs.toast.classList.remove("show");
    }, 2500);
}
