const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const pool = new Pool({
  connectionString: "СІЗДІҢ_DATABASE_URL_ОСЫНДА", // Render-ден алған сілтемені қойыңыз
  ssl: { rejectUnauthorized: false }
});

const io = new Server(server, { cors: { origin: "*" } });
const onlineUsers = {}; // { "Асхат": { socketId: "...", phone: "..." } }

// Санаттарды алу
app.get('/categories', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT role, 
            CASE 
                WHEN role IN ('🛠', '⚡', '🧹', '💇‍♂️') THEN 'service'
                WHEN role IN ('🛒', '💊', '📦', '🍏') THEN 'goods'
                ELSE 'other'
            END as type
            FROM locations WHERE time > NOW() - INTERVAL '30 minutes'
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json([]); }
});

io.on('connection', (socket) => {
    socket.on('register', (data) => {
        onlineUsers[data.id] = { socketId: socket.id, phone: data.phone };
    });

    socket.on('send_location', async (data) => {
        onlineUsers[data.id] = { socketId: socket.id, phone: data.phone };
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
            io.to(target.socketId).emit('order_received', { from: data.from, fromPhone: data.fromPhone });
        }
    });

    socket.on('order_response', (data) => {
        const client = onlineUsers[data.toClient];
        if (client) {
            io.to(client.socketId).emit('order_final_status', { 
                status: data.status, 
                from: data.from, 
                fromPhone: data.fromPhone 
            });
        }
    });

    // Рейтингті сақтау
    socket.on('submit_rating', async (data) => {
        try {
            await pool.query('INSERT INTO ratings (provider_id, rating) VALUES ($1, $2)', [data.to, data.stars]);
        } catch (err) { console.error("Rating save error"); }
    });

    socket.on('disconnect', () => {
        for (let id in onlineUsers) {
            if (onlineUsers[id].socketId === socket.id) delete onlineUsers[id];
        }
    });
});

server.listen(process.env.PORT || 3000);
