const WebSocket = require("ws");
const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });
console.log("WebSocket server running on port", PORT);

let players = new Map(); // id -> { ws, x,y,vx,vy,hp,username,color }
let lastAssigned = 1000;
let bulletsSeen = new Set();

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

  ws.on("message", raw=>{
    let data;
    try{ data=JSON.parse(raw); } catch(e){ return; }
    if(data.type==="setName" && typeof data.name==="string"){ const p=players.get(myId); if(p)p.username=data.name.slice(0,16); return; }
    if(data.type==="hello" && typeof data.name==="string"){ const p=players.get(myId); if(p)p.username=data.name.slice(0,16); return; }
    if(data.type==="update" && data.state){
      const me=players.get(myId); if(!me) return;
      me.x=data.state.x||me.x; me.y=data.state.y||me.y;
      me.vx=data.state.vx||me.vx; me.vy=data.state.vy||me.vy;
      if(typeof data.state.hp==="number") me.hp=data.state.hp;
      if(typeof data.state.username==="string") me.username=data.state.username.slice(0,16);
      // broadcast to others
      broadcast({type:"state", playerId:myId, state:{x:me.x,y:me.y,vx:me.vx,vy:me.vy,hp:me.hp,username:me.username,color:me.color}}, myId);
    }
  });

  ws.on("close", ()=>{
    players.delete(myId);
    broadcast({type:"leave", playerId:myId});
    console.log("❌ Client disconnected:", myId);
  });
});
