import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplate } from '../dist/templates.js';

test('templates escape text slots and insert generated markup without interpreting it again', () => {
  const html = renderTemplate('figure', {
    id: 'chart',
    title: '<b>{{legend}}</b> & "quoted"',
    legend: '<span>{{title}}</span>',
    svg: '<svg></svg>',
  });
  assert.match(html, /<figcaption>&lt;b&gt;\{\{legend\}\}&lt;\/b&gt; &amp; &quot;quoted&quot;<\/figcaption>/);
  assert.match(html, /<span>\{\{title\}\}<\/span>/);
  assert.match(html, /<svg><\/svg>/);
});

test('missing template values fail instead of producing an incomplete report', () => {
  assert.throws(() => renderTemplate('figure', { id: 'chart' }), /Missing template value: figure.title/);
});
