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

// БҰЛ ЖЕР МАҢЫЗДЫ: Деректер базасын жаңарту
async function initDB() {
    try {
        console.log("Деректер базасы тексерілуде...");

        // 1. Orders кестесінде қате болса, баған қосамыз
        await pool.query(`CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY, client_name TEXT, description TEXT, 
            phone TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
            is_active BOOLEAN DEFAULT FALSE, device_token TEXT, 
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Егер "is_active" жоқ болса, оны күшпен қосамыз (Migration)
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE`);
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS device_token TEXT`);
        
        await pool.query(`ALTER TABLE workers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE`);
        await pool.query(`ALTER TABLE workers ADD COLUMN IF NOT EXISTS device_token TEXT`);

        await pool.query(`ALTER TABLE goods ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE`);
        await pool.query(`ALTER TABLE goods ADD COLUMN IF NOT EXISTS device_token TEXT`);

        console.log("Деректер базасы сәтті жаңартылды!");
    } catch (err) {
        console.error("DB Init Error:", err);
    }
}
initDB();

app.post('/user-ping', (req, res) => {
    const { token } = req.body;
    if (token) onlineUsers[token] = Date.now();
    res.json({ success: true });
});

// GET-ALL
app.get('/get-all', async (req, res) => {
    try {
        const w = await pool.query('SELECT * FROM workers');
        const g = await pool.query('SELECT * FROM goods');
        const o = await pool.query('SELECT * FROM orders');

        const now = Date.now();
        const isOnline = (token) => (now - (onlineUsers[token] || 0)) < 60000;
        const filterFn = (i) => i.is_active === true || isOnline(i.device_token);

        res.json({ 
            workers: w.rows.filter(filterFn), 
            goods: g.rows.filter(filterFn), 
            orders: o.rows.filter(filterFn), 
            admin_all: { workers: w.rows, goods: g.rows, orders: o.rows }
        });
    } catch (err) { res.status(500).json({error: err.message}); }
});

// Save logic helper
const processToken = (token, isVip) => isVip ? `WAITING_VIP_${token}` : token;

app.post('/save-worker', async (req, res) => {
    try {
        const { name, phone, job, lat, lon, device_token, is_vip } = req.body;
        const finalToken = processToken(device_token, is_vip);
        await pool.query('INSERT INTO workers (name, phone, job, lat, lon, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6, false)', [name, phone, job, lat, lon, finalToken]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-goods', async (req, res) => {
    try {
        const { name, product, price, phone, lat, lon, device_token, is_vip } = req.body;
        const finalToken = processToken(device_token, is_vip);
        await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7, false)', [name, product, price, phone, lat, lon, finalToken]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-order', async (req, res) => {
    try {
        const { name, description, phone, lat, lon, device_token, is_vip } = req.body;
        const finalToken = processToken(device_token, is_vip);
        // "is_active does not exist" қатесін болдырмау үшін жоғарыда initDB түзетілді
        await pool.query('INSERT INTO orders (client_name, description, phone, lat, lon, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6, false)', [name, description, phone, lat, lon, finalToken]);
        res.json({success: true});
    } catch (err) { 
        console.error("Order Save Error:", err);
        res.status(500).json({error: err.message}); 
    }
});

// БАРЛЫҒЫН ӨШІРУ (RESET) - Егер өте қатты қате шықса қолдану үшін
app.get('/reset-database-danger', async (req, res) => {
    try {
        await pool.query('DROP TABLE IF EXISTS workers');
        await pool.query('DROP TABLE IF EXISTS goods');
        await pool.query('DROP TABLE IF EXISTS orders');
        await initDB(); // Қайта құру
        res.send("База толығымен өшіріліп, қайта құрылды! Енді жұмыс істеуі керек.");
    } catch(e) { res.send(e.message); }
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
            params = [parseInt(id)];
        } else {
            query = `DELETE FROM ${table} WHERE id = $1 AND (device_token = $2 OR device_token = $3)`;
            params = [parseInt(id), token, `WAITING_VIP_${token}`];
        }
        await pool.query(query, params);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server started on ${PORT}`));
