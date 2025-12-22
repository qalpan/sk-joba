const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ДЕРЕКТЕР БАЗАСЫНА ҚОСЫЛУ
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// БАЗАНЫ ЖӘНЕ КЕСТЕЛЕРДІ БАСТАПҚЫ ОРНАТУ
async function initDatabase() {
    try {
        // ЕСКЕРТУ: Ескі кестелерді өшіріп, жаңа құрылымды енгізу
        // (Батырмалар шыққан соң бұл DROP жолдарын өшіріп тастауға болады)
        await pool.query('DROP TABLE IF EXISTS workers CASCADE;');
        await pool.query('DROP TABLE IF EXISTS orders CASCADE;');
        console.log("Ескі деректер тазартылды.");

        // Орындаушылар кестесі
        await pool.query(`
            CREATE TABLE IF NOT EXISTS workers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                job TEXT NOT NULL,
                lat DOUBLE PRECISION NOT NULL,
                lon DOUBLE PRECISION NOT NULL,
                expires_at TIMESTAMP NOT NULL
            );
        `);

        // Тапсырыстар кестесі (Өшіру батырмасы үшін device_token қосылды)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                client_name TEXT NOT NULL,
                description TEXT NOT NULL,
                phone TEXT NOT NULL,
                lat DOUBLE PRECISION NOT NULL,
                lon DOUBLE PRECISION NOT NULL,
                device_token TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Деректер базасы жаңа құрылыммен дайын.");
    } catch (err) {
        console.error("Базаны бастау қатесі:", err);
    }
}
initDatabase();

// АВТОМАТТЫ ТАЗАЛАУ (Әр минут сайын)
setInterval(async () => {
    try {
        // Уақыты біткен мамандарды өшіру
        await pool.query("DELETE FROM workers WHERE expires_at < NOW()");
        // 24 сағаттан ескі тапсырыстарды өшіру
        await pool.query("DELETE FROM orders WHERE created_at < NOW() - INTERVAL '24 hours'");
    } catch (err) {
        console.error("Авто-тазалау қатесі:", err);
    }
}, 60000);

// МАМАНДЫ (WORKER) САҚТАУ
app.post('/save-worker', async (req, res) => {
    const { name, phone, job, lat, lon, durationHours } = req.body;
    const hours = Number(durationHours) || 1;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    try {
        await pool.query(
            'INSERT INTO workers (name, phone, job, lat, lon, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
            [name, phone, job, lat, lon, expiresAt]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ТАПСЫРЫСТЫ (ORDER) САҚТАУ
app.post('/save-order', async (req, res) => {
    const { name, description, phone, lat, lon, device_token } = req.body;
    try {
        await pool.query(
            'INSERT INTO orders (client_name, description, phone, lat, lon, device_token) VALUES ($1, $2, $3, $4, $5, $6)',
            [name, description, phone, lat, lon, device_token]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// БАРЛЫҚ МӘЛІМЕТТІ АЛУ
app.get('/get-all', async (req, res) => {
    try {
        const workers = await pool.query('SELECT * FROM workers');
        const orders = await pool.query('SELECT * FROM orders');
        res.json({ workers: workers.rows, orders: orders.rows });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ТАПСЫРЫСТЫ ӨШІРУ (Құрылғыны тексеру арқылы)
app.delete('/delete-order/:id', async (req, res) => {
    const { device_token } = req.body;
    try {
        const result = await pool.query(
            'DELETE FROM orders WHERE id = $1 AND device_token = $2', 
            [req.params.id, device_token]
        );
        if (result.rowCount > 0) {
            res.json({ success: true });
        } else {
            res.status(403).send("Бұл сіздің тапсырысыңыз емес немесе рұқсат жоқ");
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Сервер ${PORT} портында қосылды`);
});
