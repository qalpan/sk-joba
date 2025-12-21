const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Барлық жерден қосылуға рұқсат
});

io.on('connection', (socket) => {
    console.log('Қолданушы қосылды');

    // Маманнан дерек келгенде, оны барлығына тарату
    socket.on('send_location', (data) => {
        io.emit('receive_location', data);
    });

    socket.on('disconnect', () => {
        console.log('Қолданушы шықты');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер ${PORT} портында қосулы`);
});
