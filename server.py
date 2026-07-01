import http.server
import socketserver
import mimetypes
import sys

PORT = 8000

# Force correct MIME type mapping for Windows environments
mimetypes.init()
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('image/jpeg', '.jpg')
mimetypes.add_type('image/svg+xml', '.svg')

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent caching during development so changes show immediately
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

# Allow reuse of the port to prevent "address already in use" errors on restart
socketserver.TCPServer.allow_reuse_address = True

try:
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        print(f"Serving AURA Booth at http://localhost:{PORT}")
        print("MIME type fixes applied for CSS/JS.")
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped.")
    sys.exit(0)
except Exception as e:
    print(f"Error starting server: {e}")
    sys.exit(1)
