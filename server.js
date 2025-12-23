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

// БАЗАНЫ ЖӘНЕ КЕСТЕЛЕРДІ БАСТАУ
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS workers (
                id SERIAL PRIMARY KEY, 
                name TEXT, 
                phone TEXT, 
                job TEXT, 
                lat DOUBLE PRECISION, 
                lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, 
                device_token TEXT, 
                expires_at TIMESTAMP, 
                fee_amount TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS goods (
                id SERIAL PRIMARY KEY, 
                seller_name TEXT, 
                product_name TEXT, 
                price TEXT, 
                phone TEXT, 
                lat DOUBLE PRECISION, 
                lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, 
                device_token TEXT, 
                expires_at TIMESTAMP, 
                fee_amount TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY, 
                client_name TEXT, 
                description TEXT, 
                phone TEXT, 
                lat DOUBLE PRECISION, 
                lon DOUBLE PRECISION, 
                device_token TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database & Tables Ready");
    } catch (err) { 
        console.error("DB Init Error:", err); 
    }
}
initDB();

// --- ЖАЛПЫ МӘЛІМЕТТЕРДІ АЛУ (КАРТА ҮШІН) ---
app.get('/get-all', async (req, res) => {
    try {
        // Ескірген жарнамаларды автоматты түрде өшіру
        await pool.query("DELETE FROM workers WHERE expires_at < NOW()");
        await pool.query("DELETE FROM goods WHERE expires_at < NOW()");
        await pool.query("DELETE FROM orders WHERE created_at < NOW() - interval '24 hours'");
        
        const w = await pool.query('SELECT * FROM workers'); // Админ бәрін көруі үшін
        const g = await pool.query('SELECT * FROM goods');
        const o = await pool.query('SELECT * FROM orders');
        
        res.json({ workers: w.rows, goods: g.rows, orders: o.rows });
    } catch (err) { 
        res.status(500).json({error: err.message}); 
    }
});

// --- САҚТАУ МАРШРУТТАРЫ ---
app.post('/save-worker', async (req, res) => {
    try {
        const { name, phone, job, lat, lon, durationHours, device_token } = req.body;
        const fee = durationHours === "1" ? "49₸" : "490₸";
        const exp = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
        
        await pool.query(
            'INSERT INTO workers (name, phone, job, lat, lon, expires_at, device_token, fee_amount, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, FALSE)', 
            [name, phone, job, lat, lon, exp, device_token, fee]
        );
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-goods', async (req, res) => {
    try {
        const { name, product, price, phone, lat, lon, durationHours, device_token } = req.body;
        const fee = durationHours === "1" ? "49₸" : "490₸";
        const exp = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);

        await pool.query(
            'INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, expires_at, device_token, fee_amount, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, FALSE)', 
            [name, product, price, phone, lat, lon, exp, device_token, fee]
        );
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-order', async (req, res) => {
    try {
        const { name, description, phone, lat, lon, device_token } = req.body;
        await pool.query(
            'INSERT INTO orders (client_name, description, phone, lat, lon, device_token) VALUES ($1,$2,$3,$4,$5,$6)', 
            [name, description, phone, lat, lon, device_token]
        );
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

// --- АДМИН ПАНЕЛЬ ЛОГИКАСЫ ---

// Хабарламаны белсендіру (Төлем расталғанда)
app.post('/admin/activate', async (req, res) => {
    try {
        const { id, type } = req.body;
        const table = type === 'worker' ? 'workers' : 'goods';
        await pool.query(`UPDATE ${table} SET is_active = TRUE WHERE id = $1`, [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({error: err.message}); }
});

// Хабарламаны өшіру (Админ немесе қолданушы)
app.post('/delete-item', async (req, res) => {
    try {
        const { id, type, token } = req.body;
        const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
        
        // Егер token 'admin777' болса, кез келгенін өшіреді, әйтпесе тек өз құрылғысыныкін
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
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
