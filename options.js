/**
 * 设置页面 — 支持多 API 提供商
 */

// 各提供商的默认配置
const PROVIDERS = {
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyLabel: '🔑 Anthropic API Key',
    keyPlaceholder: 'sk-ant-api03-xxxxx...',
    keyHint: '<a href="https://console.anthropic.com/settings/keys" target="_blank">获取 Key</a>',
    defaultModel: 'claude-sonnet-4-6',
    quickModels: [
      'claude-sonnet-4-6',
      'claude-opus-4-8',
      'claude-haiku-4-5',
      'claude-fable-5',
    ],
    apiFormat: 'anthropic',
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    keyLabel: '🔑 OpenAI API Key',
    keyPlaceholder: 'sk-proj-xxxxx...',
    keyHint: '<a href="https://platform.openai.com/api-keys" target="_blank">获取 Key</a>',
    defaultModel: 'gpt-5',
    quickModels: ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'o4-mini'],
    apiFormat: 'openai',
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    keyLabel: '🔑 DeepSeek API Key',
    keyPlaceholder: 'sk-xxxxx...',
    keyHint: '<a href="https://platform.deepseek.com/api_keys" target="_blank">获取 Key</a>',
    defaultModel: 'deepseek-v4-flash',
    quickModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    apiFormat: 'openai',
  },
  custom: {
    name: '自定义',
    baseUrl: '',
    keyLabel: '🔑 API Key',
    keyPlaceholder: 'sk-...',
    keyHint: '输入你的 API Key',
    defaultModel: '',
    quickModels: [],
    apiFormat: 'openai',
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  const providerEl = document.getElementById('provider');
  const keyLabelEl = document.getElementById('keyLabel');
  const apiKeyEl = document.getElementById('apiKey');
  const keyHintEl = document.getElementById('keyHint');
  const baseUrlSection = document.getElementById('baseUrlSection');
  const baseUrlEl = document.getElementById('baseUrl');
  const customModelEl = document.getElementById('customModel');
  const modelHintEl = document.getElementById('modelHint');
  const quickModelsEl = document.getElementById('quickModels');
  const btnSave = document.getElementById('btnSave');
  const toastEl = document.getElementById('toast');
  const testResultEl = document.getElementById('testResult');

  // 加载已保存的设置
  const saved = await chrome.storage.local.get(['provider', 'apiKey', 'baseUrl', 'model', 'customProvider']);
  const currentProvider = saved.provider || 'anthropic';

  // 加载自定义提供商配置
  let customConfig = saved.customProvider || {};

  // --- UI 更新 ---
  function updateUI(provider) {
    const config = PROVIDERS[provider];

    keyLabelEl.textContent = config.keyLabel;
    apiKeyEl.placeholder = config.keyPlaceholder;
    keyHintEl.innerHTML = config.keyHint;

    // 自定义 provider 显示 base URL 输入
    if (provider === 'custom') {
      baseUrlSection.classList.remove('hidden');
    } else {
      baseUrlSection.classList.add('hidden');
    }

    // 模型
    const savedModel = saved.model || '';
    const defaultModel = config.defaultModel || '';
    customModelEl.placeholder = defaultModel;
    customModelEl.value = (provider === currentProvider && savedModel) ? savedModel : '';

    // 快捷模型按钮
    const models = config.quickModels;
    if (models.length) {
      quickModelsEl.innerHTML = models.map((m) =>
        `<button class="qmodel" data-model="${m}" style="padding:4px 10px;border:1px solid #ddd;border-radius:14px;background:#fff;font-size:11px;cursor:pointer;">${m}</button>`
      ).join('');
    } else {
      quickModelsEl.innerHTML = '<span style="font-size:11px;color:#bbb;">手动输入模型 ID</span>';
    }
  }

  // 初始化界面
  providerEl.value = currentProvider;
  updateUI(currentProvider);

  // 加载 base URL
  if (currentProvider === 'custom') {
    baseUrlEl.value = saved.baseUrl || customConfig.baseUrl || '';
  }

  // --- 事件 ---

  // 切换提供商
  providerEl.addEventListener('change', () => {
    updateUI(providerEl.value);
  });

  // 快捷模型点击
  quickModelsEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('qmodel')) {
      customModelEl.value = e.target.dataset.model;
      quickModelsEl.querySelectorAll('.qmodel').forEach((b) => b.style.background = '#fff');
      e.target.style.background = '#fff0f3';
      e.target.style.borderColor = '#ff2442';
    }
  });

  // 保存
  btnSave.addEventListener('click', async () => {
    const provider = providerEl.value;
    const config = PROVIDERS[provider];
    const apiKey = apiKeyEl.value.trim();

    // 确定 base URL
    let baseUrl;
    if (provider === 'custom') {
      baseUrl = baseUrlEl.value.trim() || '';
      if (!baseUrl) {
        testResultEl.textContent = '⚠️ 请输入自定义接口地址';
        testResultEl.className = 'fail';
        return;
      }
      // 保存自定义配置
      customConfig = { baseUrl };
      await chrome.storage.local.set({ customProvider: customConfig });
    } else {
      baseUrl = config.baseUrl;
    }

    const model = customModelEl.value.trim() || config.defaultModel;

    await chrome.storage.local.set({
      provider: provider,
      apiKey: apiKey,
      baseUrl: baseUrl,
      model: model,
      apiFormat: config.apiFormat,
    });

    btnSave.textContent = '✅ 已保存';
    btnSave.classList.add('saved');
    toastEl.classList.add('show');

    // 测试连接
    if (apiKey) {
      testResultEl.textContent = '⏳ 测试连接中...';
      testResultEl.className = '';

      try {
        const ok = await testConnection(config.apiFormat, baseUrl, apiKey, model);
        testResultEl.textContent = ok ? '✅ 连接测试成功' : '❌ 连接测试失败';
        testResultEl.className = ok ? 'ok' : 'fail';
      } catch (e) {
        testResultEl.textContent = `❌ ${e.message}`;
        testResultEl.className = 'fail';
      }
    }

    setTimeout(() => {
      btnSave.textContent = '💾 保存设置';
      btnSave.classList.remove('saved');
      toastEl.classList.remove('show');
    }, 2000);
  });
});

// --- API 连接测试 ---
async function testConnection(format, baseUrl, apiKey, model) {
  if (format === 'anthropic') {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    return res.ok;
  }

  // OpenAI 兼容格式
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  });
  return res.ok;
}
