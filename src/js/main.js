import '../scss/style.scss'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import '../scss/layout.scss'
import * as yup from 'yup'
import i18next from 'i18next'
import { proxy, subscribe } from 'valtio/vanilla'
import axios from 'axios'

// ========== I18N CONFIG ==========
i18next.init({
  lng: 'ru',
  resources: {
    ru: {
      translation: {
        rssLabel: 'Ссылка RSS',
        addButton: 'Добавить',
        viewButton: 'Просмотр',
        closeButton: 'Закрыть',
        readFullButton: 'Читать полностью',
        feedsTitle: 'Фиды',
        postsTitle: 'Посты',
        success: 'RSS успешно загружен',
        duplicate: 'RSS уже существует',
        empty: 'Не должно быть пустым',
        invalidUrl: 'Ссылка должна быть валидным URL',
        invalidRss: 'Ресурс не содержит валидный RSS',
        networkError: 'Ошибка сети',
        modalExampleText: 'Цель: Научиться извлекать из дерева необходимые данные',
      },
    },
  },
})

// ========== YUP LOCALE ==========
yup.setLocale({
  mixed: {
    required: () => ({ key: 'empty' }),
    notType: () => ({ key: 'invalidUrl' }),
  },
  string: {
    url: () => ({ key: 'invalidUrl' }),
  },
})

// ========== STATE (Valtio) ==========
const state = proxy({
  feeds: [],
  posts: [],
  readPostIds: new Set(),
  loading: false,
  error: null,
  form: {
    value: '',
    isValid: true,
    errorKey: null,
  },
})

// ========== HELPERS ==========
const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 6)

const parseRss = (xmlString, feedUrl) => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    const error = new Error('invalidRss')
    error.key = 'invalidRss'
    throw error
  }

  const channel = doc.querySelector('channel')
  if (!channel) {
    const error = new Error('invalidRss')
    error.key = 'invalidRss'
    throw error
  }

  const title = channel.querySelector('title')?.textContent || ''
  const description = channel.querySelector('description')?.textContent || ''

  const items = Array.from(channel.querySelectorAll('item'))
  const posts = items.map(item => ({
    id: generateId(),
    title: item.querySelector('title')?.textContent || '',
    description: item.querySelector('description')?.textContent || '',
    link: item.querySelector('link')?.textContent || '',
    feedId: feedUrl,
  }))

  return {
    feed: {
      id: feedUrl,
      title,
      description,
      url: feedUrl,
    },
    posts,
  }
}

const getRssContent = (url) => {
  const proxyUrl = 'https://allorigins.hexlet.app/get'
  const encodedUrl = encodeURIComponent(url)

  return axios.get(`${proxyUrl}?url=${encodedUrl}&disableCache=true`)
    .then(response => {
      if (!response.data || !response.data.contents) {
        const error = new Error('invalidRss')
        error.key = 'invalidRss'
        throw error
      }
      return parseRss(response.data.contents, url)
    })
    .catch(error => {
      if (error.key === 'invalidRss') {
        throw error
      }
      const networkError = new Error('networkError')
      networkError.key = 'networkError'
      throw networkError
    })
}

// ========== UPDATE FEEDS ==========
const addFeed = (url) => {
  state.loading = true
  state.error = null

  return getRssContent(url)
    .then(({ feed, posts }) => {
      state.feeds = [...state.feeds, feed]

      const newPosts = posts.filter(post =>
        !state.posts.some(existing => existing.link === post.link),
      )
      state.posts = [...state.posts, ...newPosts]

      state.loading = false
      state.form.value = ''
      state.form.isValid = true
      state.form.errorKey = null

      const feedbackDiv = document.querySelector('.feedback')
      if (feedbackDiv) {
        feedbackDiv.textContent = i18next.t('success')
        feedbackDiv.classList.remove('invalid-feedback')
        feedbackDiv.classList.add('text-success')
        feedbackDiv.style.display = 'block'

        setTimeout(() => {
          if (feedbackDiv.textContent === i18next.t('success')) {
            feedbackDiv.textContent = ''
            feedbackDiv.classList.remove('text-success')
            feedbackDiv.style.display = ''
          }
        }, 3000)
      }
    })
    .catch(err => {
      state.loading = false
      state.form.isValid = false
      state.form.errorKey = err.key || 'networkError'
      throw err
    })
}

// ========== POLLING UPDATES ==========
const updateFeedPosts = (feedUrl) => {
  return getRssContent(feedUrl)
    .then(({ posts }) => {
      const newPosts = posts.filter(post =>
        !state.posts.some(existing => existing.link === post.link),
      )
      if (newPosts.length > 0) {
        state.posts = [...state.posts, ...newPosts]
      }
    })
    .catch(err => {
      console.error(`Error updating feed ${feedUrl}:`, err)
    })
}

const scheduleUpdates = () => {
  const checkAllFeeds = () => {
    if (state.feeds.length === 0) {
      setTimeout(checkAllFeeds, 5000)
      return
    }

    const feedUrls = state.feeds.map(feed => feed.url)
    Promise.all(feedUrls.map(updateFeedPosts))
      .finally(() => {
        setTimeout(checkAllFeeds, 5000)
      })
  }

  setTimeout(checkAllFeeds, 5000)
}

// ========== MARK POST AS READ ==========
const markPostAsRead = (postId) => {
  state.readPostIds = new Set(state.readPostIds).add(postId)
}

