const ORDER_STATUSES = ["Chờ xác nhận", "Đang xử lý", "Đang giao", "Đã giao", "Đã hủy"];

const refs = {
    nav: document.getElementById("admin-nav"),
    revenue: document.getElementById("stat-revenue"),
    orders: document.getElementById("stat-orders"),
    pending: document.getElementById("stat-pending"),
    subscribers: document.getElementById("stat-subscribers"),
    ordersBody: document.getElementById("orders-body"),
    subscribersList: document.getElementById("subscribers-list"),
    usersList: document.getElementById("users-list"),
    productsList: document.getElementById("products-list"),
    couponsList: document.getElementById("coupons-list"),
    topProducts: document.getElementById("top-products"),
    lowStockProducts: document.getElementById("low-stock-products"),
    statusList: document.getElementById("status-list"),
    refreshButton: document.getElementById("refresh-orders"),
    logoutButton: document.getElementById("logout-btn"),
    adminUser: document.getElementById("admin-user"),
    toast: document.getElementById("toast"),
    systemStatus: document.getElementById("system-status"),
    newProductButton: document.getElementById("new-product-btn"),
    resetProductButton: document.getElementById("reset-product-btn"),
    productForm: document.getElementById("product-form"),
    storeForm: document.getElementById("store-form"),
    productId: document.getElementById("product-id"),
    productName: document.getElementById("product-name"),
    productCategory: document.getElementById("product-category"),
    productPrice: document.getElementById("product-price"),
    productOriginalPrice: document.getElementById("product-original-price"),
    productDiscount: document.getElementById("product-discount"),
    productStatus: document.getElementById("product-status"),
    productStock: document.getElementById("product-stock"),
    productTag: document.getElementById("product-tag"),
    productImage: document.getElementById("product-image"),
    productImageFile: document.getElementById("product-image-file"),
    productImagePreview: document.getElementById("product-image-preview"),
    productMaterial: document.getElementById("product-material"),
    productSizes: document.getElementById("product-sizes"),
    productColors: document.getElementById("product-colors"),
    productDesc: document.getElementById("product-desc"),
    couponForm: document.getElementById("coupon-form"),
    couponEditCode: document.getElementById("coupon-edit-code"),
    couponCodeInput: document.getElementById("coupon-code-input"),
    couponType: document.getElementById("coupon-type"),
    couponValue: document.getElementById("coupon-value"),
    couponMinOrder: document.getElementById("coupon-min-order"),
    couponMaxDiscount: document.getElementById("coupon-max-discount"),
    couponUsageLimit: document.getElementById("coupon-usage-limit"),
    couponExpiresAt: document.getElementById("coupon-expires-at"),
    couponActive: document.getElementById("coupon-active"),
    resetCouponButton: document.getElementById("reset-coupon-btn"),
    clearCouponButton: document.getElementById("clear-coupon-btn"),
    storeName: document.getElementById("store-name"),
    storeHotline: document.getElementById("store-hotline"),
    storeEmail: document.getElementById("store-email"),
    storeAddress: document.getElementById("store-address"),
    storeHeadline: document.getElementById("store-headline"),
    storeSubheadline: document.getElementById("store-subheadline"),
    storeHeroImage: document.getElementById("store-hero-image"),
    storeInstagram: document.getElementById("store-instagram"),
    storeFacebook: document.getElementById("store-facebook"),
    storeTiktok: document.getElementById("store-tiktok"),
    storeShippingPolicy: document.getElementById("store-shipping-policy"),
    storeReturnPolicy: document.getElementById("store-return-policy"),
    storePaymentPolicy: document.getElementById("store-payment-policy")
};

const state = {
    dashboard: null,
    orders: [],
    products: [],
    coupons: [],
    subscribers: [],
    users: [],
    store: null
};

const currency = new Intl.NumberFormat("vi-VN");
let toastTimer;
let authToken = localStorage.getItem("voidx-auth-token") || "";
let authUser = readStoredUser();

