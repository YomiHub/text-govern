#!/usr/bin/env node
'use strict';

/**
 * 把 config/standard-product.xlsx 的两个 Sheet 转换为 AI 友好的 JSON 文件。
 *
 * 输入：
 *   config/standard-product.xlsx
 *     - Sheet「产品名」列：编码 | 品规 | 名称 | 通用名 | 品牌 | 商标
 *     - Sheet「宣传语」列：类型 | 宣传语
 *
 * 输出：
 *   config/standard-product.json  — 产品标准词列表（供 AI semantic 阶段使用）
 *   config/standard-slogan.json   — 宣传语标准词列表（供 AI semantic 阶段使用）
 *
 * 使用方式：
 *   node scripts/text-govern/scripts/build-standard-rules.js
 *   （也在 npm run build:defaults 中一并运行）
 *
 * 当 standard-product.xlsx 不存在时脚本会给出警告并跳过，不报错退出，
 * 以兼容未提供该文件的项目。
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const INPUT_XLSX = path.join(CONFIG_DIR, 'standard-product.xlsx');
const OUTPUT_PRODUCT = path.join(CONFIG_DIR, 'standard-product.json');
const OUTPUT_SLOGAN = path.join(CONFIG_DIR, 'standard-slogan.json');

/**
 * "/"  表示该字段为空，统一规整为空字符串。
 */
function normalizeField(val) {
  if (!val || String(val).trim() === '/') return '';
  return String(val).trim();
}

function buildProductJson(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) return [];

  // Expected header: 编码 | 品规 | 名称 | 通用名 | 品牌 | 商标
  // We find columns by header names to be robust against reordering.
  const headers = rows[0].map((h) => String(h || '').trim());
  const idx = (name) => headers.findIndex((h) => h === name);

  const iCode = idx('编码');
  const iName = idx('名称');
  const iGeneric = idx('通用名');
  const iBrand = idx('品牌');
  const iTrademark = idx('商标');

  const products = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = normalizeField(iName >= 0 ? row[iName] : '');
    if (!name) continue;

    products.push({
      code: normalizeField(iCode >= 0 ? row[iCode] : ''),
      name,
      genericName: normalizeField(iGeneric >= 0 ? row[iGeneric] : ''),
      brand: normalizeField(iBrand >= 0 ? row[iBrand] : ''),
      trademark: normalizeField(iTrademark >= 0 ? row[iTrademark] : ''),
    });
  }
  return products;
}

function buildSloganJson(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => String(h || '').trim());
  const iType = headers.findIndex((h) => h === '类型');
  const iSlogan = headers.findIndex((h) => h === '宣传语');

  const slogans = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const type = normalizeField(iType >= 0 ? row[iType] : '');
    const slogan = normalizeField(iSlogan >= 0 ? row[iSlogan] : '');
    if (!type && !slogan) continue;
    slogans.push({ type, slogan });
  }
  return slogans;
}

function main() {
  if (!fs.existsSync(INPUT_XLSX)) {
    console.warn(
      `[build-standard-rules] 警告: ${path.relative(process.cwd(), INPUT_XLSX)} 不存在，跳过生成。\n` +
      `  如需启用标准词识别，请在 config/ 目录下放置 standard-product.xlsx 后重新运行。`
    );
    return;
  }

  const wb = XLSX.readFile(INPUT_XLSX);

  // --- 产品名 ---
  const productSheetName = wb.SheetNames.find((n) => n.includes('产品') || n.includes('product'));
  if (productSheetName) {
    const products = buildProductJson(wb.Sheets[productSheetName]);
    fs.writeFileSync(OUTPUT_PRODUCT, JSON.stringify(products, null, 2), 'utf8');
    console.log(
      `written: ${path.relative(process.cwd(), OUTPUT_PRODUCT)} (${products.length} 条产品名)`
    );
  } else {
    console.warn(`[build-standard-rules] 未找到包含"产品"或"product"的 Sheet，跳过产品名输出。`);
  }

  // --- 宣传语 ---
  const sloganSheetName = wb.SheetNames.find((n) => n.includes('宣传') || n.includes('slogan'));
  if (sloganSheetName) {
    const slogans = buildSloganJson(wb.Sheets[sloganSheetName]);
    fs.writeFileSync(OUTPUT_SLOGAN, JSON.stringify(slogans, null, 2), 'utf8');
    console.log(
      `written: ${path.relative(process.cwd(), OUTPUT_SLOGAN)} (${slogans.length} 条宣传语)`
    );
  } else {
    console.warn(`[build-standard-rules] 未找到包含"宣传"或"slogan"的 Sheet，跳过宣传语输出。`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, buildProductJson, buildSloganJson, normalizeField };
