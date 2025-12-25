const express = require('express');
const { Pool } = require('pool'); // Немесе pg
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

let onlineStatus = {};

// БАЗА ҚҰРЫЛЫМЫ
pool.query(`
    CREATE TABLE IF NOT EXISTS markers_new (
        id SERIAL PRIMARY KEY,
        name TEXT, job TEXT, type TEXT, contacts JSONB,
        lat DOUBLE PRECISION, lon DOUBLE PRECISION,
        is_vip BOOLEAN, is_active BOOLEAN DEFAULT FALSE,
        token TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

app.post('/ping', (req, res) => {
    onlineStatus[req.body.token] = Date.now();
    res.send('ok');
});

app.post('/save', async (req, res) => {
    const { name, job, type, contacts, lat, lon, is_vip, token } = req.body;
    // Тегін хабарлама болса - бірден актив (бірақ сайтта онлайндық тексеріледі)
    const active = !is_vip;
    await pool.query(
        'INSERT INTO markers_new (name, job, type, contacts, lat, lon, is_vip, is_active, token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [name, job, type, contacts, lat, lon, is_vip, active, token]
    );
    res.json({success: true});
});

app.get('/get-all', async (req, res) => {
    const r = await pool.query('SELECT * FROM markers_new ORDER BY created_at DESC');
    const data = r.rows.map(row => ({
        ...row,
        last_ping: onlineStatus[row.token] || 0
    }));
    res.json(data);
});

app.post('/delete', async (req, res) => {
    const { id, token } = req.body;
    // Тек иесі немесе админ өшіре алады
    await pool.query('DELETE FROM markers_new WHERE id = $1 AND (token = $2 OR $2 = $3)', [id, token, 'admin777']);
    res.json({success: true});
});

app.post('/admin-toggle', async (req, res) => {
    const { id, active, pass } = req.body;
    if(pass === "admin777") {
        await pool.query('UPDATE markers_new SET is_active = $1 WHERE id = $2', [active, id]);
        res.json({success: true});
    }
});

app.listen(10000);
