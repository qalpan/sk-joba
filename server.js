const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// БАЗА ҚҰРЫЛЫМЫ: Барлық талаптарды қамтиды
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ads (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                job TEXT NOT NULL,
                type TEXT NOT NULL,
                tel TEXT NOT NULL,
                email TEXT NOT NULL,
                lat DOUBLE PRECISION NOT NULL,
                lon DOUBLE PRECISION NOT NULL,
                is_vip BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                token TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Деректер базасы дайын.");
    } catch (err) { console.error("База қатесі:", err); }
}
initDB();

let onlineUsers = {};

// 3, 4, 6 ТАЛАПТАР: Деректерді алу және 24 сағаттық сүзгі
app.get('/ads', async (req, res) => {
    try {
        // Тек соңғы 24 сағаттық және өзі өшірілмеген хабарламаларды алу
        const result = await pool.query(
            "SELECT * FROM ads WHERE created_at > NOW() - INTERVAL '24 hours' ORDER BY is_vip DESC, created_at DESC"
        );
        
        const data = result.rows.map(ad => ({
            ...ad,
            // 3-ТАЛАП: Иесі соңғы 45 секундта сигнал берсе ғана онлайн (🟢)
            is_online: (Date.now() - (onlineUsers[ad.token] || 0)) < 45000
        }));
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 1, 4 ТАЛАПТАР: Сақтау (Координата дәлдігін сақтау)
app.post('/save', async (req, res) => {
    const { name, job, type, tel, email, lat, lon, is_vip, token } = req.body;
    
    // 4-ТАЛАП: VIP болса, админ рұқсатынсыз (false) көрінбейді.
    // Тегін хабарлама болса, бірден true болады.
    const active = (is_vip === true || is_vip === "true") ? false : true; 

    try {
        await pool.query(
            "INSERT INTO ads (name, job, type, tel, email, lat, lon, is_vip, is_active, token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            [
                name, job, type, tel, email, 
                parseFloat(lat), parseFloat(lon), // Қате ауданнан шықпау үшін нақты сандар
                is_vip, active, token
            ]
        );
        res.json({ success: true });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Дерек базаға жазылмады" }); 
    }
});

// 5 ТАЛАП: Админ панель - Қосу/Өшіру
app.post('/admin-toggle', async (req, res) => {
    const { id, active, pass } = req.body;
    // Админ құпия сөзі
    if (pass === "admin777") {
        try {
            await pool.query("UPDATE ads SET is_active = $1 WHERE id = $2", [active, id]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: "Жаңарту сәтсіз" }); }
    } else { res.status(403).send("Рұқсат жоқ"); }
});

// Хабарламаны өшіру (Тек иесіне)
app.post('/delete', async (req, res) => {
    const { id, token } = req.body;
    await pool.query("DELETE FROM ads WHERE id = $1 AND token = $2", [id, token]);
    res.json({ success: true });
});

// Онлайн статусын бақылау
app.post('/ping', (req, res) => {
    if (req.body.token) {
        onlineUsers[req.body.token] = Date.now();
    }
    res.send("ok");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер ${PORT} портында қосылды`));
