const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

const dataDir = path.join(__dirname, '../data');
const publicDir = path.join(__dirname, '../public');
const productUploadsDir = path.join(publicDir, 'uploads/products');
const productsPath = path.join(dataDir, 'products.json');
const ordersPath = path.join(dataDir, 'orders.json');
const subscribersPath = path.join(dataDir, 'subscribers.json');
const storePath = path.join(dataDir, 'store.json');
const usersPath = path.join(dataDir, 'users.json');
const sessionsPath = path.join(dataDir, 'sessions.json');
const couponsPath = path.join(dataDir, 'coupons.json');

const ORDER_STATUSES = ['Chờ xác nhận', 'Đang xử lý', 'Đang giao', 'Đã giao', 'Đã hủy'];
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

router.get('/store', (req, res) => {
    res.json(readJson(storePath, {}));
});

router.patch('/store', requireAdmin, (req, res) => {
    const currentStore = readJson(storePath, {});
    const payload = req.body || {};

    const nextStore = {
        ...currentStore,
        name: cleanText(payload.name, currentStore.name),
        headline: cleanText(payload.headline, currentStore.headline),
        subheadline: cleanText(payload.subheadline, currentStore.subheadline),
        hotline: cleanText(payload.hotline, currentStore.hotline),
        email: normalizeEmail(payload.email) || currentStore.email,
        address: cleanText(payload.address, currentStore.address),
        shippingPolicy: cleanText(payload.shippingPolicy, currentStore.shippingPolicy),
        returnPolicy: cleanText(payload.returnPolicy, currentStore.returnPolicy),
        paymentPolicy: cleanText(payload.paymentPolicy, currentStore.paymentPolicy),
        heroImage: cleanText(payload.heroImage, currentStore.heroImage),
        socials: {
            instagram: cleanText(payload.socials?.instagram, currentStore.socials?.instagram || ''),
            facebook: cleanText(payload.socials?.facebook, currentStore.socials?.facebook || ''),
            tiktok: cleanText(payload.socials?.tiktok, currentStore.socials?.tiktok || '')
        },
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.id
    };

    if (!nextStore.name || !nextStore.headline || !nextStore.hotline || !nextStore.email || !nextStore.address) {
        return res.status(400).json({
            success: false,
            message: 'Thông tin cấu hình shop chưa đầy đủ'
        });
    }

    if (!isValidEmail(nextStore.email)) {
        return res.status(400).json({
            success: false,
            message: 'Email shop không hợp lệ'
        });
    }

    writeJson(storePath, nextStore);

    return res.json({
        success: true,
        message: 'Đã cập nhật thông tin cửa hàng',
        store: nextStore
    });
});

router.get('/products', (req, res) => {
    const products = readJson(productsPath, []);
    const search = cleanText(req.query.search).toLowerCase();
    const category = cleanText(req.query.category).toLowerCase();
    const tag = cleanText(req.query.tag).toUpperCase();
    const sort = cleanText(req.query.sort, 'default');
    const inStockOnly = String(req.query.inStock || '').toLowerCase() === 'true';
    const limit = toPositiveInteger(req.query.limit, 0);
    const minPrice = toPositiveInteger(req.query.minPrice, 0);
    const rawMaxPrice = cleanText(req.query.maxPrice);
    const maxPrice = rawMaxPrice ? toPositiveInteger(rawMaxPrice, 0) : Number.POSITIVE_INFINITY;

    let result = products.filter((product) => {
        const matchesSearch = !search || [
            product.name,
            product.category,
            product.desc,
            product.material
        ].filter(Boolean).join(' ').toLowerCase().includes(search);

        const matchesCategory = !category || String(product.category || '').toLowerCase() === category;
        const matchesTag = !tag || String(product.tag || '').toUpperCase() === tag;
        const matchesStock = !inStockOnly || isProductPurchasable(product);
        const price = Number(product.price || 0);
        const matchesPrice = price >= minPrice && price <= maxPrice;

        return matchesSearch && matchesCategory && matchesTag && matchesStock && matchesPrice;
    });

    result = sortProducts(result, sort);

    if (limit > 0) {
        result = result.slice(0, limit);
    }

    res.json(result);
});

router.get('/products/:id', (req, res) => {
    const products = readJson(productsPath, []);
    const targetProduct = findProductById(products, req.params.id);

    if (!targetProduct) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy sản phẩm'
        });
    }

    return res.json(targetProduct);
});

