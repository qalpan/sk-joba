const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const onlineUsers = {};

pool.query(`
  CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    user_id TEXT UNIQUE,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    role TEXT,
    phone TEXT,
    balance INTEGER DEFAULT 0,
    time TIMESTAMP DEFAULT NOW()
  )
`).then(() => console.log("База дайын")).catch(err => console.error(err));

io.on('connection', (socket) => {
    
    socket.on('send_location', async (data) => {
        try {
            // 1. Базадан маманды тексеру
            let res = await pool.query('SELECT balance FROM locations WHERE user_id = $1', [data.id]);
            
            // Егер маман базада жоқ болса, оны 100 бонуспен тіркей салайық (сынақ үшін)
            if (res.rows.length === 0) {
                await pool.query(
                    'INSERT INTO locations (user_id, balance, role, phone) VALUES ($1, 100, $2, $3)', 
                    [data.id, data.role, data.phone]
                );
                res = await pool.query('SELECT balance FROM locations WHERE user_id = $1', [data.id]);
            }

            const balance = res.rows[0].balance;

            if (balance <= 0) {
                socket.emit('error_message', 'Баланс 0. Төлем жасаңыз!');
                return;
            }

            // 2. Орынды жаңарту
            await pool.query(`
                UPDATE locations 
                SET lat = $2, lng = $3, role = $4, phone = $5, time = NOW() 
                WHERE user_id = $1`,
                [data.id, data.lat, data.lng, data.role, data.phone]
            );

            onlineUsers[data.id] = socket.id;
            socket.broadcast.emit('receive_location', data); // Барлығына тарату
        } catch (err) { console.error(err); }
    });

    socket.on('admin_add_balance', async (data) => {
        await pool.query('UPDATE locations SET balance = balance + $1 WHERE user_id = $2', [data.amount, data.id]);
        console.log(`Баланс толтырылды: ${data.id}`);
    });

    socket.on('order_request', (data) => {
        const target = onlineUsers[data.to];
        if (target) io.to(target).emit('order_received', data);
    });

    socket.on('order_response', (data) => {
        const client = onlineUsers[data.toClient];
        if (client) io.to(client).emit('order_final_status', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер қосылды`));

app.post('/save-location', async (req, res) => {
    const { name, phone, job, lat, lon } = req.body;

    // 1. Барлық өрістің толтырылғанын тексеру
    if (!name || !phone || !job) {
        return res.status(400).json({ error: "Барлық өрісті толтырыңыз!" });
    }

    // 2. Телефон нөмірін тексеру (мысалы, тек 11 сан)
    const phoneRegex = /^[0-9]{11}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: "Телефон нөмірі қате! (11 сан болуы керек)" });
    }

    // 3. Аты-жөні тым қысқа болмауы керек
    if (name.length < 2) {
        return res.status(400).json({ error: "Аты-жөні тым қысқа!" });
    }

    try {
        // Осы жерде барып қана базаға сақтаймыз
        await pool.query('INSERT INTO users ...');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).send("Сервер қатесі");
    }
});
