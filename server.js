const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });

console.log("WebSocket server running on port", PORT);

let clients = new Map(); // id → { ws, hp }

function broadcast(obj, except = null) {
  const msg = JSON.stringify(obj);
  for (const [id, client] of clients) {
    if (client.ws.readyState === WebSocket.OPEN && id !== except) {
      client.ws.send(msg);
    }
  }
}

wss.on("connection", ws => {
  const myId = Math.floor(Math.random() * 1_000_000);

  clients.set(myId, { ws, hp: 100 });
  console.log("Client connected:", myId);

  ws.send(JSON.stringify({ type: "init", id: myId }));

  ws.on("message", msg => {
    const data = JSON.parse(msg);

    // Position + bullets
    if (data.type === "update") {
      broadcast({ type: "state", playerId: myId, state: data.state }, myId);
    }

    // Hit / damage
    if (data.type === "hit") {
      const target = Number(data.target);
      const damage = Number(data.damage);

      if (clients.has(target)) {
        const c = clients.get(target);
        c.hp -= damage;

        // Send new HP to victim
        c.ws.send(
          JSON.stringify({ type: "hit", playerId: target, hp: c.hp })
        );

        if (c.hp <= 0) {
          // Respawn
          c.hp = 100;
          c.ws.send(
            JSON.stringify({
              type: "dead",
              playerId: target,
              hp: c.hp
            })
          );
        }
      }
    }
  });

  ws.on("close", () => {
    clients.delete(myId);
    broadcast({ type: "leave", playerId: myId });
    console.log("Client disconnected:", myId);
  });
});
