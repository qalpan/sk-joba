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

// БАЗАДА КЕСТЕ ҚҰРУ (Осы бөлім сізде жоқ болды)
async function initDatabase() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            job TEXT NOT NULL,
            lat DOUBLE PRECISION NOT NULL,
            lon DOUBLE PRECISION NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    try {
        await pool.query(createTableQuery);
        console.log("Кесте тексерілді немесе құрылды.");
    } catch (err) {
        console.error("Кесте құру кезінде қате шықты:", err);
    }
}
initDatabase(); // Сервер қосылғанда бір рет іске қосылады

app.post('/save-location', async (req, res) => {
    const { name, phone, job, lat, lon } = req.body;

    const phoneRegex = /^\+7[0-9]{10}$/;
    if (!name || name.length < 2) return res.status(400).send("Аты қате");
    if (!phone || !phoneRegex.test(phone)) return res.status(400).send("Телефон қате");
    if (!job || job.length < 3) return res.status(400).send("Мамандық қате");

    try {
        await pool.query(
            'INSERT INTO users (name, phone, job, lat, lon) VALUES ($1, $2, $3, $4, $5)',
            [name, phone, job, lat, lon]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Базаға жазу қатесі:", err.message);
        res.status(500).send(err.message);
    }
});

app.get('/get-locations', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("Сервер 10000 портында қосылды");
});
