const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({ connectionString: "your_postgres_url" });
let onlineStatus = {};

// 3 & 4. Деректерді алу (Тек соңғы 24 сағат)
app.get('/ads', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT * FROM ads 
            WHERE created_at > NOW() - INTERVAL '24 hours' 
            ORDER BY is_vip DESC, created_at DESC
        `);
        const data = r.rows.map(i => ({ ...i, last_ping: onlineStatus[i.token] || 0 }));
        res.json(data);
    } catch(e) { res.status(500).send(e.message); }
});

// 4. Сақтау (VIP болса 'is_active: false' болып түседі)
app.post('/save', async (req, res) => {
    const { name, job, type, tel, email, lat, lon, is_vip, token } = req.body;
    const active = !is_vip; // Тегін бірден шығады, VIP админді күтеді
    await pool.query(
        'INSERT INTO ads (name, job, type, tel, email, lat, lon, is_vip, is_active, token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [name, job, type, tel, email, lat, lon, is_vip, active, token]
    );
    res.json({success: true});
});

// 5. Админ басқаруы
app.post('/admin-toggle', async (req, res) => {
    const { id, active, pass } = req.body;
    if (pass !== "admin777") return res.status(403).send("Қате пароль");
    await pool.query('UPDATE ads SET is_active = $1 WHERE id = $2', [active, id]);
    res.json({success: true});
});

app.post('/ping', (req, res) => {
    onlineStatus[req.body.token] = Date.now();
    res.send("ok");
});

app.post('/del', async (req, res) => {
    await pool.query('DELETE FROM ads WHERE id = $1 AND token = $2', [req.body.id, req.body.token]);
    res.send("ok");
});

app.listen(3000);
