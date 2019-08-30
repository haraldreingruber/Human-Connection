import { neo4jgraphql } from 'neo4j-graphql-js'
import Resolver from './helpers/Resolver'

export default {
  Mutation: {
    CreateComment: async (object, params, context, resolveInfo) => {
      const { postId } = params
      // Adding relationship from comment to post by passing in the postId,
      // but we do not want to create the comment with postId as an attribute
      // because we use relationships for this. So, we are deleting it from params
      // before comment creation.
      delete params.postId
      const session = context.driver.session()
      const commentWithoutRelationships = await neo4jgraphql(
        object,
        params,
        context,
        resolveInfo,
        false,
      )

      const transactionRes = await session.run(
        `
        MATCH (post:Post {id: $postId}), (comment:Comment {id: $commentId}), (author:User {id: $userId})
        MERGE (post)<-[:COMMENTS]-(comment)<-[:WROTE]-(author)
        RETURN comment, author`,
        {
          userId: context.user.id,
          postId,
          commentId: commentWithoutRelationships.id,
        },
      )

      const [commentWithAuthor] = transactionRes.records.map(record => {
        return {
          comment: record.get('comment'),
          author: record.get('author'),
        }
      })

      const { comment, author } = commentWithAuthor

      const commentReturnedWithAuthor = {
        ...comment.properties,
        author: author.properties,
      }
      session.close()
      return commentReturnedWithAuthor
    },
    DeleteComment: async (object, args, context, resolveInfo) => {
      const session = context.driver.session()
      const transactionRes = await session.run(
        `
        MATCH (comment:Comment {id: $commentId})
        SET comment.deleted        = TRUE
        SET comment.content        = 'DELETED'
        SET comment.contentExcerpt = 'DELETED'
        RETURN comment
      `,
        { commentId: args.id },
      )
      const [comment] = transactionRes.records.map(record => record.get('comment').properties)
      return comment
    },
  },
  Comment: {
    ...Resolver('Comment', {
      hasOne: {
        author: '<-[:WROTE]-(related:User)',
        post: '-[:COMMENTS]->(related:Post)',
        disabledBy: '<-[:DISABLED]-(related:User)',
      },
    }),
  },
}
