import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  packagingFields,
  packagingMismatches,
  pluginDir,
  readPackaging,
  setPackagingVersion,
  writePackageVersions,
} from './plugin-packaging.mjs'
import { endpoint } from './plugin-verify.mjs'

test('three app packages share one version and the production MCP endpoint', async () => {
  const docs = await readPackaging()
  const version = docs['plugin.json'].version
  assert.deepEqual(packagingMismatches(docs, { version, url: endpoint }), [])
})

test('reports the file and key when one package drifts', async () => {
  const docs = await readPackaging()
  const version = docs['plugin.json'].version
  docs['gemini-extension.json'].mcpServers['0rigin-posts'].httpUrl =
    'https://example.com/mcp'
  assert.deepEqual(packagingMismatches(docs, { version, url: endpoint }), [
    `gemini-extension.json mcpServers.0rigin-posts.httpUrl: https://example.com/mcp (기대값 ${endpoint})`,
  ])
})

test('version bump sets every package version', async () => {
  const docs = setPackagingVersion(await readPackaging(), '9.9.9')
  assert.deepEqual(
    packagingMismatches(docs, { version: '9.9.9', url: endpoint }),
    []
  )
})

test('writing a bump changes only the version line of each version file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-version-'))
  const files = [...new Set(packagingFields.map((f) => f.file))]
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true })
    await fs.copyFile(path.join(pluginDir, file), path.join(dir, file))
  }
  const before = await readPackaging(dir)
  const from = before['plugin.json'].version
  await writePackageVersions(setPackagingVersion(before, '9.9.9'), dir)
  for (const file of files) {
    const original = await fs.readFile(path.join(pluginDir, file), 'utf8')
    const written = await fs.readFile(path.join(dir, file), 'utf8')
    assert.equal(
      written,
      original.replace(`"version": "${from}"`, '"version": "9.9.9"'),
      file
    )
  }
  await fs.rm(dir, { recursive: true })
})

