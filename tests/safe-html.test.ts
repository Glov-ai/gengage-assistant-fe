import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../src/common/safe-html.js';

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
});
