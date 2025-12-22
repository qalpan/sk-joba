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

// Уақыты біткендерді автоматты өшіру (әр 5 минут сайын)
setInterval(async () => {
    try {
        await pool.query('DELETE FROM workers WHERE expires_at < NOW()');
        await pool.query('DELETE FROM goods WHERE expires_at < NOW()'); // Тауарларға да мерзім қосылды
    } catch (err) { console.error("Cleanup error:", err); }
}, 300000);

// Орындаушыны сақтау
app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon, durationHours, device_token } = req.body;
    const expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO workers (name, phone, job, lat, lon, expires_at, device_token) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
    [name, phone, job, lat, lon, expiresAt, device_token]);
    res.json({ success: true });
});

// Тауарды сақтау (Төлемді есепке алу үшін мерзім қосылды)
app.post('/save-goods', async (req, res) => {
    const { name, product, price, phone, lat, lon, durationHours, device_token } = req.body;
    const expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, expires_at, device_token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
    [name, product, price, phone, lat, lon, expiresAt, device_token]);
    res.json({ success: true });
});

// Тапсырысты сақтау (Тегін, 24 сағатқа)
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
    await pool.query(`DELETE FROM ${table} WHERE id = $1 AND device_token = $2`, [id, device_token]);
    res.json({ success: true });
});

app.listen(process.env.PORT || 10000);
