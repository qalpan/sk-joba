const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

let onlineStatus = {};

// Кестені инициализациялау
pool.query(`
    CREATE TABLE IF NOT EXISTS markers_new (
        id SERIAL PRIMARY KEY,
        name TEXT, job TEXT, type TEXT, contacts JSONB,
        lat DOUBLE PRECISION, lon DOUBLE PRECISION,
        is_vip BOOLEAN DEFAULT FALSE, is_active BOOLEAN DEFAULT FALSE,
        token TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

app.post('/ping', (req, res) => {
    if (req.body.token) onlineStatus[req.body.token] = Date.now();
    res.json({success: true});
});

app.post('/save', async (req, res) => {
    const { name, job, type, contacts, lat, lon, is_vip, token } = req.body;
    const active = !is_vip; // VIP болса активті емес, тегін болса бірден активті
    await pool.query(
        'INSERT INTO markers_new (name, job, type, contacts, lat, lon, is_vip, is_active, token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [name, job, type, contacts, lat, lon, is_vip, active, token]
    );
    res.json({success: true});
});

// ... бұрынғы импорттар мен pool конфигурациясы ...

app.get('/get-all', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT * FROM markers_new 
            WHERE created_at > NOW() - INTERVAL '24 hours' 
            ORDER BY is_vip DESC, created_at DESC
        `);
        res.json(r.rows.map(row => ({ ...row, last_ping: onlineStatus[row.token] || 0 })));
    } catch(e) { res.status(500).send(e.message); }
});

// ... басқа роуттар өзгеріссіз қала береді ...

app.post('/delete', async (req, res) => {
    await pool.query('DELETE FROM markers_new WHERE id = $1 AND (token = $2 OR $2 = $3)', [req.body.id, req.body.token, 'admin777']);
    res.json({success: true});
});

app.post('/admin-toggle', async (req, res) => {
    if (req.body.pass === "admin777") {
        await pool.query('UPDATE markers_new SET is_active = $1 WHERE id = $2', [req.body.active, req.body.id]);
        res.json({success: true});
    } else { res.status(403).send("Denied"); }
});

app.listen(process.env.PORT || 10000);
