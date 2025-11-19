import asyncio
import websockets
import json
import uuid
from http.server import SimpleHTTPRequestHandler, HTTPServer
import threading

# HTTP settings
HTTP_PORT = 8000
WS_PORT = 8765

clients = {}  # player_id -> websocket
players = {}  # player_id -> player state

# WebSocket handler
async def ws_handler(ws):
    player_id = str(uuid.uuid4())
    clients[player_id] = ws
    players[player_id] = {
        "x": 400,
        "y": 300,
        "bullets": [],
        "health": 3,
        "alive": True,
        "score": 0
    }

    # Tell client their ID
    await ws.send(json.dumps({"type":"init","id":player_id}))

    try:
        async for msg in ws:
            data = json.loads(msg)
            if data.get("type") == "update":
                players[player_id] = data["state"]
    finally:
        del clients[player_id]
        del players[player_id]

# Broadcast all player states every 50ms
async def broadcast():
    while True:
        if clients:
            state = json.dumps({"type":"state","players":players})
            await asyncio.gather(*(ws.send(state) for ws in clients.values()))
        await asyncio.sleep(0.05)

# Start WebSocket server
def start_ws():
    asyncio.set_event_loop(asyncio.new_event_loop())
    loop = asyncio.get_event_loop()
    server = websockets.serve(ws_handler, "0.0.0.0", WS_PORT)
    loop.run_until_complete(server)
    loop.run_until_complete(broadcast())
    loop.run_forever()

# Start HTTP server to serve index.html
def start_http():
    httpd = HTTPServer(('0.0.0.0', HTTP_PORT), SimpleHTTPRequestHandler)
    print(f"Serving HTTP on port {HTTP_PORT}")
    httpd.serve_forever()

# Run both servers in threads
threading.Thread(target=start_ws).start()
threading.Thread(target=start_http).start()
