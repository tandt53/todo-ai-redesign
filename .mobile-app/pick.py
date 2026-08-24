"""Read a UI tree on stdin, print the centre of the named collection row.

Kept out of the shell script on purpose: the Android branch needs a regex full
of square brackets, and embedding that in a bash heredoc inside a python heredoc
is how the last attempt died.
"""
import json, re, sys

plat, label = sys.argv[1], sys.argv[2]
data = sys.stdin.read()

if plat == 'ios':
    try:
        tree = json.loads(data)
    except Exception:
        sys.exit()
    for x in tree:
        if x.get('AXUniqueId') == 'menu-collection-row' and (x.get('AXLabel') or '').startswith(label):
            f = x['frame']
            print(int(f['x'] + f['width'] / 2), int(f['y'] + f['height'] / 2))
            break
else:
    for m in re.finditer(r'<node[^>]*>', data):
        node = m.group(0)
        if 'menu-collection-row' in node and label in node:
            b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
            if b:
                print((int(b.group(1)) + int(b.group(3))) // 2,
                      (int(b.group(2)) + int(b.group(4))) // 2)
            break
