const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const pool = new Pool({
  connectionString: "СІЗДІҢ_DATABASE_URL_ОСЫНДА", 
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
    // 1. Тіркелу кезінде атын нақтылау
    socket.on('register', (data) => {
        const id = typeof data === 'object' ? data.id : data;
        onlineUsers[id] = socket.id;
        console.log(`${id} желіге қосылды`);
    });

    socket.on('send_location', async (data) => {
        try {
            const res = await pool.query('SELECT balance FROM locations WHERE user_id = $1', [data.id]);
            const balance = res.rows[0] ? res.rows[0].balance : 0;

            if (balance <= 0) {
                socket.emit('error_message', 'Баланс 0. Төлем жасаңыз!');
                return;
            }

            await pool.query(`
                INSERT INTO locations (user_id, lat, lng, role, phone, balance) 
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (user_id) DO UPDATE 
                SET lat = $2, lng = $3, role = $4, phone = $5, time = NOW()`, // Role мен Phone-ды да жаңартып отырған дұрыс
                [data.id, data.lat, data.lng, data.role, data.phone, balance]
            );

            onlineUsers[data.id] = socket.id; // Қосымша сақтандыру
            socket.broadcast.emit('receive_location', data);
        } catch (err) { console.error("Location error:", err); }
    });

    socket.on('admin_add_balance', async (data) => {
        try {
            await pool.query('UPDATE locations SET balance = balance + $1 WHERE user_id = $2', [data.amount, data.id]);
            // Маманға баланс толғаны туралы хабар жіберу
            const target = onlineUsers[data.id];
            if (target) io.to(target).emit('balance_updated', data.amount);
        } catch (err) { console.error(err); }
    });

    socket.on('order_request', (data) => {
        const targetSocketId = onlineUsers[data.to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('order_received', data);
        }
    });

    socket.on('order_response', (data) => {
        const clientSocketId = onlineUsers[data.toClient];
        if (clientSocketId) {
            io.to(clientSocketId).emit('order_final_status', data);
        }
    });

    // Қосылым үзілгенде тазалау
    socket.on('disconnect', () => {
        for (let user in onlineUsers) {
            if (onlineUsers[user] === socket.id) {
                delete onlineUsers[user];
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер іске қосылды`));
