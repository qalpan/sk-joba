const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
app.use(cors()); app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// САҚТАУ: Жұмысшы
app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon, durationHours, device_token } = req.body;
    const expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO workers (name, phone, job, lat, lon, expires_at, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7, TRUE)', [name, phone, job, lat, lon, expiresAt, device_token]);
    res.json({ success: true });
});

// САҚТАУ: Тауар
app.post('/save-goods', async (req, res) => {
    const { name, product, price, phone, lat, lon, durationHours, device_token } = req.body;
    const expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, expires_at, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, TRUE)', [name, product, price, phone, lat, lon, expiresAt, device_token]);
    res.json({ success: true });
});

// КАРТАҒА ШЫҒАРУ
app.get('/get-all', async (req, res) => {
    const w = await pool.query('SELECT * FROM workers WHERE is_active = TRUE AND expires_at > NOW()');
    const g = await pool.query('SELECT * FROM goods WHERE is_active = TRUE AND expires_at > NOW()');
    res.json({ workers: w.rows, goods: g.rows });
});

// ӨШІРУ (ID-ді сан ретінде тексеру қосылды)
app.post('/delete-item', async (req, res) => {
    const { id, type, token } = req.body;
    const table = type === 'worker' ? 'workers' : 'goods';
    await pool.query(`DELETE FROM ${table} WHERE id = $1 AND device_token = $2`, [parseInt(id), token]);
    res.json({ success: true });
});

app.listen(process.env.PORT || 10000);
