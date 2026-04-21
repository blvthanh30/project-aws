const express = require('express');
const path = require('path');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const assetsDir = path.join(publicDir, 'assets');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(publicDir));

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

app.listen(PORT, () => {
    console.log('--- VOIDX BUSINESS SYSTEM RUNNING ---');
    console.log(`Localhost: http://localhost:${PORT}`);
});
