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

app.post('/save-location', async (req, res) => {
    const { name, phone, job, lat, lon } = req.body;

    // СЕРВЕРЛІК ТЕКСЕРУ (Осы жерді өзгерттік)
    if (!name || name.length < 2) return res.status(400).send("Аты қате");
    
    // Түзетілген Regex: +7-мен басталатын 12 символ (+ және 11 сан)
    const phoneRegex = /^\+7[0-9]{10}$/; 
    if (!phone || !phoneRegex.test(phone)) {
        return res.status(400).send("Телефон қате! Формат: +77017398309");
    }
    
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
