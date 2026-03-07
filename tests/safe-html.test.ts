import { describe, it, expect } from 'vitest';
import { sanitizeHtml, isSafeUrl, isSafeImageUrl, safeSetAttribute } from '../src/common/safe-html.js';

describe('sanitizeHtml', () => {
  it('preserves allowed tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
    expect(result).toContain('Hello');
    expect(result).toContain('world');
  });

  it('preserves <a>, <ul>, <li> tags', () => {
    const input = '<ul><li>one</li><li>two</li></ul><a href="https://example.com">link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
    expect(result).toContain('<a ');
    expect(result).toContain('link');
  });

  it('strips <script> tags entirely including children', () => {
    const input = '<p>before</p><script>alert("xss")</script><p>after</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
    expect(result).toContain('before');
    expect(result).toContain('after');
  });

  it('strips <iframe>, <object>, <embed>, <form> tags', () => {
    const input = '<iframe src="x"></iframe><object data="x"></object><embed src="x"><form><input></form>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('iframe');
    expect(result).not.toContain('object');
    expect(result).not.toContain('embed');
    expect(result).not.toContain('form');
    expect(result).not.toContain('input');
  });

  it('removes javascript: from href', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript');
    expect(result).toContain('click');
    // The href should be stripped since it doesn't start with http/https/mailto
    expect(result).not.toContain('alert');
  });

  it('forces target="_blank" and rel="noopener noreferrer" on <a>', () => {
    const input = '<a href="https://example.com">link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('allows style on div, span, p', () => {
    const input = '<div style="color:red">a</div><span style="font-weight:bold">b</span><p style="margin:0">c</p>';
    const result = sanitizeHtml(input);
    expect(result).toContain('style="color:red"');
    expect(result).toContain('style="font-weight:bold"');
    expect(result).toContain('style="margin:0"');
  });

  it('strips style on elements other than div/span/p', () => {
    const input = '<strong style="color:red">bold</strong>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<strong>');
    expect(result).not.toContain('style');
  });

  it('allows img with https:// src', () => {
    const input = '<img src="https://example.com/img.png" alt="pic" width="100" height="50">';
    const result = sanitizeHtml(input);
    expect(result).toContain('src="https://example.com/img.png"');
    expect(result).toContain('alt="pic"');
    expect(result).toContain('width="100"');
    expect(result).toContain('height="50"');
  });

  it('strips img with http:// or data: src', () => {
    const httpImg = '<img src="http://example.com/img.png">';
    const httpResult = sanitizeHtml(httpImg);
    expect(httpResult).not.toContain('src=');

    const dataImg = '<img src="data:image/png;base64,abc">';
    const dataResult = sanitizeHtml(dataImg);
    expect(dataResult).not.toContain('src=');
  });

  it('unwraps unknown elements (children promoted)', () => {
    const input = '<custom>hello <strong>world</strong></custom>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('custom');
    expect(result).toContain('hello');
    expect(result).toContain('<strong>world</strong>');
  });

  it('plain text input is returned unchanged', () => {
    const input = 'Hello world, no tags here!';
    const result = sanitizeHtml(input);
    expect(result).toBe('Hello world, no tags here!');
  });

  it('empty string returns empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('handles real KVKK notice HTML', () => {
    const kvkk =
      '<div style="font-size:12px"><p>KVKK bilgilendirmesi icin <a href="https://example.com/kvkk">tiklayiniz</a>.</p></div>';
    const result = sanitizeHtml(kvkk);
    expect(result).toContain('<div style="font-size:12px">');
    expect(result).toContain('<p>');
    expect(result).toContain('href="https://example.com/kvkk"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('tiklayiniz');
  });

  it('strips javascript: with whitespace/case variations', () => {
    const input1 = '<a href="  JavaScript:alert(1)">x</a>';
    const result1 = sanitizeHtml(input1);
    expect(result1).not.toContain('javascript');
    expect(result1).not.toContain('JavaScript');
  });

  it('preserves class attribute on any allowed tag', () => {
    const input = '<p class="my-class">text</p>';
    const result = sanitizeHtml(input);
    expect(result).toContain('class="my-class"');
  });

  it('strips event handler attributes', () => {
    const input = '<div onclick="alert(1)" onmouseover="hack()">text</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onmouseover');
    expect(result).toContain('text');
  });

  it('strips CSS url() from style attributes', () => {
    const input = '<div style="background:url(javascript:alert(1))">text</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('url(');
    expect(result).not.toContain('javascript');
    expect(result).toContain('text');
  });

  it('strips CSS expression() from style attributes', () => {
    const input = '<div style="width:expression(alert(1))">text</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('expression');
    expect(result).not.toContain('alert');
  });

  it('strips -moz-binding from style attributes', () => {
    const input = '<div style="-moz-binding:url(evil)">text</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('-moz-binding');
    expect(result).not.toContain('evil');
  });

  it('strips behavior: from style attributes (IE)', () => {
    const input = '<div style="behavior:url(evil.htc)">text</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('behavior');
    expect(result).not.toContain('evil');
  });

  it('strips disallowed CSS properties from style', () => {
    const input = '<div style="color:red; position:fixed; z-index:99999">text</div>';
    const result = sanitizeHtml(input);
    expect(result).toContain('color');
    // position and z-index not in safe list
    expect(result).not.toContain('position');
    expect(result).not.toContain('z-index');
  });

  it('keeps multiple safe CSS properties', () => {
    const input = '<div style="color:red; font-size:14px; margin:0 auto">text</div>';
    const result = sanitizeHtml(input);
    expect(result).toContain('color');
    expect(result).toContain('font-size');
    expect(result).toContain('margin');
  });

  it('removes style attribute entirely when no safe properties remain', () => {
    const input = '<div style="position:absolute; z-index:999">text</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('style');
  });

  it('strips <template> tags entirely', () => {
    const input = '<template><img src=x onerror=alert(1)></template><p>safe</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('template');
    expect(result).not.toContain('onerror');
    expect(result).toContain('safe');
  });

  it('strips <noscript> tags entirely', () => {
    const input = '<noscript><img src=x onerror=alert(1)></noscript><p>safe</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('noscript');
    expect(result).toContain('safe');
  });

  it('strips background-image with url() from style', () => {
    const input = '<div style="background-color:red; color:blue">text</div>';
    const result = sanitizeHtml(input);
    expect(result).toContain('background-color');
    expect(result).toContain('color');
  });

  it('strips CSS @import from style values', () => {
    const input = '<div style="color:import(evil)">text</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('import');
  });
});

