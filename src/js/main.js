import '../scss/style.scss';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import '../scss/layout.scss';
import * as yup from 'yup';
import i18next from 'i18next';
import { proxy, subscribe } from 'valtio/vanilla';
import axios from 'axios';

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
        modalExampleText: 'Цель: Научиться извлекать из дерева необходимые данные'
      }
    }
  }
});

// ========== YUP LOCALE ==========
yup.setLocale({
  mixed: {
    required: () => ({ key: 'empty' }),
    notType: () => ({ key: 'invalidUrl' })
  },
  string: {
    url: () => ({ key: 'invalidUrl' })
  }
});

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
    errorKey: null
  }
});

// ========== HELPERS ==========
const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 6);

const parseRss = (xmlString, feedUrl) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    const error = new Error('invalidRss');
    error.key = 'invalidRss';
    throw error;
  }
  
  const channel = doc.querySelector('channel');
  if (!channel) {
    const error = new Error('invalidRss');
    error.key = 'invalidRss';
    throw error;
  }
  
  const title = channel.querySelector('title')?.textContent || '';
  const description = channel.querySelector('description')?.textContent || '';
  
  const items = Array.from(channel.querySelectorAll('item'));
  const posts = items.map(item => ({
    id: generateId(),
    title: item.querySelector('title')?.textContent || '',
    description: item.querySelector('description')?.textContent || '',
    link: item.querySelector('link')?.textContent || '',
    feedId: feedUrl
  }));
  
  return {
    feed: {
      id: feedUrl,
      title,
      description,
      url: feedUrl
    },
    posts
  };
};

const getRssContent = (url) => {
  const proxyUrl = 'https://allorigins.hexlet.app/get';
  const encodedUrl = encodeURIComponent(url);
  
  return axios.get(`${proxyUrl}?url=${encodedUrl}&disableCache=true`)
    .then(response => {
      if (!response.data || !response.data.contents) {
        const error = new Error('invalidRss');
        error.key = 'invalidRss';
        throw error;
      }
      return parseRss(response.data.contents, url);
    })
    .catch(error => {
      if (error.key === 'invalidRss') {
        throw error;
      }
      const networkError = new Error('networkError');
      networkError.key = 'networkError';
      throw networkError;
    });
};

// ========== VALIDATION ==========
const validateUrl = (url, existingFeeds) => {
  return yup.object({
    url: yup.string().required().url()
  }).validate({ url })
    .then(() => {
      const isDuplicate = existingFeeds.some(feed => feed.url === url);
      if (isDuplicate) {
        throw { key: 'duplicate' };
      }
      return true;
    })
    .catch(err => {
      if (err.key === 'duplicate') {
        throw { key: 'duplicate' };
      }
      if (err.errors && err.errors[0]) {
        const errorKey = err.errors[0].key || 'invalidUrl';
        throw { key: errorKey };
      }
      throw { key: 'invalidUrl' };
    });
};

// ========== UPDATE FEEDS ==========
const addFeed = (url) => {
  state.loading = true;
  state.error = null;
  
  return getRssContent(url)
    .then(({ feed, posts }) => {
      state.feeds = [...state.feeds, feed];
      
      const newPosts = posts.filter(post => 
        !state.posts.some(existing => existing.link === post.link)
      );
      state.posts = [...state.posts, ...newPosts];
      
      state.loading = false;
      state.form.value = '';
      state.form.isValid = true;
      state.form.errorKey = null;
      
      const feedbackDiv = document.querySelector('.feedback');
      if (feedbackDiv) {
        feedbackDiv.textContent = i18next.t('success');
        feedbackDiv.classList.remove('invalid-feedback');
        feedbackDiv.classList.add('text-success');
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          if (feedbackDiv.textContent === i18next.t('success')) {
            feedbackDiv.textContent = '';
            feedbackDiv.classList.remove('text-success');
          }
        }, 3000);
      }
    })
    .catch(err => {
      state.loading = false;
      state.form.isValid = false;
      state.form.errorKey = err.key || 'networkError';
      throw err;
    });
};