router.post('/cart/validate', (req, res) => {
    const cartItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const products = readJson(productsPath, []);
    const items = [];
    const messages = [];
    let changed = false;

    for (const rawItem of cartItems) {
        const product = findProductById(products, rawItem?.id);
        const requestedQuantity = toPositiveInteger(rawItem?.quantity, 0);

        if (!product) {
            changed = true;
            messages.push(`Một sản phẩm trong giỏ không còn tồn tại và đã bị loại bỏ.`);
            continue;
        }

        if (requestedQuantity <= 0) {
            changed = true;
            continue;
        }

        const availableStock = getAvailableStock(product);
        const quantity = Math.min(requestedQuantity, availableStock);
        const size = normalizeVariantSelection(rawItem?.size, product.sizes);
        const color = normalizeVariantSelection(rawItem?.color, product.colors);
        const normalizedKey = `${product.id}__${size}__${color}`;

        if (!isProductPurchasable(product)) {
            changed = true;
            messages.push(`"${product.name}" hiện đã hết hàng.`);
            continue;
        }

        if (quantity !== requestedQuantity) {
            changed = true;
            messages.push(`"${product.name}" chỉ còn ${availableStock} sản phẩm.`);
        }

        if (cleanText(rawItem?.size) !== size || cleanText(rawItem?.color) !== color || cleanText(rawItem?.key) !== normalizedKey) {
            changed = true;
        }

        items.push({
            id: product.id,
            key: normalizedKey,
            name: product.name,
            image: product.image,
            price: Number(product.price || 0),
            size,
            color,
            quantity,
            stock: availableStock,
            lineTotal: Number(product.price || 0) * quantity
        });
    }

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

    return res.json({
        success: true,
        valid: messages.length === 0,
        changed,
        items,
        subtotal,
        totalItems,
        messages
    });
});

router.post('/coupon/validate', (req, res) => {
    const code = normalizeCouponCode(req.body?.code);
    const subtotal = Math.max(0, Number(req.body?.subtotal || 0));
    const coupons = readJson(couponsPath, []);
    const validation = validateCouponForSubtotal(coupons, code, subtotal);

    if (!validation.success) {
        return res.status(400).json(validation);
    }

    return res.json({
        success: true,
        message: `Đã áp dụng mã ${validation.coupon.code}`,
        coupon: sanitizeCoupon(validation.coupon),
        discount: validation.discount,
        total: Math.max(0, subtotal - validation.discount)
    });
});

router.get('/coupons', requireAdmin, (req, res) => {
    res.json(readJson(couponsPath, []));
});

router.post('/coupons', requireAdmin, (req, res) => {
    const coupons = readJson(couponsPath, []);
    const validation = validateCouponPayload(req.body || {});

    if (!validation.success) {
        return res.status(400).json(validation);
    }

    if (coupons.some((coupon) => normalizeCouponCode(coupon.code) === validation.coupon.code)) {
        return res.status(409).json({
            success: false,
            message: 'Mã giảm giá này đã tồn tại'
        });
    }

    const now = new Date().toISOString();
    const coupon = {
        id: validation.coupon.code,
        ...validation.coupon,
        usedCount: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: req.user.id
    };

    coupons.unshift(coupon);
    writeJson(couponsPath, coupons);

    return res.status(201).json({
        success: true,
        message: 'Đã tạo mã giảm giá',
        coupon
    });
});

router.patch('/coupons/:code', requireAdmin, (req, res) => {
    const coupons = readJson(couponsPath, []);
    const targetCoupon = coupons.find((coupon) => normalizeCouponCode(coupon.code) === normalizeCouponCode(req.params.code));

    if (!targetCoupon) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy mã giảm giá'
        });
    }

    const validation = validateCouponPayload({
        ...targetCoupon,
        ...req.body,
        code: targetCoupon.code
    });

    if (!validation.success) {
        return res.status(400).json(validation);
    }

    Object.assign(targetCoupon, validation.coupon, {
        usedCount: toPositiveInteger(req.body?.usedCount, Number(targetCoupon.usedCount || 0)),
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.id
    });

    writeJson(couponsPath, coupons);

    return res.json({
        success: true,
        message: 'Đã cập nhật mã giảm giá',
        coupon: targetCoupon
    });
});

router.delete('/coupons/:code', requireAdmin, (req, res) => {
    const coupons = readJson(couponsPath, []);
    const code = normalizeCouponCode(req.params.code);
    const nextCoupons = coupons.filter((coupon) => normalizeCouponCode(coupon.code) !== code);

    if (nextCoupons.length === coupons.length) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy mã giảm giá'
        });
    }

    writeJson(couponsPath, nextCoupons);

    return res.json({
        success: true,
        message: 'Đã xóa mã giảm giá'
    });
});

router.post('/products/image', requireAdmin, (req, res) => {
    const upload = saveProductImage(req.body?.imageData, req.body?.fileName);

    if (!upload.success) {
        return res.status(400).json(upload);
    }

    return res.status(201).json({
        success: true,
        message: 'Đã tải ảnh sản phẩm lên',
        imageUrl: upload.imageUrl
    });
});

router.get('/order-track', (req, res) => {
    const rawQuery = cleanText(req.query.query);
    const normalizedQuery = normalizeTrackingQuery(rawQuery);

    if (!rawQuery) {
        return res.status(400).json({
            success: false,
            message: 'Vui lòng nhập mã đơn hàng hoặc số điện thoại'
        });
    }

    const orders = readJson(ordersPath, []);
    const matchedOrders = orders.filter((order) => {
        const orderCode = normalizeTrackingQuery(order.orderCode);
        const phone = normalizeTrackingQuery(order.customer?.phone);

        return orderCode === normalizedQuery || phone === normalizedQuery;
    });

    if (!matchedOrders.length) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy đơn hàng phù hợp'
        });
    }

    const result = matchedOrders
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .map((order) => ({
            orderCode: order.orderCode,
            status: normalizeOrderStatus(order.status),
            statusStep: getOrderStatusStep(order.status),
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            total: Number(order.total || 0),
            itemCount: Number(order.itemCount || 0),
            customer: {
                name: order.customer?.name || '',
                phone: maskPhoneNumber(order.customer?.phone || '')
            },
            items: Array.isArray(order.items)
                ? order.items.map((item) => ({
                    name: item.name,
                    size: item.size || '',
                    color: item.color || '',
                    quantity: Number(item.quantity || 0)
                }))
                : [],
            statusHistory: Array.isArray(order.statusHistory)
                ? order.statusHistory.map((history) => ({
                    status: normalizeOrderStatus(history.status),
                    changedAt: history.changedAt
                }))
                : []
        }));

    return res.json({
        success: true,
        query: rawQuery,
        orders: result
    });
});

