import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const pluginDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

// 앱마다 따로 적힌 버전과 MCP 주소의 위치. 하나만 고치고 잊지 않도록 이 표로 함께 읽고 쓴다
export const packagingFields = [
  { app: 'chatgpt', file: 'plugin.json', field: 'version', key: ['version'] },
  {
    app: 'chatgpt',
    file: 'mcp.json',
    field: 'url',
    key: ['mcpServers', '0rigin-posts', 'url'],
  },
  {
    app: 'claude',
    file: '.claude-plugin/plugin.json',
    field: 'version',
    key: ['version'],
  },
  {
    app: 'claude',
    file: '.mcp.json',
    field: 'url',
    key: ['mcpServers', '0rigin-posts', 'url'],
  },
  {
    app: 'gemini',
    file: 'gemini-extension.json',
    field: 'version',
    key: ['version'],
  },
  {
    app: 'gemini',
    file: 'gemini-extension.json',
    field: 'url',
    key: ['mcpServers', '0rigin-posts', 'httpUrl'],
  },
]

const files = [...new Set(packagingFields.map((f) => f.file))]

export async function readPackaging(dir = pluginDir) {
  const entries = await Promise.all(
    files.map(async (file) => [
      file,
      JSON.parse(await fs.readFile(path.join(dir, file), 'utf8')),
    ])
  )
  return Object.fromEntries(entries)
}

export function packagingMismatches(docs, { version, url }) {
  const expected = { version, url }
  return packagingFields.flatMap(({ file, field, key }) => {
    const actual = key.reduce((value, part) => value?.[part], docs[file])
    return actual === expected[field]
      ? []
      : [`${file} ${key.join('.')}: ${actual} (기대값 ${expected[field]})`]
  })
}

export function setPackagingVersion(docs, version) {
  for (const { file, field, key } of packagingFields) {
    if (field !== 'version') continue
    const parent = key
      .slice(0, -1)
      .reduce((value, part) => value[part], docs[file])
    parent[key.at(-1)] = version
  }
  return docs
}

// 버전이 든 파일만 다시 쓴다. JSON 파일은 JSON.stringify 두 칸 들여쓰기 모양을 지켜 버전 줄만 바뀌게 한다
export async function writePackageVersions(docs, dir = pluginDir) {
  const written = [
    ...new Set(
      packagingFields.filter((f) => f.field === 'version').map((f) => f.file)
    ),
  ].map((file) => path.join(dir, file))
  for (const target of written)
    await fs.writeFile(
      target,
      JSON.stringify(docs[path.relative(dir, target)], null, 2) + '\n'
    )
}