// ========== POLLING UPDATES ==========
const updateFeedPosts = (feedUrl) => {
  return getRssContent(feedUrl)
    .then(({ posts }) => {
      const newPosts = posts.filter(post => 
        !state.posts.some(existing => existing.link === post.link)
      );
      if (newPosts.length > 0) {
        state.posts = [...state.posts, ...newPosts];
      }
    })
    .catch(err => {
      console.error(`Error updating feed ${feedUrl}:`, err);
    });
};

const scheduleUpdates = () => {
  const checkAllFeeds = () => {
    if (state.feeds.length === 0) {
      setTimeout(checkAllFeeds, 5000);
      return;
    }
    
    const feedUrls = state.feeds.map(feed => feed.url);
    Promise.all(feedUrls.map(updateFeedPosts))
      .finally(() => {
        setTimeout(checkAllFeeds, 5000);
      });
  };
  
  setTimeout(checkAllFeeds, 5000);
};

// ========== MARK POST AS READ ==========
const markPostAsRead = (postId) => {
  state.readPostIds.add(postId);
};

// ========== RENDER FUNCTIONS ==========
const escapeHtml = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const renderFeeds = () => {
  const container = document.querySelector('.feeds');
  if (!container) return;
  
  if (state.feeds.length === 0) {
    container.innerHTML = '';
    return;
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
  `;
  
  container.innerHTML = feedsHtml;
};

const renderPosts = () => {
  const container = document.querySelector('.posts');
  if (!container) return;
  
  if (state.posts.length === 0) {
    container.innerHTML = '';
    return;
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
                 class="${state.readPostIds.has(post.id) ? 'fw-normal' : 'fw-bold'}">
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
  `;
  
  container.innerHTML = postsHtml;
  
  document.querySelectorAll('.view-post-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const postId = btn.dataset.postId;
      const title = btn.dataset.postTitle;
      const description = btn.dataset.postDescription;
      const link = btn.dataset.postLink;
      
      markPostAsRead(postId);
      renderPosts();
      
      const modalElement = document.getElementById('modal');
      if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        document.querySelector('#modal-title').textContent = title;
        document.querySelector('#modal-description').textContent = description || i18next.t('modalExampleText');
        document.querySelector('#modal-full-link').href = link;
        modal.show();
      }
    });
  });
};

const renderFormError = () => {
  const input = document.querySelector('#rss-input');
  const feedback = document.querySelector('.feedback');
  
  if (!state.form.isValid && state.form.errorKey) {
    input.classList.add('is-invalid');
    if (feedback) {
      feedback.textContent = i18next.t(state.form.errorKey);
      feedback.classList.add('invalid-feedback');
      feedback.classList.remove('text-success');
    }
  } else {
    input.classList.remove('is-invalid');
    if (feedback && !feedback.classList.contains('text-success')) {
      feedback.textContent = '';
      feedback.classList.remove('invalid-feedback');
    }
  }
};

// ========== FORM HANDLER ==========
const initForm = () => {
  const form = document.querySelector('#rss-form');
  const input = document.querySelector('#rss-input');
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const url = input.value.trim();
    if (!url) {
      state.form.isValid = false;
      state.form.errorKey = 'empty';
      renderFormError();
      return;
    }
    
    validateUrl(url, state.feeds)
      .then(() => addFeed(url))
      .then(() => {
        renderFeeds();
        renderPosts();
        input.value = '';
        input.focus();
        renderFormError();
      })
      .catch(err => {
        renderFormError();
        input.classList.add('is-invalid');
      });
  });
  
  input.addEventListener('input', () => {
    state.form.isValid = true;
    state.form.errorKey = null;
    renderFormError();
  });
};

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', () => {
  initForm();
  renderFeeds();
  renderPosts();
  
  subscribe(state, () => {
    renderFeeds();
    renderPosts();
    renderFormError();
  });
  
  scheduleUpdates();
  
  window.state = state;
});
