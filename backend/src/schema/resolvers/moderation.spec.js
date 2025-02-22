import { GraphQLClient } from 'graphql-request'
import Factory from '../../seed/factories'
import { host, login, gql } from '../../jest/helpers'
import { neode } from '../../bootstrap/neo4j'

let client
const factory = Factory()
const instance = neode()
const categoryIds = ['cat9']

const setupAuthenticateClient = params => {
  const authenticateClient = async () => {
    await factory.create('User', params)
    const headers = await login(params)
    client = new GraphQLClient(host, { headers })
  }
  return authenticateClient
}

let createResource
let authenticateClient
let createPostVariables
let createCommentVariables

beforeEach(async () => {
  createResource = () => {}
  authenticateClient = () => {
    client = new GraphQLClient(host)
  }
  await instance.create('Category', {
    id: 'cat9',
    name: 'Democracy & Politics',
    icon: 'university',
  })
})

const setup = async () => {
  await createResource()
  await authenticateClient()
}

afterEach(async () => {
  await factory.cleanDatabase()
})

describe('disable', () => {
  const mutation = gql`
    mutation($id: ID!) {
      disable(id: $id)
    }
  `
  let variables

  beforeEach(() => {
    // our defaul set of variables
    variables = {
      id: 'blabla',
    }
  })

  const action = async () => {
    return client.request(mutation, variables)
  }

  it('throws authorization error', async () => {
    await setup()
    await expect(action()).rejects.toThrow('Not Authorised')
  })

  describe('authenticated', () => {
    beforeEach(() => {
      authenticateClient = setupAuthenticateClient({
        email: 'user@example.org',
        password: '1234',
      })
    })

    it('throws authorization error', async () => {
      await setup()
      await expect(action()).rejects.toThrow('Not Authorised')
    })

    describe('as moderator', () => {
      beforeEach(() => {
        authenticateClient = setupAuthenticateClient({
          id: 'u7',
          email: 'moderator@example.org',
          password: '1234',
          role: 'moderator',
        })
      })

      describe('on something that is not a (Comment|Post|User) ', () => {
        beforeEach(async () => {
          variables = {
            id: 't23',
          }
          createResource = () => {
            return Promise.all([factory.create('Tag', { id: 't23' })])
          }
        })

        it('returns null', async () => {
          const expected = { disable: null }
          await setup()
          await expect(action()).resolves.toEqual(expected)
        })
      })

      describe('on a comment', () => {
        beforeEach(async () => {
          variables = {
            id: 'c47',
          }
          createPostVariables = {
            id: 'p3',
            title: 'post to comment on',
            content: 'please comment on me',
            categoryIds,
          }
          createCommentVariables = {
            id: 'c47',
            postId: 'p3',
            content: 'this comment was created for this post',
          }
          createResource = async () => {
            await factory.create('User', {
              id: 'u45',
              email: 'commenter@example.org',
              password: '1234',
            })
            const asAuthenticatedUser = await factory.authenticateAs({
              email: 'commenter@example.org',
              password: '1234',
            })
            await asAuthenticatedUser.create('Post', createPostVariables)
            await asAuthenticatedUser.create('Comment', createCommentVariables)
          }
        })

        it('returns disabled resource id', async () => {
          const expected = { disable: 'c47' }
          await setup()
          await expect(action()).resolves.toEqual(expected)
        })

        it('changes .disabledBy', async () => {
          const before = { Comment: [{ id: 'c47', disabledBy: null }] }
          const expected = { Comment: [{ id: 'c47', disabledBy: { id: 'u7' } }] }

          await setup()
          await expect(client.request('{ Comment { id,  disabledBy { id } } }')).resolves.toEqual(
            before,
          )
          await action()
          await expect(
            client.request('{ Comment(disabled: true) { id,  disabledBy { id } } }'),
          ).resolves.toEqual(expected)
        })

        it('updates .disabled on comment', async () => {
          const before = { Comment: [{ id: 'c47', disabled: false }] }
          const expected = { Comment: [{ id: 'c47', disabled: true }] }

          await setup()
          await expect(client.request('{ Comment { id disabled } }')).resolves.toEqual(before)
          await action()
          await expect(
            client.request('{ Comment(disabled: true) { id disabled } }'),
          ).resolves.toEqual(expected)
        })
      })

      describe('on a post', () => {
        beforeEach(async () => {
          variables = {
            id: 'p9',
          }

          createResource = async () => {
            await factory.create('User', { email: 'author@example.org', password: '1234' })
            await factory.authenticateAs({ email: 'author@example.org', password: '1234' })
            await factory.create('Post', {
              id: 'p9', // that's the ID we will look for
              categoryIds,
            })
          }
        })

        it('returns disabled resource id', async () => {
          const expected = { disable: 'p9' }
          await setup()
          await expect(action()).resolves.toEqual(expected)
        })

        it('changes .disabledBy', async () => {
          const before = { Post: [{ id: 'p9', disabledBy: null }] }
          const expected = { Post: [{ id: 'p9', disabledBy: { id: 'u7' } }] }

          await setup()
          await expect(client.request('{ Post { id,  disabledBy { id } } }')).resolves.toEqual(
            before,
          )
          await action()
          await expect(
            client.request('{ Post(disabled: true) { id,  disabledBy { id } } }'),
          ).resolves.toEqual(expected)
        })

        it('updates .disabled on post', async () => {
          const before = { Post: [{ id: 'p9', disabled: false }] }
          const expected = { Post: [{ id: 'p9', disabled: true }] }

          await setup()
          await expect(client.request('{ Post { id disabled } }')).resolves.toEqual(before)
          await action()
          await expect(client.request('{ Post(disabled: true) { id disabled } }')).resolves.toEqual(
            expected,
          )
        })
      })
    })
  })
})

