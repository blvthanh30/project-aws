const state = {
    store: null,
    products: [],
    filter: "all",
    search: "",
    category: "all",
    priceRange: "all",
    cart: loadStorage("voidx-cart", []),
    cartValidation: {
        valid: true,
        changed: false,
        items: [],
        subtotal: 0,
        totalItems: 0,
        messages: []
    },
    coupon: loadStorage("voidx-coupon", null),
    customer: loadStorage("voidx-customer", {
        name: "",
        phone: "",
        email: "",
        provinceCode: "",
        province: "",
        districtCode: "",
        district: "",
        wardCode: "",
        ward: "",
        addressLine: "",
        address: "",
        shippingMethod: "standard",
        paymentMethod: "cod",
        note: ""
    }),
    authToken: localStorage.getItem("voidx-auth-token") || "",
    authUser: loadStorage("voidx-auth-user", null)
};

const refs = {
    loader: document.getElementById("loader"),
    heroHeadline: document.getElementById("hero-headline"),
    heroSubheadline: document.getElementById("hero-subheadline"),
    heroImage: document.getElementById("hero-image"),
    heroProductCount: document.getElementById("hero-product-count"),
    shippingPolicy: document.getElementById("shipping-policy"),
    returnPolicy: document.getElementById("return-policy"),
    paymentPolicy: document.getElementById("payment-policy"),
    storeHotline: document.getElementById("store-hotline"),
    storeAddress: document.getElementById("store-address"),
    storeSocial: document.getElementById("store-social"),
    footerHotline: document.getElementById("footer-hotline"),
    footerEmail: document.getElementById("footer-email"),
    footerAddress: document.getElementById("footer-address"),
    productContainer: document.getElementById("product-container"),
    filterBar: document.getElementById("filter-bar"),
    searchInput: document.getElementById("search-input"),
    categoryFilter: document.getElementById("category-filter"),
    priceFilter: document.getElementById("price-filter"),
    catalogResultCount: document.getElementById("catalog-result-count"),
    catalogResetButton: document.getElementById("catalog-reset-btn"),
    cartCount: document.getElementById("cart-count"),
    cartButton: document.getElementById("cart-button"),
    cartDrawer: document.getElementById("cart-drawer"),
    cartOverlay: document.getElementById("cart-overlay"),
    closeCart: document.getElementById("close-cart"),
    cartItems: document.getElementById("cart-items"),
    cartSubtotal: document.getElementById("cart-subtotal"),
    cartTotal: document.getElementById("cart-total"),
    couponCode: document.getElementById("coupon-code"),
    couponButton: document.getElementById("apply-coupon-btn"),
    couponMessage: document.getElementById("coupon-message"),
    couponDiscount: document.getElementById("coupon-discount"),
    couponSummaryRow: document.getElementById("coupon-summary-row"),
    checkoutButton: document.getElementById("checkout-btn"),
    cartSummary: document.querySelector(".cart-summary"),
    customerForm: document.getElementById("customer-form"),
    newsletterForm: document.getElementById("newsletter-form"),
    toast: document.getElementById("toast"),
    menuToggle: document.querySelector(".menu-toggle"),
    menu: document.querySelector(".menu"),
    loginLink: document.querySelector('.menu a[href="/dang-nhap"]'),
    adminLink: document.querySelector('.menu a[href="/admin"]')
};

const currency = new Intl.NumberFormat("vi-VN");
const ADDRESS_API_BASE = "https://provinces.open-api.vn/api/v2";
let toastTimer;
let revealObserver;
const addressStore = {
    provinces: [],
    wardsByDistrict: new Map()
};

window.addEventListener("load", () => {
    if (refs.loader) {
        window.setTimeout(() => refs.loader.classList.add("is-hidden"), 500);
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();
    ensureCartEnhancements();
    ensureCheckoutEnhancements();
    refillCustomerForm();
    setupRevealObserver();
    renderCart();
    await Promise.all([loadStore(), maybeLoadProducts(), syncAuthUser(), initCheckoutAddressData()]);
});

function bindEvents() {
    refs.filterBar?.addEventListener("click", handleFilterClick);
    refs.searchInput?.addEventListener("input", handleSearchInput);
    refs.searchInput?.addEventListener("change", handleSearchInput);
    refs.searchInput?.addEventListener("search", handleSearchInput);
    refs.searchInput?.addEventListener("keyup", handleSearchInput);
    refs.searchInput?.addEventListener("compositionend", handleSearchInput);
    refs.categoryFilter?.addEventListener("change", handleCategoryFilterChange);
    refs.priceFilter?.addEventListener("change", handlePriceFilterChange);
    refs.catalogResetButton?.addEventListener("click", resetCatalogFilters);
    refs.cartButton?.addEventListener("click", openCart);
    refs.cartOverlay?.addEventListener("click", closeCart);
    refs.closeCart?.addEventListener("click", closeCart);
    refs.checkoutButton?.addEventListener("click", submitOrder);
    refs.couponButton?.addEventListener("click", applyCoupon);
    refs.couponCode?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            applyCoupon();
        }
    });
    refs.newsletterForm?.addEventListener("submit", handleNewsletterSubmit);
    refs.menuToggle?.addEventListener("click", toggleMenu);
    refs.cartItems?.addEventListener("click", handleCartActions);
    refs.cartItems?.addEventListener("change", handleCartItemChange);
    refs.customerForm?.addEventListener("input", persistCustomerForm);
    refs.customerForm?.addEventListener("change", handleCustomerFormChange);
    refs.customerForm?.addEventListener("change", updateCheckoutPaymentPreview);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeCart();
            closeUserMenu();
        }
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".user-nav")) {
            closeUserMenu();
        }
    });
}

