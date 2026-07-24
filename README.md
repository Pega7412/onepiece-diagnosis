# Pachi Safety Net

パチスロ・パチンコで感情任せに打ってしまうユーザー向けの、スマホファーストなセーフティネット＆収支管理WebアプリのMVPです。外部パッケージの新規インストールができない環境でも確認できるよう、標準のHTML / CSS / JavaScriptとLocalStorageだけで動作します。

## ディレクトリ構成

```text
index.html        # スマホUIのHTML構造、下部タブ、入力フォーム
styles.css        # ダークテーマ、スマホ幅、片手操作向けCTAのスタイル
app.js            # 危険度判定、LocalStorage収支管理、敗因レポート、画面切り替え
start-mobile.bat  # Windowsで携帯確認用サーバーを自動起動
```

## 主要機能

- 下部タブで片手操作しやすいスマートフォン専用レイアウト
- 厳選3機種（北斗 転生2、L 東京喰種、アイムジャグラーEX）の危険度判定
- 収支・敗因タグのLocalStorage保存と簡易レポート
- 感情打ちを抑える機種別ボーダーライン確認カード

## 携帯で試す（一番簡単な方法）

### PRをマージした後（推奨）

このリポジトリにはGitHub Pagesへの自動公開設定が含まれています。画面右上の「PRを表示する」からPRを開いてマージすると、GitHubの **Actions → Deploy Pachi Safety Net** に携帯で開ける公開URLが表示されます。初回だけ、リポジトリの **Settings → Pages → Source** を `GitHub Actions` にしてください。以降は変更をマージするたびに同じURLへ自動反映されるため、接続やZIPの再取得は不要です。

### Windows PC経由で確認する

PCと携帯を同じWi-Fiにつないで、次の3ステップだけで確認できます。

1. リポジトリのZIPをWindows PCへダウンロードして展開します。
2. 展開したフォルダー内の **`start-mobile.bat` をダブルクリック**します。
3. 黒い画面に表示された `MOBILE: http://...:4173` を携帯のSafariまたはChromeへ入力します。

黒い画面はアプリを使っている間、そのまま開いておいてください。終了は黒い画面で `Ctrl+C` を押します。初回にWindowsの確認が出たら「プライベート ネットワーク」を許可してください。

> [!IMPORTANT]
> `/workspace/onepiece-diagnosis` は、この開発環境内だけに存在するパスです。WindowsのPowerShellから直接移動することはできません。先にこのリポジトリをZIPでダウンロード（またはGitでclone）し、PC上の保存先へ移動してください。

## 手動で起動する場合

例えばZIPを展開して `C:\Users\あなたの名前\Downloads\onepiece-diagnosis` に保存した場合、PowerShellでは次のように実行します。

```powershell
cd "$HOME\Downloads\onepiece-diagnosis"
py -m http.server 4173 --bind 0.0.0.0
```

`py` が見つからず、Pythonを `python` コマンドで起動できる環境では、代わりに以下を使います。

```powershell
python -m http.server 4173 --bind 0.0.0.0
```

PCのブラウザで `http://localhost:4173` を開いてください。終了するときはPowerShellで `Ctrl+C` を押します。依存パッケージのインストールは不要です。

### 同じWi-Fiの携帯から確認する

1. 上記のサーバーを起動したまま、別のPowerShellで `ipconfig` を実行します。
2. Wi-Fi欄の「IPv4 Address」（例: `192.168.1.20`）を確認します。
3. PCと携帯が同じWi-Fiにつながっていることを確認します。
4. 携帯のSafariまたはChromeで `http://192.168.1.20:4173` を開きます（IPアドレス部分は自分のPCの値に置き換えます）。

開けない場合は、Windowsファイアウォールの確認画面でPythonの「プライベート ネットワーク」へのアクセスを許可してください。公共Wi-Fiや一部のルーターでは端末同士の通信が禁止されているため、その場合は自宅Wi-Fiなどで試してください。