router.post('/products', requireAdmin, (req, res) => {
    const products = readJson(productsPath, []);
    const validation = validateProductPayload(req.body || {});

    if (!validation.success) {
        return res.status(400).json(validation);
    }

    const product = {
        id: getNextProductId(products),
        ...validation.product,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: req.user.id
    };

    products.unshift(product);
    writeJson(productsPath, products);

    return res.status(201).json({
        success: true,
        message: 'Đã thêm sản phẩm mới',
        product
    });
});

router.patch('/products/:id', requireAdmin, (req, res) => {
    const products = readJson(productsPath, []);
    const targetProduct = findProductById(products, req.params.id);

    if (!targetProduct) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy sản phẩm'
        });
    }

    const validation = validateProductPayload({
        ...targetProduct,
        ...req.body
    });

    if (!validation.success) {
        return res.status(400).json(validation);
    }

    Object.assign(targetProduct, validation.product, {
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.id
    });

    writeJson(productsPath, products);

    return res.json({
        success: true,
        message: 'Đã cập nhật sản phẩm',
        product: targetProduct
    });
});

router.delete('/products/:id', requireAdmin, (req, res) => {
    const products = readJson(productsPath, []);
    const targetProduct = findProductById(products, req.params.id);

    if (!targetProduct) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy sản phẩm'
        });
    }

    const orders = readJson(ordersPath, []);
    const isUsedInOrder = orders.some((order) =>
        Array.isArray(order.items) && order.items.some((item) => String(item.id) === String(targetProduct.id))
    );

    if (isUsedInOrder) {
        return res.status(409).json({
            success: false,
            message: 'Sản phẩm đã xuất hiện trong đơn hàng, không thể xóa'
        });
    }

    writeJson(productsPath, products.filter((product) => String(product.id) !== String(targetProduct.id)));

    return res.json({
        success: true,
        message: 'Đã xóa sản phẩm'
    });
});

router.post('/auth/register', (req, res) => {
    const name = cleanText(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const users = readJson(usersPath, []);

    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu'
        });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({
            success: false,
            message: 'Email không hợp lệ'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Mật khẩu phải có ít nhất 6 ký tự'
        });
    }

    if (users.some((user) => user.email === email)) {
        return res.status(409).json({
            success: false,
            message: 'Email này đã được sử dụng'
        });
    }

    const role = users.length === 0 ? 'admin' : 'customer';
    const newUser = {
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash: hashPassword(password),
        role,
        createdAt: new Date().toISOString()
    };

    users.unshift(newUser);
    writeJson(usersPath, users);

    return res.status(201).json({
        success: true,
        message: role === 'admin'
            ? 'Đăng ký thành công. Đây là tài khoản quản trị đầu tiên của shop'
            : 'Đăng ký thành công',
        user: sanitizeUser(newUser)
    });
});

router.post('/auth/login', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const users = readJson(usersPath, []);
    const user = users.find((item) => item.email === email);

    if (!user || user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({
            success: false,
            message: 'Email hoặc mật khẩu không đúng'
        });
    }

    const sessions = pruneExpiredSessions(readJson(sessionsPath, []));
    const token = crypto.randomUUID();
    sessions.unshift({
        token,
        userId: user.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
    });
    writeJson(sessionsPath, sessions);

    return res.json({
        success: true,
        message: 'Đăng nhập thành công',
        token,
        user: sanitizeUser(user)
    });
});

router.get('/auth/me', requireAuth, (req, res) => {
    res.json({
        success: true,
        user: sanitizeUser(req.user)
    });
});

router.post('/auth/logout', requireAuth, (req, res) => {
    const token = getTokenFromRequest(req);
    const sessions = readJson(sessionsPath, []);
    writeJson(sessionsPath, sessions.filter((session) => session.token !== token));

    res.json({
        success: true,
        message: 'Đăng xuất thành công'
    });
});

router.post('/auth/logout-all', requireAuth, (req, res) => {
    const sessions = readJson(sessionsPath, []);
    writeJson(sessionsPath, sessions.filter((session) => session.userId !== req.user.id));

    res.json({
        success: true,
        message: 'Đã đăng xuất khỏi tất cả thiết bị'
    });
});

router.get('/users', requireAdmin, (req, res) => {
    const users = readJson(usersPath, []).map(sanitizeUser);
    res.json(users);
});

router.post('/newsletter', (req, res) => {
    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
        return res.status(400).json({
            success: false,
            message: 'Email không hợp lệ'
        });
    }

    const subscribers = readJson(subscribersPath, []);

    if (subscribers.some((item) => item.email === email)) {
        return res.json({
            success: true,
            message: 'Email này đã đăng ký trước đó'
        });
    }

    subscribers.unshift({
        id: crypto.randomUUID(),
        email,
        createdAt: new Date().toISOString()
    });
    writeJson(subscribersPath, subscribers);

    return res.json({
        success: true,
        message: 'Đăng ký nhận tin thành công'
    });
});

