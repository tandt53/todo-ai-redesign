# Web is encoded wide enough to stay READABLE when enlarged (760px); the strip
# shows it small, and a lightbox that only has the small copy is a lightbox that
# does not help. Phones are near their native width already.
from PIL import Image
import glob, os
TMP=os.environ['UAT_TMP']; os.makedirs(f'{TMP}/webp',exist_ok=True)
tot=0
for f in sorted(glob.glob(f'{TMP}/png/*.png')):
    im=Image.open(f).convert('RGB'); w,h=im.size
    mx = 760 if w>500 else 400
    if w>mx: im=im.resize((mx,round(h*mx/w)), Image.LANCZOS)
    out=f'{TMP}/webp/'+os.path.basename(f).replace('.png','.webp')
    im.save(out,'WEBP',quality=74,method=5); tot+=os.path.getsize(out)
print(f'      {tot/1e6:.1f} MB webp')
