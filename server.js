// server.js
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });

console.log("WebSocket server starting on port", PORT);

let players = new Map(); // id -> { ws, x,y,vx,vy, hp, username, color }
let lastAssigned = 1000;
let bulletsSeen = new Set(); // dedupe bullet ids briefly

function broadcast(obj, except = null){
  const msg = JSON.stringify(obj);
  for (const [id, p] of players){
    if (p.ws.readyState === WebSocket.OPEN && id !== except) {
      p.ws.send(msg);
    }
  }
}

function randColor(){
  const colors = ["#39f","#4cd","cyan","#f66","#7c3","#ff7","#9af","#f9a"];
  return colors[Math.floor(Math.random()*colors.length)];
}

wss.on("connection", ws => {
  const myId = (++lastAssigned);
  const color = randColor();
  players.set(myId, { ws, x: 400, y: 300, vx:0, vy:0, hp:100, username: "P"+myId, color });

  console.log("Client connected:", myId);
  ws.send(JSON.stringify({ type: "init", id: myId, hp: 100 }));

  ws.on("message", raw => {
    let data;
    try { data = JSON.parse(raw); } catch(e) { return; }

    // setName from client
    if (data.type === "setName" && typeof data.name === "string"){
      const p = players.get(myId);
      if (p){ p.username = data.name.slice(0,16); }
      return;
    }

    if (data.type === "hello"){
      const p = players.get(myId);
      if (p && data.name) p.username = data.name.slice(0,16);
      return;
    }

    if (data.type === "update" && data.state){
      const state = data.state;
      const me = players.get(myId);
      if (!me) return;
      // update authoritative position snapshot
      me.x = state.x ?? me.x;
      me.y = state.y ?? me.y;
      me.vx = state.vx ?? me.vx;
      me.vy = state.vy ?? me.vy;
      if (typeof state.hp === "number") me.hp = state.hp;
      if (typeof state.username === "string") me.username = state.username.slice(0,16);

      // server processes bullets sent by this client
      if (Array.isArray(state.bullets)){
        for (const b of state.bullets){
          if (!b || !b.id) continue;
          if (bulletsSeen.has(b.id)) continue;
          bulletsSeen.add(b.id);
          // expire bullet id after a short time
          setTimeout(()=> bulletsSeen.delete(b.id), 5000);

          // compute collision vs all other players
          for (const [otherId, other] of players){
            if (otherId === myId) continue;
            // simple hitbox radius
            const dist2 = (b.x - other.x)*(b.x - other.x) + (b.y - other.y)*(b.y - other.y);
            const hitRadius = 18*18; // squared
            if (dist2 <= hitRadius){
              // apply damage
              other.hp -= (b.damage || 20);
              if (other.hp < 0) other.hp = 0;

              // compute knockback vector from shooter to victim
              const dx = other.x - b.x;
              const dy = other.y - b.y;
              const len = Math.hypot(dx, dy) || 1;
              const nx = (dx/len);
              const ny = (dy/len);
              const knockStrength = (b.knock || 1) *  ( (b.damage || 20) / 20 ) * 8; // scale
              other.vx = (other.vx || 0) + nx * knockStrength;
              other.vy = (other.vy || 0) + ny * knockStrength;

              // notify victim (authoritative HP + knock)
              if (other.ws.readyState === WebSocket.OPEN){
                other.ws.send(JSON.stringify({
                  type: "hit",
                  playerId: otherId,
                  hp: other.hp,
                  knock: { x: nx*knockStrength*0.9, y: ny*knockStrength*0.9 }
                }));
              }

              // notify shooter (optional)
              const shooter = players.get(myId);
              if (shooter && shooter.ws.readyState === WebSocket.OPEN){
                shooter.ws.send(JSON.stringify({
                  type: "playerHitOther",
                  playerId: otherId,
                  hp: other.hp
                }));
              }

              // if dead -> respawn after short delay
              if (other.hp <= 0){
                setTimeout(()=>{
                  other.hp = 100;
                  // teleport somewhere safe (center)
                  other.x = 450 + Math.floor(Math.random()*80-40);
                  other.y = 300 + Math.floor(Math.random()*80-40);
                  if (other.ws.readyState === WebSocket.OPEN){
                    other.ws.send(JSON.stringify({ type: "dead", playerId: otherId, hp: other.hp }));
                  }
                }, 700);
              }

              // one bullet hits at most one player
              break;
            }
          }
        }
      }

      // broadcast this player's state to everyone else
      broadcast({ type: "state", playerId: myId, state: {
        x: me.x, y: me.y, vx: me.vx, vy: me.vy, hp: me.hp, username: me.username, color: me.color
      }}, myId);

    } // update
  });

  ws.on("close", () => {
    players.delete(myId);
    broadcast({ type: "leave", playerId: myId });
    console.log("Client disconnected:", myId);
  });
});

