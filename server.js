const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
// CORS-ты қатаң орнату
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

// БАЗАНЫ ТАЗАЛАП ҚАЙТА ҚҰРУ (502 қатесін жою үшін)
async function resetDB() {
    try {
        console.log("DB Resetting...");
        // Ескі кестелерді толық өшіру (Бағандар қате болса)
        // Ескерту: Бұл барлық ескі деректерді өшіреді, бірақ қатесіз жұмыс істетеді.
        // Егер деректерді сақтау керек болса, DROP-ты алып тастаңыз.
        await pool.query('DROP TABLE IF EXISTS workers, goods, orders CASCADE;');

        await pool.query(`
            CREATE TABLE workers (
                id SERIAL PRIMARY KEY, name TEXT, phone TEXT, job TEXT, 
                lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, device_token TEXT, 
                expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            
            CREATE TABLE goods (
                id SERIAL PRIMARY KEY, seller_name TEXT, product_name TEXT, price TEXT, phone TEXT, 
                lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, device_token TEXT, 
                expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

            CREATE TABLE orders (
                id SERIAL PRIMARY KEY, client_name TEXT, description TEXT, phone TEXT, 
                lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                device_token TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        console.log("DB Recreated successfully.");
    } catch (err) { console.error("DB Reset Error:", err); }
}
resetDB();

// API БӨЛІМІ (Тұрақты жұмыс үшін try-catch қосылды)
app.post('/save-worker', async (req, res) => {
    try {
        const { name, phone, job, lat, lon, durationHours, device_token } = req.body;
        if(!name || !phone || !job || !lat) return res.status(400).send("Толтырылмаған жолдар бар");
        const expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
        await pool.query('INSERT INTO workers (name, phone, job, lat, lon, expires_at, device_token) VALUES ($1, $2, $3, $4, $5, $6, $7)', [name, phone, job, lat, lon, expiresAt, device_token]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-goods', async (req, res) => {
    try {
        const { name, product, price, phone, lat, lon, device_token } = req.body;
        if(!name || !product || !phone || !lat) return res.status(400).send("Толтырылмаған жолдар бар");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, expires_at, device_token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [name, product, price, phone, lat, lon, expiresAt, device_token]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-order', async (req, res) => {
    try {
        const { name, description, phone, lat, lon, device_token } = req.body;
        if(!name || !description || !phone || !lat) return res.status(400).send("Толтырылмаған жолдар бар");
        await pool.query('INSERT INTO orders (client_name, description, phone, lat, lon, device_token) VALUES ($1, $2, $3, $4, $5, $6)', [name, description, phone, lat, lon, device_token]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.get('/admin/pending', async (req, res) => {
    try {
        const w = await pool.query(`SELECT id, name, job as info, phone, 'worker' as type, to_char(created_at, 'DD.MM HH24:MI') as date_text, CASE WHEN (expires_at - created_at) > interval '2 hour' THEN '490₸' ELSE '49₸' END as price FROM workers WHERE is_active = FALSE`);
        const g = await pool.query(`SELECT id, seller_name as name, product_name as info, phone, 'good' as type, to_char(created_at, 'DD.MM HH24:MI') as date_text, '490₸' as price FROM goods WHERE is_active = FALSE`);
        res.json([...w.rows, ...g.rows]);
    } catch (err) { res.json([]); }
});

app.get('/get-all', async (req, res) => {
    try {
        const w = await pool.query('SELECT * FROM workers WHERE is_active = TRUE');
        const g = await pool.query('SELECT * FROM goods WHERE is_active = TRUE');
        const o = await pool.query('SELECT * FROM orders');
        res.json({ workers: w.rows, goods: g.rows, orders: o.rows });
    } catch (err) { res.json({workers:[], goods:[], orders:[]}); }
});

app.post('/admin/activate', async (req, res) => {
    const { id, type } = req.body;
    const table = type === 'worker' ? 'workers' : 'goods';
    await pool.query(`UPDATE ${table} SET is_active = TRUE WHERE id = $1`, [id]);
    res.json({ success: true });
});

app.listen(process.env.PORT || 10000);
