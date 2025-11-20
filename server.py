import os
import asyncio
import websockets
import json
import uuid

PORT = int(os.environ.get("PORT", 6789))

players = {}

async def handler(ws, path):
    player_id = str(uuid.uuid4())
    players[player_id] = {"x": 400, "y": 300, "bullets": []}

    # Send ID to client
    await ws.send(json.dumps({"type": "id", "id": player_id}))

    try:
        async for message in ws:
            data = json.loads(message)
            if data.get("type") == "update":
                players[player_id] = {
                    "x": data["x"],
                    "y": data["y"],
                    "bullets": data.get("bullets", [])
                }

            # Broadcast all players to all connected clients
            if websockets.broadcast:
                broadcast_data = json.dumps({"type": "players", "players": players})
                await broadcast(ws, broadcast_data)
    finally:
        del players[player_id]

async def broadcast(sender_ws, message):
    for ws in sender_ws.server.websockets:
        if ws.open:
            await ws.send(message)

async def main():
    async with websockets.serve(handler, "0.0.0.0", PORT):
        print(f"Server started on port {PORT}")
        await asyncio.Future()  # run forever

asyncio.run(main())
