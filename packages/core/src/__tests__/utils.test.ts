import { describe, it, expect } from 'vitest';
import { truncate, formatJson, getUrgencyEmoji, escapeHtml } from '../utils.js';

describe('truncate', () => {
  it('returns string unchanged if within limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns string unchanged if exactly at limit', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and adds ellipsis if over limit', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('handles maxLen < 4 without breaking', () => {
    expect(truncate('hello world', 2)).toBe('he');
    expect(truncate('hello world', 1)).toBe('h');
    expect(truncate('hello world', 3)).toBe('hel');
    expect(truncate('hello world', 0)).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapes all HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('formatJson', () => {
  it('formats object as pretty JSON', () => {
    const result = formatJson({ a: 1 });
    expect(result).toBe('{\n  "a": 1\n}');
  });

  it('truncates long output with numeric maxLen', () => {
    const obj = { key: 'a'.repeat(1000) };
    const result = formatJson(obj, 50);
    expect(result.length).toBe(50);
    expect(result.endsWith('...')).toBe(true);
  });

  it('truncates with options object', () => {
    const obj = { key: 'a'.repeat(1000) };
    const result = formatJson(obj, { maxLen: 50 });
    expect(result.length).toBe(50);
    expect(result.endsWith('...')).toBe(true);
  });

  it('escapes HTML when option is set', () => {
    const result = formatJson({ html: '<b>bold</b>' }, { escapeHtml: true });
    expect(result).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('does not escape HTML by default', () => {
    const result = formatJson({ html: '<b>bold</b>' });
    expect(result).toContain('<b>bold</b>');
  });

  it('uses default maxLen of 500', () => {
    const obj = { key: 'a'.repeat(1000) };
    const result = formatJson(obj);
    expect(result.length).toBe(500);
  });
});

describe('getUrgencyEmoji', () => {
  it('returns correct emoji for each urgency level', () => {
    expect(getUrgencyEmoji('critical')).toBe('🔴');
    expect(getUrgencyEmoji('high')).toBe('🟠');
    expect(getUrgencyEmoji('normal')).toBe('🟡');
    expect(getUrgencyEmoji('low')).toBe('🟢');
  });

  it('returns default emoji for unknown urgency', () => {
    expect(getUrgencyEmoji('unknown')).toBe('⚪');
    expect(getUrgencyEmoji('')).toBe('⚪');
  });
});
