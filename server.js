const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const crypto = require('crypto'); // Құрылғыны тану үшін

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// БАЗАНЫ ЖАҢАРТУ: device_token қосылды
async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS workers (
            id SERIAL PRIMARY KEY, name TEXT, phone TEXT, job TEXT, lat DOUBLE PRECISION, lon DOUBLE PRECISION
        );
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY, client_name TEXT, description TEXT, phone TEXT, 
            lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
            device_token TEXT, -- Тапсырыс иесін тану үшін
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
}
initDatabase();

// ТАПСЫРЫСТАРДЫ АВТОМАТТЫ ТАЗАЛАУ (24 сағаттан ескілерін өшіру)
async function cleanOldOrders() {
    await pool.query("DELETE FROM orders WHERE created_at < NOW() - INTERVAL '24 hours'");
    console.log("Ескі тапсырыстар тазаланды.");
}
setInterval(cleanOldOrders, 3600000); // Әр сағат сайын тексереді

// ТАПСЫРЫС САҚТАУ
app.post('/save-order', async (req, res) => {
    const { name, description, phone, lat, lon, device_token } = req.body;
    try {
        await pool.query(
            'INSERT INTO orders (client_name, description, phone, lat, lon, device_token) VALUES ($1, $2, $3, $4, $5, $6)',
            [name, description, phone, lat, lon, device_token]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// ТАПСЫРЫСТЫ ӨШІРУ (Тек токен сәйкес келсе)
app.delete('/delete-order/:id', async (req, res) => {
    const { device_token } = req.body;
    try {
        const result = await pool.query('DELETE FROM orders WHERE id = $1 AND device_token = $2', [req.params.id, device_token]);
        if (result.rowCount > 0) res.json({ success: true });
        else res.status(403).send("Бұл сіздің тапсырысыңыз емес!");
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/get-all', async (req, res) => {
    const workers = await pool.query('SELECT * FROM workers');
    const orders = await pool.query('SELECT * FROM orders');
    res.json({ workers: workers.rows, orders: orders.rows });
});

app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon } = req.body;
    await pool.query('INSERT INTO workers (name, phone, job, lat, lon) VALUES ($1, $2, $3, $4, $5)', [name, phone, job, lat, lon]);
    res.json({ success: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Сервер дайын"));

// server.js ішіндегі өзгерістер
async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS workers (
            id SERIAL PRIMARY KEY,
            name TEXT, phone TEXT, job TEXT,
            lat DOUBLE PRECISION, lon DOUBLE PRECISION,
            expires_at TIMESTAMP -- Төлемнің біту уақыты
        );
    `);
}

// Уақыты біткен мамандарды автоматты өшіру
async function clearExpiredWorkers() {
    await pool.query("DELETE FROM workers WHERE expires_at < NOW()");
}
setInterval(clearExpiredWorkers, 60000); // Әр минут сайын

// Төлемнен кейін орындаушыны белсендіру
app.post('/activate-worker', async (req, res) => {
    const { name, phone, job, lat, lon, durationHours } = req.body;
    // durationHours: 1 (сағат) немесе 24 (тәулік)
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    
    try {
        await pool.query(
            'INSERT INTO workers (name, phone, job, lat, lon, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
            [name, phone, job, lat, lon, expiresAt]
        );
        res.json({ success: true, expiresAt });
    } catch (err) { res.status(500).send(err.message); }
});
