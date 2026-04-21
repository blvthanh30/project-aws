const state = {
    store: null,
    products: [],
    filter: "all",
    search: "",
    cart: loadStorage("voidx-cart", []),
    customer: loadStorage("voidx-customer", {
        name: "",
        phone: "",
        address: "",
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
    cartCount: document.getElementById("cart-count"),
    cartButton: document.getElementById("cart-button"),
    cartDrawer: document.getElementById("cart-drawer"),
    cartOverlay: document.getElementById("cart-overlay"),
    closeCart: document.getElementById("close-cart"),
    cartItems: document.getElementById("cart-items"),
    cartSubtotal: document.getElementById("cart-subtotal"),
    checkoutButton: document.getElementById("checkout-btn"),
    customerForm: document.getElementById("customer-form"),
    newsletterForm: document.getElementById("newsletter-form"),
    toast: document.getElementById("toast"),
    menuToggle: document.querySelector(".menu-toggle"),
    menu: document.querySelector(".menu"),
    loginLink: document.querySelector('.menu a[href="/dang-nhap"]'),
    adminLink: document.querySelector('.menu a[href="/admin"]')
};

const currency = new Intl.NumberFormat("vi-VN");
let toastTimer;
let revealObserver;

window.addEventListener("load", () => {
    if (refs.loader) {
        window.setTimeout(() => refs.loader.classList.add("is-hidden"), 500);
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();
    refillCustomerForm();
    setupRevealObserver();
    renderCart();
    await Promise.all([loadStore(), maybeLoadProducts(), syncAuthUser()]);
});

function bindEvents() {
    refs.filterBar?.addEventListener("click", handleFilterClick);
    refs.searchInput?.addEventListener("input", handleSearchInput);
    refs.cartButton?.addEventListener("click", openCart);
    refs.cartOverlay?.addEventListener("click", closeCart);
    refs.closeCart?.addEventListener("click", closeCart);
    refs.checkoutButton?.addEventListener("click", submitOrder);
    refs.newsletterForm?.addEventListener("submit", handleNewsletterSubmit);
    refs.menuToggle?.addEventListener("click", toggleMenu);
    refs.cartItems?.addEventListener("click", handleCartActions);
    refs.customerForm?.addEventListener("input", persistCustomerForm);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeCart();
            closeUserMenu();
        }
    });

    document.addEventListener("click", (event) => {
        const insideUserMenu = event.target.closest(".user-nav");
        if (!insideUserMenu) {
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
        localStorage.setItem("voidx-auth-user", JSON.stringify(result.user));
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

        const cartButton = refs.cartButton;
        refs.menu.insertBefore(userNav, cartButton);

        const trigger = userNav.querySelector(".user-menu-trigger");
        const logoutButton = userNav.querySelector(".user-logout-btn");

        trigger.addEventListener("click", (event) => {
            event.stopPropagation();
            userNav.classList.toggle("is-open");
            trigger.setAttribute("aria-expanded", String(userNav.classList.contains("is-open")));
        });

        logoutButton.addEventListener("click", handleLogout);
    }

    const initials = getInitials(state.authUser.name || state.authUser.email || "U");
    userNav.querySelector(".user-avatar").textContent = initials;
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
        console.error("Lỗi khi tải cấu hình shop:", error);
        showToast("Không tải được cấu hình cửa hàng");
    }
}

function hydrateStore() {
    if (!state.store) {
        return;
    }

    if (refs.heroHeadline) refs.heroHeadline.textContent = state.store.headline;
    if (refs.heroSubheadline) refs.heroSubheadline.textContent = state.store.subheadline;
    if (refs.heroImage) refs.heroImage.src = state.store.heroImage;
    if (refs.shippingPolicy) refs.shippingPolicy.textContent = state.store.shippingPolicy;
    if (refs.returnPolicy) refs.returnPolicy.textContent = state.store.returnPolicy;
    if (refs.paymentPolicy) refs.paymentPolicy.textContent = state.store.paymentPolicy;
    if (refs.storeHotline) refs.storeHotline.textContent = state.store.hotline;
    if (refs.storeAddress) refs.storeAddress.textContent = state.store.address;
    if (refs.footerHotline) refs.footerHotline.textContent = state.store.hotline;
    if (refs.footerEmail) refs.footerEmail.textContent = state.store.email;
    if (refs.footerAddress) refs.footerAddress.textContent = state.store.address;
    if (refs.storeSocial) {
        refs.storeSocial.textContent = [
            state.store.socials?.instagram,
            state.store.socials?.facebook,
            state.store.socials?.tiktok
        ].filter(Boolean).join(" • ");
    }
}

async function maybeLoadProducts() {
    if (!refs.productContainer) {
        return;
    }

    refs.productContainer.innerHTML = '<div class="empty-state">Đang tải sản phẩm...</div>';

    try {
        const response = await fetch("/api/products");

        if (!response.ok) {
            throw new Error("Không thể tải dữ liệu sản phẩm");
        }

        state.products = await response.json();

        if (refs.heroProductCount) {
            refs.heroProductCount.textContent = String(state.products.length).padStart(2, "0");
        }

        renderProducts();
    } catch (error) {
        console.error("Lỗi khi tải sản phẩm:", error);
        refs.productContainer.innerHTML = `
            <div class="empty-state">
                Không thể tải danh sách sản phẩm lúc này. Vui lòng thử lại sau.
            </div>
        `;
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
        refs.productContainer.innerHTML = `
            <div class="empty-state">
                Không tìm thấy sản phẩm phù hợp với bộ lọc hoặc từ khóa hiện tại.
            </div>
        `;
        return;
    }

    refs.productContainer.innerHTML = visibleProducts.map((product) => {
        const sizes = Array.isArray(product.sizes) ? product.sizes.join(" / ") : "Freesize";
        const colors = Array.isArray(product.colors) ? product.colors.join(", ") : "Đang cập nhật";

        return `
            <article class="product-card reveal">
                <div class="product-media">
                    <img src="${product.image}" alt="${product.name}">
                    ${product.tag ? `<span class="product-tag">${translateTag(product.tag)}</span>` : ""}
                </div>
                <div class="product-body">
                    <div class="product-heading">
                        <div>
                            <p class="product-category">${product.category || "Thời trang đường phố"}</p>
                            <h3>${product.name}</h3>
                            <p>${product.desc}</p>
                        </div>
                        <strong>${formatPrice(product.price)}</strong>
                    </div>
                    <div class="product-meta">
                        <span>Size: ${sizes}</span>
                        <span>Màu: ${colors}</span>
                        <span>Chất liệu: ${product.material || "Đang cập nhật"}</span>
                        <span>Còn khoảng: ${product.stock || 0} sản phẩm</span>
                    </div>
                    <button type="button" class="buy-btn" data-product-id="${product.id}">
                        Thêm vào giỏ
                    </button>
                </div>
            </article>
        `;
    }).join("");

    document.querySelectorAll(".product-card .buy-btn").forEach((button) => {
        button.addEventListener("click", () => addToCart(Number(button.dataset.productId)));
    });

    observeReveal();
}

function getFilteredProducts() {
    const keyword = state.search.trim().toLowerCase();

    return state.products.filter((product) => {
        const matchesFilter = state.filter === "all" || product.tag === state.filter;
        const searchText = [
            product.name,
            product.desc,
            product.category,
            product.material,
            ...(product.colors || [])
        ].join(" ").toLowerCase();

        return matchesFilter && (!keyword || searchText.includes(keyword));
    });
}

function handleFilterClick(event) {
    const chip = event.target.closest(".filter-chip");
    if (!chip) return;

    state.filter = chip.dataset.filter;
    document.querySelectorAll(".filter-chip").forEach((button) => {
        button.classList.toggle("active", button === chip);
    });
    renderProducts();
}

function handleSearchInput(event) {
    state.search = event.target.value;
    renderProducts();
}

function addToCart(productId) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;

    const existingItem = state.cart.find((item) => item.id === productId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        state.cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: 1
        });
    }

    saveStorage("voidx-cart", state.cart);
    renderCart();
    openCart();
    showToast(`Đã thêm ${product.name} vào giỏ`);
}

