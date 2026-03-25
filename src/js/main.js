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

// ========== STATE ==========
const state = proxy({
  feeds: [],
  posts: [],
  readPostIds: new Set(),
});

// ========== HELPERS ==========
const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 6);

const parseRss = (xmlString, feedUrl) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw { key: 'invalidRss' };
  }
  
  const channel = doc.querySelector('channel');
  if (!channel) {
    throw { key: 'invalidRss' };
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
    feed: { id: feedUrl, title, description, url: feedUrl },
    posts
  };
};

const getRssContent = (url) => {
  const proxyUrl = 'https://allorigins.hexlet.app/get';
  const encodedUrl = encodeURIComponent(url);
  
  return axios.get(`${proxyUrl}?url=${encodedUrl}&disableCache=true`)
    .then(response => {
      if (!response.data?.contents) throw { key: 'invalidRss' };
      return parseRss(response.data.contents, url);
    })
    .catch((error) => {
      if (error.key === 'invalidRss') throw error;
      throw { key: 'networkError' };
    });
};

// ========== ADD FEED ==========
const addFeed = (url) => {
  return getRssContent(url)
    .then(({ feed, posts }) => {
      state.feeds = [...state.feeds, feed];
      const newPosts = posts.filter(post => 
        !state.posts.some(existing => existing.link === post.link)
      );
      state.posts = [...state.posts, ...newPosts];
      
      // Show success message
      const feedback = document.querySelector('.feedback');
      if (feedback) {
        feedback.textContent = i18next.t('success');
        feedback.classList.add('text-success');
        feedback.classList.remove('invalid-feedback');
      }
    });
};

// ========== POLLING ==========
const updateFeedPosts = (feedUrl) => {
  return getRssContent(feedUrl)
    .then(({ posts }) => {
      const newPosts = posts.filter(post => 
        !state.posts.some(existing => existing.link === post.link)
      );
      if (newPosts.length) {
        state.posts = [...state.posts, ...newPosts];
      }
    })
    .catch(err => console.error('Update error:', err));
};

const scheduleUpdates = () => {
  const checkAllFeeds = () => {
    if (state.feeds.length === 0) {
      setTimeout(checkAllFeeds, 5000);
      return;
    }
    Promise.all(state.feeds.map(feed => updateFeedPosts(feed.url)))
      .finally(() => setTimeout(checkAllFeeds, 5000));
  };
  setTimeout(checkAllFeeds, 5000);
};

// ========== RENDER ==========
const escapeHtml = (str) => {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
};

const renderFeeds = () => {
  const container = document.querySelector('.feeds');
  if (!container) return;
  
  if (state.feeds.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = `
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
};

const renderPosts = () => {
  const container = document.querySelector('.posts');
  if (!container) return;
  
  if (state.posts.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = `
    <div class="card border-primary">
      <div class="card-header bg-primary text-white">
        <h2>${i18next.t('postsTitle')}</h2>
      </div>
      <div class="card-body">
        <ul class="list-group">
          ${state.posts.map(post => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <a href="${escapeHtml(post.link)}" target="_blank" 
                 class="${state.readPostIds.has(post.id) ? 'fw-normal' : 'fw-bold'}">
                ${escapeHtml(post.title)}
              </a>
              <button class="btn btn-sm btn-outline-primary view-post-btn" 
                      data-id="${post.id}"
                      data-title="${escapeHtml(post.title)}"
                      data-description="${escapeHtml(post.description)}"
                      data-link="${escapeHtml(post.link)}">
                ${i18next.t('viewButton')}
              </button>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;
  
  document.querySelectorAll('.view-post-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const title = btn.dataset.title;
      const description = btn.dataset.description;
      const link = btn.dataset.link;
      
      state.readPostIds.add(id);
      renderPosts();
      
      const modalEl = document.getElementById('modal');
      if (modalEl) {
        document.querySelector('#modal-title').textContent = title;
        document.querySelector('#modal-description').textContent = description || i18next.t('modalExampleText');
        document.querySelector('#modal-full-link').href = link;
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
      }
    });
  });
};

// ========== UI HELPERS ==========
const showError = (key) => {
  const input = document.querySelector('#rss-input');
  const feedback = document.querySelector('.feedback');
  const message = i18next.t(key);
  
  if (feedback) {
    feedback.textContent = message;
    feedback.classList.add('invalid-feedback');
    feedback.classList.remove('text-success');
  }
  if (input) {
    input.classList.add('is-invalid');
  }
  
  // Also log to console for debugging
  console.log('Error shown:', key, message);
};

const clearError = () => {
  const input = document.querySelector('#rss-input');
  const feedback = document.querySelector('.feedback');
  
  if (feedback) {
    feedback.textContent = '';
    feedback.classList.remove('invalid-feedback', 'text-success');
  }
  if (input) {
    input.classList.remove('is-invalid');
  }
};

// ========== FORM HANDLER ==========
const initForm = () => {
  const form = document.querySelector('#rss-form');
  const input = document.querySelector('#rss-input');
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();
    
    const url = input.value.trim();
    
    // Empty URL
    if (!url) {
      showError('empty');
      return;
    }
    
    // Validate URL format
    let isValidUrl = false;
    try {
      yup.string().url().validateSync(url);
      isValidUrl = true;
    } catch (err) {
      isValidUrl = false;
    }
    
    if (!isValidUrl) {
      showError('invalidUrl');
      return;
    }
    
    // Check duplicate
    if (state.feeds.some(feed => feed.url === url)) {
      showError('duplicate');
      return;
    }
    
    // Add feed
    addFeed(url)
      .then(() => {
        clearError();
        renderFeeds();
        renderPosts();
        input.value = '';
        input.focus();
        
        // Show success message (will be cleared after 3 seconds)
        const feedback = document.querySelector('.feedback');
        if (feedback) {
          feedback.textContent = i18next.t('success');
          feedback.classList.add('text-success');
          setTimeout(() => {
            if (feedback.textContent === i18next.t('success')) {
              feedback.textContent = '';
              feedback.classList.remove('text-success');
            }
          }, 3000);
        }
      })
      .catch(err => {
        showError(err.key || 'networkError');
      });
  });
  
  input.addEventListener('input', clearError);
};

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  initForm();
  renderFeeds();
  renderPosts();
  subscribe(state, () => {
    renderFeeds();
    renderPosts();
  });
  scheduleUpdates();
});
