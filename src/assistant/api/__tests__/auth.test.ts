// UC-22 — registration and sign-in with email + password.
//
// Every case here is written from what a person can observe through the API:
// what they get back, what they can then reach, and what they are told when it
// goes wrong. Nothing reads a password hash to check its shape.

import { describe, expect, it } from 'vitest'
import { buildHarness } from './helpers.ts'
import type { Harness } from './helpers.ts'

const EMAIL = 'nguyen@example.com'
const PASSWORD = 'correct horse battery'

async function registered(h: Harness, email = EMAIL, password = PASSWORD) {
  const res = await h.agent.post('/auth/register').send({ email, password })
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${res.text}`)
  return res.body as { user: { id: string; email: string }; token: string; expires_at: string }
}

describe('UC-22 registration', () => {
  it('creates an account and hands back a usable token', async () => {
    const h = await buildHarness()
    const out = await registered(h)
    expect(out.user.email).toBe(EMAIL)
    expect(out.token).toBeTypeOf('string')
    expect(out.token.length).toBeGreaterThan(20)

    const me = await h.agent.get('/auth/me').set('Authorization', `Bearer ${out.token}`)
    expect(me.status).toBe(200)
    expect(me.body.user).toMatchObject({ id: out.user.id, email: EMAIL, registered: true })
  })

  it('folds case and surrounding space, so one person is one account', async () => {
    const h = await buildHarness()
    await registered(h, 'Person@Example.COM')
    const again = await h.agent.post('/auth/register').send({ email: '  person@example.com ', password: PASSWORD })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('EMAIL_TAKEN')

    const login = await h.agent.post('/auth/login').send({ email: 'PERSON@example.com', password: PASSWORD })
    expect(login.status).toBe(200)
  })

  it('refuses a password shorter than eight characters, naming the field', async () => {
    const h = await buildHarness()
    const res = await h.agent.post('/auth/register').send({ email: EMAIL, password: 'short12' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(res.body.error.field).toBe('password')
  })

  it('refuses an address that is not an address', async () => {
    const h = await buildHarness()
    for (const email of ['nope', 'a@b', 'two@at@signs.com', 'has space@x.com', '@nodomain.com']) {
      const res = await h.agent.post('/auth/register').send({ email, password: PASSWORD })
      expect(res.status, email).toBe(400)
      expect(res.body.error.field, email).toBe('email')
    }
  })

  it('rejects an unknown field rather than ignoring it', async () => {
    const h = await buildHarness()
    const res = await h.agent.post('/auth/register').send({ email: EMAIL, password: PASSWORD, role: 'admin' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
  })

  it('leaves nothing behind when it refuses', async () => {
    const h = await buildHarness()
    const refused = await h.agent.post('/auth/register').send({ email: EMAIL, password: 'sevench' })
    expect(refused.status).toBe(400)
    const login = await h.agent.post('/auth/login').send({ email: EMAIL, password: 'sevench' })
    expect(login.status).toBe(401)
  })
})

describe('UC-22 sign-in', () => {
  it('accepts the right password and refuses the wrong one', async () => {
    const h = await buildHarness()
    await registered(h)

    const good = await h.agent.post('/auth/login').send({ email: EMAIL, password: PASSWORD })
    expect(good.status).toBe(200)
    expect(good.body.token).toBeTypeOf('string')

    const bad = await h.agent.post('/auth/login').send({ email: EMAIL, password: 'not the password' })
    expect(bad.status).toBe(401)
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('does not reveal whether an address is registered', async () => {
    const h = await buildHarness()
    await registered(h)
    const wrongPassword = await h.agent.post('/auth/login').send({ email: EMAIL, password: 'wrong one here' })
    const noSuchUser = await h.agent.post('/auth/login').send({ email: 'nobody@example.com', password: 'wrong one here' })
    expect(noSuchUser.status).toBe(wrongPassword.status)
    expect(noSuchUser.body.error.code).toBe(wrongPassword.body.error.code)
    expect(noSuchUser.body.error.message).toBe(wrongPassword.body.error.message)
  })

  it('gives each sign-in its own token, and signing out kills only that one', async () => {
    const h = await buildHarness()
    const first = await registered(h)
    const second = await h.agent.post('/auth/login').send({ email: EMAIL, password: PASSWORD })
    const secondToken = second.body.token as string
    expect(secondToken).not.toBe(first.token)

    const out = await h.agent.post('/auth/logout').set('Authorization', `Bearer ${secondToken}`)
    expect(out.status).toBe(200)

    const dead = await h.agent.get('/auth/me').set('Authorization', `Bearer ${secondToken}`)
    expect(dead.status).toBe(401)
    const alive = await h.agent.get('/auth/me').set('Authorization', `Bearer ${first.token}`)
    expect(alive.status).toBe(200)
  })
})

describe('UC-22 the token is the identity', () => {
  it('reaches that account\'s tasks, and no one else\'s', async () => {
    const h = await buildHarness()
    const mine = await registered(h, 'mine@example.com')
    const theirs = await registered(h, 'theirs@example.com')

    const created = await h.agent
      .post('/tasks')
      .set('Authorization', `Bearer ${mine.token}`)
      .send({ title: 'Mua sữa' })
    expect(created.status).toBe(201)

    const myList = await h.agent.get('/tasks').set('Authorization', `Bearer ${mine.token}`)
    expect(myList.body.tasks).toHaveLength(1)

    const theirList = await h.agent.get('/tasks').set('Authorization', `Bearer ${theirs.token}`)
    expect(theirList.body.tasks).toHaveLength(0)
  })

  it('refuses a token that was never issued', async () => {
    const h = await buildHarness()
    const res = await h.agent.get('/tasks').set('Authorization', 'Bearer not-a-real-token')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('expires a token, and says so rather than falling back to the header', async () => {
    const h = await buildHarness()
    const out = await registered(h)
    h.clock.advance(31 * 24 * 60 * 60 * 1000)

    const res = await h.agent
      .get('/tasks')
      .set('Authorization', `Bearer ${out.token}`)
      .set('X-User-Id', 'someone-else@example.com')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('TOKEN_EXPIRED')
  })

  it('beats the header when both are sent', async () => {
    const h = await buildHarness()
    const out = await registered(h)
    await h.agent.post('/tasks').set('Authorization', `Bearer ${out.token}`).send({ title: 'Của tôi' })

    const res = await h.agent
      .get('/tasks')
      .set('Authorization', `Bearer ${out.token}`)
      .set('X-User-Id', 'somebody@example.com')
    expect(res.status).toBe(200)
    expect(res.body.tasks).toHaveLength(1)
  })
})

describe('UC-22 the pre-auth header door', () => {
  it('still answers while it is open, and the account it names is unregistered', async () => {
    const h = await buildHarness()
    const res = await h.agent.get('/auth/me').set('X-User-Id', 'header-only@example.com')
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 'header-only@example.com', email: null, registered: false })
  })

  it('closes completely when the app is built with it off', async () => {
    const h = await buildHarness({ allowHeaderIdentity: false })
    const denied = await h.agent.get('/tasks').set('X-User-Id', 'header-only@example.com')
    expect(denied.status).toBe(401)

    // …and registration still works with the door shut, which is the point.
    const out = await registered(h)
    const allowed = await h.agent.get('/tasks').set('Authorization', `Bearer ${out.token}`)
    expect(allowed.status).toBe(200)
  })
})
