import { contextBridge, ipcRenderer } from 'electron'
import type {
  EditorApi,
  ClipRequest,
  TrimRequest,
  MergeRequest,
  ExportProgress
} from '@shared/types'

const MEDIA_PREFIX = 'svemedia://file/'

// renderer へ公開する API。ここが唯一の橋渡し（contextIsolation により安全）。
const api: EditorApi = {
  openVideo: () => ipcRenderer.invoke('dialog:openVideo'),
  openVideos: () => ipcRenderer.invoke('dialog:openVideos'),
  saveDialog: (defaultName: string) => ipcRenderer.invoke('dialog:save', defaultName),
  probe: (filePath: string) => ipcRenderer.invoke('video:probe', filePath),
  toFileUrl: (filePath: string) => MEDIA_PREFIX + encodeURIComponent(filePath),
  exportClip: (req: ClipRequest) => ipcRenderer.invoke('export:clip', req),
  exportTrim: (req: TrimRequest) => ipcRenderer.invoke('export:trim', req),
  exportMerge: (req: MergeRequest) => ipcRenderer.invoke('export:merge', req),
  onProgress: (cb: (p: ExportProgress) => void) => {
    const listener = (_e: unknown, payload: ExportProgress): void => cb(payload)
    ipcRenderer.on('export:progress', listener)
    return () => ipcRenderer.removeListener('export:progress', listener)
  }
}

contextBridge.exposeInMainWorld('editor', api)
