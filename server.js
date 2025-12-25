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

// Онлайн статустарды жадта сақтау
let onlineStatus = {};

// 1. Базалық кестені жаңарту (JSONB қолдану)
pool.query(`
    CREATE TABLE IF NOT EXISTS markers_new (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL, 
        job TEXT NOT NULL, 
        type TEXT, 
        contacts JSONB, 
        lat DOUBLE PRECISION NOT NULL, 
        lon DOUBLE PRECISION NOT NULL,
        is_vip BOOLEAN DEFAULT FALSE, 
        is_active BOOLEAN DEFAULT FALSE,
        token TEXT NOT NULL, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

// Пинг жүйесі (Онлайн статус)
app.post('/ping', (req, res) => {
    if (req.body.token) {
        onlineStatus[req.body.token] = Date.now();
    }
    res.json({ success: true });
});

// 3 & 4. Сақтау логикасы
app.post('/save', async (req, res) => {
    try {
        const { name, job, type, contacts, lat, lon, is_vip, token } = req.body;
        
        // Тегін хабарландыру (is_vip = false) бірден активті болады
        // VIP (is_vip = true) админ мақұлдағанша active = false болып тұрады
        const active = !is_vip; 

        await pool.query(
            'INSERT INTO markers_new (name, job, type, contacts, lat, lon, is_vip, is_active, token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [name, job, type, contacts, lat, lon, is_vip, active, token]
        );
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 3, 4, 6, 7. Деректерді алу (Тек соңғы 24 сағат)
app.get('/get-all', async (req, res) => {
    try {
        // SQL: Тек соңғы 24 сағаттағы хабарламаларды алу
        const r = await pool.query(`
            SELECT * FROM markers_new 
            WHERE created_at > NOW() - INTERVAL '24 hours' 
            ORDER BY is_vip DESC, created_at DESC
        `);
        
        const results = r.rows.map(row => ({
            ...row,
            last_ping: onlineStatus[row.token] || 0
        }));
        
        res.json(results);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// Жою (Иесі немесе Админ)
app.post('/delete', async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM markers_new WHERE id = $1 AND (token = $2 OR $2 = $3)', 
            [req.body.id, req.body.token, 'admin777']
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. Админ панель: VIP мақұлдау немесе күйін өзгерту
app.post('/admin-toggle', async (req, res) => {
    try {
        if (req.body.pass === "admin777") {
            await pool.query(
                'UPDATE markers_new SET is_active = $1 WHERE id = $2', 
                [req.body.active, req.body.id]
            );
            res.json({ success: true });
        } else {
            res.status(403).json({ error: "Access denied" });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
