const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// БАЗАНЫ ДАЙЫНДАУ
async function initDatabase() {
    const query = `
        CREATE TABLE IF NOT EXISTS workers (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            job TEXT NOT NULL,
            lat DOUBLE PRECISION NOT NULL,
            lon DOUBLE PRECISION NOT NULL
        );
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            client_name TEXT NOT NULL,
            description TEXT NOT NULL,
            phone TEXT NOT NULL,
            lat DOUBLE PRECISION NOT NULL,
            lon DOUBLE PRECISION NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    try {
        await pool.query(query);
        console.log("Базалық кестелер дайын.");
    } catch (err) {
        console.error("Кесте құру қатесі:", err);
    }
}
initDatabase();

// МАМАНДАРДЫ САҚТАУ
app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon } = req.body;
    try {
        await pool.query('INSERT INTO workers (name, phone, job, lat, lon) VALUES ($1, $2, $3, $4, $5)', [name, phone, job, lat, lon]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// ТАПСЫРЫСТАРДЫ САҚТАУ
app.post('/save-order', async (req, res) => {
    const { name, description, phone, lat, lon } = req.body;
    try {
        await pool.query('INSERT INTO orders (client_name, description, phone, lat, lon) VALUES ($1, $2, $3, $4, $5)', [name, description, phone, lat, lon]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// БАРЛЫҚ ДЕРЕКТЕРДІ АЛУ
app.get('/get-all', async (req, res) => {
    try {
        const workers = await pool.query('SELECT * FROM workers');
        const orders = await pool.query('SELECT * FROM orders');
        res.json({ workers: workers.rows, orders: orders.rows });
    } catch (err) { res.status(500).send(err.message); }
});

// ТАПСЫРЫСТЫ ӨШІРУ (Клиент үшін)
app.delete('/delete-order/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Сервер қосулы"));