async function syncAuthUser() {
    renderAuthState();

    if (!state.authToken) {
        return;
    }

    try {
        const response = await fetch("/api/auth/me", {
            headers: {
                Authorization: `Bearer ${state.authToken}`
            }
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Phiên đăng nhập không hợp lệ");
        }

        state.authUser = result.user;
        saveStorage("voidx-auth-user", result.user);
    } catch (error) {
        clearAuthState();
    } finally {
        renderAuthState();
    }
}

function renderAuthState() {
    if (!refs.menu) {
        return;
    }

    refs.loginLink?.classList.toggle("is-hidden", Boolean(state.authUser));

    if (refs.adminLink) {
        refs.adminLink.classList.toggle("is-hidden", Boolean(state.authUser));
    }

    let userNav = refs.menu.querySelector(".user-nav");

    if (!state.authUser) {
        userNav?.remove();
        return;
    }

    if (!userNav) {
        userNav = document.createElement("div");
        userNav.className = "user-nav";
        userNav.innerHTML = `
            <button type="button" class="user-menu-trigger" aria-expanded="false" aria-label="Mở menu người dùng">
                <span class="user-avatar"></span>
                <span class="user-label"></span>
            </button>
            <div class="user-dropdown">
                <p class="user-dropdown-title"></p>
                <p class="user-dropdown-subtitle"></p>
                <a href="/" class="user-dropdown-link user-home-link">Trang chủ</a>
                <a href="/admin" class="user-dropdown-link user-admin-link">Vào quản trị</a>
                <button type="button" class="user-dropdown-link user-logout-btn">Đăng xuất</button>
            </div>
        `;

        refs.menu.insertBefore(userNav, refs.cartButton);

        const trigger = userNav.querySelector(".user-menu-trigger");
        const logoutButton = userNav.querySelector(".user-logout-btn");

        trigger.addEventListener("click", (event) => {
            event.stopPropagation();
            userNav.classList.toggle("is-open");
            trigger.setAttribute("aria-expanded", String(userNav.classList.contains("is-open")));
        });

        logoutButton.addEventListener("click", handleLogout);
    }

    userNav.querySelector(".user-avatar").textContent = getInitials(state.authUser.name || state.authUser.email || "U");
    userNav.querySelector(".user-label").textContent = getShortName(state.authUser.name || state.authUser.email);
    userNav.querySelector(".user-dropdown-title").textContent = state.authUser.name || "Tài khoản";
    userNav.querySelector(".user-dropdown-subtitle").textContent = state.authUser.role === "admin"
        ? "Quản trị viên"
        : state.authUser.email;
    userNav.querySelector(".user-admin-link").classList.toggle("is-hidden", state.authUser.role !== "admin");
}

async function handleLogout() {
    try {
        if (state.authToken) {
            await fetch("/api/auth/logout", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${state.authToken}`
                }
            });
        }
    } catch (error) {
        console.error("Lỗi đăng xuất:", error);
    } finally {
        clearAuthState();
        renderAuthState();
        showToast("Đã đăng xuất");
    }
}

function clearAuthState() {
    state.authToken = "";
    state.authUser = null;
    localStorage.removeItem("voidx-auth-token");
    localStorage.removeItem("voidx-auth-user");
}

function closeUserMenu() {
    const userNav = refs.menu?.querySelector(".user-nav");
    if (!userNav) {
        return;
    }

    userNav.classList.remove("is-open");
    userNav.querySelector(".user-menu-trigger")?.setAttribute("aria-expanded", "false");
}

async function loadStore() {
    try {
        const response = await fetch("/api/store");

        if (!response.ok) {
            throw new Error("Không thể tải thông tin cửa hàng");
        }

        state.store = await response.json();
        hydrateStore();
    } catch (error) {
        console.error("Lỗi tải cấu hình shop:", error);
        showToast("Không tải được thông tin cửa hàng");
    }
}

function hydrateStore() {
    if (!state.store) {
        return;
    }

    if (refs.heroHeadline) refs.heroHeadline.textContent = state.store.headline || "";
    if (refs.heroSubheadline) refs.heroSubheadline.textContent = state.store.subheadline || "";
    if (refs.heroImage && state.store.heroImage) refs.heroImage.src = state.store.heroImage;
    if (refs.shippingPolicy) refs.shippingPolicy.textContent = state.store.shippingPolicy || "";
    if (refs.returnPolicy) refs.returnPolicy.textContent = state.store.returnPolicy || "";
    if (refs.paymentPolicy) refs.paymentPolicy.textContent = state.store.paymentPolicy || "";
    if (refs.storeHotline) refs.storeHotline.textContent = state.store.hotline || "";
    if (refs.storeAddress) refs.storeAddress.textContent = state.store.address || "";
    if (refs.footerHotline) refs.footerHotline.textContent = state.store.hotline || "";
    if (refs.footerEmail) refs.footerEmail.textContent = state.store.email || "";
    if (refs.footerAddress) refs.footerAddress.textContent = state.store.address || "";

    if (refs.storeSocial) {
        refs.storeSocial.textContent = [
            state.store.socials?.instagram,
            state.store.socials?.facebook,
            state.store.socials?.tiktok
        ].filter(Boolean).join(" • ");
    }
}

async function maybeLoadProducts() {
    if (!refs.productContainer && !refs.cartItems) {
        return;
    }

    if (refs.productContainer) {
        refs.productContainer.innerHTML = '<div class="empty-state">Đang tải sản phẩm...</div>';
    }

    try {
        const response = await fetch("/api/products");

        if (!response.ok) {
            throw new Error("Không thể tải dữ liệu sản phẩm");
        }

        state.products = await response.json();
        syncCartWithCatalog();
        await validateCart(true);
        hydrateCatalogFilters();

        if (refs.heroProductCount) {
            refs.heroProductCount.textContent = String(state.products.length).padStart(2, "0");
        }

        renderProducts();
    } catch (error) {
        console.error("Lỗi tải sản phẩm:", error);
        if (refs.productContainer) {
            refs.productContainer.innerHTML = `
            <div class="empty-state">
                Không thể tải danh sách sản phẩm lúc này. Vui lòng thử lại sau.
            </div>
        `;
        }
        showToast("Tải sản phẩm thất bại");
    }
}

function renderProducts() {
    if (!refs.productContainer) {
        return;
    }

    const products = getFilteredProducts();
    const limit = Number(refs.productContainer.dataset.limit || 0);
    const visibleProducts = limit > 0 ? products.slice(0, limit) : products;

    if (!visibleProducts.length) {
        updateCatalogResultCount(0, products.length);
        refs.productContainer.innerHTML = `
            <div class="empty-state">
                Không tìm thấy sản phẩm phù hợp với bộ lọc hoặc từ khóa hiện tại.
            </div>
        `;
        return;
    }

    updateCatalogResultCount(visibleProducts.length, products.length);

    refs.productContainer.innerHTML = visibleProducts.map((product) => {
        const sizes = Array.isArray(product.sizes) ? product.sizes.join(" / ") : "Freesize";
        const colors = Array.isArray(product.colors) ? product.colors.join(", ") : "Đang cập nhật";
        const discountPercent = Number(product.discountPercent || 0);
        const originalPrice = Number(product.originalPrice || 0);
        const hasDiscount = discountPercent > 0 && originalPrice > Number(product.price || 0);
        const isOutOfStock = Number(product.stock || 0) <= 0 || product.status === "out-of-stock";
        const productTag = isOutOfStock ? "OUT OF STOCK" : (hasDiscount ? `SALE ${discountPercent}%` : product.tag);
        const searchValue = escapeHtml([
            product.name,
            product.desc,
            product.category,
            product.material,
            sizes,
            colors,
            translateTag(productTag || "")
        ].filter(Boolean).join(" "));

        return `
            <article class="product-card reveal" data-search="${searchValue}">
                <div class="product-media">
                    <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
                    ${productTag ? `<span class="product-tag">${translateTag(productTag)}</span>` : ""}
                </div>
                <div class="product-body">
                    <div class="product-heading">
                        <div>
                            <p class="product-category">${escapeHtml(product.category || "Streetwear")}</p>
                            <h3>${escapeHtml(product.name)}</h3>
                        </div>
                        <div class="product-price-stack">
                            ${hasDiscount ? `<span>${formatPrice(originalPrice)}</span>` : ""}
                            <strong>${formatPrice(product.price)}</strong>
                        </div>
                    </div>
                    <p class="product-copy">${escapeHtml(product.desc || "")}</p>
                    <div class="product-meta">
                        <span>Size: ${escapeHtml(sizes)}</span>
                        <span>Màu: ${escapeHtml(colors)}</span>
                        <span>Chất liệu: ${escapeHtml(product.material || "Đang cập nhật")}</span>
                        <span>Còn khoảng: ${product.stock || 0} sản phẩm</span>
                    </div>
                    <div class="variant-grid">
                        <label class="variant-field">
                            <span>Chọn size</span>
                            <select data-product-option="size" data-product-id="${product.id}">
                                ${buildVariantOptions(product.sizes, getDefaultVariantValue(product.sizes))}
                            </select>
                        </label>
                        <label class="variant-field">
                            <span>Chọn màu</span>
                            <select data-product-option="color" data-product-id="${product.id}">
                                ${buildVariantOptions(product.colors, getDefaultVariantValue(product.colors))}
                            </select>
                        </label>
                    </div>
                    <button type="button" class="product-btn" data-product-id="${product.id}" ${isOutOfStock ? "disabled" : ""}>
                        ${isOutOfStock ? "Hết hàng" : "Thêm vào giỏ"}
                    </button>
                </div>
            </article>
        `;
    }).join("");

    refs.productContainer.querySelectorAll("[data-product-id]").forEach((button) => {
        button.addEventListener("click", () => addToCart(Number(button.dataset.productId)));
    });

    observeReveal();
}

function getFilteredProducts() {
    const keyword = normalizeText(state.search.trim());

    return state.products.filter((product) => {
        const matchesFilter = state.filter === "all" || product.tag === state.filter;
        const matchesCategory = state.category === "all" || normalizeText(product.category) === normalizeText(state.category);
        const matchesPrice = matchesPriceRange(Number(product.price || 0), state.priceRange);
        const searchText = normalizeText([
            product.name,
            product.desc,
            product.category,
            product.material,
            ...(product.colors || [])
        ].filter(Boolean).join(" "));

        return matchesFilter && matchesCategory && matchesPrice && (!keyword || matchesNormalizedQuery(searchText, keyword));
    });
}

function handleFilterClick(event) {
    const chip = event.target.closest(".filter-chip");
    if (!chip) {
        return;
    }

    state.filter = chip.dataset.filter;
    document.querySelectorAll(".filter-chip").forEach((button) => {
        button.classList.toggle("active", button === chip);
    });
    renderProducts();
}

function handleSearchInput(event) {
    state.search = String(event.target?.value || "");
    renderProducts();
}

function handleCategoryFilterChange(event) {
    state.category = String(event.target?.value || "all");
    renderProducts();
}

function handlePriceFilterChange(event) {
    state.priceRange = String(event.target?.value || "all");
    renderProducts();
}

function resetCatalogFilters() {
    state.filter = "all";
    state.search = "";
    state.category = "all";
    state.priceRange = "all";

    if (refs.searchInput) refs.searchInput.value = "";
    if (refs.categoryFilter) refs.categoryFilter.value = "all";
    if (refs.priceFilter) refs.priceFilter.value = "all";

    document.querySelectorAll(".filter-chip").forEach((button) => {
        button.classList.toggle("active", button.dataset.filter === "all");
    });

    renderProducts();
}

function ensureCartEnhancements() {
    if (!refs.cartSummary) {
        return;
    }

    if (!document.getElementById("cart-total-items")) {
        const metaRow = document.createElement("div");
        metaRow.className = "summary-row";
        metaRow.innerHTML = '<span>Tổng sản phẩm</span><strong id="cart-total-items">0</strong>';
        refs.cartSummary.insertBefore(metaRow, refs.cartSummary.children[1] || null);
    }

    if (!document.getElementById("cart-status")) {
        const status = document.createElement("p");
        status.className = "cart-status";
        status.id = "cart-status";
        refs.cartSummary.insertBefore(status, refs.checkoutButton || null);
    }

    if (!document.getElementById("clear-cart-btn")) {
        const clearButton = document.createElement("button");
        clearButton.type = "button";
        clearButton.className = "clear-cart-btn";
        clearButton.id = "clear-cart-btn";
        clearButton.textContent = "Xóa toàn bộ giỏ";
        clearButton.addEventListener("click", clearCart);
        refs.cartSummary.insertBefore(clearButton, refs.checkoutButton || null);
    }

    if (document.body.dataset.page !== "checkout" && !document.getElementById("go-checkout-link")) {
        const checkoutLink = document.createElement("a");
        checkoutLink.className = "checkout-page-link";
        checkoutLink.id = "go-checkout-link";
        checkoutLink.href = "/thanh-toan";
        checkoutLink.textContent = "Tới trang thanh toán";
        refs.cartSummary.insertBefore(checkoutLink, refs.checkoutButton || null);
    }

    refs.cartTotalItems = document.getElementById("cart-total-items");
    refs.cartStatus = document.getElementById("cart-status");
    refs.clearCartButton = document.getElementById("clear-cart-btn");
}

function ensureCheckoutEnhancements() {
    if (!refs.customerForm) {
        return;
    }

    const isCheckoutPage = document.body.dataset.page === "checkout";
    if (!isCheckoutPage) {
        return;
    }

    const addressLabel = refs.customerForm.querySelector('textarea[name="address"]')?.closest("label");
    if (addressLabel) {
        const addressSpan = addressLabel.querySelector("span");
        if (addressSpan) {
            addressSpan.textContent = "Số nhà, tên đường";
        }
        const addressField = addressLabel.querySelector("textarea");
        if (addressField) {
            addressField.name = "addressLine";
            addressField.id = "customer-address-line";
            addressField.placeholder = "Ví dụ: 25 Nguyễn Trãi, Chung cư A, tầng 6...";
        }
    }

    if (!refs.customerForm.querySelector(".checkout-address-grid")) {
        const formGrid = refs.customerForm.querySelector(".form-grid");
        formGrid?.insertAdjacentHTML("afterend", `
            <div class="checkout-address-grid">
                <label>
                    <span>Tỉnh / Thành phố</span>
                    <select id="customer-province" name="provinceCode" required>
                        <option value="">Chọn tỉnh / thành phố</option>
                    </select>
                </label>
                <label>
                    <span>Quận / Huyện</span>
                    <select id="customer-district" name="districtCode" required disabled>
                        <option value="">Chọn quận / huyện</option>
                    </select>
                </label>
                <label>
                    <span>Phường / Xã</span>
                    <select id="customer-ward" name="wardCode" required disabled>
                        <option value="">Chọn phường / xã</option>
                    </select>
                </label>
            </div>
            <p class="checkout-address-hint" id="checkout-address-hint">Chọn địa chỉ để hệ thống tự ghép địa chỉ giao hàng đầy đủ.</p>
        `);
    }

    if (!refs.customerForm.querySelector(".checkout-extra-grid")) {
        const noteLabel = refs.customerForm.querySelector('textarea[name="note"]')?.closest("label");
        noteLabel?.insertAdjacentHTML("beforebegin", `
            <div class="checkout-extra-grid">
                <label>
                    <span>Email nhận xác nhận</span>
                    <input id="customer-email" name="email" type="email" placeholder="tenban@email.com">
                </label>
                <label>
                    <span>Hình thức giao hàng</span>
                    <select id="customer-shipping-method" name="shippingMethod">
                        <option value="shop">Shop tự giao / xác nhận sau</option>
                        <option value="ghtk">Giao Hàng Tiết Kiệm (giả lập)</option>
                        <option value="ghn">Giao Hàng Nhanh (giả lập)</option>
                    </select>
                </label>
                <label>
                    <span>Phương thức thanh toán</span>
                    <select id="customer-payment-method" name="paymentMethod">
                        <option value="cod">Thanh toán khi nhận hàng</option>
                        <option value="bank">Chuyển khoản ngân hàng</option>
                        <option value="momo">Ví MoMo giả lập</option>
                        <option value="vnpay">VNPay giả lập</option>
                    </select>
                </label>
            </div>
            <div class="payment-preview" id="payment-preview"></div>
        `);
    }

    updateCheckoutPaymentPreview();
}

function addToCart(productId) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) {
        return;
    }

    const selectedSize = getSelectedProductOption(product.id, "size");
    const selectedColor = getSelectedProductOption(product.id, "color");
    const itemKey = buildCartItemKey(product.id, selectedSize, selectedColor);
    const existingItem = state.cart.find((item) => item.key === itemKey);

    if (Number(product.stock || 0) <= 0 || product.status === "out-of-stock") {
        showToast(`"${product.name}" hiện đang hết hàng`);
        return;
    }

    if (existingItem) {
        if (existingItem.quantity >= Number(product.stock || 0)) {
            showToast(`"${product.name}" chỉ còn ${product.stock} sản phẩm`);
            return;
        }
        existingItem.quantity += 1;
        existingItem.stock = Number(product.stock || 0);
    } else {
        state.cart.push({
            key: itemKey,
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            size: selectedSize,
            color: selectedColor,
            quantity: 1,
            stock: Number(product.stock || 0)
        });
    }

    clearCoupon(false);
    saveStorage("voidx-cart", state.cart);
    renderCart();
    validateCart(true);
    openCart();
    showToast(`Đã thêm ${product.name} vào giỏ`);
}

function renderCart() {
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = getCouponDiscount(subtotal);
    const total = Math.max(0, subtotal - discount);
    const hasWarnings = Boolean(state.cartValidation.messages?.length);

    if (refs.cartCount) refs.cartCount.textContent = String(totalItems);
    if (refs.cartSubtotal) refs.cartSubtotal.textContent = formatPrice(subtotal);
    if (refs.cartTotal) refs.cartTotal.textContent = formatPrice(total);
    if (refs.couponDiscount) refs.couponDiscount.textContent = discount > 0 ? `-${formatPrice(discount)}` : formatPrice(0);
    if (refs.couponSummaryRow) refs.couponSummaryRow.classList.toggle("is-active", discount > 0);
    if (refs.couponCode && state.coupon?.code && refs.couponCode.value.trim() === "") {
        refs.couponCode.value = state.coupon.code;
    }
    updateCheckoutPaymentPreview();
    if (refs.cartTotalItems) refs.cartTotalItems.textContent = String(totalItems);
    if (refs.clearCartButton) refs.clearCartButton.disabled = state.cart.length === 0;

    if (refs.checkoutButton) {
        refs.checkoutButton.disabled = state.cart.length === 0 || hasWarnings;
        refs.checkoutButton.classList.toggle("is-disabled", state.cart.length === 0 || hasWarnings);
    }

    if (refs.cartStatus) {
        refs.cartStatus.textContent = hasWarnings
            ? state.cartValidation.messages.join(" ")
            : (state.cart.length ? "Giỏ hàng đã sẵn sàng để gửi đơn." : "Hãy thêm sản phẩm để bắt đầu tạo đơn.");
        refs.cartStatus.classList.toggle("has-warning", hasWarnings);
    }

    if (!refs.cartItems) {
        return;
    }

    if (!state.cart.length) {
        refs.cartItems.innerHTML = `
            <div class="cart-empty">
                Giỏ hàng đang trống. Chọn sản phẩm rồi điền thông tin khách hàng để gửi đơn.
            </div>
        `;
        return;
    }

    refs.cartItems.innerHTML = state.cart.map((item) => `
        <article class="cart-item">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
            <div>
                <h3>${escapeHtml(item.name)}</h3>
                <p>${formatPrice(item.price)} • Còn ${item.stock ?? "?"} sản phẩm</p>
                <div class="cart-variant-grid">
                    <label class="variant-field variant-field--compact">
                        <span>Size</span>
                        <select data-action="change-size" data-key="${escapeHtml(item.key)}">
                            ${buildVariantOptions(getProductOptions(item.id, "sizes"), item.size)}
                        </select>
                    </label>
                    <label class="variant-field variant-field--compact">
                        <span>Màu</span>
                        <select data-action="change-color" data-key="${escapeHtml(item.key)}">
                            ${buildVariantOptions(getProductOptions(item.id, "colors"), item.color)}
                        </select>
                    </label>
                </div>
                <div class="qty-controls">
                    <button type="button" data-action="decrease" data-key="${escapeHtml(item.key)}" aria-label="Giảm số lượng">-</button>
                    <span>${item.quantity}</span>
                    <button
                        type="button"
                        data-action="increase"
                        data-key="${escapeHtml(item.key)}"
                        aria-label="Tăng số lượng"
                        ${(item.quantity >= Number(item.stock || 0)) ? "disabled" : ""}
                    >+</button>
                </div>
                <small class="cart-line-total">Thành tiền: ${formatPrice(item.price * item.quantity)}</small>
            </div>
            <button type="button" class="remove-item" data-action="remove" data-key="${escapeHtml(item.key)}">
                Xóa
            </button>
        </article>
    `).join("");
}

function handleCartActions(event) {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
        return;
    }

    const itemKey = String(actionButton.dataset.key || "");
    const action = actionButton.dataset.action;
    const targetItem = state.cart.find((item) => item.key === itemKey);

    if (!targetItem) {
        return;
    }

    if (action === "increase") {
        const product = state.products.find((item) => item.id === targetItem.id);
        const stock = Number(product?.stock ?? targetItem.stock ?? 0);

        if (targetItem.quantity >= stock) {
            showToast(`"${targetItem.name}" chỉ còn ${stock} sản phẩm`);
            return;
        }

        targetItem.quantity += 1;
        targetItem.stock = stock;
    }

    if (action === "decrease") {
        targetItem.quantity -= 1;
    }

    if (action === "remove" || targetItem.quantity <= 0) {
        state.cart = state.cart.filter((item) => item.key !== itemKey);
    }

    clearCoupon(false);
    saveStorage("voidx-cart", state.cart);
    renderCart();
    validateCart(true);
}

function handleCartItemChange(event) {
    const target = event.target.closest("select[data-action]");
    if (!target) {
        return;
    }

    const itemKey = String(target.dataset.key || "");
    const targetItem = state.cart.find((item) => item.key === itemKey);
    if (!targetItem) {
        return;
    }

    const nextSize = target.dataset.action === "change-size" ? target.value : targetItem.size;
    const nextColor = target.dataset.action === "change-color" ? target.value : targetItem.color;
    const nextKey = buildCartItemKey(targetItem.id, nextSize, nextColor);

    if (nextKey === targetItem.key) {
        return;
    }

    const mergedItem = state.cart.find((item) => item.key === nextKey);

    if (mergedItem) {
        mergedItem.quantity += targetItem.quantity;
        mergedItem.stock = Math.max(Number(mergedItem.stock || 0), Number(targetItem.stock || 0));
        state.cart = state.cart.filter((item) => item.key !== itemKey);
    } else {
        targetItem.size = nextSize;
        targetItem.color = nextColor;
        targetItem.key = nextKey;
    }

    clearCoupon(false);
    saveStorage("voidx-cart", state.cart);
    renderCart();
    validateCart(true);
}

function openCart() {
    if (!refs.cartDrawer) {
        return;
    }

    refs.cartDrawer.classList.add("is-open");
    refs.cartDrawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    validateCart(true);
}

function closeCart() {
    if (!refs.cartDrawer) {
        return;
    }

    refs.cartDrawer.classList.remove("is-open");
    refs.cartDrawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function clearCart() {
    if (!state.cart.length) {
        showToast("Giỏ hàng đang trống");
        return;
    }

    state.cart = [];
    state.cartValidation = {
        valid: true,
        changed: false,
        items: [],
        subtotal: 0,
        totalItems: 0,
        messages: []
    };
    clearCoupon(false);
    saveStorage("voidx-cart", state.cart);
    renderCart();
    showToast("Đã xóa toàn bộ giỏ hàng");
}

function syncCartWithCatalog() {
    if (!state.products.length || !state.cart.length) {
        return;
    }

    let changed = false;
    const nextCart = [];

    state.cart.forEach((item) => {
        const product = state.products.find((productItem) => productItem.id === item.id);

        if (!product || Number(product.stock || 0) <= 0) {
            changed = true;
            return;
        }

        const quantity = Math.min(Number(item.quantity || 0), Number(product.stock || 0));
        if (quantity <= 0) {
            changed = true;
            return;
        }

        if (
            quantity !== item.quantity ||
            item.price !== product.price ||
            item.name !== product.name ||
            item.image !== product.image ||
            item.size !== normalizeCartVariant(item.size, product.sizes) ||
            item.color !== normalizeCartVariant(item.color, product.colors) ||
            item.key !== buildCartItemKey(
                product.id,
                normalizeCartVariant(item.size, product.sizes),
                normalizeCartVariant(item.color, product.colors)
            )
        ) {
            changed = true;
        }

        nextCart.push({
            key: buildCartItemKey(
                product.id,
                normalizeCartVariant(item.size, product.sizes),
                normalizeCartVariant(item.color, product.colors)
            ),
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            size: normalizeCartVariant(item.size, product.sizes),
            color: normalizeCartVariant(item.color, product.colors),
            quantity,
            stock: Number(product.stock || 0)
        });
    });

    if (changed) {
        state.cart = nextCart;
        clearCoupon(false);
        saveStorage("voidx-cart", state.cart);
    }
}

async function validateCart(silent = false) {
    if (!state.cart.length) {
        state.cartValidation = {
            valid: true,
            changed: false,
            items: [],
            subtotal: 0,
            totalItems: 0,
            messages: []
        };
        renderCart();
        return state.cartValidation;
    }

    try {
        const response = await fetch("/api/cart/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: state.cart.map((item) => ({
                    id: item.id,
                    key: item.key,
                    size: item.size,
                    color: item.color,
                    quantity: item.quantity
                }))
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không kiểm tra được giỏ hàng");
        }

        state.cartValidation = result;

        if (result.changed) {
            state.cart = result.items.map((item) => ({
                key: buildCartItemKey(item.id, item.size, item.color),
                id: item.id,
                name: item.name,
                price: item.price,
                image: item.image,
                size: item.size,
                color: item.color,
                quantity: item.quantity,
                stock: item.stock
            }));
            clearCoupon(false);
            saveStorage("voidx-cart", state.cart);
        }

        renderCart();

        if (!silent && result.messages?.length) {
            showToast(result.messages[0]);
        }

        return result;
    } catch (error) {
        state.cartValidation = {
            success: false,
            valid: false,
            changed: false,
            items: state.cart,
            subtotal: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            totalItems: state.cart.reduce((sum, item) => sum + item.quantity, 0),
            messages: [error.message || "Không kiểm tra được giỏ hàng"]
        };
        renderCart();

        if (!silent) {
            showToast(error.message || "Không kiểm tra được giỏ hàng");
        }

        return state.cartValidation;
    }
}

async function applyCoupon() {
    const code = refs.couponCode?.value.trim().toUpperCase();
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (!code) {
        clearCoupon();
        return;
    }

    if (!state.cart.length || subtotal <= 0) {
        showCouponMessage("Hãy thêm sản phẩm vào giỏ trước khi dùng mã", false);
        return;
    }

    refs.couponButton.disabled = true;
    refs.couponButton.textContent = "Đang kiểm tra...";

    try {
        const response = await fetch("/api/coupon/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, subtotal })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Mã giảm giá không hợp lệ");
        }

        state.coupon = {
            code: result.coupon.code,
            discount: Number(result.discount || 0),
            total: Number(result.total || 0)
        };
        saveStorage("voidx-coupon", state.coupon);
        showCouponMessage(`${result.message}. Giảm ${formatPrice(result.discount)}`, true);
        renderCart();
    } catch (error) {
        clearCoupon(false);
        showCouponMessage(error.message || "Không áp dụng được mã giảm giá", false);
        renderCart();
    } finally {
        refs.couponButton.disabled = false;
        refs.couponButton.textContent = "Áp dụng";
    }
}

function clearCoupon(showMessage = true) {
    state.coupon = null;
    localStorage.removeItem("voidx-coupon");
    if (refs.couponCode) refs.couponCode.value = "";
    if (showMessage) showCouponMessage("Đã bỏ mã giảm giá", false);
}

function getCouponDiscount(subtotal) {
    if (!state.coupon?.discount || subtotal <= 0) {
        return 0;
    }

    return Math.min(subtotal, Number(state.coupon.discount || 0));
}

function showCouponMessage(message, success) {
    if (!refs.couponMessage) {
        showToast(message);
        return;
    }

    refs.couponMessage.textContent = message;
    refs.couponMessage.classList.toggle("is-success", Boolean(success));
    refs.couponMessage.classList.toggle("is-error", !success);
}

function updateCheckoutPaymentPreview() {
    const preview = document.getElementById("payment-preview");
    if (!preview || !refs.customerForm) {
        return;
    }

    const customer = getCustomerFormData();
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = Math.max(0, subtotal - getCouponDiscount(subtotal));
    const paymentLabel = getPaymentMethodLabel(customer.paymentMethod);
    const shippingLabel = getShippingProviderLabel(customer.shippingMethod);

    if (customer.paymentMethod === "bank") {
        const qrUrl = buildVietQrUrl(total, "VOIDX THANH TOAN");
        preview.innerHTML = `
            <div class="payment-preview-card">
                <div>
                    <strong>${paymentLabel}</strong>
                    <span>${shippingLabel}</span>
                    <p>Quét mã VietQR để chuyển khoản. Nội dung chuyển khoản sẽ được tự động thay bằng mã đơn sau khi đặt hàng.</p>
                </div>
                <img src="${qrUrl}" alt="Mã VietQR thanh toán">
            </div>
        `;
        return;
    }

    preview.innerHTML = `
        <div class="payment-preview-card payment-preview-card--text">
            <strong>${paymentLabel}</strong>
            <span>${shippingLabel}</span>
            <p>${getPaymentMethodNote(customer.paymentMethod)}</p>
        </div>
    `;
}

function buildVietQrUrl(amount, addInfo) {
    const bankId = "MB";
    const accountNo = "0923627588";
    const accountName = "VOIDX STUDIO";
    const params = new URLSearchParams({
        amount: String(Math.max(0, Number(amount || 0))),
        addInfo,
        accountName
    });

    return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?${params.toString()}`;
}

function getPaymentMethodLabel(method) {
    const labels = {
        cod: "COD - Thanh toán khi nhận hàng",
        bank: "Chuyển khoản VietQR",
        momo: "MoMo giả lập",
        vnpay: "VNPay giả lập"
    };

    return labels[method] || labels.cod;
}

function getPaymentMethodNote(method) {
    const notes = {
        cod: "Khách thanh toán tiền mặt khi nhận hàng. Shop xác nhận trước khi giao.",
        momo: "Demo ví điện tử: hệ thống sẽ ghi nhận là đang chờ thanh toán MoMo, chưa trừ tiền thật.",
        vnpay: "Demo VNPay: hệ thống sẽ ghi nhận là đang chờ thanh toán VNPay, chưa gọi cổng thật."
    };

    return notes[method] || notes.cod;
}

function getShippingProviderLabel(provider) {
    const labels = {
        shop: "Shop tự giao / xác nhận sau",
        ghtk: "Giao Hàng Tiết Kiệm - giả lập",
        ghn: "Giao Hàng Nhanh - giả lập"
    };

    return labels[provider] || labels.shop;
}

async function submitOrder() {
    if (!state.cart.length) {
        showToast("Giỏ hàng đang trống");
        return;
    }

    const validation = await validateCart();
    if (!validation.valid || !state.cart.length) {
        showToast(validation.messages?.[0] || "Giỏ hàng cần được cập nhật lại trước khi đặt");
        return;
    }

    const customer = getCustomerFormData();
    if (!validateCustomerForCheckout(customer)) {
        return;
    }

    refs.checkoutButton.disabled = true;
    refs.checkoutButton.textContent = "Đang gửi...";

    const order = {
        customer,
        items: state.cart.map((item) => ({
            id: item.id,
            name: item.name,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            price: item.price
        })),
        couponCode: state.coupon?.code || "",
        subtotal: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        discount: getCouponDiscount(state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)),
        total: Math.max(0, state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) - getCouponDiscount(state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0))),
        createdAt: new Date().toISOString()
    };

    try {
        const response = await fetch("/api/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(order)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Gửi đơn hàng thất bại");
        }

        const checkoutCompleted = showCheckoutConfirmation(result.orderCode, result.order);
        showToast(`${result.message}. Mã đơn: ${result.orderCode}`);
        state.cart = [];
        state.cartValidation = {
            valid: true,
            changed: false,
            items: [],
            subtotal: 0,
            totalItems: 0,
            messages: []
        };
        saveStorage("voidx-cart", state.cart);
        clearCoupon(false);
        renderCart();
        if (!checkoutCompleted) {
            closeCart();
        }
    } catch (error) {
        console.error("Lỗi đặt hàng:", error);
        showToast(error.message || "Không gửi được đơn hàng");
    } finally {
        if (refs.checkoutButton && !document.body.classList.contains("checkout-order-complete")) {
            refs.checkoutButton.disabled = state.cart.length === 0;
            refs.checkoutButton.classList.toggle("is-disabled", state.cart.length === 0);
            refs.checkoutButton.textContent = "Gửi đơn hàng";
        }
    }
}