router.post('/order', (req, res) => {
    const orderData = req.body || {};
    const customer = normalizeCustomer(orderData.customer || {});
    const requestedItems = Array.isArray(orderData.items) ? orderData.items : [];
    const products = readJson(productsPath, []);
    const coupons = readJson(couponsPath, []);

    if (!customer.name || !customer.phone || !customer.address) {
        return res.status(400).json({
            success: false,
            message: 'Thông tin khách hàng chưa đầy đủ'
        });
    }

    if (!isLikelyPhoneNumber(customer.phone)) {
        return res.status(400).json({
            success: false,
            message: 'Số điện thoại không hợp lệ'
        });
    }

    if (!requestedItems.length) {
        return res.status(400).json({
            success: false,
            message: 'Đơn hàng chưa có sản phẩm'
        });
    }

    const preparedItems = [];

    for (const rawItem of requestedItems) {
        const quantity = toPositiveInteger(rawItem?.quantity, 0);
        const product = findProductById(products, rawItem?.id);
        const size = normalizeVariantSelection(rawItem?.size, product?.sizes);
        const color = normalizeVariantSelection(rawItem?.color, product?.colors);

        if (!product) {
            return res.status(400).json({
                success: false,
                message: `Không tìm thấy sản phẩm trong đơn hàng: ${rawItem?.name || rawItem?.id || 'N/A'}`
            });
        }

        if (quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: `Số lượng sản phẩm "${product.name}" không hợp lệ`
            });
        }

        if (!isProductPurchasable(product)) {
            return res.status(409).json({
                success: false,
                message: `Sản phẩm "${product.name}" hiện đã hết hàng`
            });
        }

        if (getAvailableStock(product) < quantity) {
            return res.status(409).json({
                success: false,
                message: `Sản phẩm "${product.name}" không đủ tồn kho`
            });
        }

        preparedItems.push({
            id: product.id,
            name: product.name,
            size,
            color,
            quantity,
            price: Number(product.price || 0),
            lineTotal: Number(product.price || 0) * quantity
        });
    }

    for (const item of preparedItems) {
        const product = findProductById(products, item.id);
        product.stock = Math.max(0, Number(product.stock || 0) - item.quantity);
        syncProductInventoryState(product);
        product.updatedAt = new Date().toISOString();
    }

    const subtotal = preparedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const couponCode = normalizeCouponCode(orderData.couponCode || orderData.coupon?.code);
    const couponValidation = couponCode
        ? validateCouponForSubtotal(coupons, couponCode, subtotal)
        : { success: true, discount: 0, coupon: null };

    if (!couponValidation.success) {
        return res.status(400).json(couponValidation);
    }

    if (couponValidation.coupon) {
        couponValidation.coupon.usedCount = Number(couponValidation.coupon.usedCount || 0) + 1;
        couponValidation.coupon.updatedAt = new Date().toISOString();
    }

    const discount = Number(couponValidation.discount || 0);
    const total = Math.max(0, subtotal - discount);
    const orderCode = createOrderCode();
    const now = new Date().toISOString();
    const savedOrder = {
        orderCode,
        status: ORDER_STATUSES[0],
        customer,
        items: preparedItems,
        itemCount: preparedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal,
        discount,
        coupon: couponValidation.coupon ? sanitizeCoupon(couponValidation.coupon) : null,
        total,
        payment: createPaymentSnapshot(customer.paymentMethod, total, orderCode),
        shipping: createShippingSnapshot(customer.shippingMethod),
        createdAt: now,
        updatedAt: now,
        statusHistory: [
            {
                status: ORDER_STATUSES[0],
                changedAt: now,
                changedBy: 'system'
            }
        ]
    };

    const existingOrders = readJson(ordersPath, []);
    existingOrders.unshift(savedOrder);
    writeJson(productsPath, products);
    writeJson(couponsPath, coupons);
    writeJson(ordersPath, existingOrders);

    return res.status(201).json({
        success: true,
        message: 'Đơn hàng đã được ghi nhận',
        orderCode,
        order: savedOrder
    });
});

router.get('/orders', requireAdmin, (req, res) => {
    const orders = readJson(ordersPath, []);
    const status = cleanText(req.query.status);

    if (!status) {
        return res.json(orders);
    }

    return res.json(orders.filter((order) => order.status === status));
});

router.get('/orders/:orderCode', requireAdmin, (req, res) => {
    const orders = readJson(ordersPath, []);
    const targetOrder = orders.find((order) => order.orderCode === req.params.orderCode);

    if (!targetOrder) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy đơn hàng'
        });
    }

    return res.json(targetOrder);
});

