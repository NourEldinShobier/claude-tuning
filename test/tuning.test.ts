import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadRoster, parseSkill } from '../src/roster';
import { block, skip } from '../src/suggest';
import { MARK, patch } from '../src/cap-context-mode';

describe('roster', () => {
  test('reads plain and folded descriptions', () => {
    expect(parseSkill('---\nname: gsap\ndescription: Use for GSAP.\n---\n# Body').description).toBe('Use for GSAP.');
    const folded = parseSkill('---\nname: p\ndescription: >\n  Forces the laziest\n  solution.\nlicense: MIT\n---\nbody');
    expect(folded).toEqual({ name: 'p', description: 'Forces the laziest solution.', body: 'body' });
    expect(parseSkill('---\ndescription: "Quoted: yes"\n---\n').description).toBe('Quoted: yes');
  });

  test('loads the real roster with plugin prefixes', () => {
    const roster = loadRoster(process.cwd());
    expect(roster.length).toBeGreaterThan(100);
    expect(roster.some((s) => s.id === 'web-search:web-search')).toBe(true);
    expect(roster.every((s) => s.description.length > 0)).toBe(true);
  });
});

describe('suggest', () => {
  test('skips slash commands, skill invocations and short replies', () => {
    expect(skip('go')).toBe(true);
    expect(skip('/web-search:web-search bun')).toBe(true);
    expect(skip('add a scroll reveal animation to the hero section')).toBe(false);
  });

  test('suggestion wording is ignorable', () => {
    expect(block('gsap')).toContain('Relevant to the current request: gsap. Ignore this if it does not fit');
  });
});

describe('context-mode cap', () => {
  const root = join(homedir(), '.claude', 'plugins', 'cache', 'context-mode', 'context-mode');
  const version = readdirSync(root).sort().at(-1)!;
  const src = readFileSync(join(root, version, 'hooks', 'sessionstart.mjs'), 'utf8');

  test('patches the installed context-mode once', () => {
    const once = patch(src.replace(/\n\s*\/\/ \[claude-tuning[^\n]*[\s\S]*?\n  }\n/, '\n'));
    expect(once).toContain(MARK);
    expect(patch(once!)).toBeNull();
  });

  test('the patched cut keeps the start and stays under 10,000 characters', () => {
    let additionalContext = `<rules>${'r'.repeat(4600)}</rules>\n` + 'line of session guide\n'.repeat(1200);
    // Run the exact snippet the patch inserts.
    const snippet = /if \(additionalContext\.length > 9500\) \{[\s\S]*?\n  \}/.exec(patch(src.replace(/\n\s*\/\/ \[claude-tuning[^\n]*[\s\S]*?\n  }\n/, '\n'))!)![0];
    additionalContext = new Function('additionalContext', `${snippet}; return additionalContext;`)(additionalContext);
    expect(additionalContext.length).toBeLessThan(10_000);
    expect(additionalContext.startsWith(`<rules>${'r'.repeat(4600)}</rules>`)).toBe(true);
    expect(additionalContext).toContain('ctx_search');
  });
});
