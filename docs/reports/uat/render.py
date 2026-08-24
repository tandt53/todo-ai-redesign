# Build the single self-contained DESIGN-MOCKUP book from manifest.json + flows.json.
#
# This photographs docs/design/assistant/screens/*.html — drawings, not the built
# product. It is NOT the UAT document: signing off on a drawing proves nothing
# about what shipped. The UAT book is render-real.py, built from the running app.
# Refuses to finish on an unmapped state or a flow pointing at a state that does
# not exist: silent coverage loss is the failure this document exists to avoid.
import json, html, base64, os, sys
TMP=os.environ['UAT_TMP']; D='docs/reports/uat'
M=json.load(open(f'{D}/manifest.json')); F=json.load(open(f'{D}/flows.json'))
PL=[("web","Web"),("ios","iOS"),("android","Android")]
NA={'app-shell/tasks-typing-kb-short':'web không có bàn phím ảo',
    'app-shell/tasks-typing-kb-long':'web không có bàn phím ảo',
    'app-shell/phone-tasks-swiped':'vuốt là cử chỉ cảm ứng'}
mapped={k for fl in F["flows"] for k,_ in fl["happy"]+fl["neg"]}
orphan=sorted(set(M)-mapped); ghost=sorted(mapped-set(M))
if orphan or ghost:
    for k in orphan: print('  CHƯA XẾP FLOW:',k,file=sys.stderr)
    for k in ghost:  print('  FLOW TRỎ SAI :',k,file=sys.stderr)
    sys.exit(f'render: {len(orphan)} trạng thái chưa xếp flow, {len(ghost)} flow trỏ sai — sửa flows.json')
b64=lambda n: base64.b64encode(open(f'{TMP}/webp/'+n.replace('.png','.webp'),'rb').read()).decode()
def card(fid,key,note,kind,n):
    sid=f"{fid}-{kind}-{n}"; got=M.get(key,{}); panes=[]
    for p,l in PL:
        f=got.get(p)
        if f: panes.append(f'<img class="sh" data-p="{p}" loading="lazy" src="data:image/webp;base64,{b64(f)}" alt="{html.escape(note)} — {l}">')
        else:
            cls='na' if key in NA else 'gap'
            panes.append(f'<div class="sh {cls}" data-p="{p}"><span>{"không áp dụng" if cls=="na" else "chưa có bản vẽ"}<br><i>{html.escape(NA.get(key,""))}</i></span></div>')
    badge=f'<span class="n">{n}</span>' if kind=='h' else '<span class="n neg">!</span>'
    return (f'<div class="card{" negc" if kind=="n" else ""}" id="{sid}"><div class="cap">{badge}<span>{html.escape(note)}</span></div>'
            f'<div class="shot">{"".join(panes)}</div><div class="v" data-id="{sid}">'
            f'<button data-v="pass" title="Đạt">✓</button><button data-v="fail" title="Lỗi">✕</button>'
            f'<button data-v="na" title="Bỏ qua">–</button><input class="note" placeholder="ghi chú"></div>'
            f'<code>{html.escape(key)}</code></div>')
flows=[];toc=[];total=0
for fl in F["flows"]:
    fid=fl["id"];total+=len(fl["happy"])+len(fl["neg"])
    toc.append(f'<a href="#{fid}"><b>{fid}</b>{html.escape(fl["title"])}</a>')
    hs='<span class="arw">→</span>'.join(card(fid,k,nt,'h',i+1) for i,(k,nt) in enumerate(fl["happy"]))
    ns="".join(card(fid,k,nt,'n',i+1) for i,(k,nt) in enumerate(fl["neg"]))
    nb=f'<div class="negwrap"><h4>Trạng thái đặc biệt &amp; lỗi của luồng này</h4><div class="strip neg">{ns}</div></div>' if ns else ''
    flows.append(f'<section class="flow" id="{fid}"><h2><b>{fid}</b>{html.escape(fl["title"])}'
                 f'<em>{len(fl["happy"])} bước · {len(fl["neg"])} đặc biệt</em></h2>'
                 f'<p class="why">{html.escape(fl["purpose"])}</p><div class="strip">{hs}</div>{nb}</section>')
CSS=open(f'{D}/style.css').read(); JS=open(f'{D}/app.js').read()
seg="".join(f'<button data-p="{p}">{l}</button>' for p,l in PL)
legend=("Mỗi luồng đọc từ trái sang phải theo mũi tên. Chọn nền tảng ở góc trên — đổi một lần, đổi cho cả trang. "
        "<b>Bấm ảnh để phóng to</b> (ảnh web nhỏ trong dải, phóng to mới đọc được chữ). Đánh dấu "
        "<b>✓ Đạt</b> / <b>✕ Lỗi</b> / <b>– Bỏ qua</b> dưới mỗi bước; kết quả lưu trong trình duyệt này, không gửi đi đâu.")
H=("<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\">"
   "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
   "<title>Bản vẽ màn hình — Todo AI · " + str(len(F["flows"])) + " luồng</title><style>" + CSS + "</style></head><body>"
   "<div class=\"top\"><h1>Bản vẽ màn hình — Todo AI</h1><span class=\"m\">" + str(len(F["flows"])) + " luồng · " + str(total) + " trạng thái</span>"
   "<div class=\"seg\">" + seg + "</div>"
   "<span id=\"prog\">0 / " + str(total) + "</span><button class=\"exp\" id=\"exp\">Xuất kết quả</button></div>"
   "<div class=\"toc\">" + "".join(toc) + "</div>"
   "<p class=\"legend\">" + legend + "</p>"
   + "".join(flows) + "<div id=\"lb\"><img alt=\"\"></div>"
   "<script>const TOTAL=" + str(total) + ";" + JS + "</script></body></html>")
open(f'{D}/design-mockups.html','w').write(H)
print(f'      {len(H)/1e6:.1f} MB · {total} bước · {len(F["flows"])} luồng')