describe('isSafeUrl', () => {
  it('allows https URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
  });

  it('allows http URLs', () => {
    expect(isSafeUrl('http://example.com')).toBe(true);
  });

  it('allows relative paths starting with /', () => {
    expect(isSafeUrl('/products/123')).toBe(true);
  });

  it('rejects javascript: protocol', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects javascript: with whitespace and case variations', () => {
    expect(isSafeUrl('  JavaScript:alert(1)')).toBe(false);
  });

  it('rejects protocol-relative URLs', () => {
    expect(isSafeUrl('//evil.com/path')).toBe(false);
  });

  it('rejects data: URLs', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects blob: URLs', () => {
    expect(isSafeUrl('blob:http://example.com/uuid')).toBe(false);
  });

  it('rejects vbscript: protocol', () => {
    expect(isSafeUrl('vbscript:MsgBox("xss")')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSafeUrl('')).toBe(false);
  });
});

describe('isSafeImageUrl', () => {
  it('allows https image URLs', () => {
    expect(isSafeImageUrl('https://cdn.example.com/photo.jpg')).toBe(true);
  });

  it('allows http image URLs', () => {
    expect(isSafeImageUrl('http://cdn.example.com/photo.jpg')).toBe(true);
  });

  it('rejects javascript: protocol', () => {
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: URLs', () => {
    expect(isSafeImageUrl('data:image/png;base64,abc')).toBe(false);
  });

  it('rejects relative paths (requires absolute URL)', () => {
    expect(isSafeImageUrl('/images/photo.jpg')).toBe(false);
  });
});

describe('safeSetAttribute', () => {
  it('sets safe href attribute', () => {
    const el = document.createElement('a');
    safeSetAttribute(el, 'href', 'https://example.com');
    expect(el.getAttribute('href')).toBe('https://example.com');
  });

  it('blocks javascript: in href', () => {
    const el = document.createElement('a');
    safeSetAttribute(el, 'href', 'javascript:alert(1)');
    expect(el.getAttribute('href')).toBeNull();
  });

  it('blocks data: in src', () => {
    const el = document.createElement('img');
    safeSetAttribute(el, 'src', 'data:image/png;base64,abc');
    expect(el.getAttribute('src')).toBeNull();
  });

  it('allows non-url attributes without validation', () => {
    const el = document.createElement('div');
    safeSetAttribute(el, 'class', 'my-class');
    expect(el.getAttribute('class')).toBe('my-class');
  });
});
