import test from 'node:test'
import assert from 'node:assert/strict'
import {
  expectedTools,
  loadPackage,
  storingTools,
  verifyPackage,
} from './plugin-verify.mjs'

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

async function fixture() {
  return {
    ...(await loadPackage()),
    tools: expectedTools.map((name) => ({
      name,
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      _meta: {
        ...(name === 'get_profile' && { 'openai/profile': true }),
        ...(storingTools.has(name) && { 'openai/fileParams': ['image'] }),
        securitySchemes:
          name === 'get_profile' ||
          (name.includes('_member_') && name !== 'request_member_post')
            ? [
                {
                  type: 'oauth2',
                  scopes:
                    name === 'create_member_comment'
                      ? ['posts:write', 'comments:write']
                      : ['posts:write'],
                },
              ]
            : [{ type: 'noauth' }],
      },
      ...(name === 'get_profile' && {
        outputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'name'],
          properties: { id: { type: 'string' }, name: { type: 'string' } },
        },
      }),
      annotations: {
        readOnlyHint: !mutatingTools.has(name) && !storingTools.has(name),
        destructiveHint: mutatingTools.has(name),
        openWorldHint: mutatingTools.has(name) || storingTools.has(name),
      },
    })),
  }
}
test('requires an authenticated read-only profile tool', async () => {
  const p = await fixture()
  assert.ok(expectedTools.includes('get_profile'))
  const profile = p.tools.find((tool) => tool.name === 'get_profile')
  assert.ok(profile)
  profile._meta['openai/profile'] = true
  assert.equal(verifyPackage(p).contract, 'pass')
  profile._meta.securitySchemes = [{ type: 'noauth' }]
  assert.throws(() => verifyPackage(p))
})

test('member review case checks identity and only offers site confirmation by explicit choice', async () => {
  const p = await fixture()
  const memberCase =
    p.manifest.extensions['com.openai'].review.test_cases.positive[2]
  assert.ok(
    memberCase.tools_triggered
      .split(',')
      .map((name) => name.trim())
      .includes('get_profile')
  )
  assert.match(memberCase.expected_behavior, /명시적으로/)
  assert.doesNotMatch(
    memberCase.expected_behavior,
    /OAuth 연결이 불가능하면 새 회원 글에만/
  )
})
test('secret-free contract passes without claiming review or real execution success', async () => {
  const result = verifyPackage(await fixture())
  assert.equal(result.contract, 'pass')
  assert.equal(result.reviewReady, false)
  assert.equal(
    result.policy,
    'model_secret_fields_absent_policy_review_required'
  )
  assert.deepEqual(result.passwordInputTools, [])
})

for (const [name, mutate] of [
  [
    'old resource',
    (p) => {
      p.mcp.mcpServers['0rigin-posts'].extensions['com.openai'].auth.resource +=
        '/member'
    },
  ],
  [
    'wrong authorization server',
    (p) => {
      p.mcp.mcpServers['0rigin-posts'].extensions[
        'com.openai'
      ].auth.authorizationServerBase += '/legacy'
    },
  ],
  [
    'wrong authorization endpoint',
    (p) => {
      p.mcp.mcpServers['0rigin-posts'].extensions[
        'com.openai'
      ].auth.authorizationUrl += '/legacy'
    },
  ],
  [
    'wrong token endpoint',
    (p) => {
      p.mcp.mcpServers['0rigin-posts'].extensions['com.openai'].auth.tokenUrl +=
        '/legacy'
    },
  ],
  [
    'old endpoint',
    (p) => {
      p.mcp.mcpServers['0rigin-posts'].url += '/member'
    },
  ],
  [
    'missing read tool',
    (p) => {
      p.tools = p.tools.filter((t) => t.name !== 'get_post')
    },
  ],
  [
    'missing comment tool',
    (p) => {
      p.tools = p.tools.filter((t) => t.name !== 'list_comments')
    },
  ],
  [
    'six positive cases',
    (p) => {
      p.manifest.extensions['com.openai'].review.test_cases.positive.push(
        p.manifest.extensions['com.openai'].review.test_cases.positive[0]
      )
    },
  ],
  [
    'unknown test tool',
    (p) => {
      p.manifest.extensions[
        'com.openai'
      ].review.test_cases.positive[0].tools_triggered += ', search_posts'
    },
  ],
  [
    'embedded credentials',
    (p) => {
      p.mcp.mcpServers['0rigin-posts'].headers = { Authorization: 'fixture' }
    },
  ],
  [
    'member without OAuth',
    (p) => {
      p.tools.find(
        (t) => t.name === 'create_member_post'
      )._meta.securitySchemes = [{ type: 'noauth' }]
    },
  ],
  [
    'member comment without comments scope',
    (p) => {
      p.tools.find(
        (t) => t.name === 'create_member_comment'
      )._meta.securitySchemes[0].scopes = ['posts:write']
    },
  ],
  [
    'comment writer marked read-only',
    (p) => {
      p.tools.find(
        (t) => t.name === 'create_member_comment'
      ).annotations.readOnlyHint = true
    },
  ],
  [
    'member password field',
    (p) => {
      p.tools.find(
        (t) => t.name === 'create_member_post'
      ).inputSchema.properties.password = {}
    },
  ],
])
  test(`rejects ${name}`, async () => {
    const p = await fixture()
    mutate(p)
    assert.throws(() => verifyPackage(p))
  })

