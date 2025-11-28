// Slips-main.zip/Slips-main/server.js
const WebSocket = require("ws");
const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });

// 🚨 Error handling for 'Address already in use' (EADDRINUSE)
wss.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`\n🚨 ERROR: Port ${PORT} is already in use. Please stop the old process or change the port.`);
    } else {
        console.error('Server error:', error.message);
    }
});

console.log("✅ WebSocket server running on port", PORT);

const MAP_CHANGE_INTERVAL = 180000; // 3 minutes

// Multiple map layouts - must match client
const MAPS = [
    // Map 1: Cross layout
    [
        {x: 0, y: 0, width: 1000, height: 20},
        {x: 0, y: 680, width: 1000, height: 20},
        {x: 0, y: 0, width: 20, height: 700},
        {x: 980, y: 0, width: 20, height: 700},
        {x: 200, y: 200, width: 200, height: 20},
        {x: 600, y: 200, width: 200, height: 20},
        {x: 200, y: 480, width: 200, height: 20},
        {x: 600, y: 480, width: 200, height: 20},
        {x: 480, y: 100, width: 20, height: 200},
        {x: 480, y: 400, width: 20, height: 200},
    ],
    
    // Map 2: Arena
    [
        {x: 0, y: 0, width: 1000, height: 20},
        {x: 0, y: 680, width: 1000, height: 20},
        {x: 0, y: 0, width: 20, height: 700},
        {x: 980, y: 0, width: 20, height: 700},
        {x: 150, y: 150, width: 100, height: 100},
        {x: 750, y: 150, width: 100, height: 100},
        {x: 150, y: 450, width: 100, height: 100},
        {x: 750, y: 450, width: 100, height: 100},
        {x: 420, y: 250, width: 80, height: 80},
        {x: 520, y: 370, width: 80, height: 80},
    ],
    
    // Map 3: Maze
    [
        {x: 0, y: 0, width: 1000, height: 20},
        {x: 0, y: 680, width: 1000, height: 20},
        {x: 0, y: 0, width: 20, height: 700},
        {x: 980, y: 0, width: 20, height: 700},
        {x: 200, y: 100, width: 20, height: 250},
        {x: 400, y: 150, width: 20, height: 400},
        {x: 600, y: 100, width: 20, height: 250},
        {x: 800, y: 150, width: 20, height: 400},
        {x: 100, y: 300, width: 150, height: 20},
        {x: 300, y: 500, width: 150, height: 20},
        {x: 550, y: 300, width: 150, height: 20},
        {x: 700, y: 500, width: 150, height: 20},
    ],
    
    // Map 4: Corridors
    [
        {x: 0, y: 0, width: 1000, height: 20},
        {x: 0, y: 680, width: 1000, height: 20},
        {x: 0, y: 0, width: 20, height: 700},
        {x: 980, y: 0, width: 20, height: 700},
        {x: 100, y: 200, width: 800, height: 20},
        {x: 100, y: 480, width: 800, height: 20},
        {x: 300, y: 50, width: 20, height: 150},
        {x: 700, y: 50, width: 20, height: 150},
        {x: 300, y: 520, width: 20, height: 150},
        {x: 700, y: 520, width: 20, height: 150},
    ],
    
    // Map 5: Open field
    [
        {x: 0, y: 0, width: 1000, height: 20},
        {x: 0, y: 680, width: 1000, height: 20},
        {x: 0, y: 0, width: 20, height: 700},
        {x: 980, y: 0, width: 20, height: 700},
        {x: 250, y: 150, width: 80, height: 20},
        {x: 670, y: 150, width: 80, height: 20},
        {x: 250, y: 530, width: 80, height: 20},
        {x: 670, y: 530, width: 80, height: 20},
        {x: 450, y: 300, width: 20, height: 100},
        {x: 550, y: 300, width: 20, height: 100},
    ]
];

let currentMapIndex = 0;
let WALLS = MAPS[currentMapIndex];

