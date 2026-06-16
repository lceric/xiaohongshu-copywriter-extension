/**
 * 小红书笔记内容提取器 - Content Script
 *
 * 在小红书笔记详情页自动运行，提取笔记的标题、正文、作者、标签。
 * 通过 window.postMessage 与 popup 通信。
 */

// --- 提取逻辑 ---

function extractNoteContent() {
  const result = {
    title: '',
    body: '',
    author: '',
    tags: [],
    url: window.location.href,
    success: false,
  };

  // 尝试多种选择器组合（小红书经常改版）
  const titleSelectors = [
    '#detail-title',
    '.note-title',
    '.title',
    'h1',
    '[class*="title"]',
    '#noteContainer h1',
    'meta[property="og:title"]',
  ];

  const bodySelectors = [
    '#detail-desc',
    '.note-text',
    '.desc',
    '[class*="desc"]',
    '.note-scroller .content',
    '[class*="note"] [class*="content"]',
  ];

  const authorSelectors = [
    '.username',
    '.author .name',
    '[class*="username"]',
    '.nickname',
    '[class*="author"] [class*="name"]',
    'meta[property="og:author"]',
  ];

  const tagSelectors = [
    '.tag',
    '[class*="tag"]',
    '.hash-tag',
    '[class*="topic"]',
    '[class*="hashtag"]',
  ];

  // 提取标题
  for (const sel of titleSelectors) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el.getAttribute('content') || el.textContent || '').trim();
        if (text && text.length > 1) {
          result.title = text;
          break;
        }
      }
    } catch (_) {}
  }

  // 提取正文
  for (const sel of bodySelectors) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el.textContent || '').trim();
        if (text && text.length > 10) {
          result.body = text;
          break;
        }
      }
    } catch (_) {}
  }

  // 如果指定选择器都没命中，尝试找最长的文本容器
  if (!result.body) {
    const candidates = document.querySelectorAll(
      'div[class*="note"], div[class*="content"], div[class*="desc"], ' +
      'div[class*="detail"], [class*="scroller"], #detail-desc, .note-scroller'
    );
    let best = '';
    for (const el of candidates) {
      const text = (el.textContent || '').trim();
      if (text.length > best.length && text.length > 50) {
        best = text;
      }
    }
    if (best) result.body = best;
  }

  // 提取作者
  for (const sel of authorSelectors) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el.getAttribute('content') || el.textContent || '').trim();
        if (text && text.length > 1) {
          result.author = text;
          break;
        }
      }
    } catch (_) {}
  }

  // 提取标签
  for (const sel of tagSelectors) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = (el.textContent || '').trim();
        if (text && text.startsWith('#') && !result.tags.includes(text)) {
          result.tags.push(text);
        }
      }
    } catch (_) {}
  }

  // 也尝试从正文中提取 #tag
  if (result.tags.length === 0 && result.body) {
    const matches = result.body.match(/#[\w一-鿿]+/g);
    if (matches) {
      result.tags = [...new Set(matches)];
    }
  }

  // 如果正文还是空的，提取页面全文
  if (!result.body) {
    const mainEl = document.querySelector('main, article, [role="main"], .main-content');
    const text = ((mainEl || document.body).innerText || '').trim();
    result.body = text.substring(0, 3000);
  }

  result.success = !!(result.title || result.body);
  return result;
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extract') {
    const content = extractNoteContent();
    sendResponse(content);
  }
  return true; // 保持消息通道开启（异步响应）
});
