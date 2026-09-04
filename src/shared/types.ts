// ============================================================================
// IPC コントラクト層（shared）
// main / preload / renderer が共通で参照する型定義。
// ここを固定し、実装層は差し替え可能にする（過度な抽象化はしない）。
// ============================================================================

/** 動画ファイルのメタ情報（ffprobe から取得） */
export interface VideoInfo {
  /** 絶対パス */
  filePath: string
  /** ファイル名（拡張子込み） */
  fileName: string
  /** 動画長（秒） */
  duration: number
  /** 幅（px） */
  width: number
  /** 高さ（px） */
  height: number
  /** フレームレート（fps） */
  fps: number
  /** 映像コーデック名（例: h264） */
  videoCodec: string
  /** 音声コーデック名（例: aac）。音声なしは null */
  audioCodec: string | null
}

/** 書き出し処理の種類 */
export type ExportKind = 'clip' | 'trim' | 'merge'

/** クリップ切り出しリクエスト */
export interface ClipRequest {
  input: string
  output: string
  /** 開始（秒） */
  start: number
  /** 終了（秒） */
  end: number
}

/** 範囲削除リクエスト（start〜end を取り除く） */
export interface TrimRequest {
  input: string
  output: string
  /** 削除開始（秒） */
  start: number
  /** 削除終了（秒） */
  end: number
}

/** 動画結合リクエスト（inputs の順番で連結） */
export interface MergeRequest {
  inputs: string[]
  output: string
}

/** 書き出し進捗イベント（main → renderer へ push） */
export interface ExportProgress {
  jobId: string
  kind: ExportKind
  /** 0〜100。算出不能なフェーズでは null */
  percent: number | null
  /** 現在の追加情報メッセージ（任意） */
  message?: string
}

/** 処理結果 */
export interface ExportResult {
  jobId: string
  success: boolean
  output?: string
  /** 失敗時のユーザー向けメッセージ */
  error?: string
  /** 再エンコードにフォールバックした等の補足 */
  note?: string
}

/** ファイル選択ダイアログのフィルタ結果 */
export interface OpenResult {
  canceled: boolean
  filePath?: string
}

export interface OpenMultipleResult {
  canceled: boolean
  filePaths: string[]
}

export interface SaveResult {
  canceled: boolean
  filePath?: string
}

/** preload で contextBridge 経由に公開する API の型 */
export interface EditorApi {
  /** 単一動画を開く */
  openVideo: () => Promise<OpenResult>
  /** 結合用に複数動画を開く */
  openVideos: () => Promise<OpenMultipleResult>
  /** 保存先を尋ねる */
  saveDialog: (defaultName: string) => Promise<SaveResult>
  /** 動画情報取得 */
  probe: (filePath: string) => Promise<VideoInfo>
  /** ローカルファイルを <video> で再生できる URL に変換 */
  toFileUrl: (filePath: string) => string
  /** クリップ切り出し */
  exportClip: (req: ClipRequest) => Promise<ExportResult>
  /** 範囲削除 */
  exportTrim: (req: TrimRequest) => Promise<ExportResult>
  /** 結合 */
  exportMerge: (req: MergeRequest) => Promise<ExportResult>
  /** 進捗イベント購読。返り値は解除関数 */
  onProgress: (cb: (p: ExportProgress) => void) => () => void
}
