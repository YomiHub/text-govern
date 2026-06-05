'use strict';

const SEVERITIES = ['严重违禁', '高风险', '需关注', '推荐修改'];

const CATEGORIES = ['行业合规', '词义统一类', '业务语义统一类', '优化类'];

const SEVERITY_ORDER = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));

const KIND_LABELS = {
  'wxml-text': 'WXML 文本',
  'wxml-attr': 'WXML 属性',
  'js-literal': 'JS 字符串',
  'json-value': 'JSON 值',
  'vue-text': 'Vue 模板',
  'jsx-text': 'JSX 文本',
  'html-text': 'HTML 文本',
};

const CATEGORY_LABELS = {
  行业合规: '行业合规',
  词义统一类: '词义统一类',
  业务语义统一类: '业务语义统一类',
  优化类: '优化类',
  banned: '违禁/违规词',
  industry: '行业合规',
  terminology: '术语统一',
  semantic: '语义统一',
  recommend: '推荐优化',
};

const SEVERITY_LABELS = {
  严重违禁: '严重违禁',
  高风险: '高风险',
  需关注: '需关注',
  推荐修改: '推荐修改',
  critical: '严重违禁',
  high: '高风险',
  medium: '需关注',
  low: '推荐修改',
};

const DEFAULT_OUTPUT_DIR = '.text-govern';
const EXTRACTED_FILE = 'extracted.json';
const RULE_FINDINGS_FILE = 'findings.rule.json';
const AI_FINDINGS_FILE = 'findings.ai.json';
const REPORT_DIR = 'report';
const MAX_SYSTEM_BACKGROUND_LENGTH = 200;

const WXML_TEXT_ATTRS = [
  'placeholder',
  'title',
  'label',
  'aria-label',
  'hint',
  'content',
  'value',
  'range-key',
  'name',
  'desc',
  'description',
  'summary',
  'tip',
  'emptyText',
  'error-message',
];

module.exports = {
  SEVERITIES,
  CATEGORIES,
  SEVERITY_ORDER,
  KIND_LABELS,
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  DEFAULT_OUTPUT_DIR,
  EXTRACTED_FILE,
  RULE_FINDINGS_FILE,
  AI_FINDINGS_FILE,
  REPORT_DIR,
  MAX_SYSTEM_BACKGROUND_LENGTH,
  WXML_TEXT_ATTRS,
};
