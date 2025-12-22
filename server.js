const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Базаны инициализациялау (Кестелер мен бағандарды автоматты тексеру)
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS workers (
                id SERIAL PRIMARY KEY, name TEXT, phone TEXT, job TEXT, 
                lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, device_token TEXT, 
                expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            
            CREATE TABLE IF NOT EXISTS goods (
                id SERIAL PRIMARY KEY, seller_name TEXT, product_name TEXT, price TEXT, phone TEXT, 
                lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, device_token TEXT, 
                expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY, client_name TEXT, description TEXT, phone TEXT, 
                lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                device_token TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        console.log("DB Ready");
    } catch (err) { console.error("DB Error:", err); }
}
initDB();

// Мәліметтерді сақтау (Валидациямен)
app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon, durationHours, device_token } = req.body;
    if(!name || !phone || !job || !lat || !lon) return res.status(400).json({error: "Мәліметтер толық емес!"});
    
    const expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO workers (name, phone, job, lat, lon, expires_at, device_token) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
    [name, phone, job, lat, lon, expiresAt, device_token]);
    res.json({ success: true });
});

app.post('/save-goods', async (req, res) => {
    const { name, product, price, phone, lat, lon, durationHours, device_token } = req.body;
    if(!name || !product || !phone || !lat || !lon) return res.status(400).json({error: "Мәліметтер толық емес!"});

    const expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, expires_at, device_token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
    [name, product, price, phone, lat, lon, expiresAt, device_token]);
    res.json({ success: true });
});

app.post('/save-order', async (req, res) => {
    const { name, description, phone, lat, lon, device_token } = req.body;
    if(!name || !description || !phone || !lat || !lon) return res.status(400).json({error: "Мәліметтер толық емес!"});
    
    await pool.query('INSERT INTO orders (client_name, description, phone, lat, lon, device_token) VALUES ($1, $2, $3, $4, $5, $6)', 
    [name, description, phone, lat, lon, device_token]);
    res.json({ success: true });
});

app.get('/admin/pending', async (req, res) => {
    try {
        const w = await pool.query(`SELECT id, name, job as info, phone, 'worker' as type, to_char(created_at, 'DD.MM HH24:MI') as date_text, CASE WHEN (expires_at - created_at) > interval '2 hour' THEN '24 сағат' ELSE '1 сағат' END as duration FROM workers WHERE is_active = FALSE ORDER BY created_at DESC`);
        const g = await pool.query(`SELECT id, seller_name as name, product_name as info, phone, 'good' as type, to_char(created_at, 'DD.MM HH24:MI') as date_text, CASE WHEN (expires_at - created_at) > interval '2 hour' THEN '24 сағат' ELSE '1 сағат' END as duration FROM goods WHERE is_active = FALSE ORDER BY created_at DESC`);
        res.json([...w.rows, ...g.rows]);
    } catch (err) { res.status(500).json({error: "DB Error"}); }
});

app.post('/admin/activate', async (req, res) => {
    const { id, type } = req.body;
    const table = type === 'worker' ? 'workers' : 'goods';
    await pool.query(`UPDATE ${table} SET is_active = TRUE WHERE id = $1`, [id]);
    res.json({ success: true });
});

app.get('/get-all', async (req, res) => {
    try {
        const workers = await pool.query('SELECT * FROM workers WHERE is_active = TRUE');
        const goods = await pool.query('SELECT * FROM goods WHERE is_active = TRUE');
        const orders = await pool.query('SELECT * FROM orders');
        res.json({ workers: workers.rows, goods: goods.rows, orders: orders.rows });
    } catch (err) { res.status(500).json({error: "DB Error"}); }
});

app.listen(process.env.PORT || 10000);
