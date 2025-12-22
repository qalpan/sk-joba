const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
app.use(cors()); app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// МАМАН САҚТАУ (Duration сан екенін тексеру)
app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon, durationHours } = req.body;
    if(!name || !phone || !job || isNaN(lat)) return res.status(400).send("Қате деректер");
    
    const expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO workers (name, phone, job, lat, lon, expires_at) VALUES ($1, $2, $3, $4, $5, $6)', 
    [name, phone, job, lat, lon, expiresAt]);
    res.json({ success: true });
});

// ТАУАР САҚТАУ (Бағасы сан екенін тексеру)
app.post('/save-goods', async (req, res) => {
    const { name, product, price, phone, lat, lon, durationHours } = req.body;
    if(!name || !product || isNaN(price.replace(/\s/g, '')) || !phone) return res.status(400).send("Баға сан болуы керек");
    
    const expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
    [name, product, price, phone, lat, lon, expiresAt]);
    res.json({ success: true });
});

app.get('/get-all', async (req, res) => {
    const w = await pool.query('SELECT * FROM workers WHERE is_active = TRUE');
    const g = await pool.query('SELECT * FROM goods WHERE is_active = TRUE');
    const o = await pool.query('SELECT * FROM orders');
    res.json({ workers: w.rows, goods: g.rows, orders: o.rows });
});

app.listen(process.env.PORT || 10000);