function showCheckoutConfirmation(orderCode, order = {}) {
    const confirmation = document.getElementById("checkout-confirmation");
    if (!confirmation) return false;

    document.body.classList.add("checkout-order-complete");
    document.getElementById("checkout-flow")?.classList.add("is-hidden");

    document.querySelectorAll("#checkout-steps [data-step]").forEach((step) => {
        step.classList.add("is-active", "is-complete");
    });

    const code = orderCode || order.orderCode || "Đang cập nhật";
    const items = Array.isArray(order.items) ? order.items : [];
    const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const total = Number(order.total || items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0));

    const codeEl = document.getElementById("checkout-confirmation-code");
    const itemsEl = document.getElementById("checkout-confirmation-items");
    const totalEl = document.getElementById("checkout-confirmation-total");
    const trackLink = document.getElementById("checkout-track-link");
    const copyEl = confirmation.querySelector(".checkout-confirmation-copy");

    if (codeEl) codeEl.textContent = code;
    if (itemsEl) itemsEl.textContent = String(totalItems);
    if (totalEl) totalEl.textContent = formatPrice(total);
    if (trackLink) trackLink.href = `/tra-cuu-don-hang?query=${encodeURIComponent(code)}`;
    if (copyEl) {
        const payment = order.payment || {};
        const shipping = order.shipping || {};
        copyEl.innerHTML = `
            VOIDX đã nhận đơn của bạn. Thanh toán: <strong>${escapeHtml(payment.label || "COD")}</strong>.
            Vận chuyển: <strong>${escapeHtml(shipping.providerLabel || "Shop xác nhận")}</strong>.
            ${payment.qrUrl ? `<br><img class="confirmation-qr" src="${escapeHtml(payment.qrUrl)}" alt="Mã VietQR cho đơn ${escapeHtml(code)}">` : ""}
        `;
    }

    confirmation.classList.remove("is-hidden");
    refs.checkoutButton?.classList.add("is-disabled");
    if (refs.checkoutButton) {
        refs.checkoutButton.disabled = true;
        refs.checkoutButton.textContent = "Đơn đã gửi";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
}

