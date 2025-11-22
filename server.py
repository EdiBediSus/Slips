import asyncio
import websockets
import json
import uuid
import os

players = {}
connections = {}

async def websocket_handler(ws):
    player_id = str(uuid.uuid4())

    players[player_id] = {"x": 400, "y": 300, "bullets": []}
    connections[player_id] = ws

    print("Player connected:", player_id)

    try:
        async for message in ws:
            data = json.loads(message)

            players[player_id]["x"] = data.get("x", 400)
            players[player_id]["y"] = data.get("y", 300)
            players[player_id]["bullets"] = data.get("bullets", [])

            await broadcast()

    except Exception as e:
        print("WS Error:", e)

    finally:
        del players[player_id]
        del connections[player_id]
        await broadcast()
        print("Player disconnected:", player_id)


async def broadcast():
    if not connections:
        return

    msg = json.dumps(players)
    await asyncio.gather(*(ws.send(msg) for ws in connections.values()))


# -------- FIX: Accept HTTP requests so Render doesn't crash --------
async def http_handler(reader, writer):
    response = (
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/plain\r\n"
        "Content-Length: 7\r\n\r\n"
        "ONLINE"
    )
    writer.write(response.encode())
    await writer.drain()
    writer.close()


async def main():
    port = int(os.environ.get("PORT", 10000))
    print("Running on:", port)

    # HTTP server (Render health checks)
    http_server = await asyncio.start_server(http_handler, "0.0.0.0", port)

    # WebSocket server
    ws_server = await websockets.serve(websocket_handler, "0.0.0.0", port)

    print("Servers launched!")

    await asyncio.gather(http_server.serve_forever(), ws_server.wait_closed())


asyncio.run(main())
