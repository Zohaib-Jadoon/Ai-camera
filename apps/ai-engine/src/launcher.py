"""Reserve the service port before importing expensive AI models."""
import argparse
import socket
import sys


def reserve_port(host, port):
    """Return an owned listening socket, or fail without importing the engine."""
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        listener.bind((host, port))
        listener.listen(128)
        listener.set_inheritable(True)
        return listener
    except BaseException:
        listener.close()
        raise


def main():
    """Run Uvicorn against the already-reserved socket, including reload mode."""
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--reload', action='store_true')
    args = parser.parse_args()
    try:
        listener = reserve_port(args.host, args.port)
    except OSError as error:
        print(f'Cannot start AI engine on {args.host}:{args.port}: {error}. '
              'If another engine is running, use that instance or stop it first. No AI models were loaded.', file=sys.stderr)
        return 1
    try:
        import uvicorn
        config = uvicorn.Config('src.main:app', host=args.host, port=args.port, reload=args.reload)
        server = uvicorn.Server(config)
        if config.should_reload:
            from uvicorn.supervisors import ChangeReload
            ChangeReload(config, target=server.run, sockets=[listener]).run()
        else:
            server.run(sockets=[listener])
        return 0 if server.started or args.reload else 1
    finally:
        listener.close()


if __name__ == '__main__':
    raise SystemExit(main())
