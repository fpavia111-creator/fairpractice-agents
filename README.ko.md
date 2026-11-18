# Kestrel (Fairpractice)

*Claude가 번역했으며 원어민 검토는 아직입니다. 영문 [README](README.md)가 기준입니다.*

미국의 의원, 재가 돌봄 기관, 호스피스, 치료 클리닉을 위한 작은 MCP 에이전트 30개: 행정, 청구, 컴플라이언스. 각 에이전트는 **한 가지 일**만 맡아, 기존 시스템이 내보내는 파일을 읽고 여러분의 컴퓨터에 보고서와 초안을 씁니다.

MIT 라이선스 · Node 20 이상 · 로컬 파일만 · 자격 증명 불필요 · 가상의 테스트 데이터만

고정 가격 도입 서비스: [Fairpractice](https://fair-agents.com/fairpractice.html).

## 사용해 보기

```bash
npm install
npm test
node packages/heron-of-exclusions/bin/heron-of-exclusions.js demo
node packages/condor-of-provider-pay/bin/condor-of-provider-pay.js demo
```

각 에이전트에는 가상 파일로 실행하는 `demo`, 자체 테스트 케이스가 있는 `eval`, MCP 서버(`<agent> mcp --root <폴더>`)가 있습니다.

## 에이전트 목록

**컴플라이언스:** [`heron-of-exclusions`](packages/heron-of-exclusions), [`finch-of-licenses`](packages/finch-of-licenses), [`robin-of-staff-health`](packages/robin-of-staff-health), [`owl-of-access-requests`](packages/owl-of-access-requests), [`hawk-of-breaches`](packages/hawk-of-breaches), [`swift-of-associates`](packages/swift-of-associates), [`plover-of-risk-analysis`](packages/plover-of-risk-analysis), [`lark-of-training`](packages/lark-of-training), [`wren-of-reviews`](packages/wren-of-reviews), [`crane-of-physician-contracts`](packages/crane-of-physician-contracts)

**전문 과목 청구:** [`magpie-of-aba`](packages/magpie-of-aba), [`swallow-of-therapy`](packages/swallow-of-therapy), [`dove-of-hospice`](packages/dove-of-hospice), [`sparrow-of-home-health`](packages/sparrow-of-home-health), [`jay-of-behavioral-health`](packages/jay-of-behavioral-health), [`ibis-of-wound-products`](packages/ibis-of-wound-products), [`raven-of-liens`](packages/raven-of-liens)

**케어 관리와 가치 기반 진료:** [`egret-of-care-management`](packages/egret-of-care-management), [`tern-of-remote-monitoring`](packages/tern-of-remote-monitoring), [`linnet-of-primary-care`](packages/linnet-of-primary-care), [`stork-of-attribution`](packages/stork-of-attribution), [`pelican-of-capitation`](packages/pelican-of-capitation)

**재가 돌봄:** [`oriole-of-evv`](packages/oriole-of-evv), [`thrush-of-caregiver-hours`](packages/thrush-of-caregiver-hours), [`warbler-of-care-plans`](packages/warbler-of-care-plans)

**금액 회수와 병원 재무:** [`falcon-of-disputes`](packages/falcon-of-disputes), [`osprey-of-secondary-claims`](packages/osprey-of-secondary-claims), [`gull-of-recoupments`](packages/gull-of-recoupments), [`curlew-of-code-updates`](packages/curlew-of-code-updates), [`condor-of-provider-pay`](packages/condor-of-provider-pay)

## 안전을 지키는 방식

- **로컬 파일만.** 진료 소프트웨어, 지급자 포털, 은행, 행정 시스템에 로그인하지 않으며 네트워크 호출과 원격 측정도 없습니다.
- **모델이 보기 전에 마스킹.** 환자, 입소자, 직원 이름은 가명(`PT-3f9a1c2e`)이 됩니다.
- **보내는 것은 사람.** 제출, 지급, 신고, 발송은 모두 거부되며, 초안은 지정된 사람의 클릭을 기다립니다.
- **고정 규칙이 아닌 설정.** 요율, 한도, 기한은 여러분이 확인하는 JSON 설정입니다.

## 한계

법률, 세무, 청구, 의료 자문이 아닙니다. 마스킹은 설계상의 선택이며 HIPAA 판단이 아닙니다. 열 이름은 아직 실제 내보내기 파일로 검증되지 않았으며, 첫 도입 때 함께 확인합니다. 9개 언어의 파일(인코딩, 숫자, 날짜, 열 이름)을 읽으며 결과와 CSV는 영어로 유지됩니다.

## 라이선스

MIT. 자세한 내용은 영문 README를 참고하세요.
