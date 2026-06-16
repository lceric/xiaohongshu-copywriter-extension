/**
 * 小红书→AI文案生成器 - Popup Script
 *
 * 流程: 提取笔记 → 自定义指令 → AI 生成（支持多版本）→ 复制
 */

let noteContent = null;
let generatedText = '';

// 系统提示词
const SYSTEM_PROMPT = `你是一个专业的内容创作者，擅长根据参考素材生成文案。

## 核心原则
1. 保留素材的核心信息和亮点
2. 用自己的话重新创作，而非逐句改写
3. 严格遵循用户给出的指令（平台风格、语气、字数、角度等）
4. 保持自然、真实的语气，避免 AI 腔

## 输出要求
- 直接输出文案正文，不要多余的说明
- 如果笔记没有文字，坦诚告知并基于标题发挥
- 如果要求多个版本，用 --- 分隔各版本，并在每个版本前标注「版本N：角度描述」`;

// --- 工具: 更新状态指示器 ---
function setStatus(el, dot, text, type) {
  el.textContent = text;
  el.className = type;
  if (dot) dot.className = 'status-dot ' + type;
}

// --- 生命周期 ---
document.addEventListener('DOMContentLoaded', async () => {
  const statusEl   = document.getElementById('status');
  const statusDot  = document.getElementById('statusDot');
  const sourceToggle = document.getElementById('sourceToggle');
  const sourceCard = document.getElementById('sourceCard');
  const customPrompt = document.getElementById('customPrompt');
  const quickTypes = document.getElementById('quickTypes');
  const genCount   = document.getElementById('genCount');
  const resultCard = document.getElementById('resultCard');
  const loadingDots = document.getElementById('loadingDots');
  const resultText = document.getElementById('resultText');
  const btnGenerate = document.getElementById('btnGenerate');
  const btnCopy    = document.getElementById('btnCopy');
  const btnSettings = document.getElementById('btnSettings');
  const toastEl    = document.getElementById('toast');

  // --- Step 1: 提取笔记 ---
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';

  if (!url.includes('xiaohongshu.com') || (!url.includes('/explore/') && !url.includes('/discovery/item/'))) {
    setStatus(statusEl, statusDot, '⚠️ 请打开一篇小红书笔记页面', 'error');
    return;
  }

  setStatus(statusEl, statusDot, '⏳ 正在读取笔记...', 'loading');

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract' });
    if (response && response.success) {
      noteContent = response;
      setStatus(statusEl, statusDot, `✅ 已读取 · ${response.author || '未知作者'} · ${(response.body || '').length}字`, 'success');
      btnGenerate.disabled = false;
      btnCopy.disabled = false;

      sourceCard.textContent = [
        response.title ? `标题：${response.title}` : '',
        response.author ? `作者：${response.author}` : '',
        response.tags?.length ? `标签：${response.tags.join(' ')}` : '',
        response.body ? `\n${response.body}` : '',
      ].filter(Boolean).join('\n');
    } else {
      setStatus(statusEl, statusDot, '⚠️ 未能识别笔记内容', 'error');
    }
  } catch (err) {
    setStatus(statusEl, statusDot, '⚠️ 读取失败，请刷新页面后重试', 'error');
  }

  // 加载上次输入的自定义指令
  const savedInput = await chrome.storage.local.get('lastPrompt');
  if (savedInput.lastPrompt) {
    customPrompt.value = savedInput.lastPrompt;
  }

  // --- 事件绑定 ---

  // 展开/收起原文
  sourceToggle.addEventListener('click', () => {
    const isOpen = sourceCard.classList.toggle('show');
    sourceToggle.textContent = isOpen ? '📝 收起原文 ▴' : '📝 查看笔记原文 ▾';
  });

  // 快捷类型按钮 → 填入文本框
  quickTypes.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      customPrompt.value = e.target.dataset.fill;
      customPrompt.focus();
    }
  });

  // 设置
  btnSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // 生成
  btnGenerate.addEventListener('click', async () => {
    if (!noteContent) return;

    const instructions = customPrompt.value.trim();
    if (!instructions) {
      setStatus(statusEl, statusDot, '⚠️ 请输入生成指令，或点击下方快捷按钮', 'error');
      customPrompt.focus();
      return;
    }

    const count = Math.max(1, Math.min(10, parseInt(genCount.value) || 1));
    genCount.value = count;

    // 保存输入
    await chrome.storage.local.set({ lastPrompt: instructions });

    // 读取 API 设置
    const settings = await chrome.storage.local.get([
      'provider', 'apiKey', 'baseUrl', 'model', 'apiFormat',
    ]);
    if (!settings.apiKey) {
      setStatus(statusEl, statusDot, '⚠️ 请先在设置中配置 API Key（点 ⚙️）', 'error');
      chrome.runtime.openOptionsPage();
      return;
    }
    settings.provider  = settings.provider  || 'anthropic';
    settings.baseUrl   = settings.baseUrl   || 'https://api.anthropic.com/v1';
    settings.model     = settings.model     || 'claude-sonnet-4-6';
    settings.apiFormat = settings.apiFormat || 'anthropic';

    // UI 状态
    resultCard.classList.add('show');
    loadingDots.style.display = 'block';
    resultText.innerHTML = '';
    btnGenerate.textContent = '⏳ 生成中...';
    btnGenerate.classList.add('generating');
    btnGenerate.disabled = true;
    btnCopy.disabled = true;
    setStatus(statusEl, statusDot, count > 1 ? `🤖 AI 正在生成 ${count} 个版本...` : '🤖 AI 正在创作...', 'loading');

    try {
      const generated = await callAI(settings, noteContent, instructions, count);
      generatedText = generated;

      loadingDots.style.display = 'none';

      // 多版本渲染
      if (count > 1) {
        renderMultiVersions(resultText, generated);
      } else {
        resultText.innerHTML = `<div style="white-space:pre-wrap;">${escapeHtml(generated)}</div>`;
      }

      resultCard.scrollTop = 0;
      btnGenerate.textContent = '🔄 重新生成';
      btnGenerate.classList.remove('generating');
      btnGenerate.disabled = false;
      btnCopy.disabled = false;
      setStatus(statusEl, statusDot, '✅ 生成完成', 'success');
    } catch (err) {
      loadingDots.style.display = 'none';
      resultText.innerHTML = `<div style="color:#ff2442;">❌ ${escapeHtml(err.message)}</div>`;
      btnGenerate.textContent = '🤖 AI 生成文案';
      btnGenerate.classList.remove('generating');
      btnGenerate.disabled = false;
      btnCopy.disabled = false;
      setStatus(statusEl, statusDot, '❌ 生成失败，请检查 API Key 或网络', 'error');
    }
  });

  // 复制
  btnCopy.addEventListener('click', async () => {
    const text = generatedText || (noteContent ? formatClipboard(noteContent) : '');
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      showToast(toastEl, '✅ 已复制！');
      btnCopy.textContent = '✅ 已复制';
      setTimeout(() => { btnCopy.textContent = '📋 复制'; }, 1500);
    } catch {
      showToast(toastEl, '❌ 复制失败');
    }
  });
});

