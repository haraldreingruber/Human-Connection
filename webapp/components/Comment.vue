<template>
  <div v-if="(comment.deleted || comment.disabled) && !isModerator" :class="{ comment: true }">
    <ds-card>
      <ds-space margin-bottom="base" />
      <ds-text style="padding-left: 40px; font-weight: bold;" color="soft">
        <ds-icon name="ban" />
        {{ this.$t('comment.content.unavailable-placeholder') }}
      </ds-text>
      <ds-space margin-bottom="base" />
    </ds-card>
  </div>
  <div v-else :class="{ comment: true, 'disabled-content': comment.deleted || comment.disabled }">
    <ds-card :id="`commentId-${comment.id}`">
      <ds-space margin-bottom="small">
        <hc-user :user="author" :date-time="comment.createdAt" />
      </ds-space>
      <!-- Content Menu (can open Modals) -->
      <client-only>
        <content-menu
          placement="bottom-end"
          resource-type="comment"
          :resource="comment"
          :modalsData="menuModalsData"
          style="float-right"
          :is-owner="isAuthor(author.id)"
          @showEditCommentMenu="editCommentMenu"
        />
      </client-only>

      <ds-space margin-bottom="small" />
      <div v-if="openEditCommentMenu">
        <hc-edit-comment-form
          :comment="comment"
          :post="post"
          @showEditCommentMenu="editCommentMenu"
        />
      </div>
      <div v-show="!openEditCommentMenu">
        <div v-if="isCollapsed" v-html="comment.contentExcerpt" style="padding-left: 40px;" />
        <div
          v-show="comment.content !== comment.contentExcerpt"
          style="text-align: right;  margin-right: 20px; margin-top: -12px;"
        >
          <a v-if="isCollapsed" style="padding-left: 40px;" @click="isCollapsed = !isCollapsed">
            {{ $t('comment.show.more') }}
          </a>
        </div>
        <content-viewer
          v-if="!isCollapsed"
          :content="comment.content"
          style="padding-left: 40px;"
        />
        <div style="text-align: right;  margin-right: 20px; margin-top: -12px;">
          <a v-if="!isCollapsed" @click="isCollapsed = !isCollapsed" style="padding-left: 40px; ">
            {{ $t('comment.show.less') }}
          </a>
        </div>
      </div>
      <ds-space margin-bottom="small" />
    </ds-card>
  </div>
</template>

<script>
import { mapGetters, mapMutations } from 'vuex'
import HcUser from '~/components/User'
import ContentMenu from '~/components/ContentMenu'
import ContentViewer from '~/components/Editor/ContentViewer'
import HcEditCommentForm from '~/components/EditCommentForm/EditCommentForm'
import CommentMutations from '~/graphql/CommentMutations'
import PostQuery from '~/graphql/PostQuery'

export default {
  data: function() {
    return {
      isCollapsed: true,
      openEditCommentMenu: false,
    }
  },
  components: {
    HcUser,
    ContentMenu,
    ContentViewer,
    HcEditCommentForm,
  },
  props: {
    post: { type: Object, default: () => {} },
    comment: {
      type: Object,
      default() {
        return {}
      },
    },
    dateTime: { type: [Date, String], default: null },
  },
  computed: {
    ...mapGetters({
      user: 'auth/user',
      isModerator: 'auth/isModerator',
    }),
    displaysComment() {
      return !this.unavailable || this.isModerator
    },
    author() {
      if (this.deleted) return {}
      return this.comment.author || {}
    },
    menuModalsData() {
      return {
        delete: {
          titleIdent: 'delete.comment.title',
          messageIdent: 'delete.comment.message',
          messageParams: {
            name: this.$filters.truncate(this.comment.contentExcerpt, 30),
          },
          buttons: {
            confirm: {
              danger: true,
              icon: 'trash',
              textIdent: 'delete.submit',
              callback: this.deleteCommentCallback,
            },
            cancel: {
              icon: 'close',
              textIdent: 'delete.cancel',
              callback: () => {},
            },
          },
        },
      }
    },
  },
  methods: {
    ...mapMutations({
      setEditPending: 'editor/SET_EDIT_PENDING',
    }),
    isAuthor(id) {
      return this.user.id === id
    },
    editCommentMenu(showMenu) {
      this.openEditCommentMenu = showMenu
      this.setEditPending(showMenu)
    },
    async deleteCommentCallback() {
      try {
        await this.$apollo.mutate({
          mutation: CommentMutations(this.$i18n).DeleteComment,
          variables: { id: this.comment.id },
          update: async store => {
            const data = await store.readQuery({
              query: PostQuery(this.$i18n),
              variables: { id: this.post.id },
            })

            const index = data.Post[0].comments.findIndex(
              deletedComment => deletedComment.id === this.comment.id,
            )
            if (index !== -1) {
              data.Post[0].comments.splice(index, 1)
            }
            await store.writeQuery({ query: PostQuery(this.$i18n), data })
          },
        })
        this.$toast.success(this.$t(`delete.comment.success`))
        this.$emit('deleteComment')
      } catch (err) {
        this.$toast.error(err.message)
      }
    },
  },
}
</script>
