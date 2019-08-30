import { GraphQLClient } from 'graphql-request'
import { createTestClient } from 'apollo-server-testing'
import Factory from '../../seed/factories'
import { host, login, gql } from '../../jest/helpers'
import { neode, getDriver } from '../../bootstrap/neo4j'
import createServer from '../../server'

const driver = getDriver()
const factory = Factory()
const instance = neode()

let client
let userParams
let authorParams

const postId = 'p3589'
const postTitle = 'I am a title'
const postContent = 'Some content'
const oldTitle = 'Old title'
const oldContent = 'Old content'
const newTitle = 'New title'
const newContent = 'New content'
const postSaveError = 'You cannot save a post without at least one category or more than three'
const categoryIds = ['cat9', 'cat4', 'cat15']
let createPostVariables

const postQueryWithCategories = gql`
  query($id: ID) {
    Post(id: $id) {
      categories {
        id
      }
    }
  }
`
const postQueryFilteredByCategory = gql`
  query Post($filter: _PostFilter) {
    Post(filter: $filter) {
      title
      id
      categories {
        id
      }
    }
  }
`
const postCategoriesFilterParam = { categories_some: { id_in: categoryIds } }
const postQueryFilteredByCategoryVariables = {
  filter: postCategoriesFilterParam,
}

const createPostMutation = gql`
  mutation($id: ID, $title: String!, $content: String!, $categoryIds: [ID]) {
    CreatePost(id: $id, title: $title, content: $content, categoryIds: $categoryIds) {
      id
      title
      content
      slug
      disabled
      deleted
    }
  }
`
beforeEach(async () => {
  userParams = {
    id: 'u198',
    name: 'TestUser',
    email: 'test@example.org',
    password: '1234',
  }
  authorParams = {
    id: 'u25',
    email: 'author@example.org',
    password: '1234',
  }
  await factory.create('User', userParams)
  await Promise.all([
    instance.create('Category', {
      id: 'cat9',
      name: 'Democracy & Politics',
      icon: 'university',
    }),
    instance.create('Category', {
      id: 'cat4',
      name: 'Environment & Nature',
      icon: 'tree',
    }),
    instance.create('Category', {
      id: 'cat15',
      name: 'Consumption & Sustainability',
      icon: 'shopping-cart',
    }),
    instance.create('Category', {
      id: 'cat27',
      name: 'Animal Protection',
      icon: 'paw',
    }),
  ])
  createPostVariables = {
    id: postId,
    title: postTitle,
    content: postContent,
    categoryIds,
  }
})

afterEach(async () => {
  await factory.cleanDatabase()
})

