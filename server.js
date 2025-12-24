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

// ДЕРЕКТЕР БАЗАСЫН ҚҰРУ
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

// GET-ALL: Картаға деректерді шығару
app.get('/get-all', async (req, res) => {
    try {
        const w = await pool.query('SELECT * FROM workers');
        const g = await pool.query('SELECT * FROM goods');
        const o = await pool.query('SELECT * FROM orders');

        const now = Date.now();
        // 45 секунд ішінде пинг жібергендер онлайн болып саналады
        const isOnline = (token) => (now - (onlineUsers[token] || 0)) < 45000;

        // СҮЗГІЛЕУ ЕРЕЖЕСІ:
        // 1. Егер Админ is_active=true қылса -> КӨРІНЕДІ.
        // 2. Егер is_active=false болса -> Тек device_token "ОНЛАЙН" тізімде болса ғана көрінеді.
        // (VIP сұрағандардың токені өзгергендіктен, олар isOnline тексерісінен өтпей қалады -> Көрінбейді)
        const filterFn = (i) => i.is_active === true || isOnline(i.device_token);

        res.json({ 
            workers: w.rows.filter(filterFn), 
            goods: g.rows.filter(filterFn), 
            orders: o.rows.filter(filterFn), // Тапсырыстар осында шығады
            admin_all: { 
                workers: w.rows, 
                goods: g.rows, 
                orders: o.rows 
            }
        });
    } catch (err) { res.status(500).json({error: err.message}); }
});

// КӨМЕКШІ ФУНКЦИЯ: Токенді өңдеу
// Егер is_vip келсе, токенді "бұзамыз", сөйтіп ол онлайн болып көрінбейді
const processToken = (token, isVip) => {
    return isVip ? `WAITING_VIP_${token}` : token;
};

app.post('/save-worker', async (req, res) => {
    try {
        const { name, phone, job, lat, lon, device_token, is_vip } = req.body;
        const finalToken = processToken(device_token, is_vip);
        
        await pool.query('INSERT INTO workers (name, phone, job, lat, lon, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6, false)', 
        [name, phone, job, lat, lon, finalToken]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-goods', async (req, res) => {
    try {
        const { name, product, price, phone, lat, lon, device_token, is_vip } = req.body;
        const finalToken = processToken(device_token, is_vip);

        await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7, false)', 
        [name, product, price, phone, lat, lon, finalToken]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-order', async (req, res) => {
    try {
        const { name, description, phone, lat, lon, device_token, is_vip } = req.body;
        const finalToken = processToken(device_token, is_vip);

        await pool.query('INSERT INTO orders (client_name, description, phone, lat, lon, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6, false)', 
        [name, description, phone, lat, lon, finalToken]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

// АДМИН ЖӘНЕ ӨШІРУ
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
            // Қарапайым қолданушы өшіруі үшін
            // Біз "WAITING_VIP_" префиксін ескеруіміз керек немесе тікелей салыстыру
            query = `DELETE FROM ${table} WHERE id = $1 AND (device_token = $2 OR device_token = $3)`;
            params = [parseInt(id), token, `WAITING_VIP_${token}`];
        }
        await pool.query(query, params);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server started on ${PORT}`));
