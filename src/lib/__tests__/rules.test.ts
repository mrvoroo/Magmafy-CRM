import { describe, expect, it } from 'vitest';
import { companyKey, leadName, missingVars, parseInline, toCsv } from '../rules';

describe('rules', () => {
  it('leadName prefers business, falls back to name then dash', () => {
    expect(leadName({ business: 'Casa Living', name: 'Sara' })).toBe('Casa Living');
    expect(leadName({ business: '', name: 'Sara' })).toBe('Sara');
    expect(leadName(null)).toBe('—');
  });
  it('companyKey groups branches of the same business', () => {
    expect(companyKey('معرض الرفاهية - فرع جدة')).toBe(companyKey('الرفاهية'));
  });
  it('missingVars lists unique placeholders', () => {
    expect(missingVars('Hi {{name}}, {{name}} at {{company}}')).toEqual(['{{name}}', '{{company}}']);
  });
  it('parseInline returns safe parts, never HTML', () => {
    const parts = parseInline('**مهم** <b>x</b> https://a.co @Sara', ['Sara']);
    expect(parts[0]).toEqual({ t: 'bold', v: 'مهم' });
    expect(parts.some((p) => p.t === 'link' && p.v === 'https://a.co')).toBe(true);
    expect(parts.some((p) => p.t === 'mention' && p.v === '@Sara')).toBe(true);
    expect(parts.find((p) => p.t === 'text' && p.v.includes('<b>'))).toBeTruthy();
  });
  it('toCsv escapes quotes, commas and newlines and adds a BOM', () => {
    const csv = toCsv([['a', 'b,c'], ['say "hi"', 'x\ny']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"b,c"');
    expect(csv).toContain('"say ""hi"""');
    expect(csv).toContain('"x\ny"');
  });
});
