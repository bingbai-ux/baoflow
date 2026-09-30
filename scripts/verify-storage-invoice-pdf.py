"""Synthetic invoice acceptance: Unicode fields, page bounds and optional render.

Requires PyMuPDF in the isolated QA environment; does not send files anywhere.
"""
import argparse
from pathlib import Path
import fitz

p = argparse.ArgumentParser()
p.add_argument('pdf')
for field in ('number', 'amount', 'cartons', 'month', 'due', 'bank_token'):
    p.add_argument('--' + field.replace('_', '-'), required=True)
p.add_argument('--render-dir')
args = p.parse_args()
document = fitz.open(args.pdf)
text = ''.join(page.get_text() for page in document)
expected = [args.number, args.amount, args.cartons + ' CTN', args.month, args.due, args.bank_token]
assert all(value in text for value in expected), 'Invoice text fields differ from the saved synthetic snapshot'
for n, page in enumerate(document):
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                x0, y0, x1, y1 = span['bbox']
                assert min(x0, y0) >= 0 and x1 <= page.rect.width + 1 and y1 <= page.rect.height + 1, 'Text crosses page bounds'
    if args.render_dir:
        target = Path(args.render_dir)
        target.mkdir(parents=True, exist_ok=True)
        page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2)).save(target / f'{Path(args.pdf).stem}-{n + 1}.png')
print(f'PASS synthetic invoice PDF: {len(document)} page(s), Unicode fields and page bounds')