router.patch('/orders/:orderCode', requireAdmin, (req, res) => {
    const orderCode = req.params.orderCode;
    const nextStatus = cleanText(req.body?.status);

    if (!ORDER_STATUSES.includes(nextStatus)) {
        return res.status(400).json({
            success: false,
            message: 'Trạng thái đơn không hợp lệ'
        });
    }

    const orders = readJson(ordersPath, []);
    const products = readJson(productsPath, []);
    const targetOrder = orders.find((order) => order.orderCode === orderCode);

    if (!targetOrder) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy đơn hàng'
        });
    }

    const previousStatus = cleanText(targetOrder.status, ORDER_STATUSES[0]);

    if (previousStatus === nextStatus) {
        return res.json({
            success: true,
            message: 'Trạng thái đơn hàng không thay đổi',
            order: targetOrder
        });
    }

    if (previousStatus !== 'Đã hủy' && nextStatus === 'Đã hủy') {
        applyStockToProducts(products, targetOrder.items, 'restore');
        writeJson(productsPath, products);
    }

    if (previousStatus === 'Đã hủy' && nextStatus !== 'Đã hủy') {
        const stockCheck = canReserveProducts(products, targetOrder.items);

        if (!stockCheck.success) {
            return res.status(409).json(stockCheck);
        }

        applyStockToProducts(products, targetOrder.items, 'reserve');
        writeJson(productsPath, products);
    }

    targetOrder.status = nextStatus;
    targetOrder.updatedAt = new Date().toISOString();
    targetOrder.statusHistory = Array.isArray(targetOrder.statusHistory) ? targetOrder.statusHistory : [];
    targetOrder.statusHistory.unshift({
        status: nextStatus,
        changedAt: targetOrder.updatedAt,
        changedBy: req.user.email
    });

    writeJson(ordersPath, orders);

    return res.json({
        success: true,
        message: 'Đã cập nhật trạng thái đơn hàng',
        order: targetOrder
    });
});

router.post('/orders/:orderCode/ship', requireAdmin, (req, res) => {
    const orders = readJson(ordersPath, []);
    const targetOrder = orders.find((order) => order.orderCode === req.params.orderCode);

    if (!targetOrder) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy đơn hàng'
        });
    }

    const provider = cleanText(req.body?.provider || targetOrder.shipping?.provider || 'shop');
    const shipment = createFakeShipment(provider, targetOrder);
    targetOrder.shipping = {
        ...(targetOrder.shipping || {}),
        ...shipment,
        provider,
        providerLabel: getShippingProviderLabel(provider),
        pushedAt: new Date().toISOString(),
        pushedBy: req.user.email
    };
    targetOrder.updatedAt = new Date().toISOString();
    targetOrder.statusHistory = Array.isArray(targetOrder.statusHistory) ? targetOrder.statusHistory : [];
    targetOrder.statusHistory.unshift({
        status: `Đã đẩy vận chuyển ${targetOrder.shipping.providerLabel}`,
        changedAt: targetOrder.updatedAt,
        changedBy: req.user.email
    });

    writeJson(ordersPath, orders);

    return res.json({
        success: true,
        message: `Đã giả lập đẩy đơn sang ${targetOrder.shipping.providerLabel}`,
        order: targetOrder
    });
});

router.get('/subscribers', requireAdmin, (req, res) => {
    res.json(readJson(subscribersPath, []));
});

router.get('/dashboard', requireAdmin, (req, res) => {
    const orders = readJson(ordersPath, []);
    const subscribers = readJson(subscribersPath, []);
    const products = readJson(productsPath, []);
    const coupons = readJson(couponsPath, []);
    const activeOrders = orders.filter((order) => order.status !== 'Đã hủy');
    const revenue = activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const pendingOrders = orders.filter((order) => order.status !== 'Đã giao' && order.status !== 'Đã hủy').length;
    const statusCounts = ORDER_STATUSES.reduce((accumulator, status) => {
        accumulator[status] = orders.filter((order) => order.status === status).length;
        return accumulator;
    }, {});

    const soldMap = {};
    for (const order of activeOrders) {
        for (const item of Array.isArray(order.items) ? order.items : []) {
            soldMap[item.id] = (soldMap[item.id] || 0) + Number(item.quantity || 0);
        }
    }

    const topProducts = products
        .map((product) => ({
            id: product.id,
            name: product.name,
            sold: soldMap[product.id] || 0,
            stock: Number(product.stock || 0)
        }))
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 5);

    const lowStockProducts = products
        .filter((product) => Number(product.stock || 0) <= 5)
        .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
        .slice(0, 5);

    res.json({
        revenue,
        orderCount: orders.length,
        pendingOrders,
        subscriberCount: subscribers.length,
        productCount: products.length,
        couponCount: coupons.length,
        activeCouponCount: coupons.filter((coupon) => isCouponActive(coupon)).length,
        latestOrders: orders.slice(0, 5),
        statusCounts,
        topProducts,
        lowStockProducts
    });
});

function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền truy cập khu vực này'
            });
        }

        next();
    });
}

function requireAuth(req, res, next) {
    const token = getTokenFromRequest(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Bạn cần đăng nhập trước'
        });
    }

    const sessions = pruneExpiredSessions(readJson(sessionsPath, []));
    const users = readJson(usersPath, []);
    const session = sessions.find((item) => item.token === token);

    writeJson(sessionsPath, sessions);

    if (!session) {
        return res.status(401).json({
            success: false,
            message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn'
        });
    }

    const user = users.find((item) => item.id === session.userId);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Không tìm thấy tài khoản đăng nhập'
        });
    }

    req.user = user;
    req.session = session;
    next();
}

