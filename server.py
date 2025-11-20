import asyncio
import websockets
import json

players = {}

async def handler(ws, path):
    player_id = id(ws)
    players[player_id] = {"x": 400, "y": 300, "bullets": []}
    print(f"Player {player_id} connected")

    try:
        async for message in ws:
            data = json.loads(message)

            if data["type"] == "update":
                players[player_id] = data["state"]

            # broadcast state to this player
            for pid, state in players.items():
                if pid != player_id:
                    await ws.send(json.dumps({
                        "type": "state",
                        "playerId": pid,
                        "state": state
                    }))
    except:
        pass
    finally:
        del players[player_id]
        print(f"Player {player_id} disconnected")

start_server = websockets.serve(handler, "0.0.0.0", 10000)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