describe('CreatePost', () => {
  describe('unauthenticated', () => {
    it('throws authorization error', async () => {
      client = new GraphQLClient(host)
      await expect(client.request(createPostMutation, createPostVariables)).rejects.toThrow(
        'Not Authorised',
      )
    })
  })

  describe('authenticated', () => {
    let headers
    beforeEach(async () => {
      headers = await login(userParams)
      client = new GraphQLClient(host, { headers })
    })

    it('creates a post', async () => {
      const expected = {
        CreatePost: {
          title: postTitle,
          content: postContent,
        },
      }
      await expect(client.request(createPostMutation, createPostVariables)).resolves.toMatchObject(
        expected,
      )
    })

    it('assigns the authenticated user as author', async () => {
      await client.request(createPostMutation, createPostVariables)
      const { User } = await client.request(
        gql`
          {
            User(name: "TestUser") {
              contributions {
                title
              }
            }
          }
        `,
        { headers },
      )
      expect(User).toEqual([{ contributions: [{ title: postTitle }] }])
    })

    describe('disabled and deleted', () => {
      it('initially false', async () => {
        const expected = { CreatePost: { disabled: false, deleted: false } }
        await expect(
          client.request(createPostMutation, createPostVariables),
        ).resolves.toMatchObject(expected)
      })
    })

    describe('language', () => {
      it('allows a user to set the language of the post', async () => {
        const createPostWithLanguageMutation = gql`
          mutation($title: String!, $content: String!, $language: String, $categoryIds: [ID]) {
            CreatePost(
              title: $title
              content: $content
              language: $language
              categoryIds: $categoryIds
            ) {
              language
            }
          }
        `
        const createPostWithLanguageVariables = {
          title: postTitle,
          content: postContent,
          language: 'en',
          categoryIds,
        }
        const expected = { CreatePost: { language: 'en' } }
        await expect(
          client.request(createPostWithLanguageMutation, createPostWithLanguageVariables),
        ).resolves.toEqual(expect.objectContaining(expected))
      })
    })

    describe('categories', () => {
      it('throws an error if categoryIds is not an array', async () => {
        createPostVariables.categoryIds = null
        await expect(client.request(createPostMutation, createPostVariables)).rejects.toThrow(
          postSaveError,
        )
      })

      it('requires at least one category for successful creation', async () => {
        createPostVariables.categoryIds = []
        await expect(client.request(createPostMutation, createPostVariables)).rejects.toThrow(
          postSaveError,
        )
      })

      it('allows a maximum of three category for successful update', async () => {
        createPostVariables.categoryIds = ['cat9', 'cat27', 'cat15', 'cat4']
        await expect(client.request(createPostMutation, createPostVariables)).rejects.toThrow(
          postSaveError,
        )
      })

      it('allows a user to filter for posts by category', async () => {
        await client.request(createPostMutation, createPostVariables)
        const categoryIdsArray = [{ id: 'cat4' }, { id: 'cat15' }, { id: 'cat9' }]
        const expected = {
          Post: [
            {
              title: postTitle,
              id: postId,
              categories: expect.arrayContaining(categoryIdsArray),
            },
          ],
        }
        await expect(
          client.request(postQueryFilteredByCategory, postQueryFilteredByCategoryVariables),
        ).resolves.toEqual(expected)
      })
    })
  })
})

describe('UpdatePost', () => {
  let updatePostVariables
  const updatePostMutation = gql`
    mutation($id: ID!, $title: String!, $content: String!, $categoryIds: [ID]) {
      UpdatePost(id: $id, title: $title, content: $content, categoryIds: $categoryIds) {
        id
        content
      }
    }
  `
  beforeEach(async () => {
    const user = await factory.create('User', authorParams)
    await factory.create('Post', {
      author: user,
      id: postId,
      title: oldTitle,
      content: oldContent,
      categoryIds,
    })

    updatePostVariables = {
      id: postId,
      title: newTitle,
      content: newContent,
    }
  })

  describe('unauthenticated', () => {
    it('throws authorization error', async () => {
      client = new GraphQLClient(host)
      await expect(client.request(updatePostMutation, updatePostVariables)).rejects.toThrow(
        'Not Authorised',
      )
    })
  })

  describe('authenticated but not the author', () => {
    let headers
    beforeEach(async () => {
      headers = await login(userParams)
      client = new GraphQLClient(host, { headers })
    })

    it('throws authorization error', async () => {
      await expect(client.request(updatePostMutation, updatePostVariables)).rejects.toThrow(
        'Not Authorised',
      )
    })
  })

  describe('authenticated as author', () => {
    let headers
    beforeEach(async () => {
      headers = await login(authorParams)
      client = new GraphQLClient(host, { headers })
    })

    it('updates a post', async () => {
      updatePostVariables.categoryIds = ['cat27']
      const expected = { UpdatePost: { id: postId, content: newContent } }
      await expect(client.request(updatePostMutation, updatePostVariables)).resolves.toEqual(
        expected,
      )
    })

    describe('categories', () => {
      it('allows a user to update other attributes without passing in categoryIds explicitly', async () => {
        const expected = { UpdatePost: { id: postId, content: newContent } }
        await expect(client.request(updatePostMutation, updatePostVariables)).resolves.toEqual(
          expected,
        )
      })

      it('allows a user to update the categories of a post', async () => {
        updatePostVariables.categoryIds = ['cat27']
        await client.request(updatePostMutation, updatePostVariables)
        const expected = [{ id: 'cat27' }]
        const postQueryWithCategoriesVariables = {
          id: postId,
        }
        await expect(
          client.request(postQueryWithCategories, postQueryWithCategoriesVariables),
        ).resolves.toEqual({ Post: [{ categories: expect.arrayContaining(expected) }] })
      })

      it('allows a maximum of three category for a successful update', async () => {
        updatePostVariables.categoryIds = ['cat9', 'cat27', 'cat15', 'cat4']
        await expect(client.request(updatePostMutation, updatePostVariables)).rejects.toThrow(
          postSaveError,
        )
      })

      describe('post created without categories somehow', () => {
        let ownerNode, owner, postMutationAction
        beforeEach(async () => {
          const postSomehowCreated = await instance.create('Post', {
            id: 'how-was-this-created',
            title: postTitle,
            content: postContent,
          })
          ownerNode = await instance.create('User', {
            id: 'author-of-post-without-category',
            name: 'Hacker',
            slug: 'hacker',
            email: 'hacker@example.org',
            password: '1234',
          })
          owner = await ownerNode.toJson()
          await postSomehowCreated.relateTo(ownerNode, 'author')
          postMutationAction = async (user, mutation, variables) => {
            const { server } = createServer({
              context: () => {
                return {
                  user,
                  neode: instance,
                  driver,
                }
              },
            })
            const { mutate } = createTestClient(server)

            return mutate({
              mutation,
              variables,
            })
          }
          updatePostVariables.id = 'how-was-this-created'
        })

        it('throws an error if categoryIds is not an array', async () => {
          const mustAddCategoryToPost = await postMutationAction(
            owner,
            updatePostMutation,
            updatePostVariables,
          )
          expect(mustAddCategoryToPost.errors[0]).toHaveProperty('message', postSaveError)
        })

        it('requires at least one category for successful update', async () => {
          updatePostVariables.categoryIds = []
          const mustAddCategoryToPost = await postMutationAction(
            owner,
            updatePostMutation,
            updatePostVariables,
          )
          expect(mustAddCategoryToPost.errors[0]).toHaveProperty('message', postSaveError)
        })
      })
    })
  })
})

