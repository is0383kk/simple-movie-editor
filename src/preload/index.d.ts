import type { EditorApi } from '@shared/types'

// renderer 側から window.editor を型付きで参照できるようにする
declare global {
  interface Window {
    editor: EditorApi
  }
}

export {}
