import { access, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { marked } from 'marked';
import { decodeEntities, htmlToMarkdown, htmlToText } from '../../core/markdown.js';

export const MAX_MARKDOWN_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_MARKDOWN_CHUNK_HTML_BYTES = 12 * 1024 * 1024;
export const MAX_MARKDOWN_CHUNK_TEXT_CHARACTERS = 25_000;
export const MAX_MARKDOWN_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_MARKDOWN_IMAGE_TOTAL_BYTES = 50 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Map([
  ['.bmp', 'image/bmp'],
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);
const IMAGE_EXTENSIONS = new Map([
  ['image/bmp', '.bmp'],
  ['image/gif', '.gif'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

export function validateMarkdownPath(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} is required and must be a non-empty string`);
  }
  if (!path.isAbsolute(value)) {
    throw new Error(`${name} must be an absolute path`);
  }
  if (!['.md', '.markdown'].includes(path.extname(value).toLowerCase())) {
    throw new Error(`${name} must end in .md or .markdown`);
  }
  return path.resolve(value);
}

function renderTokens(tokens, links) {
  const group = [...tokens];
  group.links = links;
  return marked.parser(group, { gfm: true });
}

function extractAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match ? decodeEntities(match[2]) : '';
}

function replaceAttribute(tag, name, value) {
  const escaped = value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const expression = new RegExp(`(\\s${name}\\s*=\\s*)(["']).*?\\2`, 'i');
  return expression.test(tag)
    ? tag.replace(expression, `$1"${escaped}"`)
    : tag.replace(/\s*\/?>$/, ` ${name}="${escaped}">`);
}

function imagePathFromSource(source, sourceDirectory) {
  if (source.startsWith('file:')) return fileURLToPath(source);
  if (/^[a-z][a-z0-9+.-]*:/i.test(source) && !path.isAbsolute(source)) {
    throw new Error(`Remote or unsupported Markdown image URL is not allowed: ${source}`);
  }
  const withoutFragment = source.split(/[?#]/, 1)[0];
  return path.resolve(sourceDirectory, decodeURIComponent(withoutFragment));
}

async function embedImages(html, sourceDirectory, state) {
  const tags = html.match(/<img\b[^>]*>/gi) || [];
  let result = html;
  for (const tag of tags) {
    const source = extractAttribute(tag, 'src');
    if (!source) continue;
    if (/^data:image\//i.test(source)) {
      throw new Error('Data URL images are not accepted in Markdown input; use a local image file');
    }
    const imagePath = imagePathFromSource(source, sourceDirectory);
    let cached = state.cache.get(imagePath);
    if (!cached) {
      const extension = path.extname(imagePath).toLowerCase();
      const mimeType = IMAGE_MIME_TYPES.get(extension);
      if (!mimeType) {
        throw new Error(`Unsupported Markdown image type '${extension || '(none)'}': ${imagePath}`);
      }
      const imageStat = await stat(imagePath);
      if (!imageStat.isFile()) throw new Error(`Markdown image is not a file: ${imagePath}`);
      if (imageStat.size > MAX_MARKDOWN_IMAGE_BYTES) {
        throw new Error(`Markdown image exceeds the 10 MB limit: ${imagePath}`);
      }
      if (state.totalBytes + imageStat.size > MAX_MARKDOWN_IMAGE_TOTAL_BYTES) {
        throw new Error('Markdown images exceed the 50 MB combined limit');
      }
      const data = await readFile(imagePath);
      cached = {
        dataUrl: `data:${mimeType};base64,${data.toString('base64')}`,
        bytes: imageStat.size,
      };
      state.cache.set(imagePath, cached);
      state.totalBytes += imageStat.size;
    }
    state.references++;
    result = result.replace(tag, replaceAttribute(tag, 'src', cached.dataUrl));
  }
  return result;
}

export async function loadMarkdownForWord(sourcePath) {
  const resolvedPath = validateMarkdownPath(sourcePath, 'sourcePath');
  const sourceStat = await stat(resolvedPath);
  if (!sourceStat.isFile()) throw new Error(`sourcePath is not a file: ${resolvedPath}`);
  if (sourceStat.size > MAX_MARKDOWN_FILE_BYTES) {
    throw new Error('Markdown input exceeds the 25 MB file limit');
  }

  const markdown = await readFile(resolvedPath, 'utf8');
  const tokens = marked.lexer(markdown, { gfm: true });
  const imageState = { cache: new Map(), references: 0, totalBytes: 0 };
  const blocks = [];
  for (const token of tokens) {
    const rendered = renderTokens([token], tokens.links).replaceAll(
      '<table>',
      '<table border="1">',
    );
    if (!rendered.trim()) continue;
    blocks.push(await embedImages(rendered, path.dirname(resolvedPath), imageState));
  }

  const chunks = [];
  let html = '';
  let plainText = '';
  for (const block of blocks) {
    const candidateHtml = html + block;
    const candidateText = htmlToText(candidateHtml);
    const exceedsLimit =
      Buffer.byteLength(candidateHtml, 'utf8') > MAX_MARKDOWN_CHUNK_HTML_BYTES ||
      candidateText.length > MAX_MARKDOWN_CHUNK_TEXT_CHARACTERS;
    if (exceedsLimit && html) {
      chunks.push({ html, plainText });
      html = block;
      plainText = htmlToText(block);
    } else {
      html = candidateHtml;
      plainText = candidateText;
    }
    if (
      Buffer.byteLength(html, 'utf8') > MAX_MARKDOWN_CHUNK_HTML_BYTES ||
      plainText.length > MAX_MARKDOWN_CHUNK_TEXT_CHARACTERS
    ) {
      throw new Error('One Markdown block is too large to insert into Word safely');
    }
  }
  if (html || chunks.length === 0) chunks.push({ html, plainText });

  return {
    sourcePath: resolvedPath,
    sourceBytes: sourceStat.size,
    chunks,
    imageCount: imageState.cache.size,
    imageReferences: imageState.references,
    imageBytes: imageState.totalBytes,
  };
}

function decodeDataImage(source) {
  const match = source.match(/^data:(image\/(?:bmp|gif|jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), data: Buffer.from(match[2], 'base64') };
}

function safeImageName(value, mimeType, index) {
  const candidate = path.basename(value || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  if (candidate && IMAGE_MIME_TYPES.has(path.extname(candidate).toLowerCase())) return candidate;
  return `image-${String(index).padStart(3, '0')}${IMAGE_EXTENSIONS.get(mimeType) || '.bin'}`;
}

async function pathExists(value) {
  try {
    await access(value);
    return true;
  } catch {
    return false;
  }
}

async function uniqueImagePath(directory, requestedName, reserved) {
  const extension = path.extname(requestedName);
  const stem = path.basename(requestedName, extension);
  let candidate = requestedName;
  let suffix = 2;
  while (
    reserved.has(candidate.toLowerCase()) ||
    (await pathExists(path.join(directory, candidate)))
  ) {
    candidate = `${stem}-${suffix++}${extension}`;
  }
  reserved.add(candidate.toLowerCase());
  return path.join(directory, candidate);
}

export async function writeWordClipboardAsMarkdown(
  outputPath,
  clipboard,
  { overwrite = false } = {},
) {
  const resolvedPath = validateMarkdownPath(outputPath, 'outputPath');
  if (!overwrite && (await pathExists(resolvedPath))) {
    throw new Error(`outputPath already exists: ${resolvedPath}`);
  }
  await mkdir(path.dirname(resolvedPath), { recursive: true });

  const baseName = path.basename(resolvedPath, path.extname(resolvedPath));
  const assetDirectoryName = `${baseName}.assets`;
  const assetDirectory = path.join(path.dirname(resolvedPath), assetDirectoryName);
  const clipboardFileList = clipboard.files || [];
  const clipboardFiles = new Map(
    clipboardFileList.map((file) => [path.basename(file.name).toLowerCase(), file]),
  );
  const reservedNames = new Set();
  const unresolvedImages = [];
  let html = clipboard.html || '';
  const tags = html.match(/<img\b[^>]*>/gi) || [];
  let imageCount = 0;

  for (const [tagIndex, tag] of tags.entries()) {
    const source = extractAttribute(tag, 'src');
    let sourceName = path.basename(source.split(/[?#]/, 1)[0]);
    const clipboardFile =
      clipboardFiles.get(sourceName.toLowerCase()) || clipboardFileList[tagIndex];
    if (clipboardFile?.name) sourceName = path.basename(clipboardFile.name);
    let decoded = decodeDataImage(source);
    if (!decoded && clipboardFile) {
      decoded = {
        mimeType: clipboardFile.mimeType,
        data: Buffer.from(clipboardFile.base64, 'base64'),
      };
    }
    if (!decoded) {
      unresolvedImages.push(source || '(missing source)');
      continue;
    }
    if (decoded.data.length > MAX_MARKDOWN_IMAGE_BYTES) {
      throw new Error(`Exported Word image exceeds the 10 MB limit: ${sourceName || source}`);
    }
    await mkdir(assetDirectory, { recursive: true });
    const requestedName = safeImageName(sourceName, decoded.mimeType, imageCount + 1);
    const destination = await uniqueImagePath(assetDirectory, requestedName, reservedNames);
    await writeFile(destination, decoded.data);
    imageCount++;
    const relativeSource = `${assetDirectoryName}/${path.basename(destination)}`.replaceAll(
      '\\',
      '/',
    );
    html = html.replace(tag, replaceAttribute(tag, 'src', relativeSource));
  }

  const markdown = html ? htmlToMarkdown(html) : clipboard.text || '';
  const temporaryPath = `${resolvedPath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, markdown, 'utf8');
  await rename(temporaryPath, resolvedPath);
  const outputStat = await stat(resolvedPath);
  return {
    outputPath: resolvedPath,
    outputBytes: outputStat.size,
    assetDirectory: imageCount > 0 ? assetDirectory : null,
    imageCount,
    unresolvedImages,
    sourceFormat: html ? 'html' : 'text',
  };
}
