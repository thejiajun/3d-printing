#!/bin/bash
# UV Transfer Tool - one-click pipeline
# Usage: ./run.sh --obj <path> --glb <path|dir> [--texture <path>] [--out <dir>]
#   or:  ./run.sh  (starts HTTP server only, assumes config.json already exists)

set -e

if [ "$#" -gt 0 ]; then
  echo "=== Running UV transfer ==="
  node transfer-uv.mjs "$@"
  echo ""
fi

echo "=== Starting HTTP server on port 8765 ==="
python3 -m http.server 8765 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

sleep 0.5
open http://localhost:8765

echo "Press Ctrl+C to stop the server"
trap "kill $SERVER_PID 2>/dev/null" EXIT
wait $SERVER_PID
