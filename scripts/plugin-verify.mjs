// 플러그인 ZIP을 만들거나 다시 업로드하기 전에 실행한다. 운영에서는 읽기 전용 tools/list만 호출한다.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const endpoint = 'https://0rigin.space/api/mcp'
export const expectedTools = [
  'get_profile',
  'list_categories',
  'list_posts',
  'get_post',
  'get_guest_action',
  'request_member_post',
  'create_post',
  'update_post',
  'delete_post',
  'create_member_post',
  'update_member_post',
  'delete_member_post',
  'upload_member_image',
  'list_comments',
  'create_comment',
  'create_member_comment',
  'get_writing_guide',
  'check_draft',
  'review_draft',
]
const mutatingTools = new Set([
  'request_member_post',
  'create_post',
  'update_post',
  'delete_post',
  'create_member_post',
  'update_member_post',
  'delete_member_post',
  'create_comment',
  'create_member_comment',
])
// 저장만 하고 글을 바꾸지 않는 도구다. 같은 바이트는 같은 주소라 되풀이해도 결과가 같다
export const storingTools = new Set(['upload_member_image'])
function assertNoSecretFields(schema, prefix) {
  if (!schema || typeof schema !== 'object') return
  for (const name of Object.keys(schema.properties ?? {})) {
    const normalized = name
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/-/g, '_')
      .toLowerCase()
    assert.ok(
      !/(?:password|passcode|authorization|credential|(?:^|_)token$|(?:^|_)api_?key$)/.test(
        normalized
      ),
      'Secret input field: ' + prefix + '.' + name
    )
  }
  for (const value of Object.values(schema)) {
    if (Array.isArray(value))
      value.forEach((part) => assertNoSecretFields(part, prefix))
    else assertNoSecretFields(value, prefix)
  }
}

