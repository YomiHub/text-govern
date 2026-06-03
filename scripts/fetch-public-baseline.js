#!/usr/bin/env node
'use strict';

/**
 * 构建期拉取公开开源敏感词库，生成 config/banned.default.xlsx。
 *
 * 词库来源（协议兼容，锁定 commit SHA，可追溯）：
 *   1. konsheng/Sensitive-lexicon  MIT   https://github.com/konsheng/Sensitive-lexicon
 *   2. fwwdn/sensitive-stop-words  Apache-2.0  https://github.com/fwwdn/sensitive-stop-words
 *
 * 使用方式：
 *   node scripts/fetch-public-baseline.js           # 正常拉取（网络需通）
 *   node scripts/fetch-public-baseline.js --force   # 强制刷新（即使文件已存在）
 *   node scripts/fetch-public-baseline.js --offline # 离线模式：文件已存在则跳过，否则报错
 *
 * 输出：
 *   config/banned.default.xlsx       — XLSX 格式词库，可被 lib/rules/defaults.js 加载
 *   config/THIRD_PARTY_NOTICES.md    — 许可声明与 commit SHA 记录
 */

const https = require('https');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// ── 版本锁定 ──────────────────────────────────────────────────────────────────
const KONSHENG_SHA = 'b38d80aece9837a434c601811c202d7640adeb4b';
const FWWDN_SHA = 'a7d06bb1c321e669943b6841570d9da6dad8ce2b';

const KONSHENG_BASE =
  `https://raw.githubusercontent.com/konsheng/Sensitive-lexicon/${KONSHENG_SHA}`;
const FWWDN_BASE =
  `https://raw.githubusercontent.com/fwwdn/sensitive-stop-words/${FWWDN_SHA}`;

// ── 数据源配置 ─────────────────────────────────────────────────────────────────
// format: 'newline'（每行一词）| 'comma'（逗号分隔）
const SOURCES = [
  {
    url: `${KONSHENG_BASE}/Vocabulary/色情类型.txt`,
    category: '色情违规',
    severity: '严重违禁',
    legalRef: '互联网信息服务管理办法',
    note: '公开色情词汇',
    format: 'newline',
    source: 'konsheng/Sensitive-lexicon',
  },
  {
    url: `${KONSHENG_BASE}/Vocabulary/色情词库.txt`,
    category: '色情违规',
    severity: '严重违禁',
    legalRef: '互联网信息服务管理办法',
    note: '公开色情词汇',
    format: 'newline',
    source: 'konsheng/Sensitive-lexicon',
  },
  {
    url: `${KONSHENG_BASE}/Vocabulary/政治类型.txt`,
    category: '政治敏感',
    severity: '严重违禁',
    legalRef: '互联网信息服务管理办法',
    note: '政治敏感词汇',
    format: 'newline',
    source: 'konsheng/Sensitive-lexicon',
  },
  {
    url: `${KONSHENG_BASE}/Vocabulary/反动词库.txt`,
    category: '政治敏感',
    severity: '严重违禁',
    legalRef: '互联网信息服务管理办法',
    note: '政治敏感词汇',
    format: 'newline',
    source: 'konsheng/Sensitive-lexicon',
  },
  {
    url: `${KONSHENG_BASE}/Vocabulary/暴恐词库.txt`,
    category: '暴恐违禁',
    severity: '严重违禁',
    legalRef: '反恐怖主义法',
    note: '暴力恐怖词汇',
    format: 'newline',
    source: 'konsheng/Sensitive-lexicon',
  },
  {
    url: `${KONSHENG_BASE}/Vocabulary/涉枪涉爆.txt`,
    category: '涉枪涉爆',
    severity: '严重违禁',
    legalRef: '枪支管理法',
    note: '涉枪涉爆词汇',
    format: 'newline',
    source: 'konsheng/Sensitive-lexicon',
  },
  {
    url: `${KONSHENG_BASE}/Vocabulary/广告类型.txt`,
    category: '广告违规',
    severity: '高风险',
    legalRef: '互联网广告管理办法',
    note: '广告垃圾词汇',
    format: 'newline',
    source: 'konsheng/Sensitive-lexicon',
  },
  {
    url: `${FWWDN_BASE}/广告.txt`,
    category: '广告违规',
    severity: '高风险',
    legalRef: '互联网广告管理办法',
    note: '广告推广违规词汇',
    format: 'newline',
    source: 'fwwdn/sensitive-stop-words',
  },
];

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const OUTPUT_XLSX = path.join(CONFIG_DIR, 'banned.default.xlsx');
const OUTPUT_NOTICES = path.join(CONFIG_DIR, 'THIRD_PARTY_NOTICES.md');