function validateProductPayload(payload) {
    const discountPercent = clampNumber(payload.discountPercent, 0, 95);
    const originalPrice = Number(payload.originalPrice || payload.price || 0);
    const calculatedSalePrice = discountPercent > 0
        ? Math.round(originalPrice * (100 - discountPercent) / 100)
        : Number(payload.price || originalPrice || 0);
    let status = ['active', 'out-of-stock'].includes(cleanText(payload.status))
        ? cleanText(payload.status)
        : 'active';
    const stock = status === 'out-of-stock' ? 0 : toPositiveInteger(payload.stock, 0);
    if (stock <= 0) {
        status = 'out-of-stock';
    }

    const product = {
        name: cleanText(payload.name),
        category: cleanText(payload.category),
        price: calculatedSalePrice,
        originalPrice: discountPercent > 0 ? originalPrice : 0,
        discountPercent,
        image: cleanText(payload.image),
        tag: discountPercent > 0 ? `SALE ${discountPercent}%` : cleanText(payload.tag).toUpperCase(),
        desc: cleanText(payload.desc),
        material: cleanText(payload.material),
        sizes: normalizeStringList(payload.sizes),
        colors: normalizeStringList(payload.colors),
        stock,
        status
    };

    if (!product.name || !product.category || !product.image || !product.desc) {
        return {
            success: false,
            message: 'Sản phẩm cần có tên, danh mục, ảnh và mô tả'
        };
    }

    if (!Number.isFinite(product.price) || product.price <= 0) {
        return {
            success: false,
            message: 'Giá sản phẩm không hợp lệ'
        };
    }

    if (!product.sizes.length) {
        product.sizes = ['Một kích thước'];
    }

    if (!product.colors.length) {
        product.colors = ['Đang cập nhật'];
    }

    return {
        success: true,
        product
    };
}

function validateCouponPayload(payload) {
    const type = cleanText(payload.type, 'percent');
    const coupon = {
        code: normalizeCouponCode(payload.code),
        type: ['percent', 'fixed'].includes(type) ? type : 'percent',
        value: Number(payload.value || 0),
        minOrder: toPositiveInteger(payload.minOrder, 0),
        maxDiscount: toPositiveInteger(payload.maxDiscount, 0),
        usageLimit: toPositiveInteger(payload.usageLimit, 0),
        active: Boolean(payload.active),
        expiresAt: cleanText(payload.expiresAt)
    };

    if (!coupon.code || coupon.code.length < 3) {
        return {
            success: false,
            message: 'Mã giảm giá cần có ít nhất 3 ký tự'
        };
    }

    if (!/^[A-Z0-9_-]+$/.test(coupon.code)) {
        return {
            success: false,
            message: 'Mã giảm giá chỉ nên gồm chữ in hoa, số, dấu gạch ngang hoặc gạch dưới'
        };
    }

    if (!Number.isFinite(coupon.value) || coupon.value <= 0) {
        return {
            success: false,
            message: 'Giá trị giảm giá không hợp lệ'
        };
    }

    if (coupon.type === 'percent' && coupon.value > 95) {
        return {
            success: false,
            message: 'Mã giảm theo phần trăm không nên vượt quá 95%'
        };
    }

    return {
        success: true,
        coupon
    };
}

function validateCouponForSubtotal(coupons, code, subtotal) {
    const normalizedCode = normalizeCouponCode(code);
    const coupon = coupons.find((item) => normalizeCouponCode(item.code) === normalizedCode);

    if (!coupon) {
        return {
            success: false,
            message: 'Mã giảm giá không tồn tại'
        };
    }

    if (!isCouponActive(coupon)) {
        return {
            success: false,
            message: 'Mã giảm giá đã tắt hoặc hết hạn'
        };
    }

    if (Number(coupon.usageLimit || 0) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit || 0)) {
        return {
            success: false,
            message: 'Mã giảm giá đã hết lượt sử dụng'
        };
    }

    if (subtotal < Number(coupon.minOrder || 0)) {
        return {
            success: false,
            message: `Đơn hàng cần tối thiểu ${formatServerPrice(coupon.minOrder)} để dùng mã này`
        };
    }

    const rawDiscount = coupon.type === 'fixed'
        ? Number(coupon.value || 0)
        : Math.round(subtotal * Number(coupon.value || 0) / 100);
    const cappedDiscount = Number(coupon.maxDiscount || 0) > 0
        ? Math.min(rawDiscount, Number(coupon.maxDiscount || 0))
        : rawDiscount;
    const discount = Math.min(subtotal, Math.max(0, cappedDiscount));

    return {
        success: true,
        coupon,
        discount
    };
}

function isCouponActive(coupon) {
    if (!coupon?.active) {
        return false;
    }

    if (!coupon.expiresAt) {
        return true;
    }

    return new Date(coupon.expiresAt).getTime() >= Date.now();
}

function sanitizeCoupon(coupon) {
    return {
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value || 0),
        minOrder: Number(coupon.minOrder || 0),
        maxDiscount: Number(coupon.maxDiscount || 0),
        usageLimit: Number(coupon.usageLimit || 0),
        usedCount: Number(coupon.usedCount || 0),
        active: Boolean(coupon.active),
        expiresAt: coupon.expiresAt || ''
    };
}