async function handleNewsletterSubmit(event) {
    event.preventDefault();
    const emailInput = refs.newsletterForm?.querySelector("input[type='email']");
    const email = emailInput?.value.trim();

    if (!email) {
        showToast("Hãy nhập email để đăng ký");
        return;
    }

    try {
        const response = await fetch("/api/newsletter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không đăng ký được email");
        }

        refs.newsletterForm.reset();
        showToast(result.message);
    } catch (error) {
        console.error("Lỗi đăng ký email:", error);
        showToast(error.message || "Đăng ký email thất bại");
    }
}

function toggleMenu() {
    const isOpen = refs.menu?.classList.toggle("is-open");
    refs.menuToggle?.setAttribute("aria-expanded", String(Boolean(isOpen)));
}

function persistCustomerForm() {
    state.customer = getCustomerFormData();
    saveStorage("voidx-customer", state.customer);
    updateCheckoutAddressHint();
}

async function handleCustomerFormChange(event) {
    const target = event.target;
    if (!target) {
        return;
    }

    if (target.name === "provinceCode") {
        await populateDistrictOptions(target.value, "");
        await populateWardOptions("", "");
    }

    if (target.name === "districtCode") {
        await populateWardOptions(target.value, "");
    }

    updateCheckoutAddressHint();
    persistCustomerForm();
}

