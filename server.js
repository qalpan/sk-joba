const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Render-де Environment Variables-ке қосыңыз
    ssl: { rejectUnauthorized: false }
});

// Базаның дайындығын тексеру (Міндетті!)
pool.query(`
    CREATE TABLE IF NOT EXISTS ads (
        id SERIAL PRIMARY KEY,
        name TEXT, job TEXT, type TEXT, tel TEXT, email TEXT,
        lat DOUBLE PRECISION, lon DOUBLE PRECISION,
        is_vip BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error("База қатесі:", e));

let onlineStatus = {};

app.get('/ads', async (req, res) => {
    try {
        // 3 & 4. Тек 24 сағаттық деректерді алу
        const r = await pool.query("SELECT * FROM ads WHERE created_at > NOW() - INTERVAL '24 hours'");
        const data = r.rows.map(i => ({
            ...i,
            is_online: (Date.now() - (onlineStatus[i.token] || 0)) < 45000
        }));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/save', async (req, res) => {
    const { name, job, type, tel, email, lat, lon, is_vip, token } = req.body;
    // 4-талап: VIP болса админ қоспайынша active: false (көрінбейді)
    const active = is_vip ? false : true; 
    try {
        await pool.query(
            "INSERT INTO ads (name, job, type, tel, email, lat, lon, is_vip, is_active, token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            [name, job, type, tel, email, lat, lon, is_vip, active, token]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json(err.message); }
});

app.post('/admin-toggle', async (req, res) => {
    const { id, active, pass } = req.body;
    if (pass === "admin777") {
        await pool.query("UPDATE ads SET is_active = $1 WHERE id = $2", [active, id]);
        res.json({ success: true });
    } else { res.status(403).json("Қате!"); }
});

app.post('/ping', (req, res) => {
    onlineStatus[req.body.token] = Date.now();
    res.send("ok");
});

app.listen(process.env.PORT || 3000);
