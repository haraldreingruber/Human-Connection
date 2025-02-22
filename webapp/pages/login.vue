<template>
  <transition name="fade" appear>
    <ds-container v-if="ready" width="small">
      <ds-space margin="small">
        <blockquote>
          <p>{{ $t('quotes.african.quote') }}</p>
          <b>- {{ $t('quotes.african.author') }}</b>
        </blockquote>
      </ds-space>
      <ds-card class="login-card">
        <ds-flex gutter="small">
          <ds-flex-item :width="{ base: '100%', sm: '50%' }" centered>
            <client-only>
              <locale-switch class="login-locale-switch" offset="5" />
            </client-only>
            <ds-space margin-top="small" margin-bottom="xxx-small" centered>
              <img
                class="login-image"
                alt="Human Connection"
                src="/img/sign-up/humanconnection.svg"
              />
            </ds-space>
          </ds-flex-item>
          <ds-flex-item :width="{ base: '100%', sm: '50%' }" centered>
            <ds-space margin="small">
              <ds-text size="small">{{ $t('login.copy') }}</ds-text>
            </ds-space>
            <form :disabled="pending" @submit.prevent="onSubmit">
              <ds-input
                v-model="form.email"
                :disabled="pending"
                :placeholder="$t('login.email')"
                type="email"
                name="email"
                icon="envelope"
              />
              <ds-input
                v-model="form.password"
                :disabled="pending"
                :placeholder="$t('login.password')"
                icon="lock"
                icon-right="question-circle"
                name="password"
                type="password"
              />
              <ds-space class="password-reset-link" margin-bottom="large">
                <nuxt-link to="/password-reset/request">{{ $t('login.forgotPassword') }}</nuxt-link>
              </ds-space>
              <ds-button
                :loading="pending"
                primary
                fullwidth
                name="submit"
                type="submit"
                icon="sign-in"
              >
                {{ $t('login.login') }}
              </ds-button>
              <ds-space margin="x-small">
                <a
                  :href="$t('login.moreInfoURL')"
                  :title="$t('login.moreInfoHint')"
                  target="_blank"
                >
                  {{ $t('login.moreInfo') }}
                </a>
              </ds-space>
            </form>
          </ds-flex-item>
        </ds-flex>
      </ds-card>
    </ds-container>
  </transition>
</template>

<script>
import LocaleSwitch from '~/components/LocaleSwitch/LocaleSwitch'

export default {
  components: {
    LocaleSwitch,
  },
  layout: 'default',
  data() {
    return {
      ready: false,
      form: {
        email: '',
        password: '',
      },
    }
  },
  computed: {
    pending() {
      return this.$store.getters['auth/pending']
    },
  },
  asyncData({ store, redirect }) {
    if (store.getters['auth/isLoggedIn']) {
      redirect('/')
    }
  },
  mounted() {
    setTimeout(() => {
      // NOTE: quick fix for jumping flexbox implementation
      // will be fixed in a future update of the styleguide
      this.ready = true
    }, 50)
  },
  methods: {
    async onSubmit() {
      try {
        await this.$store.dispatch('auth/login', { ...this.form })
        this.$toast.success(this.$t('login.success'))
        this.$router.replace(this.$route.query.path || '/')
      } catch (err) {
        this.$toast.error(err.message)
      }
    },
  },
}
</script>

<style lang="scss">
.login-image {
  width: 90%;
  max-width: 200px;
}
.login-card {
  position: relative;
}
.login-locale-switch {
  position: absolute;
  top: 1em;
  left: 1em;
}
</style>
