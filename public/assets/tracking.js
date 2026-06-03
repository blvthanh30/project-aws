document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("tracking-form");
    const result = document.getElementById("tracking-result");
    const queryInput = document.getElementById("tracking-query");

    if (!form || !result || !queryInput) {
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const query = String(queryInput.value || "").trim();
        if (!query) {
            renderTrackingEmpty(result, "Vui lòng nhập mã đơn hoặc số điện thoại.");
            return;
        }

        renderTrackingLoading(result);

        try {
            const response = await fetch(`/api/order-track?query=${encodeURIComponent(query)}`);
            const payload = await response.json();

            if (!response.ok || !payload.success) {
                throw new Error(payload.message || "Không tra cứu được đơn hàng");
            }

            renderTrackingOrders(result, payload.orders || []);
        } catch (error) {
            renderTrackingEmpty(result, error.message || "Không tra cứu được đơn hàng");
        }
    });
});

function renderTrackingLoading(container) {
    container.innerHTML = `
        <div class="tracking-card">
            <p class="tracking-message">Đang tra cứu đơn hàng, vui lòng chờ một chút...</p>
        </div>
    `;
}

function renderTrackingEmpty(container, message) {
    container.innerHTML = `
        <div class="tracking-card">
            <p class="tracking-message">${escapeHtml(message)}</p>
        </div>
    `;
}

function renderTrackingOrders(container, orders) {
    if (!orders.length) {
        renderTrackingEmpty(container, "Không tìm thấy đơn hàng phù hợp.");
        return;
    }

    container.innerHTML = orders.map((order) => `
        <article class="tracking-card">
            <div class="tracking-head">
                <div>
                    <p class="eyebrow">Mã đơn hàng</p>
                    <h3>${escapeHtml(order.orderCode)}</h3>
                    <p class="tracking-meta">Khách đặt: ${escapeHtml(order.customer?.name || "Khách hàng")} • ${escapeHtml(order.customer?.phone || "")}</p>
                </div>
                <div class="tracking-status-badge status-${order.statusStep}">
                    ${escapeHtml(order.status)}
                </div>
            </div>

            <div class="tracking-progress ${order.statusStep < 0 ? "is-cancelled" : ""}">
                ${renderTrackingStep("Chờ xác nhận", order.statusStep, 1)}
                ${renderTrackingStep("Đang xử lý", order.statusStep, 2)}
                ${renderTrackingStep("Đang giao", order.statusStep, 3)}
                ${renderTrackingStep("Đã giao", order.statusStep, 4)}
            </div>

            <div class="tracking-summary-grid">
                <div class="tracking-summary-item">
                    <span>Ngày đặt</span>
                    <strong>${formatTrackingDate(order.createdAt)}</strong>
                </div>
                <div class="tracking-summary-item">
                    <span>Cập nhật gần nhất</span>
                    <strong>${formatTrackingDate(order.updatedAt || order.createdAt)}</strong>
                </div>
                <div class="tracking-summary-item">
                    <span>Số món</span>
                    <strong>${order.itemCount || 0}</strong>
                </div>
                <div class="tracking-summary-item">
                    <span>Tổng tiền</span>
                    <strong>${formatTrackingPrice(order.total)}</strong>
                </div>
            </div>

            <div class="tracking-products">
                ${(order.items || []).map((item) => `
                    <div class="tracking-product-item">
                        <span>${escapeHtml(item.name)}</span>
                        <strong>x${item.quantity}</strong>
                    </div>
                `).join("")}
            </div>

            ${renderTrackingHistory(order.statusHistory || [])}
        </article>
    `).join("");
}

function renderTrackingStep(label, currentStep, targetStep) {
    const active = currentStep >= targetStep;
    return `
        <div class="tracking-step ${active ? "is-active" : ""}">
            <span class="tracking-dot"></span>
            <strong>${label}</strong>
        </div>
    `;
}

function renderTrackingHistory(history) {
    if (!history.length) {
        return "";
    }

    return `
        <div class="tracking-history">
            <p class="eyebrow">Lịch sử cập nhật</p>
            <div class="tracking-history-list">
                ${history.slice(0, 4).map((item) => `
                    <div class="tracking-history-item">
                        <strong>${escapeHtml(item.status)}</strong>
                        <span>${formatTrackingDate(item.changedAt)}</span>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

function formatTrackingPrice(value) {
    return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))} VNĐ`;
}

function formatTrackingDate(value) {
    if (!value) {
        return "Không rõ";
    }

    return new Date(value).toLocaleString("vi-VN");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
