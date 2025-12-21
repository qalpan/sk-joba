const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const pool = new Pool({
  connectionString: "СІЗДІҢ_DATABASE_URL_ОСЫНДА", // Render-ден алған сілтеме
  ssl: { rejectUnauthorized: false }
});

const io = new Server(server, { cors: { origin: "*" } });
const onlineUsers = {};

// 1. Онлайн санаттарды алу API-і
app.get('/categories', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT role, 
            CASE 
                WHEN role IN ('🛠', '⚡', '🧹', '💇‍♂️') THEN 'service'
                WHEN role IN ('🛒', '💊', '📦', '🍏') THEN 'goods'
                ELSE 'other'
            END as type
            FROM locations 
            WHERE time > NOW() - INTERVAL '30 minutes'
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json([]); }
});

io.on('connection', (socket) => {
    socket.on('register', (userId) => { onlineUsers[userId] = socket.id; });

    socket.on('send_location', async (data) => {
        onlineUsers[data.id] = socket.id;
        try {
            await pool.query(
                'INSERT INTO locations (user_id, lat, lng, role) VALUES ($1, $2, $3, $4)',
                [data.id, data.lat, data.lng, data.role]
            );
        } catch (err) { console.error("DB Error"); }
        socket.broadcast.emit('receive_location', data);
    });

    socket.on('order_request', (data) => {
    const target = onlineUsers[data.to];
    if (target) {
        io.to(target).emit('order_received', { 
            from: data.from, 
            fromPhone: data.fromPhone // Телефон нөмірін қостық
        });
    }
});

socket.on('order_response', (data) => {
    const client = onlineUsers[data.toClient];
    if (client) {
        io.to(client).emit('order_final_status', { 
            status: data.status, 
            from: data.from, 
            fromPhone: data.fromPhone // Маманның нөмірі
        });
    }
});

server.listen(process.env.PORT || 3000);
