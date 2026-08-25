"""Render the mobile acceptance book, reusing uat-real.html's shell verbatim.

The head, the stylesheet and the verdict script are read out of the web book at
build time. Copying them would let the two drift, and a reviewer comparing the
halves would start wondering whether a difference they see is the product or the
paper it is printed on.
"""
import base64, html, io, os, re, sys
from PIL import Image

SHOTS = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
web = open(os.path.join(HERE, 'uat-real.html'), encoding='utf-8').read()

HEAD = web[:web.find('<nav class="toc"')]
TAIL = web[web.rfind('<script'):]

# Flows, in the order a person meets them. Each step names the scenario the app
# is opened at; the shots are whatever the capture produced for it.
FLOWS = [
    ('M1', 'Lần chạy đầu — app chưa có việc nào',
     'Người mới mở app. Trạng thái rỗng có mời gọi hành động không.',
     [('talk-idle-empty', 'Màn Talk khi chưa có gì')]),
    ('M2', 'Nói ra một việc',
     'Đường vào chính của sản phẩm: nói một câu, việc được tạo.',
     [('talk-listening', 'Đang nghe'),
      ('talk-thinking', 'Đang hiểu câu vừa nghe'),
      ('talk-applied-diff', 'Đã tạo — phần diff cho thấy cái gì vừa đổi')]),
    ('M3', 'Danh sách việc',
     'Việc đã tạo hiện ở đâu, và thanh dưới cùng trông thế nào.',
     [('tasks-empty', 'Danh sách khi chưa có việc nào'),
      ('tasks-list', 'Danh sách việc — Inbox, chưa đặt hạn'),
      ('tasks-dated', 'Danh sách việc — Today, có hạn ở cột phải'),
      ('tasks-drawer', 'Ngăn kéo Lists')]),
    ('M4', 'Khi trợ lý phải hỏi lại',
     'Câu mơ hồ thì hỏi, không đoán bừa.',
     [('talk-question-confirm', 'Hỏi xác nhận trước khi làm'),
      ('talk-question-clarify', 'Hỏi làm rõ — nhiều việc cùng khớp')]),
    ('M5', 'Xoá và hoàn tác',
     'Không mất gì: xoá rồi vẫn lấy lại được.',
     [('talk-applied-delete', 'Đã xoá'),
      ('talk-reverted', 'Đã hoàn tác'),
      ]),
    ('M6', 'Khi trợ lý không giúp được',
     'Nói thẳng chứ không đoán, và câu người dùng nói không bị mất.',
     [('talk-no-match', 'Không có việc nào khớp'),
      ('talk-error', 'Lỗi phía AI'),
      ('talk-offline', 'Mất mạng')]),
    ('M7', 'Quyền micro',
     'App phải dùng được bằng tay khi không có micro.',
     [('talk-mic-permission', 'Chưa cấp quyền micro')]),
]

PLATFORMS = [('ios', 'iPhone 16 Pro'), ('android', 'Pixel 9 Pro')]


# The book inlines every frame, so its weight is the sum of them. At capture
# resolution that was 5.7 MB across 32 images of ~1250x2800, and a browser
# decoding those on scroll leaves each pane blank until it lands — Android
# worst, because its frames are 15% larger AND second in every pair, so the
# reader sees exactly that: "the Android ones are white". Downscaling to
# BOOK_H costs nothing a reviewer can see on a screen and removes the wait.
BOOK_H = 1200


def img(plat, step):
    p = os.path.join(SHOTS, f'{plat}-{step}.png')
    if not os.path.exists(p) or os.path.getsize(p) == 0:
        return None
    im = Image.open(p)
    if im.height > BOOK_H:
        im = im.resize((round(im.width * BOOK_H / im.height), BOOK_H), Image.LANCZOS)
    buf = io.BytesIO()
    im.convert('RGB').save(buf, 'JPEG', quality=82, optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


out = [HEAD]

# The book is only honest if it says what it could not photograph, so the count
# of missing frames is computed first and printed at the top.
missing = [(f[0], s, p) for f in FLOWS for s, _ in f[3] for p, _ in PLATFORMS
           if img(p, s) is None]

out.append('<nav class="toc">')
for fid, title, _, _ in FLOWS:
    out.append(f'<a href="#{fid}"><b>{fid}</b>{html.escape(title)}</a>')
out.append('</nav>')

for fid, title, why, steps in FLOWS:
    shown = sum(1 for s, _ in steps for p, _ in PLATFORMS if img(p, s))
    out.append(f'<section class="flow" id="{fid}">')
    out.append(f'<h2><b>{fid}</b>{html.escape(title)}'
               f'<em>{len(steps)} bước · {shown} ảnh</em></h2>')
    out.append(f'<p class="why">{html.escape(why)}</p>')
    gone = [s for s, _ in steps if all(img(p, s) is None for p, _ in PLATFORMS)]
    if gone:
        out.append('<details class="cons"><summary>'
                   f'{len(gone)} bước không chụp được</summary><ul>'
                   + ''.join(f'<li>{html.escape(g)}</li>' for g in gone)
                   + '</ul></details>')
    out.append('<div class="strip">')
    first = True
    for n, (step, cap) in enumerate(steps, 1):
        panes = []
        for plat, label in PLATFORMS:
            d = img(plat, step)
            if d is None:
                continue
            panes.append(
                f'<figure class="pane"><img loading="lazy" src="data:image/jpeg;base64,{d}" '
                f'alt="{html.escape(cap)} — {label}">'
                f'<figcaption>{label}</figcaption></figure>')
        if not panes:
            continue
        if not first:
            out.append('<span class="arw" aria-hidden="true">→</span>')
        first = False
        out.append(f'<article class="card" id="{fid}-{step}">')
        out.append(f'<header class="cap"><span class="n">{n}</span>'
                   f'<span>{html.escape(cap)}</span></header>')
        out.append('<div class="shots">' + ''.join(panes) + '</div>')
        out.append(f'<div class="v" data-id="{fid}-{step}">'
                   '<button data-v="pass" title="Đạt">✓ Đạt</button>'
                   '<button data-v="fail" title="Lỗi">✕ Lỗi</button>'
                   '<button data-v="na" title="Bỏ qua">– Bỏ qua</button>'
                   '<input class="note" placeholder="ghi chú"></div>')
        out.append(f'<code>{html.escape(step)}</code>')
        out.append('</article>')
    out.append('</div></section>')

out.append('<div id="lb"><img alt=""></div>')
total = sum(1 for f in FLOWS for s, _ in f[3]
            if any(img(p, s) for p, _ in PLATFORMS))
out.append(TAIL.replace('const TOTAL=34', f'const TOTAL={total}')
               .replace("'uat-real-v1'", "'uat-mobile-v1'"))
sys.stdout.write('\n'.join(out))
