const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS баптауын дұрыстау
const io = new Server(server, {
    cors: {
        origin: "*", // Барлық сайттарға рұқсат беру
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'] // Байланыс түрлерін анықтау
});

app.get('/', (req, res) => {
    res.send('Сервер жұмыс істеп тұр!');
});

io.on('connection', (socket) => {
    console.log('Жаңа қолданушы қосылды: ' + socket.id);

    socket.on('send_location', (data) => {
        console.log('Координата келді:', data);
        // Ақпаратты басқаларға тарату
        socket.broadcast.emit('receive_location', data);
    });

    socket.on('disconnect', () => {
        console.log('Қолданушы шықты');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер ${PORT} портында қосылды`);
});



const { Pool } = require('pg'); // PostgreSQL кітапханасы

// Базаға қосылу сілтемесі (Render-ден алған сілтемені осында қоясыз)
const pool = new Pool({
  connectionString: "СІЗДІҢ_DATABASE_URL_ОСЫНДА",
  ssl: { rejectUnauthorized: false }
});

// Маман орнын базаға сақтау функциясы
async function saveLocation(id, lat, lng) {
  const query = 'INSERT INTO locations (user_id, lat, lng, time) VALUES ($1, $2, $3, NOW())';
  try {
    await pool.query(query, [id, lat, lng]);
  } catch (err) {
    console.error("Базаға сақтау қатесі:", err);
  }
}

// Socket.io ішінде қолдану
socket.on('send_location', (data) => {
    saveLocation(data.id, data.lat, data.lng); // Базаға жазу
    io.emit('receive_location', data); // Басқаларға тарату
});

