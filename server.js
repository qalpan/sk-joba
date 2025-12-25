const express = require('express');
const cors = require('cors'); // CORS пакеті міндетті
const { Pool } = require('pg');
const app = express();

// CORS қатесін болдырмау үшін:
app.use(cors()); 
app.use(express.json());

const pool = new Pool({
  connectionString: "СІЗДІҢ_POSTGRES_СІЛТЕМЕҢІЗ", // Мысалы: Render-дегі Internal Database URL
  ssl: { rejectUnauthorized: false }
});

let onlineStatus = {}; // Пайдаланушылардың онлайн статусы

// 3 & 4. Деректерді алу (Тек 24 сағаттық және VIP логикасы)
app.get('/ads', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT * FROM ads 
            WHERE created_at > NOW() - INTERVAL '24 hours' 
            ORDER BY is_vip DESC, created_at DESC
        `);
        const data = r.rows.map(i => ({
            ...i,
            is_online: (Date.now() - (onlineStatus[i.token] || 0)) < 40000
        }));
        res.json(data);
    } catch (err) { res.status(500).json(err.message); }
});

// 4. Хабарлама сақтау
app.post('/save', async (req, res) => {
    const { name, job, type, tel, email, lat, lon, is_vip, token } = req.body;
    // VIP болса admin мақұлдағанша active: false болады
    const active = !is_vip; 
    try {
        await pool.query(
            `INSERT INTO ads (name, job, type, tel, email, lat, lon, is_vip, is_active, token) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [name, job, type, tel, email, lat, lon, is_vip, active, token]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json(err.message); }
});

// 5. Админ панель: VIP қосу/жою
app.post('/admin-toggle', async (req, res) => {
    const { id, active, pass } = req.body;
    if (pass !== "admin777") return res.status(403).json("Қате пароль");
    await pool.query('UPDATE ads SET is_active = $1 WHERE id = $2', [active, id]);
    res.json({ success: true });
});

app.post('/ping', (req, res) => {
    onlineStatus[req.body.token] = Date.now();
    res.send("ok");
});

app.listen(process.env.PORT || 3000);
