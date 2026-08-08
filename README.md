# 有給休暇管理アプリ

個人用の有給休暇管理 Web アプリです。Next.js + TypeScript + Tailwind CSS + SQLite (Prisma) で動作します。

## セットアップ手順

### 1. Node.js をインストール

Node.js をまだインストールしていない場合は公式サイトからダウンロードします。  
https://nodejs.org/ （LTS版推奨）

インストール後、PowerShell を**新しいウィンドウで開き直して**確認：

```powershell
node --version   # v20.x.x 以上
npm --version    # 10.x.x 以上
```

### 2. 依存パッケージをインストール

```powershell
cd C:\Users\yukin\projects\leave-manager
npm install
```

### 3. 環境変数ファイルを作成

プロジェクトルートに `.env` ファイルを作成します（PowerShell）：

```powershell
Set-Content -Path .env -Value 'DATABASE_URL="file:./prisma/dev.db"'
```

または `env.local.txt` の内容をコピーして `.env` にリネームしてください。

### 4. データベースをセットアップ

```powershell
npx prisma migrate dev --name init
```

> 初回のみ。`prisma/dev.db` が作成されます。

### 5. 開発サーバーを起動

```powershell
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

---

## 画面一覧

| URL | 画面 | 説明 |
|-----|------|------|
| `/` | ダッシュボード | 当年度の付与・取得・残日数サマリ |
| `/register` | 有給取得登録 | 取得日・種別・時間数を入力 |
| `/history` | 取得履歴 | 年度別一覧・削除 |
| `/settings` | 年度設定 | 付与日数の設定・編集・削除 |

## 取得種別と消化日数

| 種別 | 消化日数 |
|------|----------|
| 全休 | 1.0日 |
| 午前半休 | 0.5日 |
| 午後半休 | 0.5日 |
| 時間給 N時間 | N÷8日 |

## データ保存場所

`prisma/dev.db`（SQLite ファイル）にローカル保存されます。

---

## コマンド一覧

```powershell
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド
npm run start        # 本番サーバー起動
npx prisma studio    # DB GUI（ブラウザで操作）
```