document.addEventListener("DOMContentLoaded", async () => {
    refs.nav?.addEventListener("click", handleSectionChange);
    refs.refreshButton?.addEventListener("click", loadAllData);
    refs.logoutButton?.addEventListener("click", handleLogout);
    refs.ordersBody?.addEventListener("change", handleStatusChange);
    refs.ordersBody?.addEventListener("click", handleOrderQuickAction);
    refs.productsList?.addEventListener("click", handleProductListClick);
    refs.newProductButton?.addEventListener("click", resetProductForm);
    refs.resetProductButton?.addEventListener("click", resetProductForm);
    refs.productForm?.addEventListener("submit", handleProductSubmit);
    refs.productImageFile?.addEventListener("change", handleProductImageUpload);
    refs.productImage?.addEventListener("input", updateProductImagePreview);
    refs.productDiscount?.addEventListener("input", updateSalePriceFromDiscount);
    refs.productOriginalPrice?.addEventListener("input", updateSalePriceFromDiscount);
    refs.productStatus?.addEventListener("change", handleProductStatusChange);
    refs.couponsList?.addEventListener("click", handleCouponListClick);
    refs.couponForm?.addEventListener("submit", handleCouponSubmit);
    refs.resetCouponButton?.addEventListener("click", resetCouponForm);
    refs.clearCouponButton?.addEventListener("click", resetCouponForm);
    refs.storeForm?.addEventListener("submit", handleStoreSubmit);
    await verifySession();
});

function handleSectionChange(event) {
    const button = event.target.closest(".admin-nav-link");
    if (!button) {
        return;
    }

    setActiveSection(button.dataset.section || "tong-quan");
}

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
        await loadAllData();
    } catch (error) {
        clearSession();
        showToast(error.message || "Vui lòng đăng nhập lại");
        window.setTimeout(() => {
            window.location.href = "/dang-nhap";
        }, 800);
    }
}

async function loadAllData() {
    try {
        setSystemStatus("Đang tải dữ liệu...");

        const [
            dashboardResponse,
            ordersResponse,
            subscribersResponse,
            productsResponse,
            couponsResponse,
            storeResponse,
            usersResponse
        ] = await Promise.all([
            fetch("/api/dashboard", { headers: getAuthHeaders() }),
            fetch("/api/orders", { headers: getAuthHeaders() }),
            fetch("/api/subscribers", { headers: getAuthHeaders() }),
            fetch("/api/products", { headers: getAuthHeaders() }),
            fetch("/api/coupons", { headers: getAuthHeaders() }),
            fetch("/api/store", { headers: getAuthHeaders() }),
            fetch("/api/users", { headers: getAuthHeaders() })
        ]);

        const responses = [
            dashboardResponse,
            ordersResponse,
            subscribersResponse,
            productsResponse,
            couponsResponse,
            storeResponse,
            usersResponse
        ];

        if (responses.some((response) => !response.ok)) {
            throw new Error("Không thể tải dữ liệu quản trị");
        }

        state.dashboard = await dashboardResponse.json();
        state.orders = await ordersResponse.json();
        state.subscribers = await subscribersResponse.json();
        state.products = await productsResponse.json();
        state.coupons = await couponsResponse.json();
        state.store = await storeResponse.json();
        state.users = await usersResponse.json();

        renderDashboard();
        renderOrders(state.orders);
        renderSubscribers(state.subscribers);
        renderProducts(state.products);
        renderCoupons(state.coupons);
        renderStoreForm(state.store);
        renderUsers(state.users);
        setSystemStatus("Dữ liệu đã đồng bộ");
    } catch (error) {
        console.error(error);
        setSystemStatus("Có lỗi khi đồng bộ");
        showToast(error.message || "Lỗi tải dashboard");
    }
}

function renderDashboard() {
    const dashboard = state.dashboard || {};

    refs.revenue.textContent = formatPrice(dashboard.revenue);
    refs.orders.textContent = String(dashboard.orderCount || 0);
    refs.pending.textContent = String(dashboard.pendingOrders || 0);
    refs.subscribers.textContent = String(dashboard.subscriberCount || 0);

    renderTopProducts(dashboard.topProducts || []);
    renderLowStockProducts(dashboard.lowStockProducts || []);
    renderStatusCounts(dashboard.statusCounts || {});
}