function checkWallCollision(x, y, size) {
    for(const wall of WALLS) {
        if(x + size > wall.x && 
           x - size < wall.x + wall.width &&
           y + size > wall.y && 
           y - size < wall.y + wall.height) {
            return true;
        }
    }
    return false;
}

// State: { ws, x,y,vx,vy,hp,username,color, deadUntil, kills } 
let players = new Map(); 
let lastAssigned = 1000;

// Map change timer
setInterval(() => {
    currentMapIndex = (currentMapIndex + 1) % MAPS.length;
    WALLS = MAPS[currentMapIndex];
    console.log(`🗺️ Map changed to index ${currentMapIndex}`);
    
    // Reset all players to spawn position to prevent getting stuck in walls
    for(const [id, p] of players) {
        p.x = 500;
        p.y = 350;
        p.vx = 0;
        p.vy = 0;
    }
    
    // Broadcast map change to all players
    const msg = JSON.stringify({type: "mapChange", mapIndex: currentMapIndex});
    for(const [id, p] of players) {
        if(p.ws.readyState === 1) { // OPEN
            p.ws.send(msg);
        }
    }
}, MAP_CHANGE_INTERVAL);

function broadcast(obj, except=null){
  const msg = JSON.stringify(obj);
  for(const [id,p] of players){
    if(p.ws.readyState===WebSocket.OPEN && id!==except) p.ws.send(msg);
  }
}

