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
