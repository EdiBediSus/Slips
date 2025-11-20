import asyncio
import websockets
import json
import uuid

players = {}
bullets = []

async def handler(ws, path):
    player_id = str(uuid.uuid4())
    players[player_id] = {"x": 400, "y": 300, "bullets": []}

    print(f"[+] Player {player_id} connected")

    try:
        # send player id
        await ws.send(json.dumps({"type": "id", "id": player_id}))

        async for msg in ws:
            data = json.loads(msg)

            if data["type"] == "update":
                players[player_id]["x"] = data["state"]["x"]
                players[player_id]["y"] = data["state"]["y"]
                players[player_id]["bullets"] = data["state"]["bullets"]

            # send world state to all players
            state = {
                "type": "state",
                "players": players
            }
            msg = json.dumps(state)

            # broadcast
            await asyncio.gather(*(p.send(msg) for p in list(ws.server.websockets) if p.open))

    except:
        pass

    finally:
        print(f"[-] Player {player_id} disconnected")
        del players[player_id]

async def main():
    async with websockets.serve(handler, "0.0.0.0", 10000):
        print("Server running on port 10000")
        await asyncio.Future()

asyncio.run(main())
