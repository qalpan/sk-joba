const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg'); // PostgreSQL кітапханасы

const app = express();
const server = http.createServer(app);

// 1. БАЗАҒА ҚОСЫЛУ (Render-ден алған External Database URL-ді осында қойыңыз)
const pool = new Pool({
  connectionString: "СІЗДІҢ_DATABASE_URL_ОСЫНДА", 
  ssl: { rejectUnauthorized: false }
});

// 2. КЕСТЕНІ АВТОМАТТЫ ТҮРДЕ ЖАСАУ
// Бұл бөлік сервер қосылғанда базада кесте бар-жоғын тексереді
pool.query(`
  CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    time TIMESTAMP DEFAULT NOW()
  )
`).then(() => console.log("Базадағы 'locations' кестесі дайын!"))
  .catch(err => console.error("Кесте жасау қатесі:", err));

// 3. SOCKET.IO БАПТАУЫ
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.get('/', (req, res) => res.send('Сервер жұмыс істеп тұр!'));

const users = {}; // Қолданушыларды сақтау: { "Асхат": "socket_id_123" }

io.on('connection', (socket) => {
    // Қолданушы тіркелгенде оның ID-ін сақтау
    socket.on('register', (userId) => {
        users[userId] = socket.id;
        console.log(`${userId} жүйеге тіркелді`);
    });

    // Тапсырыс сигналын бағыттау
    socket.on('order_request', (data) => {
        const targetSocketId = users[data.to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('order_received', data);
        }
    });

    socket.on('send_location', (data) => {
        users[data.id] = socket.id; // Орын келген сайын ID жаңарту
        socket.broadcast.emit('receive_location', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер қосылды: ${PORT}`));


app.get('/find-nearest', async (req, res) => {
    const { lat, lng, role } = req.query;
    try {
        const result = await pool.query(`
            SELECT user_id, lat, lng, 
            (6371 * acos(cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) + sin(radians($1)) * sin(radians(lat)))) AS distance
            FROM locations
            WHERE time > NOW() - INTERVAL '10 minutes' -- Тек соңғы 10 минутта онлайн болғандар
            ORDER BY distance ASC
            LIMIT 1
        `, [lat, lng]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

