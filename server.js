const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
app.use(cors()); app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS workers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, job TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, is_active BOOLEAN DEFAULT FALSE, device_token TEXT, expires_at TIMESTAMP, fee_amount TEXT);
        CREATE TABLE IF NOT EXISTS goods (id SERIAL PRIMARY KEY, seller_name TEXT, product_name TEXT, price TEXT, phone TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, is_active BOOLEAN DEFAULT FALSE, device_token TEXT, expires_at TIMESTAMP, fee_amount TEXT);
        CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, client_name TEXT, description TEXT, phone TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, device_token TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);
}
initDB();

app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon, durationHours, device_token } = req.body;
    const fee = durationHours === "1" ? "49₸" : "490₸";
    const exp = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO workers (name, phone, job, lat, lon, expires_at, device_token, fee_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [name, phone, job, lat, lon, exp, device_token, fee]);
    res.json({success:true});
});

app.post('/save-goods', async (req, res) => {
    const { name, product, price, phone, lat, lon, durationHours, device_token } = req.body;
    const fee = durationHours === "1" ? "49₸" : "490₸";
    const exp = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, expires_at, device_token, fee_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [name, product, price, phone, lat, lon, exp, device_token, fee]);
    res.json({success:true});
});

app.get('/admin/pending', async (req, res) => {
    const w = await pool.query(`SELECT id, job as info, phone, 'worker' as type, fee_amount as fee FROM workers WHERE is_active = FALSE`);
    const g = await pool.query(`SELECT id, product_name as info, phone, 'good' as type, fee_amount as fee FROM goods WHERE is_active = FALSE`);
    res.json([...w.rows, ...g.rows]);
});

// Қалған endpoint-тер (get-all, activate, delete) алдыңғы нұсқадағыдай қалады...
app.get('/get-all', async (req, res) => {
    await pool.query("DELETE FROM workers WHERE expires_at < NOW()");
    await pool.query("DELETE FROM goods WHERE expires_at < NOW()");
    await pool.query("DELETE FROM orders WHERE created_at < NOW() - interval '24 hours'");
    const w = await pool.query('SELECT * FROM workers WHERE is_active = TRUE');
    const g = await pool.query('SELECT * FROM goods WHERE is_active = TRUE');
    const o = await pool.query('SELECT * FROM orders');
    res.json({ workers: w.rows, goods: g.rows, orders: o.rows });
});

app.post('/admin/activate', async (req, res) => {
    const { id, type } = req.body;
    const table = type === 'worker' ? 'workers' : 'goods';
    await pool.query(`UPDATE ${table} SET is_active = TRUE WHERE id = $1`, [id]);
    res.json({ success: true });
});

app.post('/delete-item', async (req, res) => {
    const { id, type, token } = req.body;
    const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
    const query = token === 'ADMIN' ? `DELETE FROM ${table} WHERE id = $1` : `DELETE FROM ${table} WHERE id = $1 AND device_token = $2`;
    await pool.query(query, token === 'ADMIN' ? [parseInt(id)] : [parseInt(id), token]);
    res.json({success:true});
});

app.listen(process.env.PORT || 10000);
