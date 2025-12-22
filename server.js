const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Деректер базасын инициализациялау
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS workers (
                id SERIAL PRIMARY KEY, name TEXT, phone TEXT, job TEXT, 
                lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, device_token TEXT, expires_at TIMESTAMP);
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY, client_name TEXT, description TEXT, phone TEXT, 
                lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                device_token TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS goods (
                id SERIAL PRIMARY KEY, seller_name TEXT, product_name TEXT, price TEXT, phone TEXT, 
                lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, device_token TEXT);
        `);
        console.log("Database structure is ready.");
    } catch (err) { console.error("DB Init Error:", err); }
}
initDB();

// Автоматты тазалау: Уақыты өткен мамандарды әр 5 минут сайын өшіру
setInterval(async () => {
    try {
        const now = new Date();
        await pool.query('DELETE FROM workers WHERE expires_at < $1', [now]);
    } catch (err) { console.error("Cleanup Error:", err); }
}, 300000);

// API бағыттары
app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon, durationHours, device_token } = req.body;
    const expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO workers (name, phone, job, lat, lon, expires_at, device_token) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
    [name, phone, job, lat, lon, expiresAt, device_token]);
    res.json({ success: true });
});

app.post('/save-goods', async (req, res) => {
    const { name, product, price, phone, lat, lon, device_token } = req.body;
    await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, device_token) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
    [name, product, price, phone, lat, lon, device_token]);
    res.json({ success: true });
});

app.post('/save-order', async (req, res) => {
    const { name, description, phone, lat, lon, device_token } = req.body;
    await pool.query('INSERT INTO orders (client_name, description, phone, lat, lon, device_token) VALUES ($1, $2, $3, $4, $5, $6)', 
    [name, description, phone, lat, lon, device_token]);
    res.json({ success: true });
});

app.get('/get-all', async (req, res) => {
    const workers = await pool.query('SELECT * FROM workers WHERE is_active = TRUE');
    const goods = await pool.query('SELECT * FROM goods WHERE is_active = TRUE');
    const orders = await pool.query('SELECT * FROM orders');
    res.json({ workers: workers.rows, goods: goods.rows, orders: orders.rows });
});

app.get('/admin/pending', async (req, res) => {
    const w = await pool.query('SELECT id, name, job as info, phone, \'worker\' as type FROM workers WHERE is_active = FALSE');
    const g = await pool.query('SELECT id, seller_name as name, product_name as info, phone, \'good\' as type FROM goods WHERE is_active = FALSE');
    res.json([...w.rows, ...g.rows]);
});

app.post('/admin/activate', async (req, res) => {
    const { id, type } = req.body;
    const table = type === 'worker' ? 'workers' : 'goods';
    await pool.query(`UPDATE ${table} SET is_active = TRUE WHERE id = $1`, [id]);
    res.json({ success: true });
});

app.delete('/delete/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const { device_token } = req.body;
    const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 AND device_token = $2`, [id, device_token]);
    res.json({ success: result.rowCount > 0 });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
