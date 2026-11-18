# Kestrel (Fairpractice)

*Claude による翻訳です。ネイティブスピーカーによる確認は未了です。英語の [README](README.md) が正本です。*

米国の診療所、訪問介護事業所、ホスピス、リハビリ・セラピー施設向けの小さな MCP エージェント 30 個：事務、請求、コンプライアンス。 各エージェントは**一つの仕事**だけを担当し、既存システムがエクスポートするファイルを読み、あなたのコンピューター上にレポートと下書きを書き出します。

MIT ライセンス · Node 20 以降 · ローカルファイルのみ · 認証情報不要 · 架空のテストデータのみ

固定価格の導入サービス：[Fairpractice](https://fair-agents.com/fairpractice.html)。

## 試してみる

```bash
npm install
npm test
node packages/heron-of-exclusions/bin/heron-of-exclusions.js demo
node packages/condor-of-provider-pay/bin/condor-of-provider-pay.js demo
```

各エージェントには架空のファイルで動く `demo`、独自のテストケースを持つ `eval`、MCP サーバー（`<agent> mcp --root <folder>`）があります。

## エージェント一覧

**コンプライアンス:** [`heron-of-exclusions`](packages/heron-of-exclusions), [`finch-of-licenses`](packages/finch-of-licenses), [`robin-of-staff-health`](packages/robin-of-staff-health), [`owl-of-access-requests`](packages/owl-of-access-requests), [`hawk-of-breaches`](packages/hawk-of-breaches), [`swift-of-associates`](packages/swift-of-associates), [`plover-of-risk-analysis`](packages/plover-of-risk-analysis), [`lark-of-training`](packages/lark-of-training), [`wren-of-reviews`](packages/wren-of-reviews), [`crane-of-physician-contracts`](packages/crane-of-physician-contracts)

**専門科の請求:** [`magpie-of-aba`](packages/magpie-of-aba), [`swallow-of-therapy`](packages/swallow-of-therapy), [`dove-of-hospice`](packages/dove-of-hospice), [`sparrow-of-home-health`](packages/sparrow-of-home-health), [`jay-of-behavioral-health`](packages/jay-of-behavioral-health), [`ibis-of-wound-products`](packages/ibis-of-wound-products), [`raven-of-liens`](packages/raven-of-liens)

**ケアマネジメントと価値に基づくケア:** [`egret-of-care-management`](packages/egret-of-care-management), [`tern-of-remote-monitoring`](packages/tern-of-remote-monitoring), [`linnet-of-primary-care`](packages/linnet-of-primary-care), [`stork-of-attribution`](packages/stork-of-attribution), [`pelican-of-capitation`](packages/pelican-of-capitation)

**在宅ケア:** [`oriole-of-evv`](packages/oriole-of-evv), [`thrush-of-caregiver-hours`](packages/thrush-of-caregiver-hours), [`warbler-of-care-plans`](packages/warbler-of-care-plans)

**回収と診療所の財務:** [`falcon-of-disputes`](packages/falcon-of-disputes), [`osprey-of-secondary-claims`](packages/osprey-of-secondary-claims), [`gull-of-recoupments`](packages/gull-of-recoupments), [`curlew-of-code-updates`](packages/curlew-of-code-updates), [`condor-of-provider-pay`](packages/condor-of-provider-pay)

## 安全に保つ仕組み

- **ローカルファイルのみ。** 診療ソフト、支払者ポータル、銀行、行政システムにはログインしません。ネットワーク通信もテレメトリもありません。
- **モデルに渡る前にマスク。** 患者・入居者・職員の氏名は仮名（`PT-3f9a1c2e`）になります。
- **送信するのは人。** 提出、支払、届出、送信はすべて拒否され、下書きは指名された人のクリックを待ちます。
- **固定ルールではなく設定。** 料率、上限、期限はあなたが確認する JSON 設定です。

## 限界

法律、税務、請求、医療に関する助言ではありません。マスキングは設計上の選択であり、HIPAA の判断ではありません。列名はまだ実際のエクスポートで検証されていません。最初の導入時に一緒に確認します。9 言語のファイル（文字コード、数値、日付、列名）を読み取れますが、結果と CSV は英語のままです。

## ライセンス

MIT。詳細は英語版 README を参照してください。
