const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });


console.log("WebSocket server running on port", PORT);

let clients = new Map();

function broadcast(obj, except = null) {
  const msg = JSON.stringify(obj);
  for (const [id, ws] of clients) {
    if (ws.readyState === WebSocket.OPEN && id !== except) ws.send(msg);
  }
}

wss.on("connection", ws => {
  const myId = Math.floor(Math.random() * 1000000);
  clients.set(myId, ws);
  console.log("Client connected:", myId);

  ws.on("message", message => {
    const data = JSON.parse(message);

    if (data.type === "update") {
      // broadcast player position + bullets to everyone else
      broadcast({ type: "state", playerId: myId, state: data.state }, myId);
    }
  });

  ws.on("close", () => {
    clients.delete(myId);
    broadcast({ type: "leave", playerId: myId });
    console.log("Client disconnected:", myId);
  });
});
