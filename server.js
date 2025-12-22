const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
app.use(cors()); app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ӨШІРУ ФУНКЦИЯСЫ (Қатесіз нұсқа)
app.post('/delete-item', async (req, res) => {
    const { id, type, token } = req.body;
    const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
    try {
        const query = (token === 'ADMIN') ? 
            `DELETE FROM ${table} WHERE id = $1` : 
            `DELETE FROM ${table} WHERE id = $1 AND device_token = $2`;
        const result = await pool.query(query, token === 'ADMIN' ? [id] : [id, token]);
        res.json({ success: true, count: result.rowCount });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// БАСҚА API-ЛЕР (Сақтау және алу бұрынғыша)
app.get('/get-all', async (req, res) => {
    const w = await pool.query('SELECT * FROM workers WHERE is_active = TRUE');
    const g = await pool.query('SELECT * FROM goods WHERE is_active = TRUE');
    const o = await pool.query('SELECT * FROM orders');
    res.json({ workers: w.rows, goods: g.rows, orders: o.rows });
});

// [Алдыңғы жауаптағы save-worker, save-goods, save-order кодтарын осында қосыңыз]

app.listen(process.env.PORT || 10000);
