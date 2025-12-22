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

// БАЗАНЫ ЖАҢАРТУ (Барлық кестеге device_token қосылды)
async function initDatabase() {
    try {
        await pool.query('DROP TABLE IF EXISTS workers, orders, goods CASCADE;');
        
        await pool.query(`CREATE TABLE workers (
            id SERIAL PRIMARY KEY, name TEXT, phone TEXT, job TEXT, 
            lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
            is_active BOOLEAN DEFAULT FALSE, device_token TEXT, expires_at TIMESTAMP);`);
            
        await pool.query(`CREATE TABLE orders (
            id SERIAL PRIMARY KEY, client_name TEXT, description TEXT, phone TEXT, 
            lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
            device_token TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
            
        await pool.query(`CREATE TABLE goods (
            id SERIAL PRIMARY KEY, seller_name TEXT, product_name TEXT, price TEXT, phone TEXT, 
            lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
            is_active BOOLEAN DEFAULT FALSE, device_token TEXT);`);
            
        console.log("База толық жаңартылды.");
    } catch (err) { console.error(err); }
}
initDatabase();

// --- САҚТАУ API ---
app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon, durationHours, device_token } = req.body;
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
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

// --- ӨШІРУ API (device_token арқылы) ---
app.delete('/delete/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const { device_token } = req.body;
    const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 AND device_token = $2`, [id, device_token]);
    res.json({ success: result.rowCount > 0 });
});

// --- АДМИН API ---
app.post('/admin/login', (req, res) => {
    if(req.body.password === "admin777") res.json({ success: true });
    else res.status(403).json({ success: false });
});

app.get('/admin/pending', async (req, res) => {
    const w = await pool.query('SELECT id, name, job as info, \'worker\' as type FROM workers WHERE is_active = FALSE');
    const g = await pool.query('SELECT id, seller_name as name, product_name as info, \'good\' as type FROM goods WHERE is_active = FALSE');
    res.json([...w.rows, ...g.rows]);
});

app.post('/admin/activate', async (req, res) => {
    const { id, type } = req.body;
    const table = type === 'worker' ? 'workers' : 'goods';
    await pool.query(`UPDATE ${table} SET is_active = TRUE WHERE id = $1`, [id]);
    res.json({ success: true });
});

app.get('/get-all', async (req, res) => {
    const workers = await pool.query('SELECT * FROM workers WHERE is_active = TRUE');
    const orders = await pool.query('SELECT * FROM orders');
    const goods = await pool.query('SELECT * FROM goods WHERE is_active = TRUE');
    res.json({ workers: workers.rows, orders: orders.rows, goods: goods.rows });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Сервер қосылды"));
