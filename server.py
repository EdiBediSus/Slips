import os
import asyncio
import websockets
import json

PORT = int(os.environ.get("PORT", 6789))

players = {}  # { websocket: {x,y} }

async def handler(ws):
    # Add player
    players[ws] = {"x": 400, "y": 300}

    try:
        async for msg in ws:
            data = json.loads(msg)
            players[ws] = {"x": data["x"], "y": data["y"]}

            # Broadcast all players to everyone
            out = []
            for p in players.values():
                out.append(p)

            msg = json.dumps({"players": out})

            await asyncio.gather(*[
                c.send(msg) for c in players.keys()
            ])

    except:
        pass
    finally:
        del players[ws]

async def main():
    async with websockets.serve(handler, "0.0.0.0", PORT):
        print("Server running on", PORT)
        await asyncio.Future()

asyncio.run(main())
