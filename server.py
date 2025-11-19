import asyncio
import websockets
import json
import uuid
import os

clients = {}
players = {}

async def handler(ws):
    # Assign a unique player ID
    player_id = str(uuid.uuid4())
    clients[player_id] = ws

    # Initialize player state
    players[player_id] = {
        "x": 400,
        "y": 300,
        "bullets": [],
        "health": 3,
        "alive": True,
        "score": 0
    }

    # Send the player their ID
    await ws.send(json.dumps({"type": "init", "id": player_id}))

    try:
        async for message in ws:
            data = json.loads(message)
            if data.get("type") == "update":
                players[player_id] = data["state"]
    finally:
        # Remove disconnected player
        del clients[player_id]
        del players[player_id]

# Broadcast all players every 50ms (~20 FPS)
async def broadcaster():
    while True:
        if clients:
            state = json.dumps({"type": "state", "players": players})
            await asyncio.gather(*(c.send(state) for c in clients.values()))
        await asyncio.sleep(0.05)

async def main():
    port = int(os.environ.get("PORT", 6510))
    async with websockets.serve(handler, "0.0.0.0", port):
        print(f"Server running on ws://0.0.0.0:{port}")
        await broadcaster()  # Run broadcaster forever

asyncio.run(main())