function normalizeCouponCode(value) {
    return cleanText(value).toUpperCase().replace(/\s+/g, '');
}

function formatServerPrice(value) {
    return `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} VNĐ`;
}

function saveProductImage(imageData, fileName) {
    const rawData = cleanText(imageData);
    const match = rawData.match(/^data:image\/(png|jpe?g|webp|gif);base64,([a-zA-Z0-9+/=]+)$/);

    if (!match) {
        return {
            success: false,
            message: 'Ảnh tải lên không hợp lệ. Hãy chọn PNG, JPG, WEBP hoặc GIF'
        };
    }

    const extensionMap = {
        jpeg: 'jpg',
        jpg: 'jpg',
        png: 'png',
        webp: 'webp',
        gif: 'gif'
    };
    const extension = extensionMap[match[1]] || 'jpg';
    const buffer = Buffer.from(match[2], 'base64');

    if (buffer.length > 4 * 1024 * 1024) {
        return {
            success: false,
            message: 'Ảnh quá lớn. Vui lòng chọn ảnh dưới 4MB'
        };
    }

    fs.mkdirSync(productUploadsDir, { recursive: true });
    const safeBaseName = path.basename(cleanText(fileName, 'product'))
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'product';
    const savedName = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${safeBaseName}.${extension}`;
    const savedPath = path.join(productUploadsDir, savedName);

    fs.writeFileSync(savedPath, buffer);

    return {
        success: true,
        imageUrl: `/uploads/products/${savedName}`
    };
}

function normalizeCustomer(customer) {
    const addressLine = cleanText(customer.addressLine || customer.address);
    const ward = cleanText(customer.ward);
    const district = cleanText(customer.district);
    const province = cleanText(customer.province);
    const address = cleanText(customer.address) || [addressLine, ward, district, province].filter(Boolean).join(', ');

    return {
        name: cleanText(customer.name),
        phone: cleanText(customer.phone),
        email: normalizeEmail(customer.email),
        provinceCode: cleanText(customer.provinceCode),
        province,
        districtCode: cleanText(customer.districtCode),
        district,
        wardCode: cleanText(customer.wardCode),
        ward,
        addressLine,
        address,
        shippingMethod: cleanText(customer.shippingMethod, 'shop'),
        paymentMethod: cleanText(customer.paymentMethod, 'cod'),
        note: cleanText(customer.note)
    };
}

function createPaymentSnapshot(method, amount, orderCode) {
    const paymentMethod = ['cod', 'bank', 'momo', 'vnpay'].includes(cleanText(method)) ? cleanText(method) : 'cod';
    const payment = {
        method: paymentMethod,
        label: getPaymentMethodLabel(paymentMethod),
        amount: Number(amount || 0),
        status: paymentMethod === 'cod' ? 'cod-pending' : 'pending',
        statusLabel: paymentMethod === 'cod' ? 'Thu tiền khi giao hàng' : 'Chờ thanh toán giả lập'
    };

    if (paymentMethod === 'bank') {
        payment.bank = {
            bankId: 'MB',
            accountNo: '0923627588',
            accountName: 'VOIDX STUDIO',
            transferContent: orderCode
        };
        payment.qrUrl = buildVietQrUrl(amount, orderCode);
    }

    if (paymentMethod === 'momo' || paymentMethod === 'vnpay') {
        payment.demoRedirect = `/thanh-toan?demoPay=${paymentMethod}&order=${encodeURIComponent(orderCode)}`;
    }

    return payment;
}

function createShippingSnapshot(provider) {
    const shippingProvider = ['shop', 'ghtk', 'ghn'].includes(cleanText(provider)) ? cleanText(provider) : 'shop';
    return {
        provider: shippingProvider,
        providerLabel: getShippingProviderLabel(shippingProvider),
        status: 'not-pushed',
        statusLabel: 'Chưa đẩy vận chuyển',
        trackingCode: ''
    };
}

function createFakeShipment(provider, order) {
    const normalizedProvider = ['ghtk', 'ghn', 'shop'].includes(cleanText(provider)) ? cleanText(provider) : 'shop';
    const prefix = normalizedProvider === 'ghn' ? 'GHN' : normalizedProvider === 'ghtk' ? 'GHTK' : 'SHOP';

    return {
        status: 'pushed',
        statusLabel: 'Đã tạo vận đơn giả lập',
        trackingCode: `${prefix}-${Date.now().toString().slice(-8)}-${String(order.orderCode || '').slice(-4)}`,
        trackingUrl: normalizedProvider === 'shop'
            ? ''
            : `https://demo.voidx.local/tracking/${prefix.toLowerCase()}/${encodeURIComponent(order.orderCode || '')}`
    };
}

function getPaymentMethodLabel(method) {
    const labels = {
        cod: 'COD - Thanh toán khi nhận hàng',
        bank: 'Chuyển khoản VietQR',
        momo: 'MoMo giả lập',
        vnpay: 'VNPay giả lập'
    };

    return labels[method] || labels.cod;
}

function getShippingProviderLabel(provider) {
    const labels = {
        shop: 'Shop tự giao / xác nhận sau',
        ghtk: 'Giao Hàng Tiết Kiệm - giả lập',
        ghn: 'Giao Hàng Nhanh - giả lập'
    };

    return labels[provider] || labels.shop;
}