const BANNED_HEADERS = ['词', '替换建议', '风险等级', '分类', '法规来源', '备注'];

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = (targetUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }
      const proto = targetUrl.startsWith('https') ? https : require('http');
      proto
        .get(targetUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            request(res.headers.location, redirectCount + 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for ${targetUrl}`));
            return;
          }
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          res.on('error', reject);
        })
        .on('error', reject);
    };
    request(url);
  });
}

function parseWords(text, format) {
  if (format === 'comma') {
    return text.split(',').map((w) => w.trim()).filter(Boolean);
  }
  // newline (default)
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function isValidWord(word) {
  if (!word || word.length < 2) return false;
  // Skip pure ASCII/URL-like entries — they're not useful for text content governance
  if (/^[a-zA-Z0-9_.@:/]+$/.test(word)) return false;
  // Skip entries that look like domain names or URLs
  if (/\.com|\.net|\.org|\.cn|\.io/.test(word) && word.length > 8) return false;
  return true;
}

async function fetchSource(src) {
  let text;
  try {
    text = await fetchText(src.url);
  } catch (e) {
    console.warn(`  [warn] 拉取失败，跳过: ${src.url}\n         ${e.message}`);
    return [];
  }

  const words = parseWords(text, src.format);
  const rows = [];
  const seen = new Set();
  for (const word of words) {
    if (!isValidWord(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    rows.push([word, '', src.severity, src.category, src.legalRef, src.note]);
  }
  return rows;
}

function buildNotices() {
  return `# Third-Party Notices — text-govern 默认词库

本目录的 \`banned.default.xlsx\` 由构建期脚本 \`scripts/fetch-public-baseline.js\` 自动生成，
基于以下开源词库。如需刷新，在 \`scripts/text-govern/\` 目录下运行：

\`\`\`bash
npm run fetch:baseline
\`\`\`

---

## 1. konsheng/Sensitive-lexicon

- **仓库**：<https://github.com/konsheng/Sensitive-lexicon>
- **许可证**：MIT
- **锁定 SHA**：\`${KONSHENG_SHA}\`
- **使用文件**：
  - \`Vocabulary/色情类型.txt\` → 分类：色情违规
  - \`Vocabulary/色情词库.txt\` → 分类：色情违规
  - \`Vocabulary/政治类型.txt\` → 分类：政治敏感
  - \`Vocabulary/反动词库.txt\` → 分类：政治敏感
  - \`Vocabulary/暴恐词库.txt\` → 分类：暴恐违禁
  - \`Vocabulary/涉枪涉爆.txt\` → 分类：涉枪涉爆
  - \`Vocabulary/广告类型.txt\` → 分类：广告违规

MIT License 全文见：<https://github.com/konsheng/Sensitive-lexicon/blob/${KONSHENG_SHA}/LICENSE>

---

## 2. fwwdn/sensitive-stop-words

- **仓库**：<https://github.com/fwwdn/sensitive-stop-words>
- **许可证**：Apache-2.0
- **锁定 SHA**：\`${FWWDN_SHA}\`
- **使用文件**：
  - \`广告.txt\` → 分类：广告违规

Apache 2.0 License 全文见：<https://github.com/fwwdn/sensitive-stop-words/blob/${FWWDN_SHA}/LICENSE>

---

## 维护说明

- 仅引入对中国大陆互联网平台监管相关的词汇分类（政治、色情、暴恐、广告、涉枪涉爆）。
- 故意**未引入**以下内容，以避免干扰正常业务文案扫描：
  - 网站黑名单（非法网址类）
  - GFW 翻墙工具词汇
  - 大规模无分类聚合词库（如腾讯、网易词库，体量过大且噪音过高）
  - COVID-19 专项词库（时效性过强）
  - 贪腐、民生词库（与text govern无关）
- 行业专有合规词（如绝对化用语、功效宣称、保本承诺等）、金融合规、医疗合规等**行业强相关合规词**不在此基线中，
  请通过 \`/text-govern-rules\` 命令让 AI 根据系统落地形态与行业，自主判定适用法规后生成到 \`text-govern-rules/generated/\` 目录。
`;
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

async function main(argv) {
  const isForce = argv.includes('--force');
  const isOffline = argv.includes('--offline');

  fs.mkdirSync(CONFIG_DIR, { recursive: true });

  if (!isForce && fs.existsSync(OUTPUT_XLSX)) {
    if (isOffline) {
      console.log('离线模式：banned.default.xlsx 已存在，跳过拉取。');
      return;
    }
    // Non-force, file already exists: in normal build just skip to avoid always re-fetching
    console.log('banned.default.xlsx 已存在。如需强制刷新请使用 --force 参数。');
    return;
  }

  if (isOffline && !fs.existsSync(OUTPUT_XLSX)) {
    console.error('离线模式下 banned.default.xlsx 不存在，请先在联网环境执行 npm run fetch:baseline。');
    process.exit(1);
  }

  console.log('拉取公开敏感词库...');

  const allRows = [];
  const globalSeen = new Set();

  for (const src of SOURCES) {
    const filename = src.url.split('/').pop();
    process.stdout.write(`  ${src.source} / ${filename} ... `);
    const rows = await fetchSource(src);
    let added = 0;
    for (const row of rows) {
      const word = row[0];
      if (!globalSeen.has(word)) {
        globalSeen.add(word);
        allRows.push(row);
        added++;
      }
    }
    console.log(`${rows.length} 词 (去重后新增 ${added})`);
  }

  // Write xlsx
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([BANNED_HEADERS, ...allRows]);
  XLSX.utils.book_append_sheet(wb, ws, '违禁违规词');
  XLSX.writeFile(wb, OUTPUT_XLSX);
  console.log(
    `\n✓ 写入 ${path.relative(process.cwd(), OUTPUT_XLSX)} (共 ${allRows.length} 条)`
  );

  // Write notices
  fs.writeFileSync(OUTPUT_NOTICES, buildNotices(), 'utf8');
  console.log(`✓ 写入 ${path.relative(process.cwd(), OUTPUT_NOTICES)}`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((err) => {
    console.error('[fetch-public-baseline] 失败:', err.message);
    process.exit(1);
  });
}

module.exports = { main };
