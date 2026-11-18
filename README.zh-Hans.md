# Kestrel (Fairpractice)

*由 Claude 翻译；尚待母语人士审校。以英文 [README](README.md) 为准。*

面向美国诊所、居家护理机构、临终关怀机构和治疗诊所的 30 个小型 MCP 代理：行政、计费与合规。 每个代理只负责**一项工作**，读取你的系统已经导出的文件，并在你的电脑上写出报告和草稿。

MIT 许可证 · Node 20 或更高版本 · 仅本地文件 · 无需凭据 · 仅虚构测试数据

固定价格的部署服务：[Fairpractice](https://fair-agents.com/fairpractice.html)。

## 试用

```bash
npm install
npm test
node packages/heron-of-exclusions/bin/heron-of-exclusions.js demo
node packages/condor-of-provider-pay/bin/condor-of-provider-pay.js demo
```

每个代理都有使用虚构文件的 `demo`、带自有测试用例的 `eval`，以及 MCP 服务器（`<agent> mcp --root <文件夹>`）。

## 代理列表

**合规包:** [`heron-of-exclusions`](packages/heron-of-exclusions), [`finch-of-licenses`](packages/finch-of-licenses), [`robin-of-staff-health`](packages/robin-of-staff-health), [`owl-of-access-requests`](packages/owl-of-access-requests), [`hawk-of-breaches`](packages/hawk-of-breaches), [`swift-of-associates`](packages/swift-of-associates), [`plover-of-risk-analysis`](packages/plover-of-risk-analysis), [`lark-of-training`](packages/lark-of-training), [`wren-of-reviews`](packages/wren-of-reviews), [`crane-of-physician-contracts`](packages/crane-of-physician-contracts)

**专科计费:** [`magpie-of-aba`](packages/magpie-of-aba), [`swallow-of-therapy`](packages/swallow-of-therapy), [`dove-of-hospice`](packages/dove-of-hospice), [`sparrow-of-home-health`](packages/sparrow-of-home-health), [`jay-of-behavioral-health`](packages/jay-of-behavioral-health), [`ibis-of-wound-products`](packages/ibis-of-wound-products), [`raven-of-liens`](packages/raven-of-liens)

**护理管理与价值医疗:** [`egret-of-care-management`](packages/egret-of-care-management), [`tern-of-remote-monitoring`](packages/tern-of-remote-monitoring), [`linnet-of-primary-care`](packages/linnet-of-primary-care), [`stork-of-attribution`](packages/stork-of-attribution), [`pelican-of-capitation`](packages/pelican-of-capitation)

**居家护理:** [`oriole-of-evv`](packages/oriole-of-evv), [`thrush-of-caregiver-hours`](packages/thrush-of-caregiver-hours), [`warbler-of-care-plans`](packages/warbler-of-care-plans)

**款项追回与诊所财务:** [`falcon-of-disputes`](packages/falcon-of-disputes), [`osprey-of-secondary-claims`](packages/osprey-of-secondary-claims), [`gull-of-recoupments`](packages/gull-of-recoupments), [`curlew-of-code-updates`](packages/curlew-of-code-updates), [`condor-of-provider-pay`](packages/condor-of-provider-pay)

## 如何保证安全

- **仅本地文件。** 不登录诊所软件、付款方门户、银行或政府系统；无网络调用，无遥测。
- **在模型看到之前先做掩码。** 患者、住户和员工姓名会变成化名（`PT-3f9a1c2e`）。
- **由人发送。** 每个代理都拒绝提交、付款、申报或发送；草稿须等待指定人员点击。
- **用设置代替写死的规则。** 费率、上限和期限都是由你确认的 JSON 设置。

## 局限

不提供法律、税务、计费或医疗建议。掩码是一种设计选择，不是 HIPAA 判定。列名尚未在真实导出文件上验证；首次部署时会与你一起确认。可读取九种语言的文件（编码、数字、日期、列名）；结果和 CSV 保持英文。

## 许可证

MIT。详情见英文 README。
