"""Close partially connected Socket.IO transports as well as live connections."""


async def close_client(client):
    """Always release Engine.IO's owned HTTP session after connection cancellation."""
    try:
        await client.shutdown()
    finally:
        await client.eio.disconnect(abort=True)
