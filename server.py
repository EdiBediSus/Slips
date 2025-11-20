import asyncio
import json
import os
from websockets.server import serve

players = {}  # player_id -> {x, y}

async def handler(ws):
    player_id = id(ws)
    players[player_id] = {"x": 100, "y": 100}

    print("Player joined:", player_id)

    try:
        async for msg in ws:
            data = json.loads(msg)

            if data["type"] == "update":
                players[player_id] = {"x": data["x"], "y": data["y"]}

                update = {
                    "type": "players",
                    "players": players
                }

                # broadcast to all connected players
                webs = list(players.keys())
                for p in webs:
                    try:
                        await ws.send(json.dumps(update))
                    except:
                        pass

    except Exception as e:
        print("Player error:", e)

    # disconnect
    del players[player_id]
    print("Player left:", player_id)


async def main():
    port = int(os.environ.get("PORT", 10000))
    print("Starting WebSocket server on 0.0.0.0:" + str(port))

    async with serve(handler, "0.0.0.0", port):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