test('includes the current two-round draft review tool', async () => {
  assert.ok(expectedTools.includes('review_draft'))
  const p = await fixture()
  assert.match(p.skill, /`review_draft`/)
  assert.ok(
    p.manifest.extensions['com.openai'].review.test_cases.positive.some((c) =>
      c.tools_triggered
        .split(',')
        .map((s) => s.trim())
        .includes('review_draft')
    )
  )
})

test('includes public comment reading and both comment writers in plugin instructions', async () => {
  const p = await fixture()
  assert.ok(p.skill.includes('`list_comments`'))
  assert.ok(p.skill.includes('`create_comment`'))
  assert.ok(p.skill.includes('`create_member_comment`'))
  assert.ok(
    p.manifest.extensions['com.openai'].review.test_cases.positive.some((c) =>
      c.tools_triggered.includes('create_member_comment')
    )
  )
})

test('directory package stays within five cases and three starter prompts', async () => {
  const { manifest } = await fixture()
  const openai = manifest.extensions['com.openai']
  assert.equal(openai.review.test_cases.positive.length, 5)
  assert.ok(openai.interface.defaultPrompt.length <= 3)
})

test('rejects a fourth starter prompt', async () => {
  const p = await fixture()
  p.manifest.extensions['com.openai'].interface.defaultPrompt = [
    'first prompt',
    'second prompt',
    'third prompt',
    'fourth prompt',
  ]
  assert.throws(() => verifyPackage(p))
})

test('rejects duplicate starter prompts after Unicode and whitespace normalization', async () => {
  const p = await fixture()
  p.manifest.extensions['com.openai'].interface.defaultPrompt = [
    'Read public posts',
    ' Read   public posts ',
  ]
  assert.throws(() => verifyPackage(p))
})

test('rejects starter prompts longer than 128 characters', async () => {
  const p = await fixture()
  p.manifest.extensions['com.openai'].interface.defaultPrompt = [
    'a'.repeat(129),
  ]
  assert.throws(() => verifyPackage(p))
})

test('rejects missing member comment permission in initial OAuth request', async () => {
  const p = await fixture()
  p.mcp.mcpServers['0rigin-posts'].extensions['com.openai'].auth.baseScopes = [
    'posts:write',
  ]
  assert.throws(() => verifyPackage(p))
})

test('requests offline access on every OAuth authorization, including tool-specific requests', async () => {
  const p = await fixture()
  const auth = p.mcp.mcpServers['0rigin-posts'].extensions['com.openai'].auth
  assert.ok(auth.baseScopes.includes('offline_access'))
})

for (const name of [
  'create_post',
  'update_post',
  'delete_post',
  'create_comment',
]) {
  test('rejects password input on staged guest tool ' + name, async () => {
    const p = await fixture()
    p.tools.find((t) => t.name === name).inputSchema.properties.password = {
      type: 'string',
    }
    assert.throws(() => verifyPackage(p), /Secret input field/)
  })
}

test('rejects a nested credential field rather than only top-level passwords', async () => {
  const p = await fixture()
  p.tools.find((t) => t.name === 'create_post').inputSchema.properties.options =
    { type: 'object', properties: { access_token: { type: 'string' } } }
  assert.throws(() => verifyPackage(p), /Secret input field/)
})

test('includes the separate read-only guest action status tool', async () => {
  assert.ok(expectedTools.includes('get_guest_action'))
  const p = await fixture()
  assert.ok(p.skill.includes('get_guest_action'))
  assert.equal(
    p.tools.find((t) => t.name === 'get_guest_action').annotations.readOnlyHint,
    true
  )
})

for (const [name, mutate] of [
  [
    'missing public support page',
    (p) => {
      delete p.manifest.extensions['com.openai'].interface.supportURL
    },
  ],
  [
    'credential-bearing listing URL',
    (p) => {
      p.manifest.extensions['com.openai'].interface.websiteURL =
        'https://user:secret@0rigin.space'
    },
  ],
  [
    'oversized subtitle',
    (p) => {
      p.manifest.extensions['com.openai'].interface.shortDescription =
        '가'.repeat(31)
    },
  ],
  [
    'unsupported category',
    (p) => {
      p.manifest.extensions['com.openai'].interface.category = 'Writing'
    },
  ],
  [
    'icon path escaping the package',
    (p) => {
      p.manifest.extensions['com.openai'].interface.logo =
        './assets/../logo.png'
    },
  ],
  [
    'private app binding in public upload',
    (p) => {
      p.manifest.extensions['com.openai'].apps = {}
    },
  ],
  [
    'missing release notes',
    (p) => {
      delete p.manifest.extensions['com.openai'].publication.release_notes
    },
  ],
]) {
  test(`rejects ${name}`, async () => {
    const p = await fixture()
    mutate(p)
    assert.throws(() => verifyPackage(p))
  })
}
