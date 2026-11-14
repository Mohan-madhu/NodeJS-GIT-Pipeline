#!/bin/sh
# Convert a dotenv file into safe shell export statements.
# Usage: eval "$(/path/load-dotenv.sh /path/to/.env)"
python3 - "$1" <<'PY'
import shlex, sys
path = sys.argv[1]
for raw in open(path, encoding='utf-8', errors='replace'):
    line = raw.strip()
    if not line or line.startswith('#'):
        continue
    if line.startswith('export '):
        line = line[7:].lstrip()
    if '=' not in line:
        continue
    key, value = line.split('=', 1)
    key = key.strip()
    if not key or not (key[0].isalpha() or key[0] == '_'):
        continue
    if not all(c.isalnum() or c == '_' for c in key):
        continue
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        if value[0] == '"':
            value = value[1:-1].replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
        else:
            value = value[1:-1]
    print('export %s=%s' % (key, shlex.quote(value)))
PY
