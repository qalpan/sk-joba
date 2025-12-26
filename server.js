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
    } catch (err) { console.error("База қатесі:", err); }
}
initDB();

let onlineUsers = {};

// 3-талап: 24 сағаттық сүзгі
app.get('/ads', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM ads WHERE created_at > NOW() - INTERVAL '24 hours'");
        const data = result.rows.map(ad => ({
            ...ad,
            is_online: (Date.now() - (onlineUsers[ad.token] || 0)) < 45000
        }));
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4-талап: VIP БҰҒАТТАУ (Ең маңызды жері осында!)
app.post('/save', async (req, res) => {
    const { name, job, type, tel, email, lat, lon, is_vip, token } = req.body;
    
    // ТҮЗЕТУ: "true" мәтіні келсе де, true логикасы келсе де VIP деп тану
    const isVipBool = (is_vip === true || is_vip === 'true');
    
    // Егер VIP болса - active=false (жасыру), болмаса - active=true (көрсету)
    const active = isVipBool ? false : true; 

    try {
        await pool.query(
            "INSERT INTO ads (name, job, type, tel, email, lat, lon, is_vip, is_active, token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            [name, job, type, tel, email, lat, lon, isVipBool, active, token]
        );
        res.json({ success: true });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Қате" }); 
    }
});

app.post('/admin-toggle', async (req, res) => {
    const { id, active, pass } = req.body;
    if (pass === "admin777") {
        await pool.query("UPDATE ads SET is_active = $1 WHERE id = $2", [active, id]);
        res.json({ success: true });
    } else { res.status(403).send("Рұқсат жоқ"); }
});

app.post('/delete', async (req, res) => {
    const { id, token } = req.body;
    await pool.query("DELETE FROM ads WHERE id = $1 AND token = $2", [id, token]);
    res.json({ success: true });
});

app.post('/ping', (req, res) => {
    onlineUsers[req.body.token] = Date.now();
    res.send("ok");
});

app.listen(process.env.PORT || 3000);