describe('DeletePost', () => {
  const mutation = gql`
    mutation($id: ID!) {
      DeletePost(id: $id) {
        id
        content
      }
    }
  `

  const variables = {
    id: postId,
  }

  beforeEach(async () => {
    const user = await factory.create('User', authorParams)
    await factory.create('Post', {
      id: postId,
      author: user,
      content: 'To be deleted',
      categoryIds,
    })
  })

  describe('unauthenticated', () => {
    it('throws authorization error', async () => {
      client = new GraphQLClient(host)
      await expect(client.request(mutation, variables)).rejects.toThrow('Not Authorised')
    })
  })

  describe('authenticated but not the author', () => {
    let headers
    beforeEach(async () => {
      headers = await login(userParams)
      client = new GraphQLClient(host, { headers })
    })

    it('throws authorization error', async () => {
      await expect(client.request(mutation, variables)).rejects.toThrow('Not Authorised')
    })
  })

  describe('authenticated as author', () => {
    let headers
    beforeEach(async () => {
      headers = await login(authorParams)
      client = new GraphQLClient(host, { headers })
    })

    it('deletes a post', async () => {
      const expected = { DeletePost: { id: postId, content: 'To be deleted' } }
      await expect(client.request(mutation, variables)).resolves.toEqual(expected)
    })
  })
})

