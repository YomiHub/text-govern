'use strict';

const crypto = require('crypto');

/**
 * Terminology consistency analysis.
 *
 * Strategy:
 * 1. Build alias → canonical map.
 * 2. For each fragment, detect if any alias appears.
 * 3. If an alias appears (and not the canonical form), flag it.
 * 4. Additionally, detect cross-fragment inconsistency:
 *    if both "订单编号" and "订单编码" appear in the project → flag all non-canonical ones.
 */
function analyzeTerminology(fragments, terminologyRules) {
  if (!terminologyRules.length) return [];

  // Build: alias → { canonical, rule }
  const aliasMap = new Map();
  for (const rule of terminologyRules) {
    for (const alias of rule.aliases || []) {
      if (alias && alias !== rule.canonical) {
        aliasMap.set(alias, { canonical: rule.canonical, rule });
      }
    }
  }

  if (!aliasMap.size) return [];

  // Build Aho-Corasick for all aliases
  const { AhoCorasick } = require('./banned');
  const ac = new AhoCorasick();
  for (const [alias, meta] of aliasMap) {
    ac.addPattern(alias, meta);
  }
  ac.build();

  // Scan all fragments, collect occurrences per canonical term
  // key: canonical → Map<alias, Fragment[]>
  const occurrencesByCanonical = new Map();

  for (const fragment of fragments) {
    const text = fragment.normalized || fragment.raw;
    const matches = ac.search(text);
    for (const match of matches) {
      const { canonical } = match.meta;
      if (!occurrencesByCanonical.has(canonical)) {
        occurrencesByCanonical.set(canonical, new Map());
      }
      const aliasFragMap = occurrencesByCanonical.get(canonical);
      if (!aliasFragMap.has(match.word)) aliasFragMap.set(match.word, []);
      aliasFragMap.get(match.word).push({ fragment, match });
    }
  }

  const findings = [];

  for (const [canonical, aliasFragMap] of occurrencesByCanonical) {
    // All non-canonical aliases present
    const usedAliases = [...aliasFragMap.keys()];

    // Check if canonical itself is used anywhere in the project
    const canonicalUsedAnywhere = fragments.some(
      (f) => (f.normalized || f.raw).includes(canonical)
    );

    for (const [alias, occurrences] of aliasFragMap) {
      for (const { fragment, match } of occurrences) {
        const rule = match.meta.rule;
        findings.push({
          id: buildFindingId(fragment.id, alias),
          fragmentId: fragment.id,
          file: fragment.file,
          line: fragment.line,
          column: fragment.column,
          rawText: fragment.raw,
          category: '词义统一类',
          severity: '需关注',
          matched: alias,
          suggestion: canonical,
          reason: buildReason(alias, canonical, usedAliases, canonicalUsedAnywhere, rule),
          source: 'rule',
          rulePack: `terminology.${canonical}`,
          legalRef: '',
          pageHint: fragment.pageHint,
          surrounding: fragment.surrounding,
          kind: fragment.kind,
        });
      }
    }
  }

  return findings;
}

function buildReason(alias, canonical, usedAliases, canonicalUsed, rule) {
  const parts = [`使用了非标准术语"${alias}"，标准词为"${canonical}"`];
  if (usedAliases.length > 1) {
    parts.push(`系统中同时出现了 ${usedAliases.map((a) => `"${a}"`).join('、')} 等多种写法`);
  }
  if (canonicalUsed) {
    parts.push('部分位置已使用标准词，建议全局统一');
  }
  if (rule && rule.note) {
    parts.push(rule.note);
  }
  return parts.join('；');
}

function buildFindingId(fragmentId, alias) {
  return crypto
    .createHash('md5')
    .update(`term:${fragmentId}:${alias}`)
    .digest('hex')
    .slice(0, 12);
}

module.exports = { analyzeTerminology };
