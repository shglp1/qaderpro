/* global supabase */
(function () {
  'use strict';

  function deepMerge(target, src) {
    if (!src || typeof src !== 'object') return target;
    for (const k of Object.keys(src)) {
      const sv = src[k];
      const tv = target[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
        deepMerge(tv, sv);
      } else {
        target[k] = Array.isArray(sv) ? JSON.parse(JSON.stringify(sv)) : sv;
      }
    }
    return target;
  }

  function mergeContent(def, remote) {
    const out = JSON.parse(JSON.stringify(def));
    if (remote && typeof remote === 'object') deepMerge(out, remote);
    return out;
  }

  function isConfigured() {
    const c = window.QADER_CONFIG || {};
    return (
      c.supabaseUrl &&
      c.supabaseAnonKey &&
      !String(c.supabaseUrl).includes('YOUR_') &&
      !String(c.supabaseAnonKey).includes('YOUR_')
    );
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  let client = null;
  let workingCopy = null;
  let formsMounted = false;
  let editMode = 'visual';

  function $(id) {
    return document.getElementById(id);
  }

  function safeStorageBase(name) {
    const base = String(name || 'img')
      .replace(/\.[a-zA-Z0-9]+$/, '')
      .replace(/[^a-zA-Z0-9\u0600-\u06FF._-]+/g, '_')
      .slice(0, 60);
    return base || 'img';
  }

  function extFromFile(file) {
    const m = String(file.name || '').match(/(\.[a-zA-Z0-9]+)$/);
    if (m) return m[1];
    if (file.type === 'image/png') return '.png';
    if (file.type === 'image/webp') return '.webp';
    if (file.type === 'image/gif') return '.gif';
    return '.jpg';
  }

  function installAdminUpload() {
    window.QaderAdminUpload = {
      async uploadImage(file) {
        if (!client) throw new Error('لا يوجد اتصال بـ server.');
        const cfg = window.QADER_CONFIG || {};
        const bucket =
          cfg.mediaBucket !== undefined && cfg.mediaBucket !== null && String(cfg.mediaBucket).trim() !== ''
            ? String(cfg.mediaBucket).trim()
            : 'site-media';
        const {
          data: { session }
        } = await client.auth.getSession();
        if (!session) throw new Error('سجّل الدخول أولاً.');
        const path = 'site/' + Date.now() + '_' + safeStorageBase(file.name) + extFromFile(file);
        const { data, error } = await client.storage.from(bucket).upload(path, file, {
          cacheControl: '31536000',
          upsert: false,
          contentType: file.type || 'application/octet-stream'
        });
        if (error) {
          throw new Error(
            error.message || 'فشل الرفع — أنشئ الدلو site-media ونفّذ supabase/storage-policies.sql'
          );
        }
        const { data: pub } = client.storage.from(bucket).getPublicUrl(data.path);
        if (!pub || !pub.publicUrl) throw new Error('لم يُرجَع رابط عام للملف.');
        return pub.publicUrl;
      }
    };
  }

  function setBar(msg, kind) {
    const el = $('status-bar');
    if (!el) return;
    el.textContent = msg || '';
    const base = 'text-xs text-right min-h-[1rem] ';
    el.className =
      base +
      (kind === 'err' ? 'text-red-400' : kind === 'ok' ? 'text-emerald-400' : 'text-gray-400');
  }

  function showLogin() {
    $('screen-login')?.classList.remove('hidden');
    $('screen-dash')?.classList.add('hidden');
  }

  function showDash() {
    $('screen-login')?.classList.add('hidden');
    $('screen-dash')?.classList.remove('hidden');
  }

  function ensureFormsMounted() {
    if (formsMounted || !window.QaderAdminForms) return;
    const root = $('visual-editor-root');
    if (root) {
      window.QaderAdminForms.mount(root);
      formsMounted = true;
    }
  }

  function setEditMode(next) {
    if (next === editMode) return;
    if (next === 'visual') {
      try {
        const raw = JSON.parse($('json-editor').value);
        workingCopy = mergeContent(window.DEFAULT_SITE_CONTENT, raw);
        window.QaderAdminForms.load(workingCopy);
      } catch (e) {
        setBar('JSON غير صالح — لا يمكن فتح النماذج.', 'err');
        return;
      }
    } else {
      ensureFormsMounted();
      if (!workingCopy) workingCopy = mergeContent(window.DEFAULT_SITE_CONTENT, {});
      window.QaderAdminForms.readInto(workingCopy);
      $('json-editor').value = JSON.stringify(workingCopy, null, 2);
    }
    editMode = next;
    $('visual-editor-wrap').classList.toggle('hidden', next !== 'visual');
    $('json-editor-wrap').classList.toggle('hidden', next !== 'json');
    $('btn-mode-visual').classList.toggle('mode-tab-active', next === 'visual');
    $('btn-mode-json').classList.toggle('mode-tab-active', next === 'json');
    $('btn-mode-visual').classList.toggle('text-gray-400', next !== 'visual');
    $('btn-mode-visual').classList.toggle('border-transparent', next !== 'visual');
    $('btn-mode-json').classList.toggle('text-gray-400', next !== 'json');
    $('btn-mode-json').classList.toggle('border-transparent', next !== 'json');
    const fmt = $('btn-format');
    if (fmt) {
      fmt.disabled = next !== 'json';
      fmt.classList.toggle('opacity-50', next !== 'json');
      fmt.classList.toggle('cursor-not-allowed', next !== 'json');
    }
  }

  async function refreshEditorFromServer() {
    const rowId = window.QADER_CONFIG.siteRowId || 'main';
    const def = window.DEFAULT_SITE_CONTENT;
    const { data, error } = await client.from('site_settings').select('content').eq('id', rowId).maybeSingle();
    if (error) throw error;
    const merged = mergeContent(def, data?.content || {});
    workingCopy = merged;
    $('json-editor').value = JSON.stringify(merged, null, 2);
    ensureFormsMounted();
    if (formsMounted && window.QaderAdminForms) window.QaderAdminForms.load(merged);
    setBar('تم التحميل من server.', 'ok');
  }

  async function saveEditor() {
    let toSave;
    if (editMode === 'visual') {
      ensureFormsMounted();
      if (!workingCopy) workingCopy = mergeContent(window.DEFAULT_SITE_CONTENT, {});
      window.QaderAdminForms.readInto(workingCopy);
      toSave = workingCopy;
      $('json-editor').value = JSON.stringify(toSave, null, 2);
    } else {
      let parsed;
      try {
        parsed = JSON.parse($('json-editor').value);
      } catch (e) {
        setBar('JSON غير صالح — راجع الصياغة.', 'err');
        return;
      }
      if (!parsed || typeof parsed !== 'object') {
        setBar('المحتوى يجب أن يكون كائناً.', 'err');
        return;
      }
      workingCopy = mergeContent(window.DEFAULT_SITE_CONTENT, parsed);
      toSave = workingCopy;
    }
    const rowId = window.QADER_CONFIG.siteRowId || 'main';
    const { error } = await client.from('site_settings').upsert(
      {
        id: rowId,
        content: toSave,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
    setBar('تم الحفظ. يظهر التحديث على الموقع (Realtime أو تحديث الصفحة).', 'ok');
  }

  function runDefaultMerge() {
    try {
      if (editMode === 'visual') {
        ensureFormsMounted();
        if (!workingCopy) workingCopy = mergeContent(window.DEFAULT_SITE_CONTENT, {});
        window.QaderAdminForms.readInto(workingCopy);
        workingCopy = mergeContent(window.DEFAULT_SITE_CONTENT, JSON.parse(JSON.stringify(workingCopy)));
        window.QaderAdminForms.load(workingCopy);
      } else {
        const cur = JSON.parse($('json-editor').value);
        workingCopy = mergeContent(window.DEFAULT_SITE_CONTENT, cur);
      }
      $('json-editor').value = JSON.stringify(workingCopy, null, 2);
      setBar('تم دمج الحقول الناقصة من القالب الافتراضي.', 'ok');
    } catch (e) {
      setBar(e.message || 'فشل الدمج.', 'err');
    }
  }

  async function loadSubmissions() {
    const box = $('submissions-list');
    if (!box) return;
    box.innerHTML = '<p class="text-gray-500 text-sm">جاري التحميل…</p>';
    const { data, error } = await client
      .from('contact_submissions')
      .select('id, created_at, payload')
      .order('created_at', { ascending: false })
      .limit(80);
    if (error) {
      box.innerHTML = `<p class="text-red-400 text-sm">${esc(error.message)}</p>`;
      return;
    }
    if (!data || !data.length) {
      box.innerHTML = '<p class="text-gray-500 text-sm">لا توجد طلبات بعد.</p>';
      return;
    }
    box.innerHTML = data
      .map((row) => {
        const p = row.payload || {};
        const preview = [p.name, p.phone, p.email, p.service].filter(Boolean).join(' · ') || JSON.stringify(p);
        return `<div class="border border-white/10 rounded-xl p-4 text-sm bg-black/20">
          <div class="text-gray-500 text-xs mb-1 font-mono dir-ltr text-right">${esc(row.created_at || '')}</div>
          <div class="text-gray-200">${esc(preview)}</div>
          ${p.message ? `<div class="text-gray-400 text-xs mt-2 whitespace-pre-wrap border-t border-white/5 pt-2">${esc(p.message)}</div>` : ''}
        </div>`;
      })
      .join('');
  }

  function bindDash() {
    $('btn-reload')?.addEventListener('click', () => {
      refreshEditorFromServer().catch((e) => setBar(e.message || String(e), 'err'));
    });
    $('btn-save')?.addEventListener('click', () => {
      saveEditor().catch((e) => setBar(e.message || String(e), 'err'));
    });
    $('btn-format')?.addEventListener('click', () => {
      if (editMode !== 'json') return;
      try {
        const o = JSON.parse($('json-editor').value);
        $('json-editor').value = JSON.stringify(o, null, 2);
        setBar('تم التنسيق.', 'ok');
      } catch (e) {
        setBar('JSON غير صالح.', 'err');
      }
    });
    $('btn-default-merge')?.addEventListener('click', () => runDefaultMerge());
    $('btn-logout')?.addEventListener('click', async () => {
      await client.auth.signOut();
      showLogin();
      setBar('تم تسجيل الخروج.', 'ok');
    });
    $('btn-refresh-subs')?.addEventListener('click', () => {
      loadSubmissions().catch((e) => setBar(e.message || String(e), 'err'));
    });
    $('btn-mode-visual')?.addEventListener('click', () => setEditMode('visual'));
    $('btn-mode-json')?.addEventListener('click', () => setEditMode('json'));
  }

  async function onLoginSubmit(e) {
    e.preventDefault();
    const email = $('login-email')?.value?.trim();
    const password = $('login-password')?.value || '';
    if (!email || !password) {
      setBar('أدخل البريد وكلمة المرور.', 'err');
      return;
    }
    setBar('جاري تسجيل الدخول…', '');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setBar(error.message, 'err');
      return;
    }
    showDash();
    try {
      await refreshEditorFromServer();
      await loadSubmissions();
    } catch (err) {
      setBar(err.message || String(err), 'err');
    }
  }

  async function boot() {
    const warn = $('config-warn');
    if (!isConfigured()) {
      warn?.classList.remove('hidden');
      return;
    }
    warn?.classList.add('hidden');

    ensureFormsMounted();

    const supLib = window.supabase;
    if (!supLib || typeof supLib.createClient !== 'function') {
      setBar('مكتبة server غير محمّلة.', 'err');
      return;
    }

    client = supLib.createClient(window.QADER_CONFIG.supabaseUrl, window.QADER_CONFIG.supabaseAnonKey);
    installAdminUpload();

    const {
      data: { session }
    } = await client.auth.getSession();
    $('login-form')?.addEventListener('submit', onLoginSubmit);
    bindDash();

    client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        showDash();
        refreshEditorFromServer().catch(() => {});
        loadSubmissions().catch(() => {});
      } else {
        showLogin();
      }
    });

    if (session) {
      showDash();
      try {
        await refreshEditorFromServer();
        await loadSubmissions();
      } catch (e) {
        setBar(e.message || String(e), 'err');
      }
    } else {
      showLogin();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