function refillCustomerForm() {
    if (!refs.customerForm) {
        return;
    }

    refs.customerForm.elements.name.value = state.customer.name || "";
    refs.customerForm.elements.phone.value = state.customer.phone || "";
    if (refs.customerForm.elements.email) refs.customerForm.elements.email.value = state.customer.email || "";
    if (refs.customerForm.elements.addressLine) refs.customerForm.elements.addressLine.value = state.customer.addressLine || "";
    if (refs.customerForm.elements.shippingMethod) refs.customerForm.elements.shippingMethod.value = state.customer.shippingMethod || "shop";
    if (refs.customerForm.elements.paymentMethod) refs.customerForm.elements.paymentMethod.value = state.customer.paymentMethod || "cod";
    refs.customerForm.elements.note.value = state.customer.note || "";
    updateCheckoutAddressHint();
    updateCheckoutPaymentPreview();
}

function getCustomerFormData() {
    if (!refs.customerForm) {
        return {
            name: "",
            phone: "",
            email: "",
            provinceCode: "",
            province: "",
            districtCode: "",
            district: "",
            wardCode: "",
            ward: "",
            addressLine: "",
            address: "",
            shippingMethod: "shop",
            paymentMethod: "cod",
            note: ""
        };
    }

    const formData = new FormData(refs.customerForm);
    const provinceCode = String(formData.get("provinceCode") || "").trim();
    const districtCode = String(formData.get("districtCode") || "").trim();
    const wardCode = String(formData.get("wardCode") || "").trim();
    const addressLine = String(formData.get("addressLine") || formData.get("address") || "").trim();
    const province = getSelectedOptionText(refs.customerForm.elements.provinceCode, provinceCode);
    const district = getSelectedOptionText(refs.customerForm.elements.districtCode, districtCode);
    const ward = getSelectedOptionText(refs.customerForm.elements.wardCode, wardCode);

    return {
        name: String(formData.get("name") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        provinceCode,
        province,
        districtCode,
        district,
        wardCode,
        ward,
        addressLine,
        address: buildCustomerAddress(addressLine, ward, district, province),
        shippingMethod: String(formData.get("shippingMethod") || "shop").trim(),
        paymentMethod: String(formData.get("paymentMethod") || "cod").trim(),
        note: String(formData.get("note") || "").trim()
    };
}

function isCustomerFormValid(customer) {
    if (!customer.name || !customer.phone || !customer.address) {
        showToast("Hãy điền họ tên, số điện thoại và địa chỉ");
        return false;
    }

    if (!/^0\d{9,10}$/.test(customer.phone)) {
        showToast("Số điện thoại chưa đúng định dạng");
        return false;
    }

    return true;
}

function showToast(message) {
    if (!refs.toast) {
        return;
    }

    refs.toast.textContent = message;
    refs.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => refs.toast.classList.remove("show"), 3200);
}

