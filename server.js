const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();

// CORS қатесін болдырмау үшін осылай жазылуы тиіс
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

let onlineUsers = {}; // Пайдаланушылардың онлайн статусын сақтау

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
        }
        console.log("База дайын");
    } catch (err) { console.error(err); }
}
initDB();

app.post('/user-ping', (req, res) => {
    const { token } = req.body;
    if (token) {
        const cleanToken = token.replace('WAITING_VIP_', '');
        onlineUsers[cleanToken] = Date.now();
    }
    res.json({ success: true });
});

app.get('/get-all', async (req, res) => {
    try {
        const w = await pool.query('SELECT * FROM workers');
        const g = await pool.query('SELECT * FROM goods');
        const o = await pool.query('SELECT * FROM orders');

        const attachStatus = (rows) => rows.map(item => {
            const cleanToken = item.device_token ? item.device_token.replace('WAITING_VIP_', '') : null;
            return {
                ...item,
                last_ping: onlineUsers[cleanToken] || 0
            };
        });

        res.json({ 
            workers: attachStatus(w.rows), 
            goods: attachStatus(g.rows), 
            orders: attachStatus(o.rows),
            admin_all: { workers: w.rows, goods: g.rows, orders: o.rows }
        });
    } catch (err) { res.status(500).json({error: err.message}); }
});

const saveTemplate = async (table, cols, vals, device_token, is_vip) => {
    const finalToken = is_vip ? `WAITING_VIP_${device_token}` : device_token;
    const isActive = is_vip ? false : true; 
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
    const query = `INSERT INTO ${table} (${cols.join(',')}, device_token, is_active) VALUES (${placeholders}, $${vals.length + 1}, $${vals.length + 2})`;
    await pool.query(query, [...vals, finalToken, isActive]);
};

app.post('/save-worker', async (req, res) => {
    try {
        const { name, phone, job, lat, lon, device_token, is_vip, contacts } = req.body;
        await saveTemplate('workers', ['name', 'phone', 'job', 'lat', 'lon', 'contacts'], [name, phone, job, lat, lon, contacts], device_token, is_vip);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-goods', async (req, res) => {
    try {
        const { name, product, price, phone, lat, lon, device_token, is_vip, contacts } = req.body;
        await saveTemplate('goods', ['seller_name', 'product_name', 'price', 'phone', 'lat', 'lon', 'contacts'], [name, product, price, phone, lat, lon, contacts], device_token, is_vip);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-order', async (req, res) => {
    try {
        const { name, description, phone, lat, lon, device_token, is_vip, contacts } = req.body;
        await saveTemplate('orders', ['client_name', 'description', 'phone', 'lat', 'lon', 'contacts'], [name, description, phone, lat, lon, contacts], device_token, is_vip);
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
        let query, params;
        if (token === 'admin777') {
            query = `DELETE FROM ${table} WHERE id = $1`;
            params = [id];
        } else {
            query = `DELETE FROM ${table} WHERE id = $1 AND (device_token = $2 OR device_token = $3)`;
            params = [id, token, `WAITING_VIP_${token}`];
        }
        await pool.query(query, params);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер ${PORT} портында қосылды`));