wss.on("connection", ws=>{
  const myId = (++lastAssigned);
  const color=["#39f","#4cd","cyan","#f66","#7c3","#ff7","#9af","#f9a"][Math.floor(Math.random()*8)];
  
  // Initialize player with deadUntil: 0 and kills: 0
  players.set(myId,{
    ws, x:500, y:350, vx:0, vy:0, hp:100,
    username:"P"+myId, color, deadUntil: 0, kills: 0
  });
  
  console.log("📡 Player connected:", myId, "| Total players:", players.size);
  
  ws.send(JSON.stringify({type:"init", id: myId, hp:100, deadUntil: 0}));
  
  // Send current map to new player
  ws.send(JSON.stringify({type:"mapChange", mapIndex: currentMapIndex}));

  let bullets = [];

  ws.on("message", raw=>{
    let data;
    try{ data=JSON.parse(raw); } catch(e){ return; }

    const me = players.get(myId);
    if(!me) return;
    
    // If player is in cooldown, ignore movement updates and bullets
    if(me.deadUntil > Date.now()) { 
        if(data.type!=="setName" && data.type!=="chat") return; 
    }

    // --- Username set ---
    if(data.type==="setName" && typeof data.name==="string"){
      me.username = data.name.slice(0,16);
      broadcast({
        type:"state", 
        playerId: myId, 
        state:{
          x: me.x, y: me.y, vx: me.vx, vy: me.vy, 
          hp: me.hp, username: me.username, color: me.color, 
          deadUntil: me.deadUntil, kills: me.kills, bullets: bullets
        }
      }, myId);
      return;
    }

    // --- Chat ---
    if(data.type==="chat" && typeof data.message==="string"){
      broadcast({
        type:"chat",
        playerId: myId,
        username: me.username,
        message: data.message.slice(0,120)
      });
      return;
    }

    // --- Player update ---
    if(data.type==="update" && data.state){
      me.x = data.state.x || me.x;
      me.y = data.state.y || me.y;
      me.vx = data.state.vx || me.vx;
      me.vy = data.state.vy || me.vy;
      if(Array.isArray(data.state.bullets)) {
        bullets = data.state.bullets;
      }
    }
  });

  // --- Main game tick: 50ms interval ---
  const interval = setInterval(()=>{
    const me = players.get(myId);
    if(!me) return;
    
    const RESP_COOLDOWN_MS = 3000;

    // --- Respawn check ---
    if (me.deadUntil > 0 && me.deadUntil <= Date.now()) {
        me.deadUntil = 0;
        me.hp = 100;
        me.x = 500; me.y = 350; me.vx = 0; me.vy = 0;
        bullets = []; // Clear bullets on respawn
        
        console.log(`✨ Player ${myId} respawned`);
        
        // Notify THIS player they respawned
        me.ws.send(JSON.stringify({type:"respawned", playerId: myId}));
        
        // Also broadcast to others so they see the respawn
        broadcast({
          type:"state", 
          playerId: myId, 
          state:{
            x: me.x, y: me.y, vx: me.vx, vy: me.vy, hp: me.hp, 
            username: me.username, color: me.color, 
            deadUntil: 0, kills: me.kills, bullets: []
          }
        }, myId);
    }

    // --- Health Regeneration: +0.5 HP every 50ms (10 HP/sec) ---
    if(me.deadUntil === 0 && me.hp < 100) { 
        me.hp = Math.min(100, me.hp + 0.5);
    }

    // --- Collision detection ---
    if (me.deadUntil === 0 && bullets.length > 0) { 
        for(const [targetId, target] of players){
          if(targetId === myId) continue;
          if(target.deadUntil > Date.now()) continue;
          
          let bulletsToRemove = [];

          bullets.forEach((bullet, bulletIndex) => {
            // Check if bullet hit a wall
            if(checkWallCollision(bullet.x, bullet.y, 6)) {
              bulletsToRemove.push(bulletIndex);
              return; // Skip player collision check for this bullet
            }
            
            const dx = bullet.x - target.x;
            const dy = bullet.y - target.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // HIT DETECTION: bullet (radius 6) + player (radius 16) = 22px
            if(distance < 22) {
              console.log(`💥 HIT! Player ${myId} hit player ${targetId} at distance ${distance.toFixed(1)}`);
              
              // Apply damage
              target.hp -= 20;
              
              // Apply knockback
              const knockX = dx * 0.1;
              const knockY = dy * 0.1;
              target.vx += knockX;
              target.vy += knockY;
              
              // Notify about the hit
              broadcast({
                type:"hit", 
                playerId: targetId, 
                hp: target.hp, 
                knock: {x: knockX, y: knockY}
              });
              
              // Mark bullet for removal
              bulletsToRemove.push(bulletIndex);

              // Check if target died
              if(target.hp <= 0){
                target.hp = 0;
                target.deadUntil = Date.now() + RESP_COOLDOWN_MS;
                target.vx = 0; // Stop movement when dead
                target.vy = 0;
                
                // Award kill
                me.kills++;
                console.log(`☠️ KILL: ${me.username} (ID:${myId}) eliminated ${target.username} (ID:${targetId}). Killer kills: ${me.kills}`);
                
                // Notify the victim directly
                target.ws.send(JSON.stringify({
                    type:"dead", 
                    playerId: targetId, 
                    deadUntil: target.deadUntil
                }));
                
                // Broadcast death to everyone else
                broadcast({
                    type:"dead", 
                    playerId: targetId, 
                    deadUntil: target.deadUntil
                });
                
                // Broadcast kill event with updated kill count
                broadcast({
                    type:"kill",
                    killerId: myId,
                    victimId: targetId,
                    killerName: me.username,
                    victimName: target.username,
                    killerKills: me.kills
                });
              }
            }
          });
          
          // Remove hit bullets (reverse order to maintain indices)
          for(let i = bulletsToRemove.length - 1; i >= 0; i--){
            bullets.splice(bulletsToRemove[i], 1);
          }
        }
    }

    // Broadcast state to all other players
    broadcast({
      type:"state", 
      playerId: myId, 
      state:{
        x: me.x, y: me.y, vx: me.vx, vy: me.vy, hp: me.hp, 
        username: me.username, color: me.color, 
        deadUntil: me.deadUntil, kills: me.kills, bullets: bullets
      }
    }, myId); 
  }, 50);

  ws.on("close", ()=>{
    clearInterval(interval);
    players.delete(myId);
    broadcast({type:"leave", playerId: myId});
    console.log("❌ Player disconnected:", myId, "| Total players:", players.size);
  });
});
