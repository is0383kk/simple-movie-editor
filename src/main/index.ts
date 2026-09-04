import { app, shell, BrowserWindow, protocol } from 'electron'
import { join } from 'path'
import { promises as fsp, createReadStream } from 'fs'
import { Readable } from 'stream'
import { registerIpcHandlers } from './ipc'

// ローカル動画を <video> で再生するためのカスタムスキーム。
// file:// を直接使うと http origin(dev) から webSecurity で弾かれるため、
// 専用プロトコル svemedia:// を用意してローカルファイルを配信する（外部送信なし）。
// シーク（任意位置への移動）には HTTP Range 対応が必須なため、
// 下の protocol.handle で Range ヘッダを解釈して 206 Partial Content を返す。
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'svemedia',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  }
])

const MEDIA_PREFIX = 'svemedia://file/'

/** 拡張子から Content-Type を推定 */
function contentType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop()
  switch (ext) {
    case 'mp4':
    case 'm4v':
      return 'video/mp4'
    case 'webm':
      return 'video/webm'
    case 'mov':
      return 'video/quicktime'
    case 'mkv':
      return 'video/x-matroska'
    case 'avi':
      return 'video/x-msvideo'
    default:
      return 'application/octet-stream'
  }
}

/** Node の Readable を Web ReadableStream に変換して Response ボディに使う */
function toResponseBody(stream: Readable): ReadableStream {
  return Readable.toWeb(stream) as unknown as ReadableStream
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    title: 'シンプル動画編集',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // svemedia://file/<encodeURIComponent(絶対パス)> をローカルファイルへ解決して配信。
  // Range ヘッダがあれば該当バイト範囲のみを 206 で返す（動画のシークに必要）。
  protocol.handle('svemedia', async (request) => {
    const encoded = request.url.slice(MEDIA_PREFIX.length)
    const filePath = decodeURIComponent(encoded)

    let size: number
    try {
      const stat = await fsp.stat(filePath)
      size = stat.size
    } catch {
      return new Response('File not found', { status: 404 })
    }

    const type = contentType(filePath)
    const rangeHeader = request.headers.get('Range')

    if (rangeHeader) {
      // 例: "bytes=1000-" / "bytes=1000-2000"
      const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
      let start = match && match[1] !== '' ? parseInt(match[1], 10) : 0
      let end = match && match[2] !== '' ? parseInt(match[2], 10) : size - 1
      if (Number.isNaN(start) || start < 0) start = 0
      if (Number.isNaN(end) || end >= size) end = size - 1
      if (start > end) {
        start = 0
        end = size - 1
      }
      return new Response(toResponseBody(createReadStream(filePath, { start, end })), {
        status: 206,
        headers: {
          'Content-Type': type,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes'
        }
      })
    }

    return new Response(toResponseBody(createReadStream(filePath)), {
      status: 200,
      headers: {
        'Content-Type': type,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes'
      }
    })
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
