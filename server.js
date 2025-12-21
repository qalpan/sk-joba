const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const pool = new Pool({
  connectionString: "СІЗДІҢ_DATABASE_URL_ОСЫНДА", // Render-ден алған сілтемеңіз
  ssl: { rejectUnauthorized: false }
});

const io = new Server(server, { cors: { origin: "*" } });
const onlineUsers = {};

// БАЗАНЫ ЖӘНЕ БАЛАНСТЫ ДАЙЫНДАУ
pool.query(`
  CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    user_id TEXT UNIQUE, -- Әр маманның бір жолы болады
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    role TEXT,
    phone TEXT,
    balance INTEGER DEFAULT 0,
    time TIMESTAMP DEFAULT NOW()
  )
`).then(() => console.log("База дайын")).catch(err => console.error(err));

io.on('connection', (socket) => {
    
    // 1. ТЕКСЕРУ ЖӘНЕ ОРЫНДЫ ТАРАТУ
    socket.on('send_location', async (data) => {
        try {
            // Маманның балансын тексеру
            const res = await pool.query('SELECT balance FROM locations WHERE user_id = $1', [data.id]);
            const balance = res.rows[0] ? res.rows[0].balance : 0;

            if (balance <= 0) {
                socket.emit('error_message', 'Баланс 0. Жұмысқа шығу үшін төлем жасаңыз!');
                return;
            }

            // Орынды жаңарту
            await pool.query(`
                INSERT INTO locations (user_id, lat, lng, role, phone, balance) 
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (user_id) DO UPDATE 
                SET lat = $2, lng = $3, time = NOW()`,
                [data.id, data.lat, data.lng, data.role, data.phone, balance]
            );

            onlineUsers[data.id] = socket.id;
            socket.broadcast.emit('receive_location', data);
        } catch (err) { console.error(err); }
    });

    // 2. АДМИН: БАЛАНС ТОЛТЫРУ
    socket.on('admin_add_balance', async (data) => {
        await pool.query('UPDATE locations SET balance = balance + $1 WHERE user_id = $2', [data.amount, data.id]);
        console.log(`${data.id} балансы толтырылды: +${data.amount}`);
    });

    // 3. ТАПСЫРЫС ЛОГИКАСЫ (Алдыңғы кодпен бірдей)
    socket.on('order_request', (data) => {
        const target = onlineUsers[data.to];
        if (target) io.to(target).emit('order_received', data);
    });

    socket.on('order_response', (data) => {
        const client = onlineUsers[data.toClient];
        if (client) io.to(client).emit('order_final_status', data);
    });
});

server.listen(process.env.PORT || 3000);