function buildVietQrUrl(amount, addInfo) {
    const params = new URLSearchParams({
        amount: String(Math.max(0, Number(amount || 0))),
        addInfo,
        accountName: 'VOIDX STUDIO'
    });

    return `https://img.vietqr.io/image/MB-0923627588-compact2.png?${params.toString()}`;
}

function normalizeStringList(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => cleanText(item))
            .filter(Boolean);
    }

    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => cleanText(item))
            .filter(Boolean);
    }

    return [];
}

function normalizeVariantSelection(value, options) {
    const normalizedOptions = Array.isArray(options) && options.length
        ? options.map((option) => cleanText(option))
        : ['Mặc định'];
    const candidate = cleanText(value);
    return normalizedOptions.includes(candidate) ? candidate : normalizedOptions[0];
}

function getAvailableStock(product) {
    if (!product || product.status === 'out-of-stock') {
        return 0;
    }

    return Number(product.stock || 0);
}

function isProductPurchasable(product) {
    return getAvailableStock(product) > 0;
}

function syncProductInventoryState(product) {
    if (!product) {
        return;
    }

    const stock = Number(product.stock || 0);
    if (stock <= 0) {
        product.stock = 0;
        product.status = 'out-of-stock';
        product.tag = 'OUT OF STOCK';
        return;
    }

    if (product.status === 'out-of-stock' || product.tag === 'OUT OF STOCK') {
        product.status = 'active';
        product.tag = '';
    }
}

function canReserveProducts(products, items) {
    for (const item of Array.isArray(items) ? items : []) {
        const product = findProductById(products, item.id);

        if (!product) {
            return {
                success: false,
                message: `Không thể cập nhật đơn vì sản phẩm #${item.id} không còn tồn tại`
            };
        }

        if (getAvailableStock(product) < Number(item.quantity || 0)) {
            return {
                success: false,
                message: `Không đủ tồn kho để mở lại đơn hàng cho sản phẩm "${product.name}"`
            };
        }
    }

    return { success: true };
}

function applyStockToProducts(products, items, mode) {
    for (const item of Array.isArray(items) ? items : []) {
        const product = findProductById(products, item.id);

        if (!product) {
            continue;
        }

        const quantity = Number(item.quantity || 0);
        if (mode === 'restore') {
            product.stock = Number(product.stock || 0) + quantity;
        }

        if (mode === 'reserve') {
            product.stock = Math.max(0, Number(product.stock || 0) - quantity);
        }

        syncProductInventoryState(product);
        product.updatedAt = new Date().toISOString();
    }
}

function sortProducts(products, sort) {
    const nextProducts = [...products];

    if (sort === 'price-asc') {
        return nextProducts.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }

    if (sort === 'price-desc') {
        return nextProducts.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }

    if (sort === 'name-asc') {
        return nextProducts.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
    }

    if (sort === 'stock-desc') {
        return nextProducts.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
    }

    return nextProducts;
}

function getNextProductId(products) {
    return products.reduce((maxId, product) => Math.max(maxId, Number(product.id || 0)), 0) + 1;
}

function createOrderCode() {
    const stamp = Date.now().toString().slice(-8);
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `VDX-${stamp}-${suffix}`;
}

function findProductById(products, id) {
    return products.find((product) => String(product.id) === String(id));
}

function normalizeTrackingQuery(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
}

function normalizeOrderStatus(status) {
    const value = String(status || '').trim();
    const mapping = {
        'Chờ xác nhận': 'Chờ xác nhận',
        'Chá» xÃ¡c nháº­n': 'Chờ xác nhận',
        'Đang xử lý': 'Đang xử lý',
        'Äang xá»­ lÃ½': 'Đang xử lý',
        'Đang giao': 'Đang giao',
        'Äang giao': 'Đang giao',
        'Đã giao': 'Đã giao',
        'ÄÃ£ giao': 'Đã giao',
        'Đã hủy': 'Đã hủy',
        'ÄÃ£ há»§y': 'Đã hủy'
    };

    return mapping[value] || value || 'Chờ xác nhận';
}

function getOrderStatusStep(status) {
    const normalized = normalizeOrderStatus(status);
    const order = {
        'Chờ xác nhận': 1,
        'Đang xử lý': 2,
        'Đang giao': 3,
        'Đã giao': 4,
        'Đã hủy': -1
    };

    return order[normalized] ?? 1;
}

function maskPhoneNumber(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 7) {
        return phone;
    }

    return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization || '';
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

function sanitizeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
    };
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function cleanText(value, fallback = '') {
    return String(value ?? fallback).trim();
}

function normalizeEmail(value) {
    return cleanText(value).toLowerCase();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function isLikelyPhoneNumber(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 11;
}

function toPositiveInteger(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function clampNumber(value, min, max) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return min;
    }

    return Math.min(max, Math.max(min, parsed));
}

function pruneExpiredSessions(sessions) {
    const now = Date.now();
    return sessions.filter((session) => {
        if (!session.expiresAt) {
            return true;
        }

        return new Date(session.expiresAt).getTime() > now;
    });
}

function readJson(filePath, fallback) {
    if (!fs.existsSync(filePath)) {
        return fallback;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    if (!content.trim()) {
        return fallback;
    }

    try {
        return JSON.parse(content);
    } catch (error) {
        return fallback;
    }
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = router;
