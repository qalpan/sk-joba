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

// ДЕРЕКТЕР БАЗАСЫН БАСТАУ
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS workers (
                id SERIAL PRIMARY KEY, name TEXT, phone TEXT, job TEXT, 
                lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, device_token TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS goods (
                id SERIAL PRIMARY KEY, seller_name TEXT, product_name TEXT, 
                price TEXT, phone TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, device_token TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY, client_name TEXT, description TEXT, 
                phone TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, device_token TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Деректер базасы дайын.");
    } catch (err) { console.error("DB Init Error:", err); }
}
initDB();

app.post('/user-ping', (req, res) => {
    const { token } = req.body;
    if (token) onlineUsers[token] = Date.now();
    res.json({ success: true });
});

// БАРЛЫҚ ДЕРЕКТЕРДІ АЛУ ЖӘНЕ СҮЗГІЛЕУ
app.get('/get-all', async (req, res) => {
    try {
        const w = await pool.query('SELECT * FROM workers');
        const g = await pool.query('SELECT * FROM goods');
        const o = await pool.query('SELECT * FROM orders');

        const now = Date.now();
        const isOnline = (token) => (now - (onlineUsers[token] || 0)) < 45000;

        // ЖАҢА ЛОГИКА:
        // 1. Егер is_active === true болса (Админ VIP қосса) - КӨРІНЕДІ (оффлайн болса да).
        // 2. Егер ТЕГІН болса (is_active === false) - ТЕК ОНЛАЙН болса ғана көрінеді.
        // 3. Егер VIP батырмасын басса, бірақ Админ әлі растамаса - КӨРІНБЕЙДІ.
        const filterFn = (i) => i.is_active || isOnline(i.device_token);

        res.json({ 
            workers: w.rows.filter(filterFn), 
            goods: g.rows.filter(filterFn), 
            orders: o.rows.filter(filterFn), // Енді бұл жер жөнделді
            admin_all: { workers: w.rows, goods: g.rows, orders: o.rows }
        });
    } catch (err) { res.status(500).json({error: err.message}); }
});

// САҚТАУ: Барлық жаңа жазбалар is_active = false болып сақталады
app.post('/save-worker', async (req, res) => {
    try {
        const { name, phone, job, lat, lon, device_token } = req.body;
        await pool.query('INSERT INTO workers (name, phone, job, lat, lon, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6, false)', 
        [name, phone, job, lat, lon, device_token]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-goods', async (req, res) => {
    try {
        const { name, product, price, phone, lat, lon, device_token } = req.body;
        await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7, false)', 
        [name, product, price, phone, lat, lon, device_token]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-order', async (req, res) => {
    try {
        const { name, description, phone, lat, lon, device_token, is_vip } = req.body;
        // Тексеріс: Егер VIP батырмасымен келсе, админ растағанша күтеді
        await pool.query('INSERT INTO orders (client_name, description, phone, lat, lon, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6, false)', 
        [name, description, phone, lat, lon, device_token]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

// АДМИН ПАНЕЛЬ: Статусты өзгерту
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
            params = [parseInt(id)];
        } else {
            query = `DELETE FROM ${table} WHERE id = $1 AND device_token = $2`;
            params = [parseInt(id), token];
        }
        await pool.query(query, params);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер ${PORT} портында қосылды.`));