function setupRevealObserver() {
    revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.18 });

    observeReveal();
}

function observeReveal() {
    if (!revealObserver) {
        return;
    }

    document.querySelectorAll(".reveal:not(.is-visible)").forEach((element) => {
        revealObserver.observe(element);
    });
}

function getInitials(value) {
    return String(value || "")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "U";
}

function getShortName(value) {
    const parts = String(value || "").split(" ").filter(Boolean);
    return parts.length > 1 ? parts.slice(-2).join(" ") : String(value || "Tài khoản");
}

function getSelectedProductOption(productId, optionType) {
    const product = state.products.find((item) => item.id === productId);
    const options = optionType === "size" ? product?.sizes : product?.colors;
    const select = document.querySelector(`select[data-product-option="${optionType}"][data-product-id="${productId}"]`);
    return normalizeCartVariant(select?.value, options);
}

function getDefaultVariantValue(options) {
    return Array.isArray(options) && options.length ? String(options[0]) : "Mặc định";
}

function getProductOptions(productId, field) {
    const product = state.products.find((item) => item.id === Number(productId));
    const options = Array.isArray(product?.[field]) && product[field].length ? product[field] : ["Mặc định"];
    return options.map((option) => String(option));
}

function normalizeCartVariant(value, options) {
    const normalizedOptions = Array.isArray(options) && options.length
        ? options.map((option) => String(option))
        : ["Mặc định"];
    const candidate = String(value || "").trim();
    return normalizedOptions.includes(candidate) ? candidate : normalizedOptions[0];
}

