'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface DesignFile {
  id: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  version: number
  is_final: boolean
  notes: string | null
  created_at: string
  profiles: { id: string; display_name: string } | null
}

interface DesignFilesListProps {
  dealId: string
  initialFiles: DesignFile[]
  userId: string
}

export function DesignFilesList({ dealId, initialFiles, userId }: DesignFilesListProps) {
  const router = useRouter()
  const [files, setFiles] = useState(initialFiles)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
      // Upload to Supabase storage
      const fileName = `${dealId}/${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('design-files')
        .upload(fileName, file)

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('design-files')
        .getPublicUrl(fileName)

      // Get next version
      const maxVersion = files.reduce((max, f) => Math.max(max, f.version), 0)

      // Insert record
      const { error: insertError } = await supabase
        .from('design_files')
        .insert({
          deal_id: dealId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.name.split('.').pop() || null,
          file_size: file.size,
          version: maxVersion + 1,
          uploaded_by: userId,
        })

      if (insertError) {
        throw insertError
      }

      router.refresh()
    } catch (error) {
      console.error('Upload error:', error)
      alert('アップロードに失敗しました')
    } finally {
      setUploading(false)
    }
  }

  const handleSetFinal = async (fileId: string) => {
    try {
      // Unset all other finals
      await supabase
        .from('design_files')
        .update({ is_final: false })
        .eq('deal_id', dealId)

      // Set this one as final
      await supabase
        .from('design_files')
        .update({ is_final: true })
        .eq('id', fileId)

      router.refresh()
    } catch (error) {
      console.error('Error setting final:', error)
    }
  }

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm('このファイルを削除しますか？')) return

    try {
      // Delete from storage
      await supabase.storage
        .from('design-files')
        .remove([`${dealId}/${fileName}`])

      // Delete record
      await supabase
        .from('design_files')
        .delete()
        .eq('id', fileId)

      router.refresh()
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 8 }}>
      {/* Upload Card */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
          ファイルアップロード
        </h2>

        <div
          style={{
            border: '2px dashed #e8e8e6',
            borderRadius: 10,
            padding: 24,
            textAlign: 'center',
            backgroundColor: '#f2f2f0',
          }}
        >
          <input
            type="file"
            accept=".ai,.pdf,.png,.jpg,.jpeg,.psd,.eps"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: 'none' }}
            id="design-file-input"
          />
          <label
            htmlFor="design-file-input"
            style={{
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'block',
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#888888"
              strokeWidth="1.5"
              style={{ margin: '0 auto 12px' }}
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <div style={{ fontSize: 12, color: uploading ? '#bbbbbb' : '#888888' }}>
              {uploading ? 'アップロード中...' : 'クリックして選択'}
            </div>
            <div style={{ fontSize: 11, color: '#bbbbbb', marginTop: 4 }}>
              AI, PDF, PNG, JPG, PSD, EPS
            </div>
          </label>
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: '#888888' }}>
          <div>・バージョンは自動でインクリメント</div>
          <div>・最終確定版は1つのみ設定可能</div>
        </div>
      </div>

      {/* Files List */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
          アップロード済みファイル
        </h2>

        {files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#888888', fontSize: 13 }}>
            ファイルがありません
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <th style={thStyle}>バージョン</th>
                <th style={thStyle}>ファイル名</th>
                <th style={thStyle}>種類</th>
                <th style={thStyle}>サイズ</th>
                <th style={thStyle}>アップロード者</th>
                <th style={thStyle}>日時</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>
                        v{file.version}
                      </span>
                      {file.is_final && (
                        <span
                          style={{
                            backgroundColor: '#22c55e',
                            color: '#ffffff',
                            fontSize: 9,
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontWeight: 500,
                          }}
                        >
                          FINAL
                        </span>
                      )}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <a
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#0a0a0a', textDecoration: 'none' }}
                    >
                      {file.file_name}
                    </a>
                  </td>
                  <td style={tdStyle}>{file.file_type?.toUpperCase() || '-'}</td>
                  <td style={{ ...tdStyle, fontFamily: "'Fraunces', serif" }}>
                    {formatFileSize(file.file_size)}
                  </td>
                  <td style={tdStyle}>{file.profiles?.display_name || '-'}</td>
                  <td style={tdStyle}>{formatDate(file.created_at)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!file.is_final && (
                        <button
                          onClick={() => handleSetFinal(file.id)}
                          style={{
                            backgroundColor: '#0a0a0a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 4,
                            padding: '4px 8px',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          確定
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(file.id, file.file_name)}
                        style={{
                          backgroundColor: '#ffffff',
                          color: '#888888',
                          border: '1px solid #e8e8e6',
                          borderRadius: 4,
                          padding: '4px 8px',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 20,
  border: '1px solid rgba(0,0,0,0.06)',
  padding: '20px 22px',
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 500,
  color: '#bbbbbb',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  color: '#555555',
}
