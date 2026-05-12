'use strict';

const fs = require('fs');
const { createFragment } = require('../extractor/fragment');

const HAS_CHINESE = /[\u4e00-\u9fff\u3400-\u4dbf]/;

function extract(filePath, relativeFile) {
  let src;
  try {
    src = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return [];
  }

  let compilerSfc;
  try {
    compilerSfc = require('@vue/compiler-sfc');
  } catch (e) {
    return extractWithRegex(src, relativeFile);
  }

  const { descriptor } = compilerSfc.parse(src, { filename: filePath });
  const fragments = [];

  // Extract from template block
  if (descriptor.template && descriptor.template.content) {
    const tplSrc = descriptor.template.content;
    const tplOffset = descriptor.template.loc.start.line - 1;
    const { parse: parseWxml } = require('./wxml');
    const tplFragments = parseWxml(tplSrc, relativeFile);
    // Adjust line numbers by template offset
    tplFragments.forEach((f) => {
      f.line += tplOffset;
      f.kind = 'vue-text';
      fragments.push(f);
    });
  }

  // Extract from script/scriptSetup string literals
  const scriptContent =
    (descriptor.script && descriptor.script.content) ||
    (descriptor.scriptSetup && descriptor.scriptSetup.content) ||
    '';
  if (scriptContent) {
    const scriptOffset = descriptor.script
      ? descriptor.script.loc.start.line - 1
      : descriptor.scriptSetup
      ? descriptor.scriptSetup.loc.start.line - 1
      : 0;

    const { extract: extractJs } = require('./js');
    // Write a temp approach: parse the script block src
    const tmpFragments = extractJs(null, relativeFile, scriptContent);
    tmpFragments.forEach((f) => {
      f.line += scriptOffset;
      fragments.push(f);
    });
  }

  return fragments;
}

function extractWithRegex(src, relativeFile) {
  const { parse: parseWxml } = require('./wxml');
  // Extract template section with a simple regex
  const templateMatch = src.match(/<template[^>]*>([\s\S]*?)<\/template>/);
  if (templateMatch) {
    return parseWxml(templateMatch[1], relativeFile);
  }
  return [];
}

module.exports = { extract };