// ========== RENDER FUNCTIONS ==========
const escapeHtml = (str) => {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const renderFeeds = () => {
  const container = document.querySelector('.feeds')
  if (!container) return

  if (state.feeds.length === 0) {
    container.innerHTML = ''
    return
  }

  const feedsHtml = `
    <div class="card border-primary mb-3">
      <div class="card-header bg-primary text-white">
        <h2>${i18next.t('feedsTitle')}</h2>
      </div>
      <div class="card-body">
        ${state.feeds.map(feed => `
          <div class="mb-3">
            <h3>${escapeHtml(feed.title)}</h3>
            <p>${escapeHtml(feed.description)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `

  container.innerHTML = feedsHtml
}

const renderPosts = () => {
  const container = document.querySelector('.posts')
  if (!container) return

  if (state.posts.length === 0) {
    container.innerHTML = ''
    return
  }

  const postsHtml = `
    <div class="card border-primary">
      <div class="card-header bg-primary text-white">
        <h2>${i18next.t('postsTitle')}</h2>
      </div>
      <div class="card-body">
        <ul class="list-group">
          ${state.posts.map(post => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <a href="${escapeHtml(post.link)}"
                 target="_blank"
                 class="${state.readPostIds.has(post.id) ? 'link-secondary' : 'fw-bold'}">
                ${escapeHtml(post.title)}
              </a>
              <button
                class="btn btn-sm btn-outline-primary view-post-btn"
                data-post-id="${post.id}"
                data-post-title="${escapeHtml(post.title)}"
                data-post-description="${escapeHtml(post.description)}"
                data-post-link="${escapeHtml(post.link)}">
                ${i18next.t('viewButton')}
              </button>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
  `

  container.innerHTML = postsHtml

  document.querySelectorAll('.view-post-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const postId = btn.dataset.postId
      const title = btn.dataset.postTitle
      const description = btn.dataset.postDescription
      const link = btn.dataset.postLink

      markPostAsRead(postId)
      renderPosts()

      const modalElement = document.getElementById('modal')
      if (modalElement) {
        document.querySelector('#modal-title').textContent = title
        document.querySelector('#modal-description').textContent = description || i18next.t('modalExampleText')
        document.querySelector('#modal-full-link').href = link

        modalElement.style.display = 'block'
        modalElement.classList.add('show')
        document.body.classList.add('modal-open')

        let backdrop = document.querySelector('.modal-backdrop')
        if (!backdrop) {
          backdrop = document.createElement('div')
          backdrop.className = 'modal-backdrop fade show'
          document.body.appendChild(backdrop)
        }

        const closeModal = () => {
          modalElement.style.display = ''
          modalElement.classList.remove('show')
          document.body.classList.remove('modal-open')
          const backdrop = document.querySelector('.modal-backdrop')
          if (backdrop) backdrop.remove()
        }

        const closeButton = modalElement.querySelector('[data-bs-dismiss="modal"]')
        if (closeButton) {
          closeButton.removeEventListener('click', closeModal)
          closeButton.addEventListener('click', closeModal)
        }

        backdrop?.addEventListener('click', closeModal)
        modalElement.querySelector('.modal-content')?.addEventListener('click', e => e.stopPropagation())
      }
    })
  })
}

const setError = (errorKey) => {
  const input = document.querySelector('#rss-input')
  const feedback = document.querySelector('.feedback')
  const message = i18next.t(errorKey)

  if (feedback) {
    feedback.textContent = message
    feedback.classList.add('invalid-feedback')
    feedback.classList.remove('text-success')
    feedback.style.setProperty('display', 'block', 'important')
    feedback.style.visibility = 'visible'
    feedback.style.opacity = '1'
  } else {
    const container = document.querySelector('#rss-form')
    if (container) {
      const newFeedback = document.createElement('div')
      newFeedback.className = 'feedback invalid-feedback'
      newFeedback.textContent = message
      newFeedback.style.setProperty('display', 'block', 'important')
      container.appendChild(newFeedback)
    }
  }
  if (input) {
    input.classList.add('is-invalid')
  }
}

const clearFeedback = () => {
  const input = document.querySelector('#rss-input')
  const feedback = document.querySelector('.feedback')

  if (feedback) {
    feedback.textContent = ''
    feedback.classList.remove('invalid-feedback', 'text-success')
    feedback.style.display = ''
    feedback.style.visibility = ''
    feedback.style.opacity = ''
  }
  if (input) {
    input.classList.remove('is-invalid')
  }
}

// ========== FORM HANDLER ==========
const initForm = () => {
  const form = document.querySelector('#rss-form')
  const input = document.querySelector('#rss-input')

  form.addEventListener('submit', (e) => {
    e.preventDefault()

    const url = input.value.trim()
    if (!url) {
      setError('empty')
      return
    }

    let isValidUrl = true
    try {
      new URL(url)
    } catch {
      isValidUrl = false
    }

    if (!isValidUrl) {
      setError('invalidUrl')
      return
    }

    if (state.feeds.some(feed => feed.url === url)) {
      setError('duplicate')
      return
    }

    addFeed(url)
      .then(() => {
        clearFeedback()
        renderFeeds()
        renderPosts()
        input.value = ''
        input.focus()

        const feedbackDiv = document.querySelector('.feedback')
        if (feedbackDiv) {
          feedbackDiv.textContent = i18next.t('success')
          feedbackDiv.classList.add('text-success')
          feedbackDiv.style.display = 'block'
        }

        setTimeout(() => {
          if (feedbackDiv && feedbackDiv.textContent === i18next.t('success')) {
            feedbackDiv.textContent = ''
            feedbackDiv.classList.remove('text-success')
            feedbackDiv.style.display = ''
          }
        }, 3000)
      })
      .catch(err => {
        setError(err.key)
      })
  })

  input.addEventListener('input', () => {
    clearFeedback()
  })
}

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', () => {
  initForm()
  renderFeeds()
  renderPosts()

  subscribe(state, () => {
    renderFeeds()
    renderPosts()
  })

  scheduleUpdates()

  window.state = state
})
