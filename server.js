const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};
let gems = [];

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

    // 接收玩家加入與名字
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

        // 發送初始資訊給新玩家
        socket.emit('initSelf', players[socket.id]);
        socket.emit('currentPlayers', players);
        socket.emit('gemsData', gems);

        // 廣播給其他玩家
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // 玩家移動與旋轉同步
    socket.on('playerInput', (inputData) => {
        if (players[socket.id]) {
            players[socket.id].x = inputData.x;
            players[socket.id].y = inputData.y;
            players[socket.id].rotation = inputData.rotation;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 發射箭矢同步
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

    // 處理擊中扣血邏輯
    socket.on('hitPlayer', (targetId) => {
        if (players[targetId] && players[socket.id]) {
            let damage = 20;
            players[targetId].hp -= damage;

            if (players[targetId].hp <= 0) {
                // 重置死亡玩家血量與位置
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

   // 吃寶石
       socket.on('collectGem', (gemId) => {
           const index = gems.findIndex(g => g.id === gemId);
           if (index !== -1) {
               // 先通知所有玩家該寶石已被吃掉
               io.emit('gemCollected', gemId);
   
               // 更新寶石位置並重新生成
               gems[index] = {
                   id: gemId,
                   x: Math.random() * 1500 + 50,
                   y: Math.random() * 1100 + 50
               };
               io.emit('gemSpawn', gems[index]);
           }
       });

    // 離線處理
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