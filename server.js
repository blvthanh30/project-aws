require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const publicDir = path.join(__dirname, 'public');
const assetsDir = path.join(publicDir, 'assets');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.static(publicDir));

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'ok',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(assetsDir, 'index.html'));
});

app.get('/san-pham', (req, res) => {
    res.sendFile(path.join(assetsDir, 'shop.html'));
});

app.get('/gioi-thieu', (req, res) => {
    res.sendFile(path.join(assetsDir, 'about.html'));
});

app.get('/chinh-sach', (req, res) => {
    res.sendFile(path.join(assetsDir, 'policies.html'));
});

app.get('/lien-he', (req, res) => {
    res.sendFile(path.join(assetsDir, 'contact.html'));
});

app.get('/tra-cuu-don-hang', (req, res) => {
    res.sendFile(path.join(assetsDir, 'tracking.html'));
});

app.get('/thanh-toan', (req, res) => {
    res.sendFile(path.join(assetsDir, 'checkout.html'));
});

app.get('/dang-nhap', (req, res) => {
    res.sendFile(path.join(assetsDir, 'login.html'));
});

app.get('/dang-ky', (req, res) => {
    res.sendFile(path.join(assetsDir, 'register.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicDir, 'admin', 'index.html'));
});

app.use('/api', apiRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài nguyên'
    });
});

const server = app.listen(PORT, HOST, () => {
    console.log('--- VOIDX BUSINESS SYSTEM RUNNING ---');
    console.log(`Localhost: http://localhost:${PORT}`);
    console.log(`Bind address: http://${HOST}:${PORT}`);
});

function shutdown(signal) {
    console.log(`Nhan tin hieu ${signal}, dang dung he thong...`);
    server.close(() => {
        console.log('Server da dung an toan.');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Buoc tat server qua han, thoat cuong buc.');
        process.exit(1);
    }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
