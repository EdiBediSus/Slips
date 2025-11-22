import os
import asyncio
import websockets
import json
import uuid
import time

players = {}
connections = {}
last_broadcast = 0

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
        print("Error with player", player_id, e)
    finally:
        print("Player disconnected:", player_id)
        del players[player_id]
        del connections[player_id]
        await broadcast()

async def broadcast():
    global last_broadcast
    now = time.time()
    if now - last_broadcast < 0.05:
        return
    last_broadcast = now

    if not connections:
        return

    message = json.dumps(players)
    await asyncio.gather(*(ws.send(message) for ws in connections.values()))

async def http_handler(reader, writer):
    response = (
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/plain\r\n"
        "Content-Length: 2\r\n\r\n"
        "OK"
    )
    writer.write(response.encode())
    await writer.drain()
    writer.close()

async def main():
    port = int(os.environ.get("PORT", 10000))
    print("Starting server on port", port)

    http_server = await asyncio.start_server(http_handler, "0.0.0.0", port)
    ws_server = await websockets.serve(websocket_handler, "0.0.0.0", port)

    await asyncio.gather(
        http_server.serve_forever(),
        ws_server.wait_closed()
    )

if __name__ == "__main__":
    asyncio.run(main())
