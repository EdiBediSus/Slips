import asyncio
from websockets.server import serve
import json
import os

players = {}  # { player_id: {"x":0, "y":0} }

async def handler(ws):
    player_id = id(ws)
    players[player_id] = {"x": 100, "y": 100}

    print("Player joined:", player_id)

    try:
        async for msg in ws:
            data = json.loads(msg)

            if data["type"] == "update":
                players[player_id] = {"x": data["x"], "y": data["y"]}

                # broadcast to all players
                update = {
                    "type": "players",
                    "players": players
                }

                webs = list(players.keys())
                for p in webs:
                    try:
                        await ws.send(json.dumps(update))
                    except:
                        pass

    except:
        pass

    # player leaves
    del players[player_id]
    print("Player left:", player_id)


async def main():
    port = int(os.environ.get("PORT", 10000))
    print("Starting server on port", port)

    async with serve(handler, "0.0.0.0", port):
        await asyncio.Future()

asyncio.run(main())
