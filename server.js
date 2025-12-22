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

// Базаны реттеу
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS workers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, job TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, is_active BOOLEAN DEFAULT FALSE, device_token TEXT, expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS goods (id SERIAL PRIMARY KEY, seller_name TEXT, product_name TEXT, price TEXT, phone TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, is_active BOOLEAN DEFAULT FALSE, device_token TEXT, expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, client_name TEXT, description TEXT, phone TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, device_token TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
    } catch (err) { console.error("DB Error:", err); }
}
initDB();

// API-лер
app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon, durationHours, device_token } = req.body;
    const expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO workers (name, phone, job, lat, lon, expires_at, device_token) VALUES ($1, $2, $3, $4, $5, $6, $7)', [name, phone, job, lat, lon, expiresAt, device_token]);
    res.json({ success: true });
});

app.post('/save-goods', async (req, res) => {
    const { name, product, price, phone, lat, lon, durationHours, device_token } = req.body;
    const expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, expires_at, device_token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [name, product, price, phone, lat, lon, expiresAt, device_token]);
    res.json({ success: true });
});

app.post('/save-order', async (req, res) => {
    const { name, description, phone, lat, lon, device_token } = req.body;
    await pool.query('INSERT INTO orders (client_name, description, phone, lat, lon, device_token) VALUES ($1, $2, $3, $4, $5, $6)', [name, description, phone, lat, lon, device_token]);
    res.json({ success: true });
});

app.get('/get-all', async (req, res) => {
    const w = await pool.query('SELECT * FROM workers WHERE is_active = TRUE AND expires_at > NOW()');
    const g = await pool.query('SELECT * FROM goods WHERE is_active = TRUE AND expires_at > NOW()');
    const o = await pool.query('SELECT * FROM orders WHERE created_at > NOW() - interval \'24 hours\'');
    res.json({ workers: w.rows, goods: g.rows, orders: o.rows });
});

// ӨШІРУ (Админ және Иесі үшін)
app.post('/delete-item', async (req, res) => {
    const { id, type, token } = req.body;
    const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
    try {
        const query = (token === 'ADMIN') ? 
            `DELETE FROM ${table} WHERE id = $1` : 
            `DELETE FROM ${table} WHERE id = $1 AND device_token = $2`;
        await pool.query(query, token === 'ADMIN' ? [id] : [id, token]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Админ тізімі
app.get('/admin/pending', async (req, res) => {
    const w = await pool.query(`SELECT id, name, job as info, phone, 'worker' as type FROM workers`);
    const g = await pool.query(`SELECT id, seller_name as name, product_name as info, phone, 'good' as type FROM goods`);
    const o = await pool.query(`SELECT id, client_name as name, description as info, phone, 'order' as type FROM orders`);
    res.json([...w.rows, ...g.rows, ...o.rows]);
});

app.post('/admin/activate', async (req, res) => {
    const { id, type } = req.body;
    await pool.query(`UPDATE ${type === 'worker' ? 'workers' : 'goods'} SET is_active = TRUE WHERE id = $1`, [id]);
    res.json({ success: true });
});

app.listen(process.env.PORT || 10000);
