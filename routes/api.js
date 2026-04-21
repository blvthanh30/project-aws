const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();
const productsPath = path.join(__dirname, '../data/products.json');
const ordersPath = path.join(__dirname, '../data/orders.json');
const subscribersPath = path.join(__dirname, '../data/subscribers.json');
const storePath = path.join(__dirname, '../data/store.json');
const usersPath = path.join(__dirname, '../data/users.json');
const sessionsPath = path.join(__dirname, '../data/sessions.json');

router.get('/store', (req, res) => {
    res.json(readJson(storePath, {}));
});

router.get('/products', (req, res) => {
    res.json(readJson(productsPath, []));
});

router.post('/auth/register', (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const users = readJson(usersPath, []);

    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu'
        });
    }

    if (!email.includes('@')) {
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
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const users = readJson(usersPath, []);
    const user = users.find((item) => item.email === email);

    if (!user || user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({
            success: false,
            message: 'Email hoặc mật khẩu không đúng'
        });
    }

    const sessions = readJson(sessionsPath, []);
    const token = crypto.randomUUID();

    sessions.unshift({
        token,
        userId: user.id,
        createdAt: new Date().toISOString()
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
    const nextSessions = sessions.filter((session) => session.token !== token);
    writeJson(sessionsPath, nextSessions);

    res.json({
        success: true,
        message: 'Đăng xuất thành công'
    });
});

router.post('/newsletter', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
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
    const customer = orderData.customer || {};
    const items = Array.isArray(orderData.items) ? orderData.items : [];

    if (!customer.name || !customer.phone || !customer.address) {
        return res.status(400).json({
            success: false,
            message: 'Thông tin khách hàng chưa đầy đủ'
        });
    }

    if (!items.length) {
        return res.status(400).json({
            success: false,
            message: 'Đơn hàng chưa có sản phẩm'
        });
    }

    const orderCode = `VDX-${Date.now()}`;
    const savedOrder = {
        orderCode,
        status: 'Chờ xác nhận',
        customer,
        items,
        total: Number(orderData.total || 0),
        createdAt: orderData.createdAt || new Date().toISOString()
    };

    const existingOrders = readJson(ordersPath, []);
    existingOrders.unshift(savedOrder);
    writeJson(ordersPath, existingOrders);

    return res.status(200).json({
        success: true,
        message: 'Đơn hàng đã được ghi nhận',
        orderCode
    });
});

router.get('/orders', requireAdmin, (req, res) => {
    res.json(readJson(ordersPath, []));
});

router.get('/subscribers', requireAdmin, (req, res) => {
    res.json(readJson(subscribersPath, []));
});

router.get('/dashboard', requireAdmin, (req, res) => {
    const orders = readJson(ordersPath, []);
    const subscribers = readJson(subscribersPath, []);
    const products = readJson(productsPath, []);
    const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const pendingOrders = orders.filter((order) => order.status !== 'Đã giao').length;

    res.json({
        revenue,
        orderCount: orders.length,
        pendingOrders,
        subscriberCount: subscribers.length,
        productCount: products.length,
        latestOrders: orders.slice(0, 5)
    });
});

router.patch('/orders/:orderCode', requireAdmin, (req, res) => {
    const orderCode = req.params.orderCode;
    const nextStatus = String(req.body?.status || '').trim();
    const allowedStatuses = ['Chờ xác nhận', 'Đang xử lý', 'Đang giao', 'Đã giao', 'Đã hủy'];

    if (!allowedStatuses.includes(nextStatus)) {
        return res.status(400).json({
            success: false,
            message: 'Trạng thái đơn không hợp lệ'
        });
    }

    const orders = readJson(ordersPath, []);
    const targetOrder = orders.find((order) => order.orderCode === orderCode);

    if (!targetOrder) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy đơn hàng'
        });
    }

    targetOrder.status = nextStatus;
    targetOrder.updatedAt = new Date().toISOString();
    writeJson(ordersPath, orders);

    return res.json({
        success: true,
        message: 'Đã cập nhật trạng thái đơn hàng',
        order: targetOrder
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

    const sessions = readJson(sessionsPath, []);
    const users = readJson(usersPath, []);
    const session = sessions.find((item) => item.token === token);

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
    next();
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
