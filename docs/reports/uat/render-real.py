# Build the self-contained UAT book from manifest-real.json.
#
# Every image here is a photograph of the running product (capture-real.mjs),
# never a mockup. The page is one file with the images embedded: an earlier
# version referenced a sibling shots/ folder and broke the moment it was opened
# on its own.
#
# Coverage guard: every captured PNG must be claimed by exactly one step, and
# every step must own at least one image. A UAT book that silently drops a
# screenshot is worse than one that never claimed to cover it.
import json, html, base64, os, sys, glob

TMP = os.environ['UAT_TMP']; D = 'docs/reports/uat'
M = json.load(open(f'{D}/manifest-real.json'))
VP = [('wide', 'Khổ rộng · 1280'), ('narrow', 'Khổ hẹp · 390')]

claimed = {f for fl in M['flows'] for s in fl['steps'] for f in s['img'].values()}
on_disk = {os.path.basename(p) for p in glob.glob(f'{TMP}/png/*.png')}
orphan, ghost = sorted(on_disk - claimed), sorted(claimed - on_disk)
empty = [f"{fl['id']}/{s['name']}" for fl in M['flows'] for s in fl['steps'] if not s['img']]
if orphan or ghost or empty:
    for k in orphan: print('  ẢNH KHÔNG THUỘC BƯỚC NÀO:', k, file=sys.stderr)
    for k in ghost:  print('  BƯỚC TRỎ VÀO ẢNH KHÔNG CÓ:', k, file=sys.stderr)
    for k in empty:  print('  BƯỚC KHÔNG CÓ ẢNH NÀO   :', k, file=sys.stderr)
    sys.exit(f'render: {len(orphan)} ảnh thừa, {len(ghost)} ảnh thiếu, {len(empty)} bước rỗng')

b64 = lambda n: base64.b64encode(open(f"{TMP}/webp/" + n.replace('.png', '.webp'), 'rb').read()).decode()

def card(fid, step, n):
    sid = f"{fid}-{step['name']}"
    neg = step['kind'] == 'neg'
    panes = []
    for vp, label in VP:
        f = step['img'].get(vp)
        if f:
            panes.append(f'<figure class="pane"><img loading="lazy" src="data:image/webp;base64,{b64(f)}" '
                         f'alt="{html.escape(step["caption"])} — {label}"><figcaption>{label}</figcaption></figure>')
    badge = '<span class="n neg">!</span>' if neg else f'<span class="n">{n}</span>'
    return (f'<article class="card{" negc" if neg else ""}" id="{sid}">'
            f'<header class="cap">{badge}<span>{html.escape(step["caption"])}</span></header>'
            f'<div class="shots">{"".join(panes)}</div>'
            f'<div class="v" data-id="{sid}">'
            f'<button data-v="pass" title="Đạt">✓ Đạt</button>'
            f'<button data-v="fail" title="Lỗi">✕ Lỗi</button>'
            f'<button data-v="na" title="Bỏ qua">– Bỏ qua</button>'
            f'<input class="note" placeholder="ghi chú"></div>'
            f'<code>{html.escape(step["name"])}</code></article>')

sections, toc, total = [], [], 0
for fl in M['flows']:
    happy = [s for s in fl['steps'] if s['kind'] != 'neg']
    negs  = [s for s in fl['steps'] if s['kind'] == 'neg']
    total += len(fl['steps'])
    toc.append(f'<a href="#{fl["id"]}"><b>{fl["id"]}</b>{html.escape(fl["title"])}</a>')
    hs = '<span class="arw" aria-hidden="true">→</span>'.join(card(fl['id'], s, i + 1) for i, s in enumerate(happy))
    ns = ''.join(card(fl['id'], s, i + 1) for i, s in enumerate(negs))
    nb = (f'<div class="negwrap"><h3>Trạng thái đặc biệt &amp; lỗi của luồng này</h3>'
          f'<div class="strip">{ns}</div></div>') if ns else ''
    only = '' if len(fl.get('viewports', [])) == 2 else \
        f'<span class="only">chỉ {"khổ rộng" if fl["viewports"] == ["wide"] else "khổ hẹp"}</span>'
    cons = ''
    if fl.get('console'):
        items = ''.join(f'<li>{html.escape(c)}</li>' for c in fl['console'])
        cons = f'<details class="cons"><summary>{len(fl["console"])} lỗi console khi chạy luồng này</summary><ul>{items}</ul></details>'
    sections.append(
        f'<section class="flow" id="{fl["id"]}"><h2><b>{fl["id"]}</b>{html.escape(fl["title"])}{only}'
        f'<em>{len(happy)} bước · {len(negs)} đặc biệt</em></h2>'
        f'<p class="why">{html.escape(fl["purpose"])}</p>{cons}'
        f'<div class="strip">{hs}</div>{nb}</section>')

fails = ''
if M['failures']:
    rows = ''.join(f'<li><b>{f["flow"]}</b> · {f["viewport"]} — {html.escape(f["error"])}</li>' for f in M['failures'])
    fails = (f'<section class="flow blocked"><h2>Không chạy được</h2>'
             f'<p class="why">Những bước dưới đây không lái được trên bản đang chạy. Mỗi dòng là một phát hiện '
             f'của UAT, không phải lỗi của tài liệu.</p><ul class="fails">{rows}</ul></section>')

CSS = open(f'{D}/style-real.css').read(); JS = open(f'{D}/app-real.js').read()
note = ('Mọi ảnh trong tài liệu này chụp từ <b>sản phẩm đang chạy</b> (web client trên Vite + API thật), '
        'không phải từ bản vẽ. <b>Client mobile (React Native) không có mặt ở đây</b> — nó không có đường chạy '
        'trong trình duyệt, nên chưa chụp được. Hai cột là cùng một web client ở hai khổ màn hình: '
        '1280 (hai khung, thêm việc bằng dòng trong danh sách) và 390 (một khung, thêm việc bằng thanh dưới).')
H = ('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
     f'<title>Sổ nghiệm thu Todo AI</title>'
     '<link rel="preconnect" href="https://fonts.googleapis.com">'
     '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
     '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&'
     'family=IBM+Plex+Sans:wght@400;500;600&display=swap">'
     f'<style>{CSS}</style>'
     '<div class="top"><h1>Sổ nghiệm thu Todo AI</h1>'
     f'<span class="m">{len(M["flows"])} luồng · {total} bước · chụp {html.escape(M["captured_at"])}</span>'
     f'<span id="prog">0 / {total}</span><button class="exp" id="exp">Xuất kết quả</button></div>'
     f'<p class="legend">{note}</p>'
     f'<nav class="toc">{"".join(toc)}</nav>'
     + ''.join(sections) + fails +
     '<div id="lb"><img alt=""></div>'
     f'<script>const TOTAL={total};{JS}</script>')
open(f'{D}/uat-real.html', 'w').write(H)
print(f'      {len(H)/1e6:.1f} MB · {total} bước · {len(M["flows"])} luồng · {len(M["failures"])} bước hỏng')
