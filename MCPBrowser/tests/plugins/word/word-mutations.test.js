import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  copyDocumentContent,
  replaceDocumentTextSurgically,
  updateDocumentContent,
} from '../../../src/plugins/word/helpers.js';
import {
  normalizeDocumentText,
  planTextReplacement,
  verifyDocumentText,
} from '../../../src/plugins/word/mutation-verification.js';
import { mutationFailure } from '../../../src/plugins/word/actions/common.js';
import { WORD_PLUGIN } from '../../../src/plugins/word/index.js';

async function finishWithTimers(t, operation) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let settled = false;
  const pending = operation().finally(() => {
    settled = true;
  });
  for (let i = 0; !settled && i < 100; i++) {
    await setImmediate();
    t.mock.timers.tick(250);
  }
  assert.ok(settled, 'operation must finish within its bounded polling window');
  return pending;
}

function wordFixture({
  text = '',
  pasteHandled = true,
  apply = true,
  delayCopies = 0,
  copyAvailable = true,
  clipboardSurface = false,
  pasteLimit = Infinity,
  wordCountLabel = '',
} = {}) {
  const state = {
    text,
    selection: 'all',
    input: null,
    query: '',
    replacement: '',
    occurrence: 1,
    pending: null,
    copies: 0,
    keys: [],
    insertions: [],
    clicks: [],
  };
  class DataTransfer {
    constructor() {
      this.data = new Map();
      this.files = [];
    }
    setData(type, value) {
      this.data.set(type, value);
    }
    getData(type) {
      return this.data.get(type) || '';
    }
    get types() {
      return [...this.data.keys()];
    }
  }
  class ClipboardEvent {
    constructor(type, options) {
      Object.assign(this, options);
      this.type = type;
      this.defaultPrevented = false;
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
  }
  function insert(value, rich = false) {
    if (!apply) return;
    const next =
      state.selection === 'all'
        ? value
        : state.selection === 'start'
          ? value + (rich ? '\n' : '') + state.text
          : state.text + (rich ? '\n' : '') + value;
    if (delayCopies) state.pending = next;
    else state.text = next;
  }
  function matches() {
    return state.query
      ? [
          ...state.text.matchAll(
            new RegExp(state.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          ),
        ]
      : [];
  }
  const editor = {
    getAttribute: () => 'true',
    getBoundingClientRect: () => ({ width: 1000, height: 800 }),
    querySelector: () => ({}),
    querySelectorAll: (selector) => (selector === '.Page' ? [{}] : [{ textContent: state.text }]),
    focus: () => {
      document.activeElement = editor;
      state.input = null;
    },
    click: () => {},
    dispatchEvent(event) {
      if (event.type === 'copy') {
        if (state.pending !== null && ++state.copies > delayCopies) {
          state.text = state.pending;
          state.pending = null;
        }
        if (copyAvailable) event.clipboardData.setData('text/plain', state.text);
        event.preventDefault();
      }
      if (event.type === 'paste') {
        if (++state.pastes <= pasteLimit) {
          insert(
            event.clipboardData.getData('text/plain'),
            Boolean(event.clipboardData.getData('text/html')),
          );
        }
        if (pasteHandled) event.preventDefault();
      }
    },
  };
  state.pastes = 0;
  const clipboard = {
    id: 'WACViewPanel_ClipboardElement',
    querySelector: () => ({}),
    get innerText() {
      return state.text;
    },
    dispatchEvent: editor.dispatchEvent,
  };
  const panel = {
    get innerText() {
      const count = matches().length;
      return count ? `Result ${state.occurrence} of ${count}` : 'No results';
    },
    querySelectorAll: () => [],
  };
  const document = {
    activeElement: editor,
    hasFocus: () => true,
    querySelector: (selector) =>
      selector === '#ShowWordCountDialog'
        ? { getAttribute: () => wordCountLabel }
        : selector === '#navigationTab3-panel'
          ? panel
          : selector.startsWith('#PagesContainer')
            ? editor
            : null,
  };
  const frame = {
    url: () => 'https://word-edit.officeapps.live.com/we/editor',
    evaluate: (fn, arg) =>
      runInNewContext(`(${fn.toString()})(arg)`, {
        document,
        navigator: { platform: 'Win32' },
        DataTransfer,
        ClipboardEvent,
        arg,
        setTimeout,
        Date,
      }),
    $eval: async () => true,
    $$: async () =>
      ['Match case', 'Whole words only'].map((label) => ({
        evaluate: async (fn) => fn({ textContent: label, getAttribute: () => 'false' }),
        click: async () => {},
      })),
    waitForSelector: async () => {},
    click: async (selector) => {
      state.clicks.push(selector);
      if (selector === '#FindSearchBoxV2') {
        state.input = 'query';
        state.occurrence = 1;
      }
      if (selector === '#ReplaceSearchBoxV2') state.input = 'replacement';
      if (selector === '#NextSearchResult') state.occurrence++;
      if (selector === '#ReplaceButton' || selector === '#ReplaceAllButton') {
        if (!apply) return;
        const expected = planTextReplacement(
          state.text,
          state.query,
          state.replacement,
          {
            matchCase: true,
            occurrence: state.occurrence,
            replaceAll: selector === '#ReplaceAllButton',
          },
          matches().length,
        );
        if (delayCopies) state.pending = expected;
        else state.text = expected;
      }
    },
  };
  const page = {
    url: frame.url,
    frames: () => [frame],
    bringToFront: async () => {},
    keyboard: {
      down: async () => {},
      up: async () => {},
      press: async (key) => {
        state.keys.push(key);
        if (key === 'Home') state.selection = 'start';
        if (key === 'End') state.selection = 'end';
        if (key === 'a') {
          if (state.input) state[state.input] = '';
          else {
            state.selection = 'all';
            if (clipboardSurface)
              setTimeout(() => {
                document.activeElement = clipboard;
              }, 100);
          }
        }
        if (key === 'Backspace') {
          if (state.input) state[state.input] = '';
          else insert('');
        }
      },
      sendCharacter: async (value) => {
        state.insertions.push(value);
        if (state.input) state[state.input] = value;
        else insert(value);
      },
      type: async () => assert.fail('large inputs must not be typed character by character'),
    },
    browser: () => ({
      newPage: async () => ({
        evaluate: async (_fn, { richHtml }) => ({
          html: richHtml,
          nodeCount: 1,
          tableCount: 0,
          linkCount: 0,
          imageCount: 0,
        }),
        close: async () => {},
      }),
    }),
  };
  return { page, state };
}

describe('Word mutation verification', () => {
  it('normalizes layout whitespace without accepting missing or duplicated words', () => {
    assert.equal(normalizeDocumentText('A\u00a0 B\r\nC\u200b'), 'A B C');
    assert.notEqual(normalizeDocumentText('A B'), normalizeDocumentText('AB'));
    assert.notEqual(normalizeDocumentText('A B B'), normalizeDocumentText('A B'));
  });
  it('plans only the requested occurrence and preserves literal replacement dollars', () => {
    assert.equal(
      planTextReplacement('keep cat cat notes', 'cat', '$& dog', { occurrence: 2 }, 2),
      'keep cat $& dog notes',
    );
    assert.equal(
      planTextReplacement('cat cats cat', 'cat', 'dog', { replaceAll: true, wholeWords: true }, 2),
      'dog cats dog',
    );
    assert.equal(planTextReplacement('CAT cat', 'cat', 'dog', { replaceAll: true }, 2), 'dog dog');
    assert.equal(planTextReplacement('cat', 'cat', 'dog', {}, 2), null);
  });
  it('reports an unknown outcome when a write never appears, even though Word is saved', async (t) => {
    const result = await finishWithTimers(t, () =>
      verifyDocumentText(
        async () => ({ accepted: true, text: 'old', saveState: 'saved' }),
        'old',
        'new',
      ),
    );
    assert.equal(result.accepted, false);
    assert.equal(result.changed, null);
    assert.equal(result.reason, 'content_not_verified');
  });
  it('retries a temporarily unavailable copy before verifying the document', async (t) => {
    let attempts = 0;
    const result = await finishWithTimers(t, () =>
      verifyDocumentText(async () => {
        attempts++;
        return attempts < 3
          ? { accepted: false, text: '' }
          : { accepted: true, text: 'new' };
      }, 'old', 'new'),
    );
    assert.equal(result.accepted, true);
    assert.equal(result.verification, 'full_document_text');
    assert.equal(attempts, 3);
  });
  it('does not interpret persistently unavailable copies as an empty document', async (t) => {
    const result = await finishWithTimers(t, () =>
      verifyDocumentText(async () => ({ accepted: false, text: '' }), 'old', ''),
    );
    assert.equal(result.reason, 'verification_unavailable');
  });
  it('does not accept an ignored whitespace-only change', async (t) => {
    const result = await finishWithTimers(t, () =>
      verifyDocumentText(
        async () => ({ accepted: true, text: 'old text' }),
        'old text',
        'old  text',
      ),
    );
    assert.equal(result.accepted, false);
  });
  it('selects and inserts through native keyboard input, then copies the entire result', async () => {
    const { page, state } = wordFixture({ text: 'old' });
    const result = await updateDocumentContent(page, {
      plainText: 'new body',
      placement: 'replace',
    });
    assert.equal(result.accepted, true);
    assert.equal(result.changed, true);
    assert.equal(result.verification, 'full_document_text');
    assert.equal(state.text, 'new body');
    assert.equal(state.pastes, 1);
    assert.deepEqual(state.keys, ['Home', 'a', 'Home', 'a', 'Home', 'a']);
  });
  it('waits for delayed rich content even when the paste event was not cancelled', async (t) => {
    const { page, state } = wordFixture({ text: 'old', pasteHandled: false, delayCopies: 2 });
    const result = await finishWithTimers(t, () =>
      updateDocumentContent(page, { html: '<p>new</p>', plainText: 'new' }),
    );
    assert.equal(result.accepted, true);
    assert.equal(result.pasteHandled, false);
    assert.equal(state.text, 'new');
  });
  it('does not claim success when a cancelled paste event writes nothing', async (t) => {
    const { page } = wordFixture({ text: 'old', pasteHandled: true, apply: false });
    const result = await finishWithTimers(t, () =>
      updateDocumentContent(page, { html: '<p>new</p>', plainText: 'new' }),
    );
    assert.equal(result.accepted, false);
    assert.equal(result.changed, null);
    assert.equal(result.pasteHandled, true);
    assert.match(mutationFailure(result).message, /may have changed/);
  });
  it('refuses a mutation before dispatch if full text cannot be copied', async (t) => {
    const { page, state } = wordFixture({ copyAvailable: false });
    const result = await finishWithTimers(t, () =>
      updateDocumentContent(page, { plainText: 'new' }),
    );
    assert.equal(result.reason, 'document_snapshot_unavailable');
    assert.equal(result.changed, false);
    assert.deepEqual(state.insertions, []);
  });
  it('supports clearing the document and native prepend/append', async () => {
    const { page, state } = wordFixture({ text: 'body' });
    assert.equal(
      (await updateDocumentContent(page, { plainText: 'prefix ', placement: 'start' })).accepted,
      true,
    );
    assert.equal(
      (await updateDocumentContent(page, { plainText: ' suffix', placement: 'end' })).accepted,
      true,
    );
    assert.equal(state.text, 'prefix body suffix');
    assert.equal((await updateDocumentContent(page, { plainText: '' })).accepted, true);
    assert.equal(state.text, '');
  });
  it('recognizes a loaded empty body without treating unavailable text as empty', async (t) => {
    const { page } = wordFixture({ copyAvailable: false, wordCountLabel: '0 words' });
    const result = await finishWithTimers(t, () => copyDocumentContent(page, { textOnly: true }));
    assert.equal(result.accepted, true);
    assert.equal(result.empty, true);
    assert.equal(result.text, '');
  });
  it('waits for the native clipboard surface and supports repeated copies', async (t) => {
    const { page } = wordFixture({
      text: 'model text including offscreen content',
      copyAvailable: false,
      clipboardSurface: true,
    });
    const results = await finishWithTimers(t, async () => [
      await copyDocumentContent(page, { textOnly: true }),
      await copyDocumentContent(page, { textOnly: true }),
    ]);
    assert.ok(
      results.every(
        (result) => result.accepted && result.text === 'model text including offscreen content',
      ),
    );
  });
  it('verifies a surgical edit while preserving independent text and other occurrences', async (t) => {
    const { page, state } = wordFixture({
      text: 'Independent Word note. cat then cat. Review note.',
      delayCopies: 1,
    });

    const result = await finishWithTimers(t, () =>
      replaceDocumentTextSurgically(page, {
        query: 'cat',
        replacement: 'cats',
        occurrence: 2,
        expectedMatchCount: 2,
      }),
    );
    assert.equal(result.changed, true);
    assert.equal(result.replacedCount, 1);
    assert.equal(state.text, 'Independent Word note. cat then cats. Review note.');
    assert.deepEqual(state.insertions, ['cat', 'cats']);
  });
  it('never reports replacedCount for an ignored Replace click', async (t) => {
    const { page, state } = wordFixture({ text: 'old', apply: false });
    const result = await finishWithTimers(t, () =>
      replaceDocumentTextSurgically(page, { query: 'old', replacement: 'new' }),
    );
    assert.equal(result.changed, null);
    assert.equal(result.replacedCount, undefined);
    assert.equal(state.text, 'old');
  });
  it('clears the replacement input for a deletion instead of reusing stale text', async (t) => {
    const { page, state } = wordFixture({ text: 'keep old end' });
    state.replacement = 'stale';
    const result = await finishWithTimers(t, () =>
      replaceDocumentTextSurgically(page, { query: 'old', replacement: '' }),
    );
    assert.equal(result.changed, true);
    assert.equal(state.text, 'keep  end');
  });
  it('does not click Replace for identical or ambiguous edits', async (t) => {
    const { page, state } = wordFixture({ text: 'old old' });
    const result = await finishWithTimers(t, () =>
      replaceDocumentTextSurgically(page, { query: 'old', replacement: 'old', occurrence: 1 }),
    );
    assert.equal(result.reason, 'replacement_is_identical');
    assert.ok(!state.clicks.includes('#ReplaceButton'));
  });
  it('refuses ambiguous and stale selectors without editing', async (t) => {
    const { page, state } = wordFixture({ text: 'old old' });
    const result = await finishWithTimers(t, () =>
      replaceDocumentTextSurgically(page, { query: 'old', replacement: 'new' }),
    );
    assert.equal(result.reason, 'ambiguous_match');
    assert.equal(state.text, 'old old');
    assert.ok(!state.clicks.includes('#ReplaceButton'));
  });
  it('verifies every requested replacement rather than trusting Replace All', async (t) => {
    const { page, state } = wordFixture({ text: 'note old and old footer' });
    const result = await finishWithTimers(t, () =>
      replaceDocumentTextSurgically(page, {
        query: 'old',
        replacement: 'new',
        replaceAll: true,
        expectedMatchCount: 2,
      }),
    );
    assert.equal(result.changed, true);
    assert.equal(result.replacedCount, 2);
    assert.equal(state.text, 'note new and new footer');
  });
});

describe('Word Markdown import verification', () => {
  for (const failSecondChunk of [false, true]) {
    it(
      failSecondChunk
        ? 'stops on an unverified second chunk without claiming no change'
        : 'verifies each chunk before appending the next',
      async (t) => {
        const directory = await mkdtemp(path.join(os.tmpdir(), 'word-import-verification-'));
        try {
          const sourcePath = path.join(directory, 'large.md');
          await writeFile(
            sourcePath,
            Array.from({ length: 2200 }, (_, i) => `Paragraph ${i} ${'x'.repeat(90)}.\n\n`).join(
              '',
            ),
          );
          const { page, state } = wordFixture({ pasteLimit: failSecondChunk ? 1 : Infinity });
          const action = WORD_PLUGIN.getActions().find(
            (action) => action.name === 'import_markdown',
          );
          const result = await action.execute({
            page,
            params: { sourcePath, placement: 'replace' },
          });
          if (failSecondChunk) {
            assert.match(result.message, /chunk 2 of 3/);
            assert.match(result.message, /1 chunk\(s\) have verified/);
            assert.match(result.message, /outcome is unknown/);
            assert.equal(state.pastes, 2);
          } else {
            assert.equal(result.data.chunksInserted, 3);
            assert.equal(result.data.verification, 'full_document_text');
            assert.ok(state.text.includes('Paragraph 2199'));
            assert.equal((state.text.match(/Paragraph /g) || []).length, 2200);
          }
        } finally {
          await rm(directory, { recursive: true });
        }
      },
    );
  }
});

describe('Word action coordination', () => {
  it('refuses competing actions and releases the guard on completion and failure', async () => {
    const actions = WORD_PLUGIN.getActions();
    const getState = actions.find((action) => action.name === 'get_state');
    const invalidReplace = actions.find((action) => action.name === 'replace_document_html');
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const frame = {
      url: () => 'https://word-edit.officeapps.live.com/we/editor',
      evaluate: async (_fn, arg) => {
        if (typeof arg === 'string') return { visible: true, editable: true };
        await gate;
        throw new Error('frame unavailable');
      },
    };
    const pending = getState.execute({
      page: { url: frame.url, frames: () => [frame] },
      params: {},
    });
    try {
      const busy = await invalidReplace.execute({ page: {}, params: {} });
      assert.match(busy.message, /busy.*get_state/);
    } finally {
      release();
      await assert.rejects(pending);
    }
    const result = await invalidReplace.execute({ page: {}, params: {} });
    assert.match(result.message, /html is required/);
  });
});
