const WebSocket = require("ws");

const port = process.env.PORT || 6510;
const wss = new WebSocket.Server({ port });
const clients = new Map();

console.log("Server running on ws://0.0.0.0:" + port);

wss.on("connection", (ws) => {
  const id = Date.now() + "-" + Math.floor(Math.random() * 1000);
  const player = { x: 400, y: 300, bullets: [], health: 3, alive: true, score: 0 };
  clients.set(ws, { id, player });

  // Send the assigned ID to the client
  ws.send(JSON.stringify({ type: "init", id }));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "update") {
        clients.get(ws).player = data.state;
      }
    } catch (e) {
      console.error(e);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});

// Broadcast all players 20 times per second
setInterval(() => {
  const state = { type: "state", players: {} };
  clients.forEach((p, ws) => {
    state.players[p.id] = p.player;
  });
  const msg = JSON.stringify(state);
  clients.forEach((_, ws) => ws.send(msg));
}, 50); // 50ms = 20 FPS