export function verifyPackage({ manifest, mcp, skill, dependency, tools }) {
  const extension = manifest.extensions['com.openai']
  assert.ok(
    manifest.apps == null && extension.apps == null,
    'Public upload must not contain app bindings'
  )
  const listing = extension.interface
  for (const [key, limit] of [
    ['displayName', 30],
    ['shortDescription', 30],
    ['longDescription', 4000],
    ['developerName', 80],
  ]) {
    assert.equal(typeof listing[key], 'string', `Missing listing field: ${key}`)
    assert.ok(
      listing[key].trim() && [...listing[key]].length <= limit,
      `Invalid listing field: ${key}`
    )
  }
  assert.ok(
    [
      'Business & Operations',
      'Communication',
      'Creativity',
      'Data & Analytics',
      'Developer Tools',
      'Education & Research',
      'Entertainment',
      'Finance',
      'Healthcare',
      'Other',
      'Productivity',
      'Scientific Research',
      'Security',
      'Travel',
    ].includes(listing.category),
    'Unsupported listing category'
  )
  for (const key of [
    'websiteURL',
    'supportURL',
    'privacyPolicyURL',
    'termsOfServiceURL',
  ]) {
    const url = new URL(listing[key])
    assert.ok(
      url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        listing[key].length <= 1024,
      `Invalid listing URL: ${key}`
    )
  }
  for (const key of ['logo', 'composerIcon']) {
    assert.equal(typeof listing[key], 'string', `Missing icon: ${key}`)
    assert.ok(
      /^\.\/assets\/.+\.png$/.test(listing[key]) &&
        !listing[key].split('/').includes('..'),
      `Invalid icon path: ${key}`
    )
  }
  assert.ok(
    extension.publication?.release_notes?.trim(),
    'Missing release notes'
  )
  for (const tool of tools) assertNoSecretFields(tool.inputSchema, tool.name)
  assert.equal(manifest.name, '0rigin')
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/)
  assert.deepEqual(Object.keys(mcp.mcpServers), ['0rigin-posts'])
  const server = mcp.mcpServers['0rigin-posts']
  assert.equal(server.type, 'streamable-http')
  assert.equal(server.url, endpoint)
  assert.deepEqual(server.headers ?? {}, {})
  assert.deepEqual(server.extensions['com.openai'].auth, {
    type: 'mixed',
    client: { mode: 'cimd' },
    resource: endpoint,
    baseScopes: ['posts:write', 'comments:write', 'offline_access'],
    authorizationServerBase: 'https://0rigin.space',
    authorizationUrl: 'https://0rigin.space/api/oauth/authorize',
    tokenUrl: 'https://0rigin.space/api/oauth/token',
  })
  assert.deepEqual(tools.map((t) => t.name).sort(), [...expectedTools].sort())
  const review = manifest.extensions['com.openai'].review
  assert.equal(review.test_cases.positive.length, 5)
  assert.equal(review.test_cases.negative.length, 3)
  for (const key of ['test_credentials', 'reviewer_instructions'])
    assert.ok(!(key in review))
  const prompts = manifest.extensions['com.openai'].interface.defaultPrompt
  assert.ok(Array.isArray(prompts) && prompts.length > 0 && prompts.length <= 3)
  const normalized = prompts.map((prompt) => {
    assert.equal(typeof prompt, 'string')
    assert.ok(prompt.trim().length > 0 && [...prompt].length <= 128)
    assert.ok(!/[\r\n@]/.test(prompt))
    return prompt.normalize('NFKC').trim().replace(/\s+/g, ' ')
  })
  assert.equal(new Set(normalized).size, normalized.length)
  const covered = new Set()
  for (const c of review.test_cases.positive) {
    for (const key of [
      'description',
      'prompt',
      'tools_triggered',
      'expected_behavior',
    ])
      assert.ok(c[key]?.trim())
    for (const name of c.tools_triggered.split(',').map((t) => t.trim())) {
      assert.ok(expectedTools.includes(name), `Unknown tool: ${name}`)
      covered.add(name)
    }
  }
  for (const c of review.test_cases.negative)
    assert.ok(c.description?.trim() && c.prompt?.trim())
  assert.deepEqual([...covered].sort(), [...expectedTools].sort())
  assert.match(skill, /^---\nname: ['"]?origin-writing['"]?\n/)
  assert.match(dependency, /value:\s*['"]?0rigin-posts['"]?/)
  assert.ok(dependency.includes(endpoint))
  assert.ok(
    !JSON.stringify({ manifest, mcp, skill, dependency }).includes(
      '/api/mcp/member'
    )
  )
  for (const tool of tools) {
    assert.ok(skill.includes('`' + tool.name + '`'))
    const member =
      tool.name === 'get_profile' ||
      (tool.name.includes('_member_') && tool.name !== 'request_member_post')
    if (tool.name === 'get_profile') {
      assert.equal(tool._meta?.['openai/profile'], true)
      assert.equal(tool.inputSchema.additionalProperties, false)
      assert.deepEqual(Object.keys(tool.inputSchema.properties ?? {}), [])
      assert.ok(tool.outputSchema?.required?.includes('id'))
      assert.ok(tool.outputSchema?.required?.includes('name'))
      for (const key of ['id', 'name'])
        assert.equal(tool.outputSchema.properties?.[key]?.type, 'string')
    }
    const mutating = mutatingTools.has(tool.name)
    const scopes =
      tool.name === 'create_member_comment'
        ? ['posts:write', 'comments:write']
        : ['posts:write']
    assert.deepEqual(
      tool._meta?.securitySchemes,
      member ? [{ type: 'oauth2', scopes }] : [{ type: 'noauth' }]
    )
    const stores = storingTools.has(tool.name)
    assert.equal(tool.annotations?.readOnlyHint, !mutating && !stores)
    assert.equal(tool.annotations?.destructiveHint, mutating)
    assert.equal(tool.annotations?.openWorldHint, mutating || stores)
    if (stores) assert.deepEqual(tool._meta?.['openai/fileParams'], ['image'])
    if (member)
      for (const key of ['password', 'nickname', 'user_id', 'token'])
        assert.ok(!(key in tool.inputSchema.properties))
  }
  const exposedSecrets = tools
    .filter((t) => 'password' in (t.inputSchema.properties ?? {}))
    .map((t) => t.name)
  return {
    version: manifest.version,
    endpoint,
    toolCount: tools.length,
    positive: 5,
    negative: 3,
    contract: 'pass',
    policy: 'model_secret_fields_absent_policy_review_required',
    passwordInputTools: exposedSecrets,
    realHostOAuth: 'not_proven_by_contract_check',
    realHostMutations: 'not_proven_by_contract_check',
    reviewReady: false,
  }
}
export async function loadPackage() {
  const base = root
  const read = (name) => fs.readFile(path.join(base, name), 'utf8')
  return {
    manifest: JSON.parse(await read('plugin.json')),
    mcp: JSON.parse(await read('mcp.json')),
    skill: await read('skills/origin-writing/SKILL.md'),
    dependency: await read('skills/origin-writing/agents/openai.yaml'),
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    }),
    signal: AbortSignal.timeout(30000),
  })
  assert.ok(response.ok, `HTTP ${response.status}`)
  const text = await response.text()
  const message = response.headers
    .get('content-type')
    ?.includes('text/event-stream')
    ? JSON.parse(
        text
          .split('\n')
          .find((line) => line.startsWith('data: '))
          .slice(6)
      )
    : JSON.parse(text)
  assert.ok(
    Array.isArray(message.result?.tools),
    'tools/list response missing tools'
  )
  console.log(
    JSON.stringify(
      verifyPackage({ ...(await loadPackage()), tools: message.result.tools }),
      null,
      2
    )
  )
}
