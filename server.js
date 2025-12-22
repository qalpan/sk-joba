const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); // CORS пакеті міндетті түрде болуы керек

const app = express();

// CORS-ты қатаң түрде баптау
app.use(cors({
    origin: '*', // Барлық сайттарға рұқсат (GitHub Pages үшін маңызды)
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

// БАЗАНЫ ТЕКСЕРУ (Бұл бөлім базаның дайын екеніне көз жеткізеді)
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS workers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, job TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, is_active BOOLEAN DEFAULT FALSE, device_token TEXT, expires_at TIMESTAMP, fee_amount TEXT);
            CREATE TABLE IF NOT EXISTS goods (id SERIAL PRIMARY KEY, seller_name TEXT, product_name TEXT, price TEXT, phone TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, is_active BOOLEAN DEFAULT FALSE, device_token TEXT, expires_at TIMESTAMP, fee_amount TEXT);
            CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, client_name TEXT, description TEXT, phone TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION, device_token TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        console.log("Database initialized");
    } catch (err) {
        console.error("DB Init Error:", err);
    }
}
initDB();

// МАРШРУТТАР (404 болмауы үшін аттарын тексеріңіз)
app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon, durationHours, device_token } = req.body;
    const fee = durationHours === "1" ? "49₸" : "490₸";
    const exp = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO workers (name, phone, job, lat, lon, expires_at, device_token, fee_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [name, phone, job, lat, lon, exp, device_token, fee]);
    res.status(200).json({success: true});
});

app.post('/save-goods', async (req, res) => {
    const { name, product, price, phone, lat, lon, durationHours, device_token } = req.body;
    const fee = durationHours === "1" ? "49₸" : "490₸";
    const exp = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
    await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, expires_at, device_token, fee_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [name, product, price, phone, lat, lon, exp, device_token, fee]);
    res.status(200).json({success: true});
});

app.post('/save-order', async (req, res) => {
    const { name, description, phone, lat, lon, device_token } = req.body;
    await pool.query('INSERT INTO orders (client_name, description, phone, lat, lon, device_token) VALUES ($1,$2,$3,$4,$5,$6)', [name, description, phone, lat, lon, device_token]);
    res.status(200).json({success: true});
});

app.get('/get-all', async (req, res) => {
    try {
        const w = await pool.query('SELECT * FROM workers WHERE is_active = TRUE');
        const g = await pool.query('SELECT * FROM goods WHERE is_active = TRUE');
        const o = await pool.query('SELECT * FROM orders');
        res.json({ workers: w.rows, goods: g.rows, orders: o.rows });
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Қалған Админ маршруттарын да осылай res.json() арқылы аяқтаңыз...

app.listen(process.env.PORT || 10000, () => console.log("Server running"));
