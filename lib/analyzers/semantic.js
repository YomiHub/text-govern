'use strict';

const crypto = require('crypto');
const micromatch = require('micromatch');

/**
 * Semantic consistency analysis.
 *
 * For each semantic rule: { pageGlob, fieldMeaning, forbidden: [], suggestion }
 * Check every fragment whose file path matches the pageGlob.
 * If the fragment's text contains a forbidden word → flag it.
 */
function analyzeSemantic(fragments, semanticRules) {
  if (!semanticRules.length) return [];

  const findings = [];

  for (const rule of semanticRules) {
    const { pageGlob, fieldMeaning, forbidden = [], suggestion } = rule;
    if (!pageGlob || !forbidden.length) continue;

    // Build AC for forbidden words
    const { AhoCorasick } = require('./banned');
    const ac = new AhoCorasick();
    for (const word of forbidden) {
      if (word) ac.addPattern(word, { word, rule });
    }
    ac.build();

    for (const fragment of fragments) {
      // Match against file path AND pageHint
      const matchesGlob =
        micromatch.isMatch(fragment.file, pageGlob) ||
        micromatch.isMatch(fragment.pageHint || '', pageGlob.replace(/^\*\*\//, '').replace(/\/\*\*$/, '')) ||
        (fragment.pageHint && fragment.pageHint.includes(
          pageGlob.replace(/\*\*/g, '').replace(/\//g, '')
        ));

      if (!matchesGlob) continue;

      const text = fragment.normalized || fragment.raw;
      const matches = ac.search(text);

      for (const match of matches) {
        findings.push({
          id: buildFindingId(fragment.id, match.word, pageGlob),
          fragmentId: fragment.id,
          file: fragment.file,
          line: fragment.line,
          column: fragment.column,
          rawText: fragment.raw,
          category: '业务语义统一类',
          severity: '需关注',
          matched: match.word,
          suggestion: suggestion || fieldMeaning || '',
          reason: buildReason(match.word, fieldMeaning, pageGlob, suggestion),
          source: 'rule',
          rulePack: `semantic.${pageGlob.replace(/[^a-zA-Z0-9]/g, '-')}`,
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

function buildReason(word, fieldMeaning, pageGlob, suggestion) {
  const parts = [`页面路径匹配 "${pageGlob}"，该上下文字段含义为"${fieldMeaning || '?'}"`];
  parts.push(`出现了语义歧义词"${word}"`);
  if (suggestion && suggestion !== word) {
    parts.push(`建议修改为"${suggestion}"`);
  }
  return parts.join('，');
}

function buildFindingId(fragmentId, word, glob) {
  return crypto
    .createHash('md5')
    .update(`sem:${fragmentId}:${word}:${glob}`)
    .digest('hex')
    .slice(0, 12);
}

module.exports = { analyzeSemantic };
