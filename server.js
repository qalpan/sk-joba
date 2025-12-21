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

io.on('connection', (socket) => {
    console.log('Жаңа қолданушы: ' + socket.id);

    socket.on('send_location', async (data) => {
        // МАМАН ОРНЫН БАЗАҒА САҚТАУ
        try {
            await pool.query(
                'INSERT INTO locations (user_id, lat, lng) VALUES ($1, $2, $3)',
                [data.id, data.lat, data.lng]
            );
            console.log(`Сақталды: ${data.id}`);
        } catch (err) {
            console.error("Сақтау қатесі:", err);
        }

        // Ақпаратты басқаларға тарату
        socket.broadcast.emit('receive_location', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер қосылды: ${PORT}`));
