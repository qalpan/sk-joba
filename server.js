const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// CORS-ты кеңейтілген түрде баптау
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// БАЗАНЫ ЖАҢАРТУ: Қателерге төзімді функция
async function initDB() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Негізгі кестелерді құру
        await client.query(`
            CREATE TABLE IF NOT EXISTS workers (
                id SERIAL PRIMARY KEY, name TEXT, phone TEXT, job TEXT, 
                lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, device_token TEXT, 
                expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            
            CREATE TABLE IF NOT EXISTS goods (
                id SERIAL PRIMARY KEY, seller_name TEXT, product_name TEXT, price TEXT, phone TEXT, 
                lat DOUBLE PRECISION, lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, device_token TEXT, 
                expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);

        // 2. created_at бағанының бар-жоғын тексеріп, жоқ болса қосу
        const tables = ['workers', 'goods'];
        for (let table of tables) {
            const res = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='${table}' AND column_name='created_at'
            `);
            if (res.rowCount === 0) {
                await client.query(`ALTER TABLE ${table} ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
                console.log(`Added created_at to ${table}`);
            }
        }
        
        await client.query('COMMIT');
        console.log("Database updated successfully.");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("DB Init Error, continuing...", err);
    } finally {
        client.release();
    }
}
initDB();

// API-лерді try-catch блогымен қорғау (сервер құламауы үшін)
app.get('/admin/pending', async (req, res) => {
    try {
        const w = await pool.query(`SELECT id, name, job as info, phone, 'worker' as type, to_char(created_at, 'DD.MM HH24:MI') as date_text FROM workers WHERE is_active = FALSE`);
        const g = await pool.query(`SELECT id, seller_name as name, product_name as info, phone, 'good' as type, to_char(created_at, 'DD.MM HH24:MI') as date_text FROM goods WHERE is_active = FALSE`);
        res.json([...w.rows, ...g.rows]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

app.get('/get-all', async (req, res) => {
    try {
        const workers = await pool.query('SELECT * FROM workers WHERE is_active = TRUE');
        const goods = await pool.query('SELECT * FROM goods WHERE is_active = TRUE');
        const orders = await pool.query('SELECT * FROM orders');
        res.json({ workers: workers.rows, goods: goods.rows, orders: orders.rows });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// Қалған API-лерді (save-worker, save-goods) өзгеріссіз қалдырыңыз...
// [Осы жерге алдыңғы save-worker, save-goods кодтарын қойыңыз]

app.listen(process.env.PORT || 10000, () => {
    console.log("Server is running...");
});