// --- 渲染多版本结果（标签页） ---
function renderMultiVersions(container, text) {
  // 按 --- 分隔各版本
  const parts = text.split(/\n?---\n?/).filter((p) => p.trim());
  if (parts.length <= 1) {
    container.innerHTML = `<div style="white-space:pre-wrap;">${escapeHtml(text)}</div>`;
    return;
  }

  // 提取每个版本的标签和内容
  const versions = parts.map((part, i) => {
    const trimmed = part.trim();
    // 尝试提取第一行作为标签: "版本N：描述" / "V1: desc" / "**版本1**" 等
    const labelMatch = trimmed.match(/^(?:版本\s*[N\d]+|V\d+)\s*[：:]\s*(.+)/i);
    let label, content;
    if (labelMatch) {
      label = labelMatch[1].trim();
      content = trimmed.substring(labelMatch[0].length).trim();
    } else {
      // 取第一行（去除 markdown 标记）作标签，限长
      const firstLine = trimmed.split('\n')[0].replace(/^[*#\s]+|[*#\s]+$/g, '').trim();
      label = firstLine.length > 0 && firstLine.length < 20 ? firstLine : `版本 ${i + 1}`;
      content = trimmed;
    }
    // 标签限长
    if (label.length > 16) label = label.slice(0, 14) + '…';
    return { label, content };
  });

  // 构建标签栏 + 内容区
  const tabsHtml = versions.map((v, i) =>
    `<button class="tab-btn${i === 0 ? ' active' : ''}" data-index="${i}">${escapeHtml(v.label)}</button>`
  ).join('');

  const contentsHtml = versions.map((v, i) =>
    `<div class="tab-content${i === 0 ? ' active' : ''}" data-index="${i}">${escapeHtml(v.content)}</div>`
  ).join('');

  container.innerHTML = `
    <div class="tab-bar">${tabsHtml}</div>
    <div class="tab-contents">${contentsHtml}</div>
  `;

  // 绑定标签切换
  const tabBar = container.querySelector('.tab-bar');
  const tabContents = container.querySelectorAll('.tab-content');
  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const idx = btn.dataset.index;

    // 切换按钮状态
    tabBar.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // 切换内容
    tabContents.forEach((c) => c.classList.remove('active'));
    const target = container.querySelector(`.tab-content[data-index="${idx}"]`);
    if (target) target.classList.add('active');
  });
}

// --- 调用 AI API ---
async function callAI(settings, note, instructions, count) {
  const { baseUrl, apiKey, model, apiFormat } = settings;

  const contentText = [
    note.title ? `标题：${note.title}` : '',
    note.author ? `作者：${note.author}` : '',
    note.body ? `正文：\n${note.body}` : '',
    note.tags?.length ? `标签：${note.tags.join(' ')}` : '',
  ].filter(Boolean).join('\n\n');

  let userMessage = `参考以下小红书笔记内容，${instructions}`;

  if (count > 1) {
    userMessage += `\n\n请生成 ${count} 个不同角度或风格的版本，每个版本用 --- 分隔，并在版本前标注「版本N：一句话说明角度」。`;
  }

  userMessage += `\n\n---\n${contentText}\n---`;

  if (apiFormat === 'anthropic') {
    return callAnthropic(baseUrl, apiKey, model, userMessage);
  }
  return callOpenAI(baseUrl, apiKey, model, userMessage);
}

// --- Anthropic API ---
async function callAnthropic(baseUrl, apiKey, model, userMessage) {
  const res = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 错误 (${res.status})`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  if (!text) throw new Error('API 返回为空');
  return text;
}

// --- OpenAI 兼容 API ---
async function callOpenAI(baseUrl, apiKey, model, userMessage) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.8,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 错误 (${res.status})`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('API 返回为空');
  return text;
}

// --- 工具函数 ---
function formatClipboard(note) {
  const lines = [];
  if (note.title) lines.push(`📌 ${note.title}`);
  if (note.author) lines.push(`✍️ ${note.author}`);
  if (note.tags?.length) lines.push(note.tags.join(' '));
  if (note.body) { lines.push(''); lines.push(note.body); }
  if (note.url) { lines.push(''); lines.push(`🔗 ${note.url}`); }
  return lines.join('\n');
}

function showToast(el, msg) {
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