function renderTopProducts(products) {
    if (!products.length) {
        refs.topProducts.innerHTML = '<div class="empty-admin">Chưa có dữ liệu bán chạy.</div>';
        return;
    }

    refs.topProducts.innerHTML = products.map((product) => `
        <article class="stack-item">
            <div>
                <strong>${escapeHtml(product.name)}</strong>
                <span>Đã bán: ${product.sold || 0}</span>
            </div>
            <span>Tồn: ${product.stock || 0}</span>
        </article>
    `).join("");
}

function renderLowStockProducts(products) {
    if (!products.length) {
        refs.lowStockProducts.innerHTML = '<div class="empty-admin">Tồn kho đang ổn.</div>';
        return;
    }

    refs.lowStockProducts.innerHTML = products.map((product) => `
        <article class="stack-item">
            <div>
                <strong>${escapeHtml(product.name)}</strong>
                <span>${escapeHtml(product.category || "Sản phẩm")}</span>
            </div>
            <span>${product.stock || 0} sản phẩm</span>
        </article>
    `).join("");
}

function renderStatusCounts(statusCounts) {
    const entries = ORDER_STATUSES.map((status) => ({
        label: status,
        value: statusCounts[status] || 0
    }));

    refs.statusList.innerHTML = entries.map((item) => `
        <article class="status-item">
            <div>
                <strong>${escapeHtml(item.label)}</strong>
                <span>Số lượng đơn đang ở trạng thái này</span>
            </div>
            <span>${item.value}</span>
        </article>
    `).join("");
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
            <td>${escapeHtml(order.orderCode)}</td>
            <td>
                <strong>${escapeHtml(order.customer?.name || "Khách lẻ")}</strong><br>
                ${escapeHtml(order.customer?.phone || "")}<br>
                <span>${escapeHtml(order.customer?.address || "")}</span>
            </td>
            <td>
                <div class="order-items">
                    ${(order.items || []).map((item) => `
                        <span>${escapeHtml(item.name)} x${item.quantity}</span>
                    `).join("")}
                </div>
            </td>
            <td>${formatPrice(order.total)}</td>
            <td>
                <span class="order-status-pill">${escapeHtml(order.status || "Chờ xác nhận")}</span>
                <div class="order-fulfillment">
                    <span>${escapeHtml(order.payment?.label || order.customer?.paymentMethod || "COD")}</span>
                    <span>${escapeHtml(order.shipping?.providerLabel || order.customer?.shippingMethod || "Shop xác nhận")}</span>
                    ${order.shipping?.trackingCode ? `<strong>${escapeHtml(order.shipping.trackingCode)}</strong>` : ""}
                </div>
            </td>
            <td>
                <select class="status-select" data-order-code="${escapeHtml(order.orderCode)}">
                    ${renderStatusOptions(order.status)}
                </select>
                <div class="order-quick-actions">
                    ${renderOrderQuickActions(order)}
                </div>
                <div class="shipping-push-actions">
                    ${renderShippingPushActions(order)}
                </div>
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
        <article class="stack-item">
            <div>
                <strong>${escapeHtml(subscriber.email)}</strong>
                <span>Khách đã để lại email để nhận tin</span>
            </div>
            <span>${formatDate(subscriber.createdAt)}</span>
        </article>
    `).join("");
}

function renderUsers(users) {
    if (!users.length) {
        refs.usersList.innerHTML = '<div class="empty-admin">Chưa có tài khoản nào.</div>';
        return;
    }

    refs.usersList.innerHTML = users.map((user) => `
        <article class="stack-item">
            <div>
                <strong>${escapeHtml(user.name || "Không rõ tên")}</strong>
                <span>${escapeHtml(user.email)}</span>
            </div>
            <span>${user.role === "admin" ? "Quản trị" : "Khách hàng"}</span>
        </article>
    `).join("");
}

function renderProducts(products) {
    if (!products.length) {
        refs.productsList.innerHTML = '<div class="empty-admin">Chưa có sản phẩm nào.</div>';
        return;
    }

    refs.productsList.innerHTML = products.map((product) => `
        <article class="catalog-card">
            <div class="catalog-card-head">
                <img class="catalog-thumb" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
                <div>
                    <h3>${escapeHtml(product.name)}</h3>
                    <p>${escapeHtml(product.desc || "Chưa có mô tả")}</p>
                </div>
                <div class="catalog-price-group">
                    ${Number(product.discountPercent || 0) > 0 && Number(product.originalPrice || 0) > Number(product.price || 0)
                        ? `<span>${formatPrice(product.originalPrice)}</span>`
                        : ""}
                    <strong class="catalog-price">${formatPrice(product.price)}</strong>
                </div>
            </div>

            <div class="catalog-card-tags">
                <span>${escapeHtml(product.category || "Danh mục")}</span>
                <span class="${Number(product.stock || 0) <= 0 || product.status === "out-of-stock" ? "danger-chip" : ""}">
                    ${Number(product.stock || 0) <= 0 || product.status === "out-of-stock" ? "Hết hàng" : `Tồn kho: ${product.stock || 0}`}
                </span>
                ${Number(product.discountPercent || 0) > 0 ? `<span class="sale-chip">Giảm ${product.discountPercent}%</span>` : ""}
                ${product.tag ? `<span>${escapeHtml(product.tag)}</span>` : ""}
            </div>

            <div class="catalog-card-meta">
                <span class="muted-text">${escapeHtml(product.material || "Chưa có chất liệu")}</span>
                <div class="catalog-actions">
                    <button type="button" class="action-link" data-action="edit-product" data-product-id="${product.id}">Sửa</button>
                    <button type="button" class="action-link" data-action="toggle-stock" data-product-id="${product.id}">
                        ${Number(product.stock || 0) <= 0 || product.status === "out-of-stock" ? "Mở bán lại" : "Set hết hàng"}
                    </button>
                    <button type="button" class="action-link" data-action="stock-plus-5" data-product-id="${product.id}">Nhập +5</button>
                    <button type="button" class="action-link" data-action="stock-minus-1" data-product-id="${product.id}">Trừ -1</button>
                    <button type="button" class="action-link" data-action="discount-20" data-product-id="${product.id}">Giảm 20%</button>
                    <button type="button" class="action-link danger" data-action="delete-product" data-product-id="${product.id}">Xóa</button>
                </div>
            </div>
        </article>
    `).join("");
}

function renderCoupons(coupons) {
    if (!refs.couponsList) {
        return;
    }

    if (!coupons.length) {
        refs.couponsList.innerHTML = '<div class="empty-admin">Chưa có mã giảm giá nào.</div>';
        return;
    }

    refs.couponsList.innerHTML = coupons.map((coupon) => {
        const isExpired = coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now();
        const isActive = Boolean(coupon.active) && !isExpired;
        const valueText = coupon.type === "fixed" ? formatPrice(coupon.value) : `${coupon.value}%`;
        const usageText = Number(coupon.usageLimit || 0) > 0
            ? `${coupon.usedCount || 0}/${coupon.usageLimit}`
            : `${coupon.usedCount || 0}/Không giới hạn`;

        return `
            <article class="coupon-card">
                <div>
                    <div class="coupon-code">${escapeHtml(coupon.code)}</div>
                    <p>
                        Giảm ${escapeHtml(valueText)}
                        ${Number(coupon.minOrder || 0) > 0 ? ` cho đơn từ ${formatPrice(coupon.minOrder)}` : ""}
                        ${Number(coupon.maxDiscount || 0) > 0 ? `, tối đa ${formatPrice(coupon.maxDiscount)}` : ""}
                    </p>
                </div>
                <div class="coupon-meta">
                    <span class="${isActive ? "sale-chip" : "danger-chip"}">${isActive ? "Đang bật" : "Đang tắt / hết hạn"}</span>
                    <span>Lượt dùng: ${escapeHtml(usageText)}</span>
                    <span>Hết hạn: ${coupon.expiresAt ? formatDate(coupon.expiresAt) : "Không giới hạn"}</span>
                </div>
                <div class="catalog-actions">
                    <button type="button" class="action-link" data-action="edit-coupon" data-coupon-code="${escapeHtml(coupon.code)}">Sửa</button>
                    <button type="button" class="action-link" data-action="toggle-coupon" data-coupon-code="${escapeHtml(coupon.code)}">
                        ${coupon.active ? "Tắt mã" : "Bật mã"}
                    </button>
                    <button type="button" class="action-link danger" data-action="delete-coupon" data-coupon-code="${escapeHtml(coupon.code)}">Xóa</button>
                </div>
            </article>
        `;
    }).join("");
}

function renderStoreForm(store) {
    refs.storeName.value = store.name || "";
    refs.storeHotline.value = store.hotline || "";
    refs.storeEmail.value = store.email || "";
    refs.storeAddress.value = store.address || "";
    refs.storeHeadline.value = store.headline || "";
    refs.storeSubheadline.value = store.subheadline || "";
    refs.storeHeroImage.value = store.heroImage || "";
    refs.storeInstagram.value = store.socials?.instagram || "";
    refs.storeFacebook.value = store.socials?.facebook || "";
    refs.storeTiktok.value = store.socials?.tiktok || "";
    refs.storeShippingPolicy.value = store.shippingPolicy || "";
    refs.storeReturnPolicy.value = store.returnPolicy || "";
    refs.storePaymentPolicy.value = store.paymentPolicy || "";
}

async function handleStatusChange(event) {
    const select = event.target.closest(".status-select");

    if (!select) {
        return;
    }

    await updateOrderStatus(select.dataset.orderCode, select.value);
}

async function handleOrderQuickAction(event) {
    const shipButton = event.target.closest("[data-ship-provider]");
    if (shipButton) {
        shipButton.disabled = true;
        await pushOrderToShipping(shipButton.dataset.orderCode, shipButton.dataset.shipProvider);
        return;
    }

    const button = event.target.closest("[data-order-status]");

    if (!button) {
        return;
    }

    button.disabled = true;
    await updateOrderStatus(button.dataset.orderCode, button.dataset.orderStatus);
}

async function pushOrderToShipping(orderCode, provider) {
    try {
        const response = await fetch(`/api/orders/${orderCode}/ship`, {
            method: "POST",
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ provider })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không đẩy được đơn sang vận chuyển");
        }

        showToast(result.message);
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Đẩy vận chuyển thất bại");
    }
}

async function updateOrderStatus(orderCode, status) {
    try {
        const response = await fetch(`/api/orders/${orderCode}`, {
            method: "PATCH",
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không cập nhật được trạng thái");
        }

        showToast(result.message);
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Cập nhật thất bại");
    }
}

function handleProductListClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
        return;
    }

    const productId = button.dataset.productId;
    const product = state.products.find((item) => String(item.id) === String(productId));

    if (!product) {
        showToast("Không tìm thấy sản phẩm cần thao tác");
        return;
    }

    if (button.dataset.action === "edit-product") {
        setActiveSection("san-pham");
        fillProductForm(product);
        refs.productName.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
    }

    if (button.dataset.action === "toggle-stock") {
        toggleProductStock(product);
        return;
    }

    if (button.dataset.action === "discount-20") {
        applyQuickDiscount(product, 20);
        return;
    }

    if (button.dataset.action === "stock-plus-5") {
        adjustProductStock(product, 5);
        return;
    }

    if (button.dataset.action === "stock-minus-1") {
        adjustProductStock(product, -1);
        return;
    }

    if (button.dataset.action === "delete-product") {
        deleteProduct(product);
    }
}

function fillProductForm(product) {
    refs.productId.value = product.id || "";
    refs.productName.value = product.name || "";
    refs.productCategory.value = product.category || "";
    refs.productPrice.value = product.price || 0;
    refs.productOriginalPrice.value = product.originalPrice || product.price || 0;
    refs.productDiscount.value = product.discountPercent || 0;
    refs.productStatus.value = product.status || (Number(product.stock || 0) <= 0 ? "out-of-stock" : "active");
    refs.productStock.value = product.stock || 0;
    refs.productTag.value = product.tag || "";
    refs.productImage.value = product.image || "";
    refs.productMaterial.value = product.material || "";
    refs.productSizes.value = Array.isArray(product.sizes) ? product.sizes.join(", ") : "";
    refs.productColors.value = Array.isArray(product.colors) ? product.colors.join(", ") : "";
    refs.productDesc.value = product.desc || "";
    updateProductImagePreview();
}

function resetProductForm() {
    refs.productForm.reset();
    refs.productId.value = "";
    refs.productStatus.value = "active";
    refs.productDiscount.value = "";
    updateProductImagePreview();
}

async function handleProductSubmit(event) {
    event.preventDefault();

    const productId = refs.productId.value.trim();
    const payload = {
        name: refs.productName.value.trim(),
        category: refs.productCategory.value.trim(),
        price: Number(refs.productPrice.value || 0),
        originalPrice: Number(refs.productOriginalPrice.value || refs.productPrice.value || 0),
        discountPercent: Number(refs.productDiscount.value || 0),
        status: refs.productStatus.value,
        stock: Number(refs.productStock.value || 0),
        tag: refs.productTag.value.trim(),
        image: refs.productImage.value.trim(),
        material: refs.productMaterial.value.trim(),
        sizes: refs.productSizes.value.trim(),
        colors: refs.productColors.value.trim(),
        desc: refs.productDesc.value.trim()
    };

    const isEditing = Boolean(productId);
    const url = isEditing ? `/api/products/${productId}` : "/api/products";
    const method = isEditing ? "PATCH" : "POST";

    try {
        const response = await fetch(url, {
            method,
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không lưu được sản phẩm");
        }

        showToast(result.message);
        resetProductForm();
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Lưu sản phẩm thất bại");
    }
}

async function deleteProduct(product) {
    const confirmed = window.confirm(`Xóa sản phẩm "${product.name}"?`);
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/products/${product.id}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không xóa được sản phẩm");
        }

        showToast(result.message);
        if (String(refs.productId.value) === String(product.id)) {
            resetProductForm();
        }
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Xóa sản phẩm thất bại");
    }
}

async function toggleProductStock(product) {
    const isOutOfStock = Number(product.stock || 0) <= 0 || product.status === "out-of-stock";
    const payload = {
        ...product,
        status: isOutOfStock ? "active" : "out-of-stock",
        stock: isOutOfStock ? Math.max(Number(product.stock || 0), 1) : 0
    };

    await updateProductQuickly(product.id, payload, isOutOfStock ? "Đã mở bán lại sản phẩm" : "Đã set sản phẩm hết hàng");
}

async function adjustProductStock(product, delta) {
    const nextStock = Math.max(0, Number(product.stock || 0) + delta);
    const payload = {
        ...product,
        stock: nextStock,
        status: nextStock > 0 ? "active" : "out-of-stock"
    };

    await updateProductQuickly(
        product.id,
        payload,
        nextStock > 0 ? `Đã cập nhật tồn kho: ${nextStock} sản phẩm` : "Tồn kho đã về 0, sản phẩm tự chuyển hết hàng"
    );
}

async function applyQuickDiscount(product, percent) {
    const originalPrice = Number(product.originalPrice || product.price || 0);
    const payload = {
        ...product,
        originalPrice,
        discountPercent: percent,
        price: Math.round(originalPrice * (100 - percent) / 100),
        status: product.status || "active"
    };

    await updateProductQuickly(product.id, payload, `Đã áp dụng giảm ${percent}%`);
}

async function updateProductQuickly(productId, payload, successMessage) {
    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: "PATCH",
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không cập nhật được sản phẩm");
        }

        showToast(successMessage || result.message);
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Cập nhật nhanh thất bại");
    }
}

function handleCouponListClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || !button.dataset.couponCode) {
        return;
    }

    const coupon = state.coupons.find((item) => item.code === button.dataset.couponCode);
    if (!coupon) {
        showToast("Không tìm thấy mã giảm giá");
        return;
    }

    if (button.dataset.action === "edit-coupon") {
        fillCouponForm(coupon);
        refs.couponCodeInput.focus();
        return;
    }

    if (button.dataset.action === "toggle-coupon") {
        updateCoupon(coupon.code, { ...coupon, active: !coupon.active }, coupon.active ? "Đã tắt mã giảm giá" : "Đã bật mã giảm giá");
        return;
    }

    if (button.dataset.action === "delete-coupon") {
        deleteCoupon(coupon);
    }
}

async function handleCouponSubmit(event) {
    event.preventDefault();

    const editingCode = refs.couponEditCode.value.trim();
    const payload = {
        code: refs.couponCodeInput.value.trim().toUpperCase(),
        type: refs.couponType.value,
        value: Number(refs.couponValue.value || 0),
        minOrder: Number(refs.couponMinOrder.value || 0),
        maxDiscount: Number(refs.couponMaxDiscount.value || 0),
        usageLimit: Number(refs.couponUsageLimit.value || 0),
        active: refs.couponActive.checked,
        expiresAt: refs.couponExpiresAt.value
    };

    const url = editingCode ? `/api/coupons/${editingCode}` : "/api/coupons";
    const method = editingCode ? "PATCH" : "POST";

    try {
        const response = await fetch(url, {
            method,
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không lưu được mã giảm giá");
        }

        showToast(result.message);
        resetCouponForm();
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Lưu mã giảm giá thất bại");
    }
}

function fillCouponForm(coupon) {
    refs.couponEditCode.value = coupon.code || "";
    refs.couponCodeInput.value = coupon.code || "";
    refs.couponCodeInput.disabled = true;
    refs.couponType.value = coupon.type || "percent";
    refs.couponValue.value = coupon.value || "";
    refs.couponMinOrder.value = coupon.minOrder || "";
    refs.couponMaxDiscount.value = coupon.maxDiscount || "";
    refs.couponUsageLimit.value = coupon.usageLimit || "";
    refs.couponExpiresAt.value = coupon.expiresAt ? String(coupon.expiresAt).slice(0, 10) : "";
    refs.couponActive.checked = Boolean(coupon.active);
}

function resetCouponForm() {
    refs.couponForm?.reset();
    refs.couponEditCode.value = "";
    refs.couponCodeInput.disabled = false;
    refs.couponActive.checked = true;
}

async function updateCoupon(code, payload, successMessage) {
    try {
        const response = await fetch(`/api/coupons/${code}`, {
            method: "PATCH",
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không cập nhật được mã giảm giá");
        }

        showToast(successMessage || result.message);
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Cập nhật mã giảm giá thất bại");
    }
}

async function deleteCoupon(coupon) {
    if (!window.confirm(`Xóa mã giảm giá "${coupon.code}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/coupons/${coupon.code}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không xóa được mã giảm giá");
        }

        showToast(result.message);
        resetCouponForm();
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Xóa mã giảm giá thất bại");
    }
}

