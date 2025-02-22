import { GraphQLClient } from 'graphql-request'
import Factory from '../../seed/factories'
import { host, login } from '../../jest/helpers'

const factory = Factory()
let clientUser1
let headersUser1

const mutationFollowUser = id => `
  mutation {
    follow(id: "${id}", type: User)
  }
`
const mutationUnfollowUser = id => `
  mutation {
    unfollow(id: "${id}", type: User)
  }
`

beforeEach(async () => {
  await factory.create('User', {
    id: 'u1',
    email: 'test@example.org',
    password: '1234',
  })
  await factory.create('User', {
    id: 'u2',
    email: 'test2@example.org',
    password: '1234',
  })

  headersUser1 = await login({ email: 'test@example.org', password: '1234' })
  clientUser1 = new GraphQLClient(host, { headers: headersUser1 })
})

afterEach(async () => {
  await factory.cleanDatabase()
})

describe('follow', () => {
  describe('follow user', () => {
    describe('unauthenticated follow', () => {
      it('throws authorization error', async () => {
        const client = new GraphQLClient(host)
        await expect(client.request(mutationFollowUser('u2'))).rejects.toThrow('Not Authorised')
      })
    })

    it('I can follow another user', async () => {
      const res = await clientUser1.request(mutationFollowUser('u2'))
      const expected = {
        follow: true,
      }
      expect(res).toMatchObject(expected)

      const { User } = await clientUser1.request(`{
        User(id: "u2") {
          followedBy { id }
          followedByCurrentUser
        }
      }`)
      const expected2 = {
        followedBy: [{ id: 'u1' }],
        followedByCurrentUser: true,
      }
      expect(User[0]).toMatchObject(expected2)
    })

    it('I can`t follow myself', async () => {
      const res = await clientUser1.request(mutationFollowUser('u1'))
      const expected = {
        follow: false,
      }
      expect(res).toMatchObject(expected)

      const { User } = await clientUser1.request(`{
        User(id: "u1") {
          followedBy { id }
          followedByCurrentUser
        }
      }`)
      const expected2 = {
        followedBy: [],
        followedByCurrentUser: false,
      }
      expect(User[0]).toMatchObject(expected2)
    })
  })
  describe('unfollow user', () => {
    describe('unauthenticated follow', () => {
      it('throws authorization error', async () => {
        // follow
        await clientUser1.request(mutationFollowUser('u2'))
        // unfollow
        const client = new GraphQLClient(host)
        await expect(client.request(mutationUnfollowUser('u2'))).rejects.toThrow('Not Authorised')
      })
    })

    it('I can unfollow a user', async () => {
      // follow
      await clientUser1.request(mutationFollowUser('u2'))
      // unfollow
      const expected = {
        unfollow: true,
      }
      const res = await clientUser1.request(mutationUnfollowUser('u2'))
      expect(res).toMatchObject(expected)

      const { User } = await clientUser1.request(`{
        User(id: "u2") {
          followedBy { id }
          followedByCurrentUser
        }
      }`)
      const expected2 = {
        followedBy: [],
        followedByCurrentUser: false,
      }
      expect(User[0]).toMatchObject(expected2)
    })
  })
})
