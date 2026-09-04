// ============================================================================
// IPC ハンドラ登録
// renderer からの要求を受け、ダイアログ表示・ffprobe・書き出しを実行する。
// 書き出し進捗は 'export:progress' チャンネルで renderer へ push する。
// ============================================================================
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { probeVideo } from './ffmpeg/probe'
import { exportClip, exportTrim, exportMerge } from './ffmpeg/executor'
import type {
  ClipRequest,
  TrimRequest,
  MergeRequest,
  ExportKind,
  ExportProgress,
  ExportResult
} from '@shared/types'

const VIDEO_FILTERS = [
  { name: '動画ファイル', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'] },
  { name: 'すべてのファイル', extensions: ['*'] }
]

/** 保存先の書き込み可否を事前チェック（ディレクトリに書けるか） */
async function ensureWritable(outputPath: string): Promise<void> {
  const dir = outputPath.replace(/[\\/][^\\/]*$/, '')
  try {
    await fs.access(dir, fs.constants.W_OK)
  } catch {
    throw new Error('保存先フォルダに書き込みできません。別の場所を選んでください。')
  }
}

/** 進捗送信用のヘルパを生成 */
function makeProgressSender(win: BrowserWindow, jobId: string, kind: ExportKind) {
  return (percent: number | null, message?: string): void => {
    const payload: ExportProgress = { jobId, kind, percent, message }
    if (!win.isDestroyed()) win.webContents.send('export:progress', payload)
  }
}

/** 書き出し系ハンドラの共通ラッパ（jobId 発行・エラー整形） */
async function runExport(
  win: BrowserWindow,
  kind: ExportKind,
  output: string,
  task: (progress: ReturnType<typeof makeProgressSender>) => Promise<{ note?: string }>
): Promise<ExportResult> {
  const jobId = randomUUID()
  const progress = makeProgressSender(win, jobId, kind)
  try {
    await ensureWritable(output)
    const { note } = await task(progress)
    return { jobId, success: true, output, note }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { jobId, success: false, error: message }
  }
}

export function registerIpcHandlers(): void {
  // --- ダイアログ ---
  ipcMain.handle('dialog:openVideo', async () => {
    const result = await dialog.showOpenDialog({
      title: '動画を開く',
      properties: ['openFile'],
      filters: VIDEO_FILTERS
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }
    return { canceled: false, filePath: result.filePaths[0] }
  })

  ipcMain.handle('dialog:openVideos', async () => {
    const result = await dialog.showOpenDialog({
      title: '結合する動画を追加',
      properties: ['openFile', 'multiSelections'],
      filters: VIDEO_FILTERS
    })
    if (result.canceled) return { canceled: true, filePaths: [] }
    return { canceled: false, filePaths: result.filePaths }
  })

  ipcMain.handle('dialog:save', async (_e, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      title: '保存先を指定',
      defaultPath: defaultName,
      filters: VIDEO_FILTERS
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    return { canceled: false, filePath: result.filePath }
  })

  // --- 情報取得 ---
  ipcMain.handle('video:probe', async (_e, filePath: string) => {
    return probeVideo(filePath)
  })

  // --- 書き出し ---
  ipcMain.handle('export:clip', async (e, req: ClipRequest): Promise<ExportResult> => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    return runExport(win, 'clip', req.output, (progress) => exportClip(req, progress))
  })

  ipcMain.handle('export:trim', async (e, req: TrimRequest): Promise<ExportResult> => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    return runExport(win, 'trim', req.output, (progress) => exportTrim(req, progress))
  })

  ipcMain.handle('export:merge', async (e, req: MergeRequest): Promise<ExportResult> => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    return runExport(win, 'merge', req.output, (progress) => exportMerge(req, progress))
  })
}