function buildCartItemKey(productId, size, color) {
    return `${productId}__${String(size || "").trim()}__${String(color || "").trim()}`;
}

function buildVariantOptions(options, selectedValue) {
    const normalizedOptions = Array.isArray(options) && options.length ? options.map(String) : ["Mặc định"];
    const currentValue = normalizeCartVariant(selectedValue, normalizedOptions);

    return normalizedOptions.map((option) => {
        const selected = option === currentValue ? " selected" : "";
        return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
    }).join("");
}

async function initCheckoutAddressData() {
    if (!refs.customerForm?.elements.provinceCode) {
        return;
    }

    try {
        const response = await fetch(`${ADDRESS_API_BASE}/?depth=2`);
        if (!response.ok) {
            throw new Error("Không tải được danh sách tỉnh thành");
        }

        addressStore.provinces = await response.json();
        const provinceSelect = refs.customerForm.elements.provinceCode;
        provinceSelect.innerHTML = [
            '<option value="">Chọn tỉnh / thành phố</option>',
            ...addressStore.provinces.map((province) => `<option value="${province.code}">${escapeHtml(province.name)}</option>`)
        ].join("");
        provinceSelect.disabled = false;

        if (state.customer.provinceCode) {
            provinceSelect.value = state.customer.provinceCode;
            await populateDistrictOptions(state.customer.provinceCode, state.customer.districtCode);
            await populateWardOptions(state.customer.districtCode, state.customer.wardCode);
        }

        updateCheckoutAddressHint();
        persistCustomerForm();
    } catch (error) {
        console.error("Lỗi tải địa chỉ Việt Nam:", error);
        updateCheckoutAddressHint("Chưa tải được dữ liệu tỉnh thành. Bạn có thể thử tải lại trang.");
    }
}

