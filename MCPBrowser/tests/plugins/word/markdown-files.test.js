import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  loadMarkdownForWord,
  validateMarkdownPath,
  writeWordClipboardAsMarkdown,
} from '../../../src/plugins/word/markdown-files.js';

const temporaryDirectories = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mcpbrowser-word-markdown-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('Word Markdown files — path validation', () => {
  it('requires absolute Markdown paths', () => {
    assert.throws(() => validateMarkdownPath('document.md', 'sourcePath'), /absolute path/);
    assert.throws(
      () => validateMarkdownPath(path.resolve('document.txt'), 'sourcePath'),
      /\.md or \.markdown/,
    );
    assert.equal(
      validateMarkdownPath(path.resolve('document.md'), 'sourcePath'),
      path.resolve('document.md'),
    );
  });
});

describe('Word Markdown files — import', () => {
  it('loads Markdown and embeds referenced local images without returning source content', async () => {
    const directory = await temporaryDirectory();
    const imagePath = path.join(directory, 'diagram.png');
    const markdownPath = path.join(directory, 'guide.md');
    await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await writeFile(markdownPath, '# Guide\n\n![Architecture](diagram.png)\n');

    const imported = await loadMarkdownForWord(markdownPath);

    assert.equal(imported.sourcePath, markdownPath);
    assert.equal(imported.imageCount, 1);
    assert.equal(imported.imageReferences, 1);
    assert.equal(imported.chunks.length, 1);
    assert.match(imported.chunks[0].html, /<h1>Guide<\/h1>/);
    assert.match(imported.chunks[0].html, /src="data:image\/png;base64,/);
    assert.equal('markdown' in imported, false);
  });

  it('rejects remote image references instead of silently dropping them', async () => {
    const directory = await temporaryDirectory();
    const markdownPath = path.join(directory, 'guide.md');
    await writeFile(markdownPath, '![Remote](https://example.com/image.png)\n');

    await assert.rejects(() => loadMarkdownForWord(markdownPath), /not allowed/);
  });
});

describe('Word Markdown files — export', () => {
  it('writes Markdown and preserved image names to a sibling assets folder', async () => {
    const directory = await temporaryDirectory();
    const outputPath = path.join(directory, 'Meeting Notes.md');
    const base64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');

    const exported = await writeWordClipboardAsMarkdown(outputPath, {
      html: `<h1>Notes</h1><p><img src="data:image/png;base64,${base64}" alt="Team"></p>`,
      text: 'Notes\nTeam',
      files: [{ name: 'team-photo.png', mimeType: 'image/png', base64 }],
    });

    const markdown = await readFile(outputPath, 'utf8');
    const image = await readFile(path.join(directory, 'Meeting Notes.assets', 'team-photo.png'));
    assert.match(markdown, /# Notes/);
    assert.match(markdown, /!\[Team\]\(Meeting Notes\.assets\/team-photo\.png\)/);
    assert.deepEqual(image, Buffer.from(base64, 'base64'));
    assert.equal(exported.outputPath, outputPath);
    assert.equal(exported.imageCount, 1);
    assert.equal(exported.assetDirectory, path.join(directory, 'Meeting Notes.assets'));
    assert.deepEqual(exported.unresolvedImages, []);
  });

  it('does not overwrite an existing Markdown file unless requested', async () => {
    const directory = await temporaryDirectory();
    const outputPath = path.join(directory, 'existing.md');
    await writeFile(outputPath, 'keep');

    await assert.rejects(
      () =>
        writeWordClipboardAsMarkdown(outputPath, {
          html: '<p>replacement</p>',
          text: 'replacement',
          files: [],
        }),
      /already exists/,
    );
    assert.equal(await readFile(outputPath, 'utf8'), 'keep');
  });
});
