<template>
  <ds-card>
    <h2 style="margin-bottom: .2em;">{{ $t('post.moreInfo.title') }}</h2>
    <p>{{ $t('post.moreInfo.description') }}</p>
    <ds-space />
    <h3>
      <!-- <ds-icon name="compass" /> -->
      {{ $t('post.moreInfo.titleOfCategoriesSection') }}
    </h3>
    <div class="tags">
      <ds-icon
        v-for="category in post.categories"
        :key="category.id"
        v-tooltip="{ content: category.name, placement: 'top-start', delay: { show: 300 } }"
        :name="category.icon"
        size="large"
      />
      &nbsp;
      <!--<ds-tag
        v-for="category in post.categories"
      :key="category.id"><ds-icon :name="category.icon" /> {{ category.name }}</ds-tag>-->
    </div>
    <template v-if="post.tags && post.tags.length">
      <h3>
        <!-- <ds-icon name="tags" /> -->
        {{ $t('post.moreInfo.titleOfHashtagsSection') }}
      </h3>
      <div class="tags">
        <ds-tag v-for="tag in post.tags" :key="tag.id">
          <ds-icon name="tag" />
          {{ tag.name }}
        </ds-tag>
      </div>
    </template>
    <h3>{{ $t('post.moreInfo.titleOfRelatedContributionsSection') }}</h3>
    <ds-section style="margin: 0 -1.5rem; padding: 1.5rem;">
      <ds-flex v-if="post.relatedContributions && post.relatedContributions.length" gutter="small">
        <hc-post-card
          v-for="(relatedPost, index) in post.relatedContributions"
          :key="relatedPost.id"
          :post="relatedPost"
          :width="{ base: '100%', lg: 1 }"
          @removePostFromList="post.relatedContributions.splice(index, 1)"
        />
      </ds-flex>
      <hc-empty v-else margin="large" icon="file" message="No related Posts" />
    </ds-section>
    <ds-space margin-bottom="large" />
  </ds-card>
</template>

<script>
import gql from 'graphql-tag'
import HcPostCard from '~/components/PostCard'
import HcEmpty from '~/components/Empty.vue'

export default {
  transition: {
    name: 'slide-up',
    mode: 'out-in',
  },
  components: {
    HcPostCard,
    HcEmpty,
  },
  computed: {
    post() {
      return this.Post ? this.Post[0] || {} : {}
    },
  },
  apollo: {
    Post: {
      query() {
        return gql`
          query Post($slug: String!) {
            Post(slug: $slug) {
              id
              title
              tags {
                id
                name
              }
              categories {
                id
                name
                icon
              }
              relatedContributions(first: 2) {
                id
                title
                slug
                contentExcerpt
                shoutedCount
                commentedCount
                categories {
                  id
                  name
                  icon
                }
                author {
                  id
                  name
                  slug
                  avatar
                  contributionsCount
                  followedByCount
                  followedByCurrentUser
                  commentedCount
                  location {
                    name: name${this.$i18n.locale().toUpperCase()}
                  }
                  badges {
                    id
                    icon
                  }
                }
              }
              shoutedCount
            }
          }
        `
      },
      variables() {
        return {
          slug: this.$route.params.slug,
        }
      },
    },
  },
}
</script>

<style lang="scss">
.related-post {
  box-shadow: $box-shadow-base;

  .ds-card-image {
    max-height: 80px;
  }
}
</style>