async function populateDistrictOptions(provinceCode, selectedDistrictCode) {
    const districtSelect = refs.customerForm?.elements.districtCode;
    const wardSelect = refs.customerForm?.elements.wardCode;
    if (!districtSelect || !wardSelect) {
        return;
    }

    if (!provinceCode) {
        districtSelect.innerHTML = '<option value="">Chọn quận / huyện</option>';
        districtSelect.disabled = true;
        wardSelect.innerHTML = '<option value="">Chọn phường / xã</option>';
        wardSelect.disabled = true;
        return;
    }

    const province = addressStore.provinces.find((item) => String(item.code) === String(provinceCode));
    const districts = Array.isArray(province?.districts) ? province.districts : [];

    districtSelect.innerHTML = [
        '<option value="">Chọn quận / huyện</option>',
        ...districts.map((district) => `<option value="${district.code}">${escapeHtml(district.name)}</option>`)
    ].join("");
    districtSelect.disabled = false;
    districtSelect.value = selectedDistrictCode || "";

    if (!selectedDistrictCode) {
        wardSelect.innerHTML = '<option value="">Chọn phường / xã</option>';
        wardSelect.disabled = true;
    }
}

async function populateWardOptions(districtCode, selectedWardCode) {
    const wardSelect = refs.customerForm?.elements.wardCode;
    if (!wardSelect) {
        return;
    }

    if (!districtCode) {
        wardSelect.innerHTML = '<option value="">Chọn phường / xã</option>';
        wardSelect.disabled = true;
        return;
    }

    try {
        if (!addressStore.wardsByDistrict.has(String(districtCode))) {
            const response = await fetch(`${ADDRESS_API_BASE}/d/${districtCode}?depth=2`);
            if (!response.ok) {
                throw new Error("Không tải được danh sách phường xã");
            }

            const district = await response.json();
            addressStore.wardsByDistrict.set(String(districtCode), Array.isArray(district?.wards) ? district.wards : []);
        }

        const wards = addressStore.wardsByDistrict.get(String(districtCode)) || [];
        wardSelect.innerHTML = [
            '<option value="">Chọn phường / xã</option>',
            ...wards.map((ward) => `<option value="${ward.code}">${escapeHtml(ward.name)}</option>`)
        ].join("");
        wardSelect.disabled = false;
        wardSelect.value = selectedWardCode || "";
    } catch (error) {
        console.error("Lỗi tải phường xã:", error);
        wardSelect.innerHTML = '<option value="">Chưa tải được phường / xã</option>';
        wardSelect.disabled = true;
    }
}

function getSelectedOptionText(selectElement, fallbackValue) {
    if (!selectElement) {
        return "";
    }

    const option = Array.from(selectElement.options || []).find((item) => item.value === String(fallbackValue || ""));
    return option ? option.textContent.trim() : "";
}

function buildCustomerAddress(addressLine, ward, district, province) {
    return [addressLine, ward, district, province]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .join(", ");
}

function updateCheckoutAddressHint(customMessage = "") {
    const hint = document.getElementById("checkout-address-hint");
    if (!hint) {
        return;
    }

    if (customMessage) {
        hint.textContent = customMessage;
        return;
    }

    const customer = getCustomerFormData();
    hint.textContent = customer.address
        ? `Địa chỉ giao hàng: ${customer.address}`
        : "Chọn địa chỉ để hệ thống tự ghép địa chỉ giao hàng đầy đủ.";
}

function isCustomerFormValid(customer) {
    if (!customer.name || !customer.phone || !customer.addressLine || !customer.provinceCode || !customer.districtCode || !customer.wardCode) {
        showToast("Hãy điền đủ họ tên, số điện thoại và địa chỉ giao hàng");
        return false;
    }

    if (!/^0\d{9,10}$/.test(customer.phone)) {
        showToast("Số điện thoại chưa đúng định dạng");
        return false;
    }

    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
        showToast("Email nhận xác nhận chưa đúng định dạng");
        return false;
    }

    return true;
}

function hydrateCatalogFilters() {
    if (!refs.categoryFilter) {
        return;
    }

    const categories = [...new Set(
        state.products
            .map((product) => String(product.category || "").trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "vi"));

    refs.categoryFilter.innerHTML = [
        '<option value="all">Tất cả loại sản phẩm</option>',
        ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    ].join("");

    refs.categoryFilter.value = state.category;
    if (refs.priceFilter) {
        refs.priceFilter.value = state.priceRange;
    }
}

function matchesPriceRange(price, priceRange) {
    if (!priceRange || priceRange === "all") {
        return true;
    }

    if (priceRange.endsWith("+")) {
        return price >= Number(priceRange.replace("+", ""));
    }

    const [minRaw, maxRaw] = String(priceRange).split("-");
    const min = Number(minRaw || 0);
    const max = Number(maxRaw || 0);

    return price >= min && price <= max;
}

function updateCatalogResultCount(visibleCount, totalCount) {
    if (!refs.catalogResultCount) {
        return;
    }

    if (!totalCount) {
        refs.catalogResultCount.textContent = "Chưa có sản phẩm để hiển thị.";
        return;
    }

    refs.catalogResultCount.textContent = `Hiển thị ${visibleCount}/${totalCount} sản phẩm phù hợp`;
}

function normalizeText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase();
}

function matchesNormalizedQuery(text, query) {
    const normalizedText = normalizeText(text);
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
        return true;
    }

    const tokens = normalizedText.split(/[^a-z0-9]+/).filter(Boolean);
    const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);

    return queryParts.every((part) => tokens.some((token) => token.startsWith(part)));
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function hasCustomerAddress(customer) {
    const manualAddress = String(customer.addressLine || customer.address || "").trim();
    const structuredAddress = Boolean(customer.provinceCode && customer.districtCode && customer.wardCode);
    return manualAddress.length >= 8 || structuredAddress;
}

function validateCustomerForCheckout(customer) {
    if (!customer.name || !customer.phone || !hasCustomerAddress(customer)) {
        showToast("Hãy điền đủ họ tên, số điện thoại và địa chỉ giao hàng");
        return false;
    }

    if (!/^0\d{9,10}$/.test(customer.phone)) {
        showToast("Số điện thoại chưa đúng định dạng");
        return false;
    }

    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
        showToast("Email nhận xác nhận chưa đúng định dạng");
        return false;
    }

    return true;
}

function loadStorage(key, fallback) {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : fallback;
    } catch (error) {
        console.warn(`Không đọc được ${key}:`, error);
        return fallback;
    }
}

function saveStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function formatPrice(price) {
    return `${currency.format(Number(price || 0))} VNĐ`;
}

function translateTag(tag) {
    if (String(tag || "").startsWith("SALE")) {
        return String(tag).replace("SALE", "Giảm");
    }

    const map = {
        LIMITED: "Giới hạn",
        "BEST SELLER": "Bán chạy",
        NEW: "Mới",
        "OUT OF STOCK": "Hết hàng"
    };

    return map[tag] || tag;
}
