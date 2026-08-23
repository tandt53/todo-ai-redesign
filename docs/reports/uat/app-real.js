// Verdicts live in this browser only — nothing is sent anywhere. Every storage
// touch is wrapped: a private window or blocked site data throws on access, and
// the page must still render and still be usable without it.
const KEY = 'uat-real-v1'
let store = {}
try { store = JSON.parse(localStorage.getItem(KEY) || '{}') } catch (e) { store = {} }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)) } catch (e) {} }
const prog = document.getElementById('prog')
const paint = () => {
  const done = Object.values(store).filter((v) => v && v.v).length
  if (prog) prog.textContent = done + ' / ' + TOTAL
}
document.querySelectorAll('.v').forEach((row) => {
  const id = row.dataset.id
  const rec = store[id] || {}
  row.querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(rec.v === b.dataset.v))
    b.addEventListener('click', () => {
      const cur = store[id] || {}
      cur.v = cur.v === b.dataset.v ? null : b.dataset.v
      store[id] = cur; save(); paint()
      row.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(cur.v === x.dataset.v)))
    })
  })
  const note = row.querySelector('.note')
  note.value = rec.note || ''
  note.addEventListener('input', () => { const c = store[id] || {}; c.note = note.value; store[id] = c; save() })
})
paint()
const lb = document.getElementById('lb')
document.querySelectorAll('.pane img').forEach((im) => im.addEventListener('click', () => {
  lb.querySelector('img').src = im.src; lb.classList.add('on')
}))
lb.addEventListener('click', () => lb.classList.remove('on'))
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.classList.remove('on') })
document.getElementById('exp').addEventListener('click', () => {
  const lines = ['bước\tkết quả\tghi chú']
  document.querySelectorAll('.v').forEach((row) => {
    const r = store[row.dataset.id] || {}
    if (r.v || r.note) lines.push(row.dataset.id + '\t' + (r.v || '') + '\t' + (r.note || ''))
  })
  const w = window.open('', '_blank')
  if (w) { w.document.write('<pre>' + lines.join('\n').replace(/</g, '&lt;') + '</pre>'); w.document.close() }
  else { alert(lines.join('\n')) }
})
