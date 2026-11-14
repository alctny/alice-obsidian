import test from 'node:test';
import assert from 'node:assert/strict';
import { exportPng } from '../src/export.js';

function fixture({ dark = false, failImage = false, failCanvas = false, sandbox = false } = {}) {
  const styles = properties => ({ ...properties,
    setProperty(name, value) { this[name] = value; },
  });
  const label = { style: styles({}) };
  const copy = {
    style: styles({}), attributes: {},
    querySelectorAll: selector => selector === 'style' ? [] : [label],
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const originalLabel = {};
  const svg = {
    viewBox: { baseVal: { width: 500, height: 250 } },
    getBoundingClientRect: () => ({ width: 100, height: 50 }),
    querySelectorAll: () => [originalLabel], cloneNode: () => copy,
  };
  let extracted = !sandbox;
  const staging = {
    style: {},
    querySelector: selector => selector === 'iframe'
      ? (sandbox ? { getAttribute: () => `data:text/html;base64,${Buffer.from('<svg>中文</svg>').toString('base64')}` } : null)
      : (extracted ? svg : null),
    replaceChildren(node) { assert.equal(node, svg); extracted = true; },
    remove() { this.removed = true; },
  };
  const context = {
    fillRect(...args) { this.fill = args; },
    drawImage(...args) { this.draw = args; },
  };
  const canvas = {
    getContext: () => context,
    toDataURL(type) { assert.equal(type, 'image/png'); if (failCanvas) throw new Error('tainted'); return 'data:image/png;base64,PNG'; },
  };
  const link = { click() { this.clicked = true; }, remove() { this.removed = true; } };
  const document = {
    body: { classList: { contains: () => dark }, appendChild() {} },
    fonts: { ready: Promise.resolve() }, importNode: node => node,
    createElement: tag => ({ div: staging, canvas, a: link })[tag],
    defaultView: {
      Image: class {
        set src(value) {
          assert.match(value, /^data:image\/svg\+xml/);
          queueMicrotask(() => failImage ? this.onerror() : this.onload());
        }
      },
      XMLSerializer: class { serializeToString(node) { assert.equal(node, copy); return '<svg/>'; } },
      DOMParser: class { parseFromString() { return { querySelector: () => svg }; } },
      atob,
      getComputedStyle(node) {
        const properties = node === originalLabel ? { color: 'rgb(10, 20, 30)', 'marker-end': 'url("app://obsidian/index.html#arrow")' }
          : { visibility: 'visible' };
        return { [Symbol.iterator]: function* () { yield* Object.keys(properties); },
          getPropertyValue: property => properties[property] ?? '' };
      },
    },
  };
  const container = { ownerDocument: document, appendChild(node) { assert.equal(node, staging); } };
  const render = async (source, target, actualDark) => {
    assert.equal(source, 'flowchart TD\nA --> B');
    assert.equal(target, staging);
    assert.equal(actualDark, dark);
    return { svg: sandbox ? '<iframe/>' : '<svg/>' };
  };
  return { container, render, staging, copy, label, canvas, context, link };
}

test('exports full SVG dimensions at double resolution with styles and local marker references', async () => {
  for (const dark of [false, true]) {
    const f = fixture({ dark });
    await exportPng('flowchart TD\nA --> B', f.container, '流程.png', f.render);
    assert.equal(f.canvas.width, 1000);
    assert.equal(f.canvas.height, 500);
    assert.deepEqual(f.context.draw.slice(1), [0, 0, 1000, 500]);
    assert.equal(f.context.fillStyle, dark ? '#1e1e1e' : '#ffffff');
    assert.equal(f.label.style.color, 'rgb(10, 20, 30)');
    assert.equal(f.label.style['marker-end'], 'url(#arrow)');
    assert.equal(f.copy.style.width, '500px');
    assert.equal(f.link.download, '流程.png');
    assert.equal(f.link.href, 'data:image/png;base64,PNG');
    assert.equal(f.link.clicked, true);
    assert.equal(f.link.removed, true);
    assert.equal(f.staging.removed, true);
  }
});

test('extracts sandbox SVG output for image export', async () => {
  const f = fixture({ sandbox: true });
  await exportPng('flowchart TD\nA --> B', f.container, 'sandbox.png', f.render);
  assert.equal(f.link.clicked, true);
});

test('render, image loading and canvas failures clean up without downloading', async () => {
  for (const failure of ['render', 'image', 'canvas']) {
    const f = fixture({ failImage: failure === 'image', failCanvas: failure === 'canvas' });
    const render = failure === 'render' ? async () => { throw new Error('invalid syntax'); } : f.render;
    await assert.rejects(exportPng('flowchart TD\nA --> B', f.container, 'failed.png', render));
    assert.equal(f.staging.removed, true);
    assert.equal(f.link.clicked, undefined);
  }
});
