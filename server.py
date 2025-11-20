import asyncio
import json
import os
from websockets.server import serve

players = {}       # player_id -> {x, y}
connections = set()  # all connected websockets


async def broadcast(message):
    """Send message to all connected players."""
    dead = []
    for ws in connections:
        try:
            await ws.send(message)
        except:
            dead.append(ws)

    # remove dead connections
    for ws in dead:
        connections.remove(ws)


async def handler(ws):
    connections.add(ws)

    player_id = id(ws)
    players[player_id] = {"x": 100, "y": 100}

    print("Player joined:", player_id)

    try:
        async for msg in ws:
            data = json.loads(msg)

            if data["type"] == "update":
                # update this player
                players[player_id]["x"] = data["x"]
                players[player_id]["y"] = data["y"]

                # send ALL players to ALL clients
                packet = json.dumps({
                    "type": "players",
                    "players": players
                })

                await broadcast(packet)

    except Exception as e:
        print("Error:", e)

    # disconnect cleanup
    del players[player_id]
    connections.remove(ws)
    print("Player left:", player_id)

    # notify others
    await broadcast(json.dumps({
        "type": "players",
        "players": players
    }))


async def main():
    port = int(os.environ.get("PORT", 10000))
    print("WS Server running on port", port)

    async with serve(handler, "0.0.0.0", port):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
