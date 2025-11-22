import asyncio
import websockets
import json
import uuid

players = {}

async def handler(ws):
    player_id = str(uuid.uuid4())
    players[player_id] = {"x": 400, "y": 300, "bullets": []}

    try:
        async for msg in ws:
            data = json.loads(msg)

            players[player_id] = {
                "x": data.get("x", 0),
                "y": data.get("y", 0),
                "bullets": data.get("bullets", [])
            }

            await broadcast()
    except:
        pass
    finally:
        del players[player_id]
        await broadcast()

async def broadcast():
    if players:
        msg = json.dumps(players)
        await asyncio.wait([ws.send(msg) for ws in list(websockets.server.WebSocketServerProtocol.instances)])

async def main():
    server = await websockets.serve(handler, "0.0.0.0", 10000)
    await server.wait_closed()

asyncio.run(main())
