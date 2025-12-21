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

// Онлайн қолданушыларды тіркеу ({ "Асхат": "socket_id" })
const onlineUsers = {};

io.on('connection', (socket) => {
    console.log('Жаңа қосылым:', socket.id);

    // Маман немесе клиент өзін тіркегенде
    socket.on('register', (userId) => {
        onlineUsers[userId] = socket.id;
        console.log(`${userId} жүйеге тіркелді`);
    });

    // Орынды сақтау және тарату
    socket.on('send_location', async (data) => {
        onlineUsers[data.id] = socket.id; // Socket ID-ді жаңарту
        try {
            await pool.query(
                'INSERT INTO locations (user_id, lat, lng) VALUES ($1, $2, $3)',
                [data.id, data.lat, data.lng]
            );
        } catch (err) { console.error("DB Error"); }
        socket.broadcast.emit('receive_location', data);
    });

    // ТАПСЫРЫС ЖІБЕРУ ЛОГИКАСЫ
    socket.on('order_request', (data) => {
        const targetSocketId = onlineUsers[data.to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('order_received', {
                from: data.from,
                clientSocketId: socket.id
            });
        }
    });

    // МАМАН ЖАУАБЫН КЛИЕНТКЕ ЖЕТКІЗУ
    socket.on('order_response', (data) => {
        const clientSocketId = onlineUsers[data.toClient];
        if (clientSocketId) {
            io.to(clientSocketId).emit('order_final_status', {
                status: data.status,
                providerName: data.from
            });
        }
    });

    socket.on('disconnect', () => {
        for (let user in onlineUsers) {
            if (onlineUsers[user] === socket.id) delete onlineUsers[user];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер іске қосылды: ${PORT}`));

app.get('/active-categories', async (req, res) => {
    const result = await pool.query(`
        SELECT DISTINCT role FROM locations 
        WHERE time > NOW() - INTERVAL '10 minutes'
    `);
    res.json(result.rows); // Тек қазір жұмыс істеп тұрған санаттарды қайтарады
});






