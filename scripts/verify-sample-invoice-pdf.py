"""Local synthetic PDF content and bounds acceptance. Requires the existing PDF QA venv."""
import argparse
from pathlib import Path
import fitz

p = argparse.ArgumentParser()
p.add_argument('pdf')
p.add_argument('--render-dir')
args = p.parse_args()
document = fitz.open(args.pdf)
text = ''.join(page.get_text() for page in document)
for expected in ['サンプル費用請求書', 'Synthetic sample customer', 'Synthetic pouch', 'Synthetic second product', '1回目', '2回目', '2個', '製作費', 'FedEx', '1,650', '2026-10-01', '2026-10-31', 'Synthetic payment details', 'Synthetic sample issuer']:
    assert expected in text, 'Synthetic sample invoice field missing: ' + expected
assert '¥1,500' in text and '¥150' in text, 'Net/tax amounts differ from frozen synthetic snapshot'
for index, page in enumerate(document):
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                x0, y0, x1, y1 = span['bbox']
                assert min(x0, y0) >= 0 and x1 <= page.rect.width + 1 and y1 <= page.rect.height + 1, 'Sample PDF text crosses page bounds'
    if args.render_dir:
        target = Path(args.render_dir)
        target.mkdir(parents=True, exist_ok=True)
        page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2)).save(target / f'sample-invoice-{index + 1}.png')
print(f'PASS synthetic sample PDF: {len(document)} page(s), product/round/quantity/charges/dates/issuer and page bounds')
