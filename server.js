const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Онлайн қолданушылар базасы (жадта сақталады)
let onlineUsers = {}; 

// Базаны дайындау
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS workers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, job TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, is_active BOOLEAN DEFAULT FALSE, device_token TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS goods (id SERIAL PRIMARY KEY, seller_name TEXT, product_name TEXT, price TEXT, phone TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, is_active BOOLEAN DEFAULT FALSE, device_token TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, client_name TEXT, description TEXT, phone TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, device_token TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);
}
initDB();

// Пинг функциясы: қолданушының онлайн екенін білу
app.post('/user-ping', (req, res) => {
    const { token } = req.body;
    if (token) {
        onlineUsers[token] = Date.now(); // Соңғы рет қашан белсенді болды
    }
    res.json({ success: true });
});

app.get('/get-all', async (req, res) => {
    try {
        // 1. Автоматты тазалау: 24 сағаттан ескінің бәрін өшіру
        await pool.query("DELETE FROM workers WHERE created_at < NOW() - interval '24 hours'");
        await pool.query("DELETE FROM goods WHERE created_at < NOW() - interval '24 hours'");
        await pool.query("DELETE FROM orders WHERE created_at < NOW() - interval '24 hours'");

        const w = await pool.query('SELECT * FROM workers');
        const g = await pool.query('SELECT * FROM goods');
        const o = await pool.query('SELECT * FROM orders');

        const now = Date.now();
        // Пайдаланушы 40 секундтан артық хабарсыз кетсе - оффлайн
        const isOnline = (token) => (now - (onlineUsers[token] || 0)) < 40000;

        // Фильтр: Тек VIP (is_active) немесе қазір онлайн отырғандар
        const filteredWorkers = w.rows.filter(item => item.is_active || isOnline(item.device_token));
        const filteredGoods = g.rows.filter(item => item.is_active || isOnline(item.device_token));

        res.json({ workers: filteredWorkers, goods: filteredGoods, orders: o.rows });
    } catch (err) { res.status(500).json({error: err.message}); }
});

// Сақтау маршруттары (Барлығы тегін, is_active = false болып түседі)
app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon, device_token } = req.body;
    await pool.query('INSERT INTO workers (name, phone, job, lat, lon, device_token) VALUES ($1,$2,$3,$4,$5,$6)', [name, phone, job, lat, lon, device_token]);
    res.json({success: true});
});

app.post('/save-goods', async (req, res) => {
    const { name, product, price, phone, lat, lon, device_token } = req.body;
    await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, device_token) VALUES ($1,$2,$3,$4,$5,$6,$7)', [name, product, price, phone, lat, lon, device_token]);
    res.json({success: true});
});

app.post('/save-order', async (req, res) => {
    const { name, description, phone, lat, lon, device_token } = req.body;
    await pool.query('INSERT INTO orders (client_name, description, phone, lat, lon, device_token) VALUES ($1,$2,$3,$4,$5,$6)', [name, description, phone, lat, lon, device_token]);
    res.json({success: true});
});

// Админ: Белсендіру (VIP қылу - оффлайн болса да көрінетін болады)
app.post('/admin/activate', async (req, res) => {
    const { id, type } = req.body;
    const table = type === 'worker' ? 'workers' : 'goods';
    await pool.query(`UPDATE ${table} SET is_active = TRUE WHERE id = $1`, [id]);
    res.json({ success: true });
});

app.post('/delete-item', async (req, res) => {
    const { id, type, token } = req.body;
    const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
    if (token === 'admin777') {
        await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    } else {
        await pool.query(`DELETE FROM ${table} WHERE id = $1 AND device_token = $2`, [id, token]);
    }
    res.json({success:true});
});

app.listen(process.env.PORT || 10000);
