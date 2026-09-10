const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};
let gems = [];

for (let i = 0; i < 30; i++) {
    gems.push({
        id: i,
        x: Math.random() * 1500 + 50,
        y: Math.random() * 1100 + 50
    });
}

io.on('connection', (socket) => {
    console.log('玩家連線:', socket.id);

    players[socket.id] = {
        id: socket.id,
        x: Math.floor(Math.random() * 1400) + 100,
        y: Math.floor(Math.random() * 1000) + 100,
        hp: 100,
        maxHp: 100,
        score: 0,
        level: 1,
        arrowSpeed: 600,
        fireRate: 300,
        arrowCount: 1
    };

    socket.emit('currentPlayers', players);
    socket.emit('gemsData', gems);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerInput', (inputData) => {
        if (players[socket.id]) {
            players[socket.id].x = inputData.x;
            players[socket.id].y = inputData.y;
            players[socket.id].rotation = inputData.rotation;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('shootArrow', (arrowData) => {
        socket.broadcast.emit('arrowFired', {
            ownerId: socket.id,
            x: arrowData.x,
            y: arrowData.y,
            angle: arrowData.angle,
            speed: arrowData.speed
        });
    });

    socket.on('collectGem', (gemId) => {
        const index = gems.findIndex(g => g.id === gemId);
        if (index !== -1) {
            gems[index] = {
                id: gemId,
                x: Math.random() * 1500 + 50,
                y: Math.random() * 1100 + 50
            };
            io.emit('gemSpawn', gems[index]);
        }
    });

    socket.on('disconnect', () => {
        console.log('玩家離線:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器已啟動於 PORT ${PORT}`);
});