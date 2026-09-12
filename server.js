const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};
let gems = [];

const obstacles = [
    { x: 300, y: 300, w: 120, h: 120 },
    { x: 1200, y: 300, w: 120, h: 120 },
    { x: 750, y: 550, w: 160, h: 100 },
    { x: 300, y: 850, w: 120, h: 120 },
    { x: 1200, y: 850, w: 120, h: 120 }
];

for (let i = 0; i < 35; i++) {
    gems.push({
        id: i,
        x: Math.random() * 1500 + 50,
        y: Math.random() * 1100 + 50
    });
}

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || '玩家',
            x: Math.floor(Math.random() * 1400) + 100,
            y: Math.floor(Math.random() * 1000) + 100,
            hp: 100,
            maxHp: 100,
            level: 1,
            rotation: 0
        };

        socket.emit('initSelf', players[socket.id]);
        socket.emit('currentPlayers', players);
        socket.emit('gemsData', gems);
        socket.emit('obstaclesData', obstacles);

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
            piercing: arrowData.piercing,
            id: Math.random().toString(36).substr(2, 9)
        });
    });

    socket.on('hitPlayer', (data) => {
        const targetId = data.targetId;
        const damage = data.damage || 20;

        if (players[targetId] && players[socket.id]) {
            players[targetId].hp -= damage;

            // 吸血回血機制
            if (data.lifesteal && data.lifesteal > 0) {
                players[socket.id].hp = Math.min(
                    players[socket.id].maxHp,
                    players[socket.id].hp + Math.floor(damage * data.lifesteal)
                );
                socket.emit('playerHealthUpdate', {
                    id: socket.id,
                    hp: players[socket.id].hp,
                    maxHp: players[socket.id].maxHp
                });
            }

            // 死亡與擊殺結算
            if (players[targetId].hp <= 0) {
                // 重置受害者（等級、血量歸零重來）
                players[targetId].hp = 100;
                players[targetId].maxHp = 100;
                players[targetId].level = 1;
                players[targetId].x = Math.floor(Math.random() * 1400) + 100;
                players[targetId].y = Math.floor(Math.random() * 1000) + 100;

                // 擊殺者獎勵大量經驗值（150點）
                socket.emit('killReward', { exp: 150, victimName: players[targetId].name });

                io.emit('playerRespawn', players[targetId]);
                io.emit('updateLeaderboard', players);
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
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
        io.emit('updateLeaderboard', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器已啟動於 PORT ${PORT}`);
});