function renderCart() {
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (refs.cartCount) refs.cartCount.textContent = String(totalItems);
    if (refs.cartSubtotal) refs.cartSubtotal.textContent = formatPrice(subtotal);

    if (refs.checkoutButton) {
        refs.checkoutButton.disabled = state.cart.length === 0;
        refs.checkoutButton.classList.toggle("is-disabled", state.cart.length === 0);
    }

    if (!refs.cartItems) return;

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
            <img src="${item.image}" alt="${item.name}">
            <div>
                <h3>${item.name}</h3>
                <p>${formatPrice(item.price)}</p>
                <div class="qty-controls">
                    <button type="button" data-action="decrease" data-id="${item.id}" aria-label="Giảm số lượng">-</button>
                    <span>${item.quantity}</span>
                    <button type="button" data-action="increase" data-id="${item.id}" aria-label="Tăng số lượng">+</button>
                </div>
            </div>
            <button type="button" class="remove-item" data-action="remove" data-id="${item.id}">
                Xóa
            </button>
        </article>
    `).join("");
}

function handleCartActions(event) {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const itemId = Number(actionButton.dataset.id);
    const action = actionButton.dataset.action;
    const targetItem = state.cart.find((item) => item.id === itemId);
    if (!targetItem) return;

    if (action === "increase") targetItem.quantity += 1;
    if (action === "decrease") targetItem.quantity -= 1;
    if (action === "remove" || targetItem.quantity <= 0) {
        state.cart = state.cart.filter((item) => item.id !== itemId);
    }

    saveStorage("voidx-cart", state.cart);
    renderCart();
}

function openCart() {
    if (!refs.cartDrawer) return;
    refs.cartDrawer.classList.add("is-open");
    refs.cartDrawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeCart() {
    if (!refs.cartDrawer) return;
    refs.cartDrawer.classList.remove("is-open");
    refs.cartDrawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

async function submitOrder() {
    if (!state.cart.length) {
        showToast("Giỏ hàng đang trống");
        return;
    }

    const customer = getCustomerFormData();
    if (!isCustomerFormValid(customer)) return;

    refs.checkoutButton.disabled = true;
    refs.checkoutButton.textContent = "Đang gửi...";

    const order = {
        customer,
        items: state.cart.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price
        })),
        total: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
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

        showToast(`${result.message}. Mã đơn: ${result.orderCode}`);
        state.cart = [];
        saveStorage("voidx-cart", state.cart);
        renderCart();
        closeCart();
    } catch (error) {
        console.error("Lỗi đặt hàng:", error);
        showToast(error.message || "Không gửi được đơn hàng");
    } finally {
        refs.checkoutButton.disabled = state.cart.length === 0;
        refs.checkoutButton.classList.toggle("is-disabled", state.cart.length === 0);
        refs.checkoutButton.textContent = "Gửi đơn hàng";
    }
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
}

function refillCustomerForm() {
    if (!refs.customerForm) return;
    refs.customerForm.elements.name.value = state.customer.name || "";
    refs.customerForm.elements.phone.value = state.customer.phone || "";
    refs.customerForm.elements.address.value = state.customer.address || "";
    refs.customerForm.elements.note.value = state.customer.note || "";
}

function getCustomerFormData() {
    if (!refs.customerForm) {
        return { name: "", phone: "", address: "", note: "" };
    }

    const formData = new FormData(refs.customerForm);
    return {
        name: String(formData.get("name") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        address: String(formData.get("address") || "").trim(),
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
    if (!refs.toast) return;
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
    if (!revealObserver) return;
    document.querySelectorAll(".reveal:not(.is-visible)").forEach((element) => {
        revealObserver.observe(element);
    });
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
    return `${currency.format(price)} VNĐ`;
}

function translateTag(tag) {
    const tagMap = {
        LIMITED: "Giới hạn",
        "BEST SELLER": "Bán chạy",
        NEW: "Mới"
    };

    return tagMap[tag] || tag;
}

function getInitials(name) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("");
}

function getShortName(name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : name;
}
