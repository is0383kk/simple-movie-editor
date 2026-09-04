# シンプル動画編集アプリ

個人利用向けの軽量な動画編集アプリ。  
動画の **切り出し / 範囲削除 / 結合** を GUI から素早く行えます。  
動画処理は同梱の **FFmpeg**（ffmpeg-static / ffprobe-static）で行い、ローカル完結・外部送信なしで動作します。

![](img\img001.png)

## 技術構成

- **Electron + React + TypeScript**（scaffold: electron-vite）
- **FFmpeg / ffprobe をアプリに同梱**（別途インストール不要）

## セットアップ

```bash
npm install
```

## 開発モードで起動

```bash
npm run dev
```