async function handleProductImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {
        showToast("Vui lòng chọn đúng file ảnh");
        return;
    }

    if (file.size > 4 * 1024 * 1024) {
        showToast("Ảnh quá lớn. Hãy chọn ảnh dưới 4MB");
        event.target.value = "";
        return;
    }

    try {
        showToast("Đang tải ảnh lên...");
        const imageData = await readFileAsDataUrl(file);
        const response = await fetch("/api/products/image", {
            method: "POST",
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                imageData,
                fileName: file.name
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không tải ảnh lên được");
        }

        refs.productImage.value = result.imageUrl;
        updateProductImagePreview();
        showToast(result.message);
    } catch (error) {
        console.error(error);
        showToast(error.message || "Tải ảnh thất bại");
    } finally {
        event.target.value = "";
    }
}

function updateProductImagePreview() {
    if (!refs.productImagePreview) {
        return;
    }

    const imageUrl = refs.productImage.value.trim();
    refs.productImagePreview.innerHTML = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="Xem trước ảnh sản phẩm"><span>${escapeHtml(imageUrl)}</span>`
        : "<span>Chưa có ảnh xem trước</span>";
}

function updateSalePriceFromDiscount() {
    let originalPrice = Number(refs.productOriginalPrice.value || 0);
    const currentPrice = Number(refs.productPrice.value || 0);
    const discountPercent = Number(refs.productDiscount.value || 0);

    if (!originalPrice && currentPrice > 0 && discountPercent > 0) {
        originalPrice = currentPrice;
        refs.productOriginalPrice.value = String(currentPrice);
    }

    if (originalPrice > 0 && discountPercent > 0) {
        refs.productPrice.value = String(Math.round(originalPrice * (100 - discountPercent) / 100));
    }
}

function handleProductStatusChange() {
    if (refs.productStatus.value === "out-of-stock") {
        refs.productStock.value = "0";
    }
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Không đọc được file ảnh"));
        reader.readAsDataURL(file);
    });
}

async function handleStoreSubmit(event) {
    event.preventDefault();

    const payload = {
        name: refs.storeName.value.trim(),
        hotline: refs.storeHotline.value.trim(),
        email: refs.storeEmail.value.trim(),
        address: refs.storeAddress.value.trim(),
        headline: refs.storeHeadline.value.trim(),
        subheadline: refs.storeSubheadline.value.trim(),
        heroImage: refs.storeHeroImage.value.trim(),
        shippingPolicy: refs.storeShippingPolicy.value.trim(),
        returnPolicy: refs.storeReturnPolicy.value.trim(),
        paymentPolicy: refs.storePaymentPolicy.value.trim(),
        socials: {
            instagram: refs.storeInstagram.value.trim(),
            facebook: refs.storeFacebook.value.trim(),
            tiktok: refs.storeTiktok.value.trim()
        }
    };

    try {
        const response = await fetch("/api/store", {
            method: "PATCH",
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không lưu được thông tin cửa hàng");
        }

        showToast(result.message);
        await loadAllData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Lưu cấu hình shop thất bại");
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
    return ORDER_STATUSES.map((status) => `
        <option value="${status}" ${status === currentStatus ? "selected" : ""}>${status}</option>
    `).join("");
}

function renderOrderQuickActions(order) {
    const currentStatus = order.status || "Chờ xác nhận";
    const actions = [
        { label: "Xác nhận", status: "Đang xử lý" },
        { label: "Đang giao", status: "Đang giao" },
        { label: "Đã giao", status: "Đã giao", highlight: true },
        { label: "Hủy", status: "Đã hủy", danger: true }
    ];

    return actions.map((action) => {
        const activeClass = currentStatus === action.status ? " is-active" : "";
        const highlightClass = action.highlight ? " success" : "";
        const dangerClass = action.danger ? " danger" : "";

        return `
            <button
                type="button"
                class="order-action-btn${activeClass}${highlightClass}${dangerClass}"
                data-order-code="${escapeHtml(order.orderCode)}"
                data-order-status="${escapeHtml(action.status)}"
                ${currentStatus === action.status ? "disabled" : ""}
            >
                ${escapeHtml(action.label)}
            </button>
        `;
    }).join("");
}

function renderShippingPushActions(order) {
    const currentProvider = order.shipping?.provider || order.customer?.shippingMethod || "shop";
    const currentTracking = order.shipping?.trackingCode || "";
    const providers = [
        { label: "Đẩy GHTK", provider: "ghtk" },
        { label: "Đẩy GHN", provider: "ghn" },
        { label: "Shop tự giao", provider: "shop" }
    ];

    return providers.map((item) => `
        <button
            type="button"
            class="order-action-btn shipping"
            data-order-code="${escapeHtml(order.orderCode)}"
            data-ship-provider="${escapeHtml(item.provider)}"
            ${currentTracking && currentProvider === item.provider ? "disabled" : ""}
        >
            ${escapeHtml(item.label)}
        </button>
    `).join("");
}

function getAuthHeaders() {
    return {
        Authorization: `Bearer ${authToken}`
    };
}

function setSystemStatus(message) {
    refs.systemStatus.textContent = message;
}

function setActiveSection(sectionId) {
    document.querySelectorAll(".admin-nav-link").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.section === sectionId);
    });

    document.querySelectorAll(".admin-panel").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.panel === sectionId);
    });
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

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function showToast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        refs.toast.classList.remove("show");
    }, 2500);
}
