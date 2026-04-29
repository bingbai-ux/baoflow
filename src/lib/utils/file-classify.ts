// Sprint 7-4-2-A (§0.5-1): 添付ファイルの拡張子から file_type カテゴリを決定。
// upload action と表示側 (Sprint 7-4-2-B の Masonry) で共通利用。

export type FileType = 'image' | 'pdf' | 'zip' | 'design' | 'document' | 'other'

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'svg', 'bmp']
const PDF_EXTS = ['pdf']
const ZIP_EXTS = ['zip', 'rar', '7z', 'tar', 'gz']
const DESIGN_EXTS = ['ai', 'psd', 'eps', 'sketch', 'fig', 'xd', 'indd']
const DOCUMENT_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf']

export function classifyFile(extension: string | null | undefined): FileType {
  if (!extension) return 'other'
  const ext = extension.replace(/^\./, '').toLowerCase().trim()
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (PDF_EXTS.includes(ext)) return 'pdf'
  if (ZIP_EXTS.includes(ext)) return 'zip'
  if (DESIGN_EXTS.includes(ext)) return 'design'
  if (DOCUMENT_EXTS.includes(ext)) return 'document'
  return 'other'
}

/**
 * Returns the lowercase extension without leading dot, or '' if filename has none.
 * 'photo.JPG' → 'jpg'、'archive.tar.gz' → 'gz'、'README' → ''
 */
export function getExtension(filename: string | null | undefined): string {
  if (!filename) return ''
  const idx = filename.lastIndexOf('.')
  if (idx === -1 || idx === filename.length - 1) return ''
  return filename.slice(idx + 1).toLowerCase()
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return '-'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const idx = Math.min(i, units.length - 1)
  const num = bytes / Math.pow(1024, idx)
  return `${num.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}
