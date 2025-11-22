import asyncio
import websockets
import json
import uuid
import os

players = {}
connections = {}

async def handler(ws):
    player_id = str(uuid.uuid4())
    players[player_id] = {"x": 400, "y": 300, "bullets": []}
    connections[player_id] = ws

    try:
        async for message in ws:
            data = json.loads(message)

            players[player_id] = {
                "x": data.get("x", 400),
                "y": data.get("y", 300),
                "bullets": data.get("bullets", [])
            }

            await broadcast()
    except:
        pass
    finally:
        del players[player_id]
        del connections[player_id]
        await broadcast()

async def broadcast():
    if not connections:
        return
    msg = json.dumps(players)
    await asyncio.gather(*[ws.send(msg) for ws in connections.values()])

async def main():
    port = int(os.environ.get("PORT", 10000))
    print("Server running on port:", port)
    async with websockets.serve(handler, "0.0.0.0", port):
        await asyncio.Future()

asyncio.run(main())
