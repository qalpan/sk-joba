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

let onlineUsers = {};

async function initDB() {
    try {
        const tables = ['workers', 'goods', 'orders'];
        for (const table of tables) {
            let schema = table === 'workers' ? 'name TEXT, phone TEXT, job TEXT' : 
                         table === 'goods' ? 'seller_name TEXT, product_name TEXT, price TEXT, phone TEXT' :
                         'client_name TEXT, description TEXT, phone TEXT';
            
            await pool.query(`CREATE TABLE IF NOT EXISTS ${table} (
                id SERIAL PRIMARY KEY, ${schema}, lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, device_token TEXT, contacts JSONB DEFAULT '[]', 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'`);
        }
        console.log("DB Ready");
    } catch (err) { console.error(err); }
}
initDB();

app.post('/user-ping', (req, res) => {
    const { token } = req.body;
    if (token) onlineUsers[token] = Date.now();
    res.json({ success: true });
});

app.get('/get-all', async (req, res) => {
    try {
        const w = await pool.query('SELECT * FROM workers');
        const g = await pool.query('SELECT * FROM goods');
        const o = await pool.query('SELECT * FROM orders');
        const nowTs = Date.now();
        const isOnline = (token) => (nowTs - (onlineUsers[token] || 0)) < 60000;
        const filterFn = (i) => i.is_active === true || (i.device_token && isOnline(i.device_token.replace('WAITING_VIP_', '')));

        res.json({ 
            workers: w.rows.filter(filterFn), 
            goods: g.rows.filter(filterFn), 
            orders: o.rows.filter(filterFn),
            admin_all: { workers: w.rows, goods: g.rows, orders: o.rows } 
        });
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-worker', async (req, res) => {
    try {
        const { name, phone, job, lat, lon, device_token, is_vip, contacts } = req.body;
        const finalToken = is_vip ? `WAITING_VIP_${device_token}` : device_token;
        await pool.query('INSERT INTO workers (name, phone, job, lat, lon, device_token, is_active, contacts) VALUES ($1,$2,$3,$4,$5,$6,false,$7)', [name, phone, job, lat, lon, finalToken, contacts]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-goods', async (req, res) => {
    try {
        const { name, product, price, phone, lat, lon, device_token, is_vip, contacts } = req.body;
        const finalToken = is_vip ? `WAITING_VIP_${device_token}` : device_token;
        await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, device_token, is_active, contacts) VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8)', [name, product, price, phone, lat, lon, finalToken, contacts]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-order', async (req, res) => {
    try {
        const { name, description, phone, lat, lon, device_token, is_vip, contacts } = req.body;
        const finalToken = is_vip ? `WAITING_VIP_${device_token}` : device_token;
        await pool.query('INSERT INTO orders (client_name, description, phone, lat, lon, device_token, is_active, contacts) VALUES ($1,$2,$3,$4,$5,$6,false,$7)', [name, description, phone, lat, lon, finalToken, contacts]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/admin/toggle-active', async (req, res) => {
    try {
        const { id, type, active } = req.body;
        const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
        await pool.query(`UPDATE ${table} SET is_active = $1 WHERE id = $2`, [active, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/delete-item', async (req, res) => {
    try {
        const { id, type, token } = req.body;
        const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
        const query = token === 'admin777' ? `DELETE FROM ${table} WHERE id = $1` : `DELETE FROM ${table} WHERE id = $1 AND (device_token = $2 OR device_token = $3)`;
        const params = token === 'admin777' ? [id] : [id, token, `WAITING_VIP_${token}`];
        await pool.query(query, params);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server: ${PORT}`));
