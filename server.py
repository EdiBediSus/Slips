import os
import asyncio
import websockets

# Render gives you a PORT automatically
PORT = int(os.environ.get("PORT", 10000))

connected = set()

async def handler(websocket):
    connected.add(websocket)
    try:
        async for message in websocket:
            # broadcast message to all other players
            for ws in connected:
                if ws != websocket:
                    await ws.send(message)
    finally:
        connected.remove(websocket)

async def main():
    async with websockets.serve(handler, "0.0.0.0", PORT):
        print(f"Server running on port {PORT}")
        await asyncio.Future()

asyncio.run(main())
