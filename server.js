const WebSocket = require("ws");
const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });
console.log("WebSocket server running on port", PORT);

let players = new Map(); // id -> { ws, x,y,vx,vy,hp,username,color }
let lastAssigned = 1000;

function broadcast(obj, except=null){
  const msg = JSON.stringify(obj);
  for(const [id,p] of players){
    if(p.ws.readyState===WebSocket.OPEN && id!==except) p.ws.send(msg);
  }
}

wss.on("connection", ws=>{
  const myId = (++lastAssigned);
  const color=["#39f","#4cd","cyan","#f66","#7c3","#ff7","#9af","#f9a"][Math.floor(Math.random()*8)];
  players.set(myId,{ws,x:400,y:300,vx:0,vy:0,hp:100,username:"P"+myId,color});
  console.log("📡 New client connected:", myId);
  ws.send(JSON.stringify({type:"init", id: myId, hp:100}));

  let bullets = [];

  ws.on("message", raw=>{
    let data;
    try{ data=JSON.parse(raw); } catch(e){ return; }

    const me = players.get(myId);
    if(!me) return;

    // --- Username set ---
    if(data.type==="setName" && typeof data.name==="string"){
      me.username = data.name.slice(0,16);
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
      if(typeof data.state.hp==="number") me.hp=data.state.hp;
      if(typeof data.state.username==="string") me.username = data.state.username.slice(0,16);
      if(Array.isArray(data.state.bullets)) bullets = data.state.bullets.slice();
    }
  });

  // --- Main game tick: check bullet collisions and broadcast ---
  const interval = setInterval(()=>{
    const me = players.get(myId); // ✅ Fix ReferenceError
    if(!me) return;

    for(const [id,p] of players){
      if(id===myId) continue;
      bullets.forEach(b=>{
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        if(Math.hypot(dx,dy)<20){ // collision
          p.hp -= 20;
          p.vx += dx*0.1;
          p.vy += dy*0.1;
          broadcast({type:"hit", playerId:id, hp:p.hp, knock:{x:dx*0.1, y:dy*0.1}});
          bullets = bullets.filter(bb=>bb!==b);
          if(p.hp <= 0){
            p.hp = 100;
            p.x = 400; p.y = 300; p.vx=0; p.vy=0;
            broadcast({type:"dead", playerId:id, hp:p.hp});
          }
        }
      });
    }

    // broadcast own state to others
    broadcast({type:"state", playerId: myId, state:{
      x: me.x, y: me.y, vx: me.vx, vy: me.vy, hp: me.hp, username: me.username, color: me.color
    }});
  }, 50);

  ws.on("close", ()=>{
    clearInterval(interval);
    players.delete(myId);
    broadcast({type:"leave", playerId: myId});
    console.log("❌ Client disconnected:", myId);
  });
});
