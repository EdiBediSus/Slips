import asyncio
import websockets
import json
import uuid
from http.server import SimpleHTTPRequestHandler, HTTPServer
import threading

PORT = 8000

clients = {}
players = {}

# WebSocket server
async def ws_handler(ws):
    player_id = str(uuid.uuid4())
    clients[player_id] = ws
    players[player_id] = {"x":400,"y":300,"bullets":[],"health":3,"alive":True,"score":0}

    await ws.send(json.dumps({"type":"init","id":player_id}))

    try:
        async for msg in ws:
            data = json.loads(msg)
            if data.get("type")=="update":
                players[player_id] = data["state"]
    finally:
        del clients[player_id]
        del players[player_id]

async def broadcast():
    while True:
        if clients:
            state = json.dumps({"type":"state","players":players})
            await asyncio.gather(*(c.send(state) for c in clients.values()))
        await asyncio.sleep(0.05)

def start_ws():
    asyncio.set_event_loop(asyncio.new_event_loop())
    loop = asyncio.get_event_loop()
    start_server = websockets.serve(ws_handler, "0.0.0.0", 8765)
    loop.run_until_complete(start_server)
    loop.run_until_complete(broadcast())
    loop.run_forever()

# Start HTTP server to serve index.html
def start_http():
    server = HTTPServer(('0.0.0.0', PORT), SimpleHTTPRequestHandler)
    print(f"Serving HTTP on port {PORT}")
    server.serve_forever()

# Start both servers
threading.Thread(target=start_ws).start()
threading.Thread(target=start_http).start()