describe('emotions', () => {
  let addPostEmotionsVariables,
    someUser,
    ownerNode,
    owner,
    postMutationAction,
    user,
    postQueryAction,
    postToEmote,
    postToEmoteNode
  const PostsEmotionsCountQuery = gql`
    query($id: ID!) {
      Post(id: $id) {
        emotionsCount
      }
    }
  `
  const PostsEmotionsQuery = gql`
    query($id: ID!) {
      Post(id: $id) {
        emotions {
          emotion
          User {
            id
          }
        }
      }
    }
  `
  const addPostEmotionsMutation = gql`
    mutation($to: _PostInput!, $data: _EMOTEDInput!) {
      AddPostEmotions(to: $to, data: $data) {
        from {
          id
        }
        to {
          id
        }
        emotion
      }
    }
  `
  beforeEach(async () => {
    userParams.id = 'u1987'
    authorParams.id = 'u257'
    createPostVariables.id = 'p1376'
    const someUserNode = await instance.create('User', userParams)
    someUser = await someUserNode.toJson()
    ownerNode = await instance.create('User', authorParams)
    owner = await ownerNode.toJson()
    postToEmoteNode = await instance.create('Post', createPostVariables)
    postToEmote = await postToEmoteNode.toJson()
    await postToEmoteNode.relateTo(ownerNode, 'author')

    postMutationAction = async (user, mutation, variables) => {
      const { server } = createServer({
        context: () => {
          return {
            user,
            neode: instance,
            driver,
          }
        },
      })
      const { mutate } = createTestClient(server)

      return mutate({
        mutation,
        variables,
      })
    }
    postQueryAction = async (postQuery, variables) => {
      const { server } = createServer({
        context: () => {
          return {
            user,
            neode: instance,
            driver,
          }
        },
      })
      const { query } = createTestClient(server)
      return query({ query: postQuery, variables })
    }
    addPostEmotionsVariables = {
      to: { id: postToEmote.id },
      data: { emotion: 'happy' },
    }
  })

  describe('AddPostEmotions', () => {
    let postsEmotionsQueryVariables
    beforeEach(async () => {
      postsEmotionsQueryVariables = { id: postToEmote.id }
    })

    describe('unauthenticated', () => {
      it('throws authorization error', async () => {
        user = null
        const addPostEmotions = await postMutationAction(
          user,
          addPostEmotionsMutation,
          addPostEmotionsVariables,
        )

        expect(addPostEmotions.errors[0]).toHaveProperty('message', 'Not Authorised!')
      })
    })

    describe('authenticated and not the author', () => {
      beforeEach(() => {
        user = someUser
      })

      it('adds an emotion to the post', async () => {
        const expected = {
          data: {
            AddPostEmotions: {
              from: { id: user.id },
              to: addPostEmotionsVariables.to,
              emotion: 'happy',
            },
          },
        }
        await expect(
          postMutationAction(user, addPostEmotionsMutation, addPostEmotionsVariables),
        ).resolves.toEqual(expect.objectContaining(expected))
      })

      it('limits the addition of the same emotion to 1', async () => {
        const expected = {
          data: {
            Post: [
              {
                emotionsCount: 1,
              },
            ],
          },
        }
        await postMutationAction(user, addPostEmotionsMutation, addPostEmotionsVariables)
        await postMutationAction(user, addPostEmotionsMutation, addPostEmotionsVariables)
        await expect(
          postQueryAction(PostsEmotionsCountQuery, postsEmotionsQueryVariables),
        ).resolves.toEqual(expect.objectContaining(expected))
      })

      it('allows a user to add more than one emotion', async () => {
        const expectedEmotions = [
          { emotion: 'happy', User: { id: user.id } },
          { emotion: 'surprised', User: { id: user.id } },
        ]
        const expectedResponse = {
          data: { Post: [{ emotions: expect.arrayContaining(expectedEmotions) }] },
        }
        await postMutationAction(user, addPostEmotionsMutation, addPostEmotionsVariables)
        addPostEmotionsVariables.data.emotion = 'surprised'
        await postMutationAction(user, addPostEmotionsMutation, addPostEmotionsVariables)
        await expect(
          postQueryAction(PostsEmotionsQuery, postsEmotionsQueryVariables),
        ).resolves.toEqual(expect.objectContaining(expectedResponse))
      })
    })

    describe('authenticated as author', () => {
      beforeEach(() => {
        user = owner
      })

      it('adds an emotion to the post', async () => {
        const expected = {
          data: {
            AddPostEmotions: {
              from: { id: owner.id },
              to: addPostEmotionsVariables.to,
              emotion: 'happy',
            },
          },
        }
        await expect(
          postMutationAction(user, addPostEmotionsMutation, addPostEmotionsVariables),
        ).resolves.toEqual(expect.objectContaining(expected))
      })
    })
  })

  describe('RemovePostEmotions', () => {
    let removePostEmotionsVariables, postsEmotionsQueryVariables
    const removePostEmotionsMutation = gql`
      mutation($to: _PostInput!, $data: _EMOTEDInput!) {
        RemovePostEmotions(to: $to, data: $data) {
          from {
            id
          }
          to {
            id
          }
          emotion
        }
      }
    `
    beforeEach(async () => {
      await ownerNode.relateTo(postToEmoteNode, 'emoted', { emotion: 'cry' })
      await postMutationAction(user, addPostEmotionsMutation, addPostEmotionsVariables)

      postsEmotionsQueryVariables = { id: postToEmote.id }
      removePostEmotionsVariables = {
        to: { id: postToEmote.id },
        data: { emotion: 'cry' },
      }
    })

    describe('unauthenticated', () => {
      it('throws authorization error', async () => {
        user = null
        const removePostEmotions = await postMutationAction(
          user,
          removePostEmotionsMutation,
          removePostEmotionsVariables,
        )
        expect(removePostEmotions.errors[0]).toHaveProperty('message', 'Not Authorised!')
      })
    })

    describe('authenticated', () => {
      describe('but not the emoter', () => {
        it('returns null if the emotion could not be found', async () => {
          user = someUser
          const removePostEmotions = await postMutationAction(
            user,
            removePostEmotionsMutation,
            removePostEmotionsVariables,
          )
          expect(removePostEmotions).toEqual(
            expect.objectContaining({ data: { RemovePostEmotions: null } }),
          )
        })
      })

      describe('as the emoter', () => {
        it('removes an emotion from a post', async () => {
          user = owner
          const expected = {
            data: {
              RemovePostEmotions: {
                to: { id: postToEmote.id },
                from: { id: user.id },
                emotion: 'cry',
              },
            },
          }
          await expect(
            postMutationAction(user, removePostEmotionsMutation, removePostEmotionsVariables),
          ).resolves.toEqual(expect.objectContaining(expected))
        })

        it('removes only the requested emotion, not all emotions', async () => {
          const expectedEmotions = [{ emotion: 'happy', User: { id: authorParams.id } }]
          const expectedResponse = {
            data: { Post: [{ emotions: expect.arrayContaining(expectedEmotions) }] },
          }
          await postMutationAction(user, removePostEmotionsMutation, removePostEmotionsVariables)
          await expect(
            postQueryAction(PostsEmotionsQuery, postsEmotionsQueryVariables),
          ).resolves.toEqual(expect.objectContaining(expectedResponse))
        })
      })
    })
  })

  describe('posts emotions count', () => {
    let PostsEmotionsCountByEmotionVariables
    let PostsEmotionsByCurrentUserVariables

    const PostsEmotionsCountByEmotionQuery = gql`
      query($postId: ID!, $data: _EMOTEDInput!) {
        PostsEmotionsCountByEmotion(postId: $postId, data: $data)
      }
    `

    const PostsEmotionsByCurrentUserQuery = gql`
      query($postId: ID!) {
        PostsEmotionsByCurrentUser(postId: $postId)
      }
    `
    beforeEach(async () => {
      await ownerNode.relateTo(postToEmoteNode, 'emoted', { emotion: 'cry' })

      PostsEmotionsCountByEmotionVariables = {
        postId: postToEmote.id,
        data: { emotion: 'cry' },
      }
      PostsEmotionsByCurrentUserVariables = { postId: postToEmote.id }
    })

    describe('PostsEmotionsCountByEmotion', () => {
      it("returns a post's emotions count", async () => {
        const expectedResponse = { data: { PostsEmotionsCountByEmotion: 1 } }
        await expect(
          postQueryAction(PostsEmotionsCountByEmotionQuery, PostsEmotionsCountByEmotionVariables),
        ).resolves.toEqual(expect.objectContaining(expectedResponse))
      })
    })

    describe('PostsEmotionsCountByEmotion', () => {
      it("returns a currentUser's emotions on a post", async () => {
        const expectedResponse = { data: { PostsEmotionsByCurrentUser: ['cry'] } }
        await expect(
          postQueryAction(PostsEmotionsByCurrentUserQuery, PostsEmotionsByCurrentUserVariables),
        ).resolves.toEqual(expect.objectContaining(expectedResponse))
      })
    })
  })
})