describe('enable', () => {
  const mutation = gql`
    mutation($id: ID!) {
      enable(id: $id)
    }
  `
  let variables

  const action = async () => {
    return client.request(mutation, variables)
  }

  beforeEach(() => {
    // our defaul set of variables
    variables = {
      id: 'blabla',
    }
  })

  it('throws authorization error', async () => {
    await setup()
    await expect(action()).rejects.toThrow('Not Authorised')
  })

  describe('authenticated', () => {
    beforeEach(() => {
      authenticateClient = setupAuthenticateClient({
        email: 'user@example.org',
        password: '1234',
      })
    })

    it('throws authorization error', async () => {
      await setup()
      await expect(action()).rejects.toThrow('Not Authorised')
    })

    describe('as moderator', () => {
      beforeEach(async () => {
        authenticateClient = setupAuthenticateClient({
          role: 'moderator',
          email: 'someuser@example.org',
          password: '1234',
        })
      })

      describe('on something that is not a (Comment|Post|User) ', () => {
        beforeEach(async () => {
          variables = {
            id: 't23',
          }
          createResource = () => {
            // we cannot create a :DISABLED relationship here
            return Promise.all([factory.create('Tag', { id: 't23' })])
          }
        })

        it('returns null', async () => {
          const expected = { enable: null }
          await setup()
          await expect(action()).resolves.toEqual(expected)
        })
      })

      describe('on a comment', () => {
        beforeEach(async () => {
          variables = {
            id: 'c456',
          }
          createPostVariables = {
            id: 'p9',
            title: 'post to comment on',
            content: 'please comment on me',
            categoryIds,
          }
          createCommentVariables = {
            id: 'c456',
            postId: 'p9',
            content: 'this comment was created for this post',
          }
          createResource = async () => {
            await factory.create('User', {
              id: 'u123',
              email: 'author@example.org',
              password: '1234',
            })
            const asAuthenticatedUser = await factory.authenticateAs({
              email: 'author@example.org',
              password: '1234',
            })
            await asAuthenticatedUser.create('Post', createPostVariables)
            await asAuthenticatedUser.create('Comment', createCommentVariables)

            const disableMutation = gql`
              mutation {
                disable(id: "c456")
              }
            `
            await factory.mutate(disableMutation) // that's we want to delete
          }
        })

        it('returns disabled resource id', async () => {
          const expected = { enable: 'c456' }
          await setup()
          await expect(action()).resolves.toEqual(expected)
        })

        it('changes .disabledBy', async () => {
          const before = { Comment: [{ id: 'c456', disabledBy: { id: 'u123' } }] }
          const expected = { Comment: [{ id: 'c456', disabledBy: null }] }

          await setup()
          await expect(
            client.request('{ Comment(disabled: true) { id,  disabledBy { id } } }'),
          ).resolves.toEqual(before)
          await action()
          await expect(client.request('{ Comment { id,  disabledBy { id } } }')).resolves.toEqual(
            expected,
          )
        })

        it('updates .disabled on post', async () => {
          const before = { Comment: [{ id: 'c456', disabled: true }] }
          const expected = { Comment: [{ id: 'c456', disabled: false }] }

          await setup()
          await expect(
            client.request('{ Comment(disabled: true) { id disabled } }'),
          ).resolves.toEqual(before)
          await action() // this updates .disabled
          await expect(client.request('{ Comment { id disabled } }')).resolves.toEqual(expected)
        })
      })

      describe('on a post', () => {
        beforeEach(async () => {
          variables = {
            id: 'p9',
          }

          createResource = async () => {
            await factory.create('User', {
              id: 'u123',
              email: 'author@example.org',
              password: '1234',
            })
            await factory.authenticateAs({ email: 'author@example.org', password: '1234' })
            await factory.create('Post', {
              id: 'p9', // that's the ID we will look for
              categoryIds,
            })

            const disableMutation = gql`
              mutation {
                disable(id: "p9")
              }
            `
            await factory.mutate(disableMutation) // that's we want to delete
          }
        })

        it('returns disabled resource id', async () => {
          const expected = { enable: 'p9' }
          await setup()
          await expect(action()).resolves.toEqual(expected)
        })

        it('changes .disabledBy', async () => {
          const before = { Post: [{ id: 'p9', disabledBy: { id: 'u123' } }] }
          const expected = { Post: [{ id: 'p9', disabledBy: null }] }

          await setup()
          await expect(
            client.request('{ Post(disabled: true) { id,  disabledBy { id } } }'),
          ).resolves.toEqual(before)
          await action()
          await expect(client.request('{ Post { id,  disabledBy { id } } }')).resolves.toEqual(
            expected,
          )
        })

        it('updates .disabled on post', async () => {
          const before = { Post: [{ id: 'p9', disabled: true }] }
          const expected = { Post: [{ id: 'p9', disabled: false }] }

          await setup()
          await expect(client.request('{ Post(disabled: true) { id disabled } }')).resolves.toEqual(
            before,
          )
          await action() // this updates .disabled
          await expect(client.request('{ Post { id disabled } }')).resolves.toEqual(expected)
        })
      })
    })
  })
})
