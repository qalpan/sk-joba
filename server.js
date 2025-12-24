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

// Деректер базасын инициализациялау және жаңарту
async function initDB() {
    try {
        console.log("Деректер базасы тексерілуде...");

        // 1. Кестелерді құру немесе жаңарту
        // workers кестесі
        await pool.query(`CREATE TABLE IF NOT EXISTS workers (
            id SERIAL PRIMARY KEY, 
            name TEXT, 
            phone TEXT, 
            job TEXT, 
            lat DOUBLE PRECISION, 
            lon DOUBLE PRECISION, 
            is_active BOOLEAN DEFAULT FALSE, 
            device_token TEXT, 
            contacts JSONB DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // goods кестесі
        await pool.query(`CREATE TABLE IF NOT EXISTS goods (
            id SERIAL PRIMARY KEY, 
            seller_name TEXT, 
            product_name TEXT, 
            price TEXT, 
            phone TEXT, 
            lat DOUBLE PRECISION, 
            lon DOUBLE PRECISION, 
            is_active BOOLEAN DEFAULT FALSE, 
            device_token TEXT, 
            contacts JSONB DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // orders кестесі
        await pool.query(`CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY, 
            client_name TEXT, 
            description TEXT, 
            phone TEXT, 
            lat DOUBLE PRECISION, 
            lon DOUBLE PRECISION, 
            is_active BOOLEAN DEFAULT FALSE, 
            device_token TEXT, 
            contacts JSONB DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. МИГРАЦИЯ: Егер кесте бұрыннан бар болса, бірақ жаңа бағандар жоқ болса, оларды қосамыз
        const tables = ['workers', 'goods', 'orders'];
        
        for (const table of tables) {
            // is_active бағаны
            await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE`);
            
            // device_token бағаны
            await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS device_token TEXT`);
            
            // contacts бағаны (бірнеше байланыс түрін сақтау үшін)
            await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'`);
            
            // created_at бағаны (уақытты көрсету үшін)
            await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        }

        console.log("Деректер базасының құрылымы толық тексерілді және дайын!");
    } catch (err) {
        console.error("DB Init Error (Базаны реттеуде қате шықты):", err);
    }
}
initDB();

// Пайдаланушының онлайн екенін тіркеу
app.post('/user-ping', (req, res) => {
    const { token } = req.body;
    if (token) onlineUsers[token] = Date.now();
    res.json({ success: true });
});

// Барлық маркерлерді алу
app.get('/get-all', async (req, res) => {
    try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        // 24 сағаттан асқандарды автоматты өшіру (логикаңыз сақталды)
        await pool.query("DELETE FROM workers WHERE created_at < $1", [oneDayAgo]);
        await pool.query("DELETE FROM goods WHERE created_at < $1", [oneDayAgo]);
        await pool.query("DELETE FROM orders WHERE created_at < $1", [oneDayAgo]);

        const w = await pool.query('SELECT * FROM workers');
        const g = await pool.query('SELECT * FROM goods');
        const o = await pool.query('SELECT * FROM orders');

        const nowTs = Date.now();
        // Пайдаланушының онлайн екенін тексеру (60 секунд ішінде)
        const isOnline = (token) => (nowTs - (onlineUsers[token] || 0)) < 60000;

        // КАРТАҒА ШЫҒАРУ ШАРТЫ:
        // 1. Немесе VIP (is_active === true)
        // 2. Немесе Тегін, бірақ қазір ОНЛАЙН болса
        const filterFn = (i) => i.is_active === true || (i.device_token && isOnline(i.device_token));

        res.json({ 
            workers: w.rows.filter(filterFn), 
            goods: g.rows.filter(filterFn), 
            orders: o.rows.filter(filterFn),
            admin_all: { workers: w.rows, goods: g.rows, orders: o.rows } 
        });
    } catch (err) { res.status(500).json({error: err.message}); }
});

const processToken = (token, isVip) => isVip ? `WAITING_VIP_${token}` : token;

// Worker сақтау
app.post('/save-worker', async (req, res) => {
    try {
        const { name, phone, job, lat, lon, device_token, is_vip } = req.body;
        const finalToken = processToken(device_token, is_vip);
        await pool.query(
            'INSERT INTO workers (name, phone, job, lat, lon, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6, false)', 
            [name, phone, job, lat, lon, finalToken]
        );
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

// Goods сақтау
app.post('/save-goods', async (req, res) => {
    try {
        const { name, product, price, phone, lat, lon, device_token, is_vip } = req.body;
        const finalToken = processToken(device_token, is_vip);
        await pool.query(
            'INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7, false)', 
            [name, product, price, phone, lat, lon, finalToken]
        );
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

// Order сақтау
app.post('/save-order', async (req, res) => {
    try {
        const { name, description, phone, lat, lon, device_token, is_vip } = req.body;
        const finalToken = processToken(device_token, is_vip);
        await pool.query(
            'INSERT INTO orders (client_name, description, phone, lat, lon, device_token, is_active) VALUES ($1,$2,$3,$4,$5,$6, false)', 
            [name, description, phone, lat, lon, finalToken]
        );
        res.json({success: true});
    } catch (err) { 
        console.error("Order Save Error:", err);
        res.status(500).json({error: err.message}); 
    }
});

// VIP статусын өзгерту (Админ үшін)
app.post('/admin/toggle-active', async (req, res) => {
    try {
        const { id, type, active } = req.body; 
        const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
        await pool.query(`UPDATE ${table} SET is_active = $1 WHERE id = $2`, [active, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({error: err.message}); }
});

// Хабарламаны өшіру
app.post('/delete-item', async (req, res) => {
    try {
        const { id, type, token } = req.body;
        const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
        
        if (token === 'admin777') {
            await pool.query(`DELETE FROM ${table} WHERE id = $1`, [parseInt(id)]);
        } else {
            await pool.query(
                `DELETE FROM ${table} WHERE id = $1 AND (device_token = $2 OR device_token = $3)`, 
                [parseInt(id), token, `WAITING_VIP_${token}`]
            );
        }
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

// Базаны толық тазалау
app.get('/reset-database-danger', async (req, res) => {
    try {
        await pool.query('DROP TABLE IF EXISTS workers');
        await pool.query('DROP TABLE IF EXISTS goods');
        await pool.query('DROP TABLE IF EXISTS orders');
        await initDB(); 
        res.send("База толығымен өшіріліп, қайта құрылды! Енді жұмыс істеуі керек.");
    } catch(e) { res.send(e.message); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
