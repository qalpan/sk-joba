const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Базаға қосылу (Render баптауларынан алады)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Деректерді сақтау
app.post('/save-location', async (req, res) => {
    const { name, phone, job, lat, lon } = req.body;

    // СЕРВЕРЛІК ТЕКСЕРУ (Шектеулер)
    if (!name || name.length < 2) return res.status(400).send("Аты қате");
    if (!phone || !/^[0-9]{12}$/.test(phone)) return res.status(400).send("Телефон қате");
    if (!job || job.length < 3) return res.status(400).send("Мамандық қате");

    try {
        await pool.query(
            'INSERT INTO users (name, phone, job, lat, lon) VALUES ($1, $2, $3, $4, $5)',
            [name, phone, job, lat, lon]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).send("Базалық қате");
    }
});

// Картаға маркерлерді шығару үшін
app.get('/get-locations', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send("Қате");
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("Сервер қосылды");
    console.log("База дайын");
});
