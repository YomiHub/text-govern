'use strict';

const crypto = require('crypto');

/**
 * Lightweight Aho-Corasick automaton for multi-pattern string matching.
 * Supports Unicode (Chinese) patterns.
 */
class AhoCorasick {
  constructor() {
    this.goto = [new Map()];
    this.fail = [0];
    this.output = [[]]; // output[state] = [{word, meta}]
    this.size = 1;
  }

  /**
   * Add a pattern string and associated metadata to the trie.
   */
  addPattern(word, meta) {
    let state = 0;
    for (const ch of word) {
      if (!this.goto[state].has(ch)) {
        this.goto[state].set(ch, this.size);
        this.goto.push(new Map());
        this.output.push([]);
        this.fail.push(0);
        this.size++;
      }
      state = this.goto[state].get(ch);
    }
    this.output[state].push({ word, meta });
  }

  /**
   * Build failure links (BFS). Must be called after all addPattern() calls.
   */
  build() {
    const queue = [];
    for (const [, s] of this.goto[0]) {
      this.fail[s] = 0;
      queue.push(s);
    }
    let head = 0;
    while (head < queue.length) {
      const r = queue[head++];
      for (const [ch, s] of this.goto[r]) {
        queue.push(s);
        let f = this.fail[r];
        while (f !== 0 && !this.goto[f].has(ch)) f = this.fail[f];
        this.fail[s] = this.goto[f].has(ch) && this.goto[f].get(ch) !== s ? this.goto[f].get(ch) : 0;
        this.output[s] = [...this.output[s], ...this.output[this.fail[s]]];
      }
    }
  }

  /**
   * Search text for all pattern matches.
   * @returns {Array<{word, meta, startIndex, endIndex}>}
   */
  search(text) {
    const matches = [];
    let state = 0;
    const chars = [...text]; // handle multi-byte chars
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      while (state !== 0 && !this.goto[state].has(ch)) state = this.fail[state];
      state = this.goto[state].has(ch) ? this.goto[state].get(ch) : 0;
      for (const out of this.output[state]) {
        const start = i - [...out.word].length + 1;
        matches.push({ word: out.word, meta: out.meta, startIndex: start, endIndex: i });
      }
    }
    return matches;
  }
}

/**
 * Run banned-word analysis.
 *
 * @param {Array} fragments   - TextFragment[]
 * @param {Array} bannedRules - [{word, suggestion, severity, category, legalRef}]
 * @returns {Array}           - Finding[]
 */
function analyzeBanned(fragments, bannedRules) {
  if (!bannedRules.length) return [];

  const ac = new AhoCorasick();
  for (const rule of bannedRules) {
    if (rule.word && rule.word.trim()) {
      ac.addPattern(rule.word.trim(), rule);
    }
  }
  ac.build();

  const findings = [];

  for (const fragment of fragments) {
    const text = fragment.normalized || fragment.raw;
    const matches = ac.search(text);

    for (const match of matches) {
      const meta = match.meta;
      findings.push({
        id: buildFindingId(fragment.id, match.word),
        fragmentId: fragment.id,
        file: fragment.file,
        line: fragment.line,
        column: fragment.column,
        rawText: fragment.raw,
        category: meta.category || '其他',
        severity: meta.severity || '高风险',
        matched: match.word,
        suggestion: meta.suggestion || '',
        reason: buildReason(match.word, meta),
        source: 'rule',
        rulePack: `banned.${meta.category || '通用规则'}`,
        legalRef: meta.legalRef || '',
        pageHint: fragment.pageHint,
        surrounding: fragment.surrounding,
        kind: fragment.kind,
      });
    }
  }

  return findings;
}

function buildReason(word, meta) {
  const parts = [`文案中出现"${word}"`];
  if (meta.legalRef) parts.push(`违反 ${meta.legalRef}`);
  if (meta.suggestion) parts.push(`建议替换为"${meta.suggestion}"`);
  return parts.join('，');
}

function buildFindingId(fragmentId, word) {
  return crypto
    .createHash('md5')
    .update(`${fragmentId}:${word}`)
    .digest('hex')
    .slice(0, 12);
}

module.exports = { analyzeBanned, AhoCorasick };
