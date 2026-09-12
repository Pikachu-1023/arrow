const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};
let gems = [];

// 地圖障礙物座標列表 (x, y, width, height)
const obstacles = [
    { x: 300, y: 300, w: 120, h: 120 },
    { x: 1200, y: 300, w: 120, h: 120 },
    { x: 750, y: 550, w: 160, h: 100 },
    { x: 300, y: 850, w: 120, h: 120 },
    { x: 1200, y: 850, w: 120, h: 120 }
];

// 產生黃色寶石
for (let i = 0; i < 35; i++) {
    gems.push({
        id: i,
        x: Math.random() * 1500 + 50,
        y: Math.random() * 1100 + 50
    });
}

io.on('connection', (socket) => {
    console.log('玩家連線:', socket.id);

    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || '玩家',
            x: Math.floor(Math.random() * 1400) + 100,
            y: Math.floor(Math.random() * 1000) + 100,
            hp: 100,
            maxHp: 100,
            score: 0,
            level: 1,
            rotation: 0
        };

        socket.emit('initSelf', players[socket.id]);
        socket.emit('currentPlayers', players);
        socket.emit('gemsData', gems);
        socket.emit('obstaclesData', obstacles); // 傳送障礙物資料

        socket.broadcast.emit('newPlayer', players[socket.id]);
        io.emit('updateLeaderboard', players);
    });

    socket.on('playerInput', (inputData) => {
        if (players[socket.id]) {
            players[socket.id].x = inputData.x;
            players[socket.id].y = inputData.y;
            players[socket.id].rotation = inputData.rotation;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('updateLevel', (level) => {
        if (players[socket.id]) {
            players[socket.id].level = level;
            io.emit('updateLeaderboard', players);
        }
    });

    socket.on('shootArrow', (arrowData) => {
        socket.broadcast.emit('arrowFired', {
            ownerId: socket.id,
            x: arrowData.x,
            y: arrowData.y,
            angle: arrowData.angle,
            speed: arrowData.speed,
            id: Math.random().toString(36).substr(2, 9)
        });
    });

    socket.on('hitPlayer', (targetId) => {
        if (players[targetId] && players[socket.id]) {
            let damage = 20;
            players[targetId].hp -= damage;

            if (players[targetId].hp <= 0) {
                players[targetId].hp = players[targetId].maxHp;
                players[targetId].x = Math.floor(Math.random() * 1400) + 100;
                players[targetId].y = Math.floor(Math.random() * 1000) + 100;
                
                io.emit('playerRespawn', players[targetId]);
            } else {
                io.emit('playerHealthUpdate', {
                    id: targetId,
                    hp: players[targetId].hp,
                    maxHp: players[targetId].maxHp
                });
            }
        }
    });

    socket.on('collectGem', (gemId) => {
        const index = gems.findIndex(g => g.id === gemId);
        if (index !== -1) {
            io.emit('gemCollected', gemId);
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
        io.emit('updateLeaderboard', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器已啟動於 PORT ${PORT}`);
});