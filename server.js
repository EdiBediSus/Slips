const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 6510 });
const clients = new Map();

console.log("Server running on ws://0.0.0.0:6510");

wss.on("connection", (ws) => {
  const id = Date.now() + "-" + Math.floor(Math.random() * 1000);
  const player = { x: 400, y: 300, bullets: [], health: 3, alive: true, score: 0 };
  clients.set(ws, { id, player });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "update") {
        clients.get(ws).player = data.state;
      }
      // Broadcast all players
      const state = { type: "state", players: {} };
      clients.forEach((p, c) => {
        state.players[p.id] = p.player;
      });
      const stateMsg = JSON.stringify(state);
      clients.forEach((_, c) => { c.send(stateMsg); });
    } catch (e) {
      console.error(e);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});
