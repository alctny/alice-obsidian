import test from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../src/i18n.js';

test('selects English, Simplified Chinese and Traditional Chinese from Obsidian locales', () => {
  for (const language of ['en', 'en-US', 'de', 'ja']) {
    assert.equal(translate('edit', language), 'Source');
  }
  for (const language of ['zh', 'zh-CN', 'zh-Hans', 'zh-SG']) {
    assert.equal(translate('edit', language), 'Source');
  }
  for (const language of ['zh-TW', 'zh_HK', 'zh-Hant', 'ZH-HANT-TW']) {
    assert.equal(translate('edit', language), 'Source');
  }
});

test('localizes plugin validation messages and retains unknown keys', () => {
  assert.equal(translate('invalidConfig', 'en'), 'config must be a YAML object.');
  assert.equal(translate('invalidConfig', 'zh-TW'), 'config 必須是 YAML 物件。');
  assert.equal(translate('invalidConfig', 'zh'), 'config 必须是 YAML 对象。');
  assert.equal(translate('unknown', 'en'), 'unknown');
});
