/* global gsap, ScrollTrigger */

(function () {
  'use strict';

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  /** When title parts are saved from the admin, .trim() removes intentional edge spaces — restore gaps for Arabic. */
  function needsHeadingGap(left, right) {
    if (!left || !right) return false;
    return !/\s$/.test(left) && !/^\s/.test(right);
  }

  function headingHtml2(before, highlight) {
    let b = before == null ? '' : String(before);
    const h = highlight == null ? '' : String(highlight);
    if (needsHeadingGap(b, h)) b += ' ';
    return `${esc(b)}<span class="gold-gradient-text">${esc(h)}</span>`;
  }

  function headingHtml3(before, highlight, after) {
    let b = before == null ? '' : String(before);
    const h = highlight == null ? '' : String(highlight);
    let a = after == null ? '' : String(after);
    if (needsHeadingGap(b, h)) b += ' ';
    if (needsHeadingGap(h, a)) a = ' ' + a;
    return `${esc(b)}<span class="gold-gradient-text">${esc(h)}</span>${esc(a)}`;
  }

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

  let siteContent = null;
  let portfolioItems = [];
  let currentFilter = 'all';
  let supabaseClient = null;
  let statsAnimated = false;
  let realtimeChannel = null;
  let contactSubmitInFlight = false;
  let clientsMarqueeResizeObs = null;

  const CONTACT_RATE_KEY = 'qader_contact_ok_v1';
  const CONTACT_MAX_OK_PER_HOUR = 5;
  const CONTACT_RATE_WINDOW_MS = 60 * 60 * 1000;

  function contactSanitizeField(s, maxLen) {
    if (s == null) return '';
    let t = String(s)
      .replace(/\0/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .slice(0, maxLen);
    t = t.trim();
    return t;
  }

  function isValidEmail(email) {
    if (!email || email.length > 254) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    return re.test(email) && !/[<>"]/.test(email);
  }

  function normalizePhoneDigits(phone) {
    return String(phone || '').replace(/[\s().-]/g, '');
  }

  function isValidPhone(phone) {
    const d = normalizePhoneDigits(phone);
    if (d.length < 8 || d.length > 16) return false;
    return /^\+?\d+$/.test(d);
  }

  function getContactOkTimestamps() {
    try {
      const raw = localStorage.getItem(CONTACT_RATE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      const cutoff = Date.now() - CONTACT_RATE_WINDOW_MS;
      return arr.filter((t) => typeof t === 'number' && t > cutoff);
    } catch (_) {
      return [];
    }
  }

  function isContactRateLimited() {
    return getContactOkTimestamps().length >= CONTACT_MAX_OK_PER_HOUR;
  }

  function recordContactSuccessSubmit() {
    const next = getContactOkTimestamps();
    next.push(Date.now());
    try {
      localStorage.setItem(CONTACT_RATE_KEY, JSON.stringify(next));
    } catch (_) {}
  }

  const CONTACT_FIELD_ORDER = ['name', 'phone', 'email', 'service', 'message'];
  const CONTACT_FIELD_INPUT_ID = {
    name: 'contact-input-name',
    phone: 'contact-input-phone',
    email: 'contact-input-email',
    service: 'contact-service-trigger',
    message: 'contact-textarea-message'
  };

  /** @returns {{ ok: true, payload: object } | { ok: false, errors: Record<string, string> }} */
  function validateContactForm(raw) {
    const errors = {};
    const c = siteContent?.contact || {};
    const allowed = Array.isArray(c.serviceOptions) ? c.serviceOptions : [];
    const allowedSet = new Set(allowed);

    const name = contactSanitizeField(raw.name, 120);
    const phone = contactSanitizeField(raw.phone, 25);
    const email = contactSanitizeField(raw.email, 254).toLowerCase();
    const service = contactSanitizeField(raw.service, 200);
    const message = contactSanitizeField(raw.message, 2000);

    if (name.length < 2) {
      errors.name = 'يرجى إدخال الاسم (حرفان على الأقل).';
    } else if (!/[a-zA-Z0-9\u0600-\u06FF]/.test(name)) {
      errors.name = 'الاسم يحتوي على أحرف غير صالحة.';
    }

    if (email && !isValidEmail(email)) {
      errors.email = 'صيغة البريد الإلكتروني غير صحيحة.';
    }
    if (phone && !isValidPhone(phone)) {
      errors.phone = 'صيغة رقم الجوال غير صحيحة.';
    }
    if (!email && !phone) {
      errors.email = 'يرجى إدخال البريد الإلكتروني أو رقم الجوال للتواصل.';
    }

    if (!service) {
      errors.service = 'يرجى اختيار نوع الخدمة.';
    } else if (allowed.length && !allowedSet.has(service)) {
      errors.service = 'نوع الخدمة المختار غير صالح.';
    }

    if (Object.keys(errors).length) {
      return { ok: false, errors };
    }

    return {
      ok: true,
      payload: {
        name,
        phone,
        email,
        service,
        message,
        submittedAt: new Date().toISOString()
      }
    };
  }

  function clearContactFormStatus() {
    const el = document.getElementById('contact-form-status');
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
  }

  function showContactFormStatus(message) {
    const el = document.getElementById('contact-form-status');
    if (!el) return;
    el.textContent = message || '';
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearContactFieldError(field) {
    const errId = 'contact-error-' + field;
    const errEl = document.getElementById(errId);
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('hidden');
    }
    const inputId = CONTACT_FIELD_INPUT_ID[field];
    if (inputId) {
      const inp = document.getElementById(inputId);
      if (inp) {
        inp.classList.remove('is-invalid');
        inp.removeAttribute('aria-invalid');
        inp.removeAttribute('aria-describedby');
      }
    }
  }

  function clearContactFormErrors() {
    CONTACT_FIELD_ORDER.forEach((f) => clearContactFieldError(f));
  }

  function applyContactFieldErrors(errors) {
    clearContactFormErrors();
    if (!errors || typeof errors !== 'object') return;
    for (const field of CONTACT_FIELD_ORDER) {
      const msg = errors[field];
      if (!msg) continue;
      const errEl = document.getElementById('contact-error-' + field);
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
      }
      const inputId = CONTACT_FIELD_INPUT_ID[field];
      if (inputId) {
        const inp = document.getElementById(inputId);
        if (inp) {
          inp.classList.add('is-invalid');
          inp.setAttribute('aria-invalid', 'true');
          inp.setAttribute('aria-describedby', 'contact-error-' + field);
        }
      }
    }
  }

  function focusFirstContactError(errors) {
    if (!errors || typeof errors !== 'object') return;
    for (const field of CONTACT_FIELD_ORDER) {
      if (!errors[field]) continue;
      const inputId = CONTACT_FIELD_INPUT_ID[field];
      const inp = inputId && document.getElementById(inputId);
      if (inp) {
        inp.focus();
        inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      break;
    }
  }

  function setupContactFormLiveValidation() {
    if (window.__qaderContactLiveValidation) return;
    window.__qaderContactLiveValidation = true;
    const onChange = (field) => () => {
      clearContactFieldError(field);
      clearContactFormStatus();
    };
    document.getElementById('contact-input-name')?.addEventListener('input', onChange('name'));
    document.getElementById('contact-input-phone')?.addEventListener('input', onChange('phone'));
    document.getElementById('contact-input-email')?.addEventListener('input', onChange('email'));
    document.getElementById('contact-textarea-message')?.addEventListener('input', onChange('message'));
  }

  function setContactSubmitButtonLoading(btn, loading, sendingLabel) {
    const labelEl = btn.querySelector('.contact-submit-btn__label');
    if (!labelEl) return;
    if (loading) {
      labelEl.textContent = '';
      const icon = document.createElement('i');
      icon.className = 'fa fa-spinner fa-spin';
      icon.setAttribute('aria-hidden', 'true');
      labelEl.appendChild(icon);
      labelEl.appendChild(document.createTextNode(' ' + (sendingLabel || '…')));
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
    } else {
      btn.removeAttribute('aria-busy');
      btn.disabled = false;
    }
  }

  function setContactSubmitButtonLabel(btn, text) {
    const labelEl = btn.querySelector('.contact-submit-btn__label');
    if (labelEl) labelEl.textContent = text || '';
    else btn.textContent = text || '';
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

  function setMetaTag(name, content, isProperty) {
    if (!content) return;
    const attr = isProperty ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function setMetaTagOptional(name, content, isProperty) {
    const attr = isProperty ? 'property' : 'name';
    const sel = `meta[${attr}="${name}"]`;
    const el = document.querySelector(sel);
    if (!content) {
      if (el) el.remove();
      return;
    }
    setMetaTag(name, content, isProperty);
  }

  function updateHreflangLinks(canonicalUrl) {
    let u = (canonicalUrl || '').trim();
    if (!u || !/^https?:\/\//i.test(u)) return;
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((link) => {
      link.href = u;
    });
  }

  function buildStructuredData(data) {
    const m = data.meta || {};
    const b = data.brand || {};
    const soc = data.social || {};
    const canonical = (m.canonicalUrl || '').trim();
    if (!canonical || !/^https?:\/\//i.test(canonical)) return null;

    const sameAs = ['instagram', 'youtube', 'twitter', 'tiktok', 'snapchat']
      .map((k) => soc[k])
      .filter((x) => x && /^https?:\/\//i.test(String(x).trim()));

    let logoUrl = (m.ogImage || '').trim();
    if (logoUrl) logoUrl = normalizeImgSrc(logoUrl);

    const org = {
      '@type': 'Organization',
      '@id': canonical + '#organization',
      name: b.nameAr || m.title || 'قادر برودكشن',
      url: canonical,
      description: (m.description || '').trim() || undefined
    };
    if (b.nameEn) org.alternateName = b.nameEn;
    if (logoUrl && /^https?:\/\//i.test(logoUrl)) {
      org.logo = { '@type': 'ImageObject', url: logoUrl };
    }
    if (sameAs.length) org.sameAs = sameAs;
    org.areaServed = { '@type': 'Country', name: 'SA' };
    if (m.keywords && String(m.keywords).trim()) {
      const parts = String(m.keywords)
        .split(/[,،|;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length) org.knowsAbout = parts.slice(0, 24);
    }

    const site = {
      '@type': 'WebSite',
      '@id': canonical + '#website',
      name: m.title || org.name,
      url: canonical,
      inLanguage: ['ar-SA', 'en'],
      publisher: { '@id': canonical + '#organization' }
    };
    if (m.titleEn && String(m.titleEn).trim()) site.alternateName = String(m.titleEn).trim();
    if (m.descriptionEn && String(m.descriptionEn).trim()) {
      site.description = String(m.descriptionEn).trim();
    }

    const graph = [org, site].map((o) => {
      Object.keys(o).forEach((k) => {
        if (o[k] === undefined) delete o[k];
      });
      return o;
    });

    return { '@context': 'https://schema.org', '@graph': graph };
  }

  function injectStructuredData(data) {
    const payload = buildStructuredData(data);
    let el = document.getElementById('qader-jsonld');
    if (!payload) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = 'qader-jsonld';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(payload);
  }

  function syncClientsMarqueeLayout() {
    const track = document.getElementById('clients-marquee-track');
    const s1 = document.getElementById('clients-strip-1');
    if (!track || !s1) return;
    const w = s1.offsetWidth;
    if (w < 4) return;
    // Move the track to the right by one full strip width (left → right loop)
    track.style.setProperty('--marquee-shift', w + 'px');
    /* Higher pxPerSec = shorter duration = faster scroll (strip width ÷ pxPerSec ≈ seconds per loop). */
    const pxPerSec = 1500;
    const dur = Math.min(5, Math.max(1, Math.round(w / pxPerSec)));
    track.style.setProperty('--marquee-duration', dur + 's');
  }

  function restartClientsMarqueeAnimation() {
    const track = document.getElementById('clients-marquee-track');
    if (!track) return;
    // Force restart: set to none → reflow → clear (CSS animation applies)
    track.style.animation = 'none';
    // eslint-disable-next-line no-unused-expressions
    track.offsetHeight;
    track.style.removeProperty('animation');
  }

  function bindClientsMarqueeObservers() {
    const s1 = document.getElementById('clients-strip-1');
    const track = document.getElementById('clients-marquee-track');
    if (!s1 || !track) return;

    const schedule = () => {
      window.requestAnimationFrame(() => {
        syncClientsMarqueeLayout();
        window.requestAnimationFrame(syncClientsMarqueeLayout);
      });
    };
    schedule();

    s1.querySelectorAll('img').forEach((img) => {
      if (!img.complete) {
        img.addEventListener('load', schedule, { once: true });
        img.addEventListener('error', schedule, { once: true });
      }
    });

    if (clientsMarqueeResizeObs) clientsMarqueeResizeObs.disconnect();
    clientsMarqueeResizeObs = new ResizeObserver(() => schedule());
    clientsMarqueeResizeObs.observe(s1);
  }

  function teardownClientsMarqueeObservers() {
    if (clientsMarqueeResizeObs) {
      clientsMarqueeResizeObs.disconnect();
      clientsMarqueeResizeObs = null;
    }
  }

  function getYoutubeId(url) {
    if (!url) return null;
    const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|watch\?v=))([\w-]{11})/);
    return m ? m[1] : null;
  }

  function getVimeoId(url) {
    if (!url) return null;
    const m = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? m[1] : null;
  }

  function isDirectVideoUrl(url) {
    if (!url) return false;
    const path = String(url).split('?')[0].split('#')[0].toLowerCase();
    return /\.(mp4|webm|ogg|ogv)(\s*)$/i.test(path);
  }

  function normalizeImgSrc(url) {
    const M = window.QaderMediaUrls;
    return M && typeof M.normalizeImageUrl === 'function' ? M.normalizeImageUrl(url) : (url || '').trim();
  }

  const _prewarmOrigins = new Set();

  function preconnect(origin) {
    if (!origin || _prewarmOrigins.has(origin)) return;
    _prewarmOrigins.add(origin);
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  function prewarmVideoUrl(url) {
    const u = (url || '').trim();
    if (!u) return;
    const yid = getYoutubeId(u);
    if (yid) {
      preconnect('https://www.youtube-nocookie.com');
      preconnect('https://i.ytimg.com');
      return;
    }
    const vid = getVimeoId(u);
    if (vid) {
      preconnect('https://player.vimeo.com');
      return;
    }
    const drivePreview =
      window.QaderMediaUrls && typeof window.QaderMediaUrls.googleDrivePreviewEmbedUrl === 'function'
        ? window.QaderMediaUrls.googleDrivePreviewEmbedUrl(u)
        : null;
    if (drivePreview) {
      preconnect('https://drive.google.com');
      preconnect('https://www.google.com');
      preconnect('https://lh3.googleusercontent.com');
      return;
    }
  }

  function modalLoaderHtml() {
    return `<div id="modal-loader" class="absolute inset-0 flex items-center justify-center bg-black/60">
      <div class="flex items-center gap-3 text-sm text-gray-200">
        <i class="fa fa-spinner fa-spin" aria-hidden="true"></i>
        <span>جاري تحميل الفيديو…</span>
      </div>
    </div>`;
  }

  /**
   * YouTube / Vimeo / direct file → inline player. Other HTTPS → external open link (many sites block iframe).
   */
  function buildModalVideoHtml(url) {
    const cfg = siteContent?.modal || {};
    const u = (url || '').trim();
    if (!u) {
      return `<div class="text-center p-8">
        <div class="modal-play-icon mx-auto mb-4"><i class="fa fa-play mr-[-4px]"></i></div>
        <p class="text-gray-400 text-sm">${esc(cfg.videoHint || '')}</p>
      </div>`;
    }

    const yid = getYoutubeId(u);
    if (yid) {
      const src = `https://www.youtube-nocookie.com/embed/${esc(yid)}`;
      return `<iframe class="w-full h-full border-0" src="${src}" title="YouTube video" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    }

    const vid = getVimeoId(u);
    if (vid) {
      const src = `https://player.vimeo.com/video/${esc(vid)}`;
      return `<iframe class="w-full h-full border-0" src="${src}" title="Vimeo video" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    }

    const drivePreview =
      window.QaderMediaUrls && typeof window.QaderMediaUrls.googleDrivePreviewEmbedUrl === 'function'
        ? window.QaderMediaUrls.googleDrivePreviewEmbedUrl(u)
        : null;
    if (drivePreview) {
      return `<iframe class="w-full h-full border-0" src="${esc(drivePreview)}" title="Google Drive" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    }

    const directU =
      window.QaderMediaUrls && typeof window.QaderMediaUrls.normalizeDirectMediaUrl === 'function'
        ? window.QaderMediaUrls.normalizeDirectMediaUrl(u)
        : u;
    if (isDirectVideoUrl(directU)) {
      return `<video class="w-full h-full object-contain bg-black" controls playsinline preload="metadata" src="${esc(directU)}"></video>`;
    }

    if (/^https?:\/\//i.test(u)) {
      const msg = cfg.externalVideoMessage || 'افتح الرابط في نافذة جديدة.';
      const label = cfg.openExternalLabel || 'فتح الفيديو';
      return `<div class="flex flex-col items-center justify-center p-6 md:p-10 text-center h-full overflow-auto">
        <p class="text-gray-400 text-sm mb-5 max-w-md leading-relaxed">${esc(msg)}</p>
        <a href="${esc(u)}" target="_blank" rel="noopener noreferrer" id="modal-external-link" class="px-6 py-3 rounded-xl font-bold text-black text-sm shrink-0" style="background:linear-gradient(135deg,#E2C06E,#C9A84C,#A07830)">${esc(label)}</a>
        <p class="text-gray-600 text-xs mt-5 break-all max-w-full px-2" dir="ltr">${esc(u)}</p>
      </div>`;
    }

    return `<div class="text-center p-8"><p class="text-gray-500 text-sm">رابط غير صالح</p></div>`;
  }

  function applyContentToDOM(data, options) {
    const opts = options || {};
    siteContent = data;
    portfolioItems = Array.isArray(data.portfolio?.items) ? data.portfolio.items : [];

    const m = data.meta || {};
    const b = data.brand || {};
    if (m.title) document.title = m.title;
    setMetaTag('description', m.description, false);
    setMetaTag('og:title', m.title || document.title, true);
    setMetaTag('og:description', m.description, true);
    setMetaTag('og:type', 'website', true);
    if (m.canonicalUrl) {
      setMetaTag('og:url', m.canonicalUrl, true);
      updateHreflangLinks(m.canonicalUrl);
    }
    setMetaTag('og:site_name', b.nameAr || m.title || document.title, true);
    setMetaTag('og:locale', 'ar_SA', true);
    setMetaTag('og:locale:alternate', 'en_US', true);
    setMetaTagOptional('keywords', (m.keywords || '').trim(), false);
    if (m.ogImage) {
      const og = normalizeImgSrc(m.ogImage);
      setMetaTag('og:image', og, true);
      setMetaTag('twitter:image', og, false);
    }
    setMetaTag('twitter:card', m.ogImage ? 'summary_large_image' : 'summary', false);
    setMetaTag('twitter:title', m.title || document.title, false);
    setMetaTag('twitter:description', m.description, false);
    injectStructuredData(data);

    const linkCanon = document.querySelector('link[rel="canonical"]');
    if (linkCanon && m.canonicalUrl) linkCanon.href = m.canonicalUrl;
    const navBrandName = document.getElementById('nav-brand-name');
    const navBrandEn = document.getElementById('nav-brand-en');
    if (navBrandName) navBrandName.textContent = b.nameAr || '';
    if (navBrandEn) navBrandEn.textContent = b.nameEn || '';

    renderNavLinks(data.nav);

    const hero = data.hero || {};
    const hTag = document.querySelector('#h-tag .hero-tag-text');
    if (hTag) hTag.textContent = hero.tag || '';
    const hSpans = document.querySelectorAll('#h-title > span');
    if (hSpans[0]) {
      const l1 = (hero.line1 || '').trim();
      hSpans[0].textContent = l1;
      if (l1) {
        hSpans[0].classList.remove('hidden');
        hSpans[0].removeAttribute('aria-hidden');
      } else {
        hSpans[0].classList.add('hidden');
        hSpans[0].setAttribute('aria-hidden', 'true');
      }
    }
    if (hSpans[1]) hSpans[1].textContent = hero.line2 || '';
    if (hSpans[2]) hSpans[2].textContent = hero.line3 || '';
    const hSub = document.getElementById('h-sub');
    if (hSub) hSub.textContent = hero.subtitle || '';
    const cta1 = document.getElementById('hero-cta-primary');
    const cta2 = document.getElementById('hero-cta-secondary');
    if (cta1) {
      cta1.textContent = hero.cta1Label || '';
      cta1.href = hero.cta1Href || '#portfolio';
    }
    if (cta2) {
      cta2.textContent = hero.cta2Label || '';
      cta2.href = hero.cta2Href || '#portfolio';
    }

    renderStats(data.stats);

    const ab = data.about || {};
    const abEyebrow = document.querySelector('#about .section-eyebrow');
    if (abEyebrow) abEyebrow.textContent = ab.eyebrow || '';
    const abH2 = document.getElementById('about-title-line1');
    const abH2g = document.getElementById('about-title-highlight');
    if (abH2) abH2.textContent = ab.titleLine1 || '';
    if (abH2g) abH2g.textContent = ab.titleHighlight || '';
    const aboutText = document.getElementById('about-text');
    if (aboutText) aboutText.textContent = ab.body || '';
    const decoLetter = document.getElementById('about-deco-letter');
    const decoSub = document.getElementById('about-deco-sub');
    if (decoLetter) decoLetter.textContent = b.logoLetter || 'Q';
    if (decoSub) decoSub.textContent = ab.decoSub || '';
    const vTitle = document.getElementById('about-vision-title');
    const vText = document.getElementById('about-vision-text');
    const mTitle = document.getElementById('about-mission-title');
    const mText = document.getElementById('about-mission-text');
    if (vTitle) vTitle.textContent = ab.visionTitle || '';
    if (vText) vText.textContent = ab.visionText || '';
    if (mTitle) mTitle.textContent = ab.missionTitle || '';
    if (mText) mText.textContent = ab.missionText || '';
    const badgeT = document.getElementById('about-badge-title');
    const badgeS = document.getElementById('about-badge-sub');
    if (badgeT) badgeT.textContent = ab.badgeTitle || '';
    if (badgeS) badgeS.textContent = ab.badgeSub || '';
    renderAboutTags(ab.tags);

    renderServicesSection(data.services);
    renderPortfolioSectionHeader(data.portfolio);
    renderFilterButtons(data.portfolio?.filters || []);
    renderPortfolio();

    renderMethodology(data.methodology);
    renderWhyUs(data.whyUs);
    renderClients(data.clients);
    renderContact(data.contact, data.contactInfo);
    renderFooter(data.footer, data.brand, data.social, data.contactInfo);
    renderWhatsappFab(data.whatsappFab);

    const fb = document.getElementById('content-fallback-banner');
    if (fb) {
      if (opts.showFallback) fb.classList.remove('hidden');
      else fb.classList.add('hidden');
    }

    refreshScrollAnimations();
  }

  function refreshScrollAnimations() {
    if (typeof ScrollTrigger === 'undefined' || typeof gsap === 'undefined') return;
    ScrollTrigger.getAll().forEach((t) => t.kill());
    statsAnimated = false;
    document.querySelectorAll('.fade-up').forEach((el, i) => {
      gsap.set(el, { opacity: 0, y: 40 });
      gsap.to(el, {
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        delay: (i % 4) * 0.1
      });
    });
    initStatCounters();
  }

  function renderNavLinks(nav) {
    const desktop = document.getElementById('nav-links-desktop');
    const mobile = document.getElementById('nav-links-mobile');
    const items = nav?.items || [];
    const adminPath = 'adminqader/';
    if (desktop) {
      desktop.innerHTML = items
        .map((it) => `<a href="${esc(it.href)}" class="nav-link">${esc(it.label)}</a>`)
        .join('');
    }
    if (mobile) {
      mobile.innerHTML =
        items
          .map(
            (it) =>
              `<a href="${esc(it.href)}" onclick="window.__qaderToggleMobile && window.__qaderToggleMobile()" class="nav-link text-lg py-2 block border-b border-white/5">${esc(it.label)}</a>`
          )
          .join('') +
        `<a href="${adminPath}" onclick="window.__qaderToggleMobile && window.__qaderToggleMobile()" class="nav-link text-lg text-gold py-3 block font-bold">لوحة التحكم</a>`;
    }
    const cta = document.getElementById('nav-cta');
    if (cta && nav) {
      cta.textContent = nav.ctaLabel || '';
      cta.href = nav.ctaHref || '#contact';
    }
  }

  function renderStats(stats) {
    const wrap = document.getElementById('stats-grid');
    if (!wrap || !Array.isArray(stats)) return;
    wrap.innerHTML = stats
      .map(
        (s, i) => `
      <div class="stat-item fade-up">
        <div class="stat-number" data-target="${Number(s.target) || 0}" data-stat-idx="${i}">0</div>
        <div class="text-[#9a9a9a] md:text-gray-500 text-xs sm:text-sm mt-1 font-medium stat-label leading-snug">${esc(s.label)}</div>
      </div>`
      )
      .join('');
    if (statsAnimated) {
      wrap.querySelectorAll('.stat-number').forEach((el) => {
        const t = +el.dataset.target;
        el.textContent = t + '+';
      });
    }
  }

  function renderAboutTags(tags) {
    const wrap = document.getElementById('about-tags');
    if (!wrap || !Array.isArray(tags)) return;
    wrap.innerHTML = tags
      .map(
        (t) =>
          `<span class="px-4 py-2 rounded-lg text-sm text-gold-light border font-medium" style="border-color:rgba(201,168,76,0.2);background:rgba(201,168,76,0.05)">${esc(t)}</span>`
      )
      .join('');
  }

  function renderServicesSection(svc) {
    const eyebrow = document.querySelector('#services .section-eyebrow');
    const h2 = document.getElementById('services-heading');
    if (eyebrow) eyebrow.textContent = svc?.eyebrow || '';
    if (h2) {
      h2.innerHTML = headingHtml3(svc?.titleBefore, svc?.titleHighlight, svc?.titleAfter);
    }
    renderServicesCards(svc?.items || []);
  }

  function initServiceAccordions() {
    const grid = document.getElementById('services-grid');
    if (!grid) return;

    function bind() {
      grid.querySelectorAll('.service-card__toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
          const card = btn.closest('.service-card');
          if (!card) return;
          const willOpen = !card.classList.contains('is-open');
          grid.querySelectorAll('.service-card').forEach((c) => {
            c.classList.remove('is-open');
            const t = c.querySelector('.service-card__toggle');
            if (t) t.setAttribute('aria-expanded', 'false');
          });
          if (willOpen) {
            card.classList.add('is-open');
            btn.setAttribute('aria-expanded', 'true');
          }
        });
      });
    }

    bind();

    if (!window.__qaderServiceResizeBound) {
      window.__qaderServiceResizeBound = true;
      window.addEventListener(
        'resize',
        debounce(() => {
          if (window.matchMedia('(min-width: 768px)').matches) {
            grid.querySelectorAll('.service-card').forEach((c) => {
              c.classList.remove('is-open');
              c.querySelector('.service-card__toggle')?.setAttribute('aria-expanded', 'false');
            });
          }
        }, 200)
      );
    }
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function renderServicesCards(items) {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    grid.innerHTML = items
      .map(
        (s, idx) => `
    <article class="service-card glass-card rounded-2xl fade-up text-right" style="opacity:0;transform:translateY(40px)" data-service-index="${idx}">
      <button type="button" class="service-card__toggle md:hidden flex w-full items-center gap-3 p-4 sm:p-5 text-right border-0 bg-transparent cursor-pointer rounded-2xl" aria-expanded="false" aria-controls="svc-body-${idx}">
        <div class="service-icon flex-shrink-0 !mb-0" style="width:48px;height:48px;font-size:1.15rem"><i class="fa ${esc(s.icon)}" aria-hidden="true"></i></div>
        <h3 class="flex-1 text-white font-bold text-[0.95rem] leading-snug m-0">${esc(s.title)}</h3>
        <span class="service-card__chevron flex-shrink-0 w-9 h-9 rounded-full border flex items-center justify-center text-gold transition-transform duration-300" style="border-color:rgba(201,168,76,0.4)" aria-hidden="true"><i class="fa fa-chevron-down text-xs"></i></span>
      </button>
      <div class="hidden md:block p-6 pb-2">
        <div class="service-icon mb-4"><i class="fa ${esc(s.icon)}" aria-hidden="true"></i></div>
        <h3 class="text-white font-bold text-base mb-0">${esc(s.title)}</h3>
      </div>
      <div id="svc-body-${idx}" class="service-card__body">
        <ul class="service-card__ul space-y-0 md:space-y-1.5 px-4 pb-4 pt-0 md:px-6 md:pb-6 md:pt-2">
        ${(s.items || [])
          .map(
            (item) =>
              `<li class="text-[#b8b8b8] md:text-gray-500 text-sm md:text-sm flex items-start gap-2.5 py-2 md:py-0 border-b border-white/[0.06] md:border-0 last:border-0"><span class="w-1.5 h-1.5 rounded-full bg-gold/80 flex-shrink-0 mt-1.5 md:mt-2" aria-hidden="true"></span><span class="leading-relaxed">${esc(item)}</span></li>`
          )
          .join('')}
        </ul>
      </div>
    </article>`
      )
      .join('');
    initServiceAccordions();
  }

  function renderPortfolioSectionHeader(p) {
    const eyebrow = document.querySelector('#portfolio .section-eyebrow');
    const h2 = document.getElementById('portfolio-heading');
    if (eyebrow) eyebrow.textContent = p?.eyebrow || '';
    if (h2) {
      h2.innerHTML = headingHtml2(p?.titleBefore, p?.titleHighlight);
    }
  }

  function renderFilterButtons(filters) {
    const host = document.getElementById('filter-btns');
    if (!host || !Array.isArray(filters)) return;
    host.innerHTML = filters
      .map(
        (f, i) =>
          `<button type="button" class="filter-btn min-h-[44px] px-4 sm:px-[22px]${i === 0 ? ' active' : ''}" data-filter="${esc(f.key)}">${esc(f.label)}</button>`
      )
      .join('');
    currentFilter = filters[0]?.key || 'all';
    host.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        host.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderPortfolio();
      });
    });
  }

  function portfolioCardInner(p) {
    const color = p.color || '#1a1a1a';
    const rawImg = (p.imageUrl && String(p.imageUrl).trim()) || '';
    if (rawImg) {
      const src = normalizeImgSrc(rawImg);
      return `<img src="${esc(src)}" alt="${esc(p.title || '')}" class="portfolio-thumb w-full h-full object-cover" loading="lazy" decoding="async"/>`;
    }
    return `<div class="w-full h-full flex items-end justify-start p-0" style="background:${esc(color)}">
      <div class="w-full h-full flex items-center justify-center" style="background:linear-gradient(135deg,${esc(color)}99,rgba(0,0,0,0.5))">
        <i class="fa fa-play-circle text-4xl md:text-5xl" style="color:rgba(201,168,76,0.28)"></i>
      </div>
    </div>`;
  }

  function renderPortfolio() {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;
    const filtered =
      currentFilter === 'all' ? portfolioItems : portfolioItems.filter((p) => p.cat === currentFilter);
    grid.innerHTML = filtered
      .map(
        (p) => `
    <div class="portfolio-card fade-up" data-portfolio-id="${p.id}" role="button" tabindex="0" aria-label="${esc(p.title)}">
      ${portfolioCardInner(p)}
      <div class="portfolio-overlay">
        <span class="portfolio-tag text-[0.65rem] md:text-[0.7rem]">${esc(p.tag)}</span>
        <h3 class="text-white font-bold text-sm md:text-base leading-tight">${esc(p.title)}</h3>
        <p class="text-gray-400 md:text-gray-300 text-[0.7rem] md:text-xs mt-0.5 md:mt-1 line-clamp-2">${esc(p.desc)}</p>
      </div>
    </div>`
      )
      .join('');
    grid.querySelectorAll('.portfolio-card').forEach((card) => {
      const open = () => {
        const id = +card.dataset.portfolioId;
        openModal(id);
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });

      // Pre-warm on hover/touch so Drive/YouTube feel faster on click.
      const warm = () => {
        const id = +card.dataset.portfolioId;
        const p = portfolioItems.find((x) => x.id === id);
        if (p && p.video) prewarmVideoUrl(p.video);
      };
      card.addEventListener('mouseenter', warm, { passive: true });
      card.addEventListener('touchstart', warm, { passive: true });
    });

    // After filtering we re-render cards. Ensure they become visible even if ScrollTrigger
    // doesn’t re-run for newly inserted .fade-up elements.
    const cards = grid.querySelectorAll('.portfolio-card.fade-up');
    if (typeof gsap === 'undefined') {
      cards.forEach((el) => {
        el.classList.remove('fade-up');
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    } else {
      cards.forEach((el, i) => {
        gsap.killTweensOf(el);
        gsap.set(el, { opacity: 0, y: 28 });
        gsap.to(el, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: Math.min(0.25, i * 0.03) });
      });
    }
  }

  function renderMethodology(m) {
    const eyebrow = document.querySelector('#methodology .section-eyebrow');
    const h2 = document.getElementById('methodology-heading');
    if (eyebrow) eyebrow.textContent = m?.eyebrow || '';
    if (h2) {
      h2.innerHTML = headingHtml2(m?.titleBefore, m?.titleHighlight);
    }
    const steps = m?.steps || [];
    const desk = document.getElementById('methodology-steps-desktop');
    const mob = document.getElementById('methodology-steps-mobile');
    if (desk) {
      desk.innerHTML = steps
        .map(
          (s) => `
      <div class="step-item text-center relative z-10">
        <div class="step-circle mx-auto mb-4">${esc(s.num)}</div>
        <div class="text-white font-bold text-sm mb-1">${esc(s.title)}</div>
        <div class="text-gray-500 text-xs leading-relaxed">${esc(s.desc)}</div>
      </div>`
        )
        .join('');
    }
    if (mob) {
      mob.innerHTML = steps
        .map(
          (s) => `
      <div class="flex gap-5 items-start">
        <div class="step-circle flex-shrink-0">${esc(s.num)}</div>
        <div><div class="text-white font-bold text-sm mb-1">${esc(s.title)}</div><div class="text-[#a8a8a8] text-sm leading-relaxed">${esc(s.desc)}</div></div>
      </div>`
        )
        .join('');
    }
  }

  function renderWhyUs(w) {
    const eyebrow = document.querySelector('#why-us .section-eyebrow');
    const h2 = document.getElementById('why-us-heading');
    if (eyebrow) eyebrow.textContent = w?.eyebrow || '';
    if (h2) {
      h2.innerHTML = headingHtml3(w?.titleBefore, w?.titleHighlight, w?.titleAfter);
    }
    const grid = document.getElementById('why-us-grid');
    if (!grid || !Array.isArray(w?.items)) return;
    grid.innerHTML = w.items
      .map(
        (it) => `
      <div class="glass-card p-5 sm:p-6 fade-up text-center rounded-2xl">
        <div class="text-2xl sm:text-3xl text-gold/90 mb-2 sm:mb-3"><i class="fa ${esc(it.icon)}" aria-hidden="true"></i></div>
        <div class="text-white font-bold text-sm sm:text-base mb-1.5 sm:mb-2 leading-snug">${esc(it.title)}</div>
        <div class="text-[#a8a8a8] sm:text-gray-500 text-xs sm:text-sm leading-relaxed">${esc(it.desc)}</div>
      </div>`
      )
      .join('');
  }

  function renderClients(cl) {
    const eb = document.getElementById('clients-eyebrow');
    const t1 = document.getElementById('clients-title-line');
    const th = document.getElementById('clients-title-highlight');
    const sub = document.getElementById('clients-subtitle');
    if (eb) eb.textContent = cl?.eyebrow || 'عملاءنا';
    if (t1) t1.textContent = cl?.titleBefore != null ? cl.titleBefore : 'شركاء';
    if (th) th.textContent = cl?.titleHighlight != null ? cl.titleHighlight : 'النجاح';
    if (sub) {
      if (cl?.subtitle) {
        sub.textContent = cl.subtitle;
        sub.classList.remove('hidden');
      } else {
        sub.textContent = '';
        sub.classList.add('hidden');
      }
    }

    const logos = Array.isArray(cl?.logos) ? cl.logos : [];
    const s1 = document.getElementById('clients-strip-1');
    const s2 = document.getElementById('clients-strip-2');
    const track = document.getElementById('clients-marquee-track');
    if (!s1 || !s2) return;

    const cell = (l) => {
      const href = (l.href || '').trim();
      const rawImg = (l.imageUrl && String(l.imageUrl).trim()) || '';
      const hasImg = !!rawImg;
      const alt = esc(l.name || 'شعار عميل');
      const imgSrc = hasImg ? normalizeImgSrc(rawImg) : '';
      const img = hasImg
        ? `<img src="${esc(imgSrc)}" alt="${alt}" class="h-9 sm:h-11 md:h-12 w-auto max-w-[100px] sm:max-w-[130px] object-contain opacity-80 hover:opacity-100 transition-opacity grayscale hover:grayscale-0" width="140" height="56" loading="eager" decoding="async" fetchpriority="low"/>`
        : `<span class="text-gray-500 text-xs sm:text-sm whitespace-nowrap px-2">${esc(l.name || 'شعار')}</span>`;
      const wrap = (inner) =>
        `<div class="flex items-center justify-center min-h-[52px] min-w-[80px]">${inner}</div>`;
      if (href && /^https?:\/\//i.test(href)) {
        return wrap(
          `<a href="${esc(href)}" class="block" target="_blank" rel="noopener noreferrer" aria-label="${alt}">${img}</a>`
        );
      }
      return wrap(img);
    };

    if (!logos.length) {
      teardownClientsMarqueeObservers();
      s1.innerHTML =
        '<span class="text-gray-500 text-sm px-4 text-center">أضف الشعارات من لوحة التحكم: المفتاح <code class="text-gold/90 text-xs">clients.logos</code> (imageUrl + name)</span>';
      s2.innerHTML = '';
      if (track) {
        track.style.animation = 'none';
        track.style.transform = 'none';
      }
      return;
    }

    if (track) {
      track.style.removeProperty('animation');
      track.style.removeProperty('transform');
    }
    // If there are only a few logos, the marquee can “cut” (visible empty gap).
    // Build a first strip that is guaranteed wide enough (>= 2× viewport of the wrap).
    const wrap = document.getElementById('clients-marquee-wrap');
    const base = logos
      .filter((l) => l && (String(l.imageUrl || '').trim() || String(l.name || '').trim()))
      .slice(0, 80);

    const baseRow = (base.length ? base : logos).map(cell).join('');
    s1.innerHTML = baseRow;
    // Measure and repeat until wide enough
    const targetW = Math.max(900, (wrap?.offsetWidth || 0) * 2);
    let guard = 0;
    while (s1.offsetWidth > 0 && s1.offsetWidth < targetW && guard < 8) {
      s1.insertAdjacentHTML('beforeend', baseRow);
      guard += 1;
    }
    s2.innerHTML = s1.innerHTML;

    bindClientsMarqueeObservers();
    restartClientsMarqueeAnimation();
  }

  function renderWhatsappFab(w) {
    const a = document.getElementById('wa-fab');
    const lbl = document.getElementById('wa-fab-label');
    if (!a) return;
    if (!w || w.enabled === false) {
      a.classList.add('hidden');
      a.removeAttribute('href');
      return;
    }
    let raw = String(w.phone || '').replace(/\D/g, '');
    if (!raw) raw = '966578258199';
    if (raw.startsWith('0')) raw = '966' + raw.slice(1);
    else if (!raw.startsWith('966')) raw = '966' + raw;
    const msg = encodeURIComponent(
      w.message ||
        'السلام عليكم، تحية طيبة. أود التواصل مع فريق قادر برودكشن بخصوص خدمات الإنتاج المرئي والمحتوى البصري.'
    );
    a.href = `https://wa.me/${raw}?text=${msg}`;
    if (lbl) lbl.textContent = w.label || 'تواصل معنا';
    const aria = `${w.label || 'واتساب'}${w.displayPhone ? ' — ' + w.displayPhone : ''}`;
    a.setAttribute('aria-label', aria);
    a.classList.remove('hidden');
  }

  function renderContact(c, info) {
    const eyebrow = document.querySelector('#contact .section-eyebrow');
    const h2 = document.getElementById('contact-heading');
    if (eyebrow) eyebrow.textContent = c?.eyebrow || '';
    if (h2) {
      h2.innerHTML = headingHtml3(c?.titleBefore, c?.titleHighlight, c?.titleAfter);
    }
    const L = c?.labels || {};
    const P = c?.placeholders || {};
    setLabel('contact-label-name', L.name);
    setLabel('contact-label-phone', L.phone);
    setLabel('contact-label-email', L.email);
    setLabel('contact-label-service', L.service);
    setLabel('contact-label-message', L.message);
    const inName = document.getElementById('contact-input-name');
    const inPhone = document.getElementById('contact-input-phone');
    const inEmail = document.getElementById('contact-input-email');
    const hiddenSvc = document.getElementById('contact-select-service');
    const svcList = document.getElementById('contact-service-list');
    const svcDisplay = document.getElementById('contact-service-display');
    const ta = document.getElementById('contact-textarea-message');
    const btn = document.getElementById('contact-submit-btn');
    if (inName) inName.placeholder = P.name || '';
    if (inPhone) inPhone.placeholder = P.phone || '';
    if (inEmail) inEmail.placeholder = P.email || '';
    if (ta) ta.placeholder = P.message || '';
    const ph = P.service || '';
    window.__qaderContactServicePlaceholder = ph;
    if (hiddenSvc) hiddenSvc.value = '';
    if (svcDisplay) {
      svcDisplay.textContent = ph;
      svcDisplay.classList.add('text-gray-500');
      svcDisplay.classList.remove('text-gray-200');
    }
    if (svcList) {
      const opts = c?.serviceOptions || [];
      svcList.innerHTML =
        `<li role="option" tabindex="-1" class="contact-service-option is-placeholder" data-service-option data-value="">${esc(ph)}</li>` +
        opts
          .map(
            (o) =>
              `<li role="option" tabindex="-1" class="contact-service-option" data-service-option data-value="${esc(o)}">${esc(o)}</li>`
          )
          .join('');
    }
    closeContactServiceDropdown();
    setupContactServiceDropdownOnce();
    if (btn) setContactSubmitButtonLabel(btn, c?.submitLabel || 'إرسال الطلب ✦');

    const citiesWrap = document.getElementById('contact-cities');
    if (citiesWrap && Array.isArray(c?.cities)) {
      citiesWrap.innerHTML = c.cities
        .map(
          (city, i) =>
            `${i ? '<span class="text-gray-700">·</span>' : ''}<span class="flex items-center gap-2 text-gray-400 text-sm"><i class="fa fa-map-marker-alt text-gold"></i> ${esc(city)}</span>`
        )
        .join('');
    }

    window.__qaderContactSuccess = c?.successMessage || '✓ تم إرسال طلبك بنجاح!';
  }

  function setLabel(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
  }

  function renderFooter(footer, brand, social, info) {
    const fname = document.getElementById('footer-brand-name');
    const fen = document.getElementById('footer-brand-en');
    const flogo = document.getElementById('footer-logo-letter');
    if (fname) fname.textContent = brand?.nameAr || '';
    if (fen) fen.textContent = brand?.nameEn || '';
    if (flogo) flogo.textContent = brand?.logoLetter || 'Q';
    const tag = document.getElementById('footer-tagline');
    if (tag) tag.textContent = footer?.tagline || '';
    const sTitle = document.getElementById('footer-col-services-title');
    const mTitle = document.getElementById('footer-col-more-title');
    const cTitle = document.getElementById('footer-col-cities-title');
    if (sTitle) sTitle.textContent = footer?.servicesTitle || '';
    if (mTitle) mTitle.textContent = footer?.moreTitle || '';
    if (cTitle) cTitle.textContent = footer?.citiesTitle || '';

    const sLinks = document.getElementById('footer-service-links');
    if (sLinks && Array.isArray(footer?.serviceLinks)) {
      sLinks.innerHTML = footer.serviceLinks
        .map((l) => `<a href="${esc(l.href)}" class="footer-link">${esc(l.label)}</a>`)
        .join('');
    }
    const mLinks = document.getElementById('footer-more-links');
    if (mLinks && Array.isArray(footer?.moreLinks)) {
      mLinks.innerHTML = footer.moreLinks
        .map((l) => `<a href="${esc(l.href)}" class="footer-link">${esc(l.label)}</a>`)
        .join('');
    }

    const ig = document.getElementById('social-instagram');
    const tw = document.getElementById('social-twitter');
    const sn = document.getElementById('social-snapchat');
    const tk = document.getElementById('social-tiktok');
    const yt = document.getElementById('social-youtube');
    if (ig) ig.href = social?.instagram || '#';
    if (tw) tw.href = social?.twitter || '#';
    if (sn) sn.href = social?.snapchat || '#';
    if (tk) tk.href = social?.tiktok || '#';
    if (yt) yt.href = social?.youtube || '#';

    const copy = document.getElementById('footer-copyright');
    const made = document.getElementById('footer-made-in');
    if (copy) copy.textContent = footer?.copyright || '';
    if (made) made.textContent = footer?.madeIn || '';

    const fCta = document.getElementById('footer-cta');
    if (fCta) fCta.textContent = footer?.ctaLabel || '';

    const citiesFoot = document.getElementById('footer-cities');
    const cities = siteContent?.contact?.cities || [];
    if (citiesFoot && Array.isArray(cities)) {
      citiesFoot.innerHTML = cities
        .map(
          (city) =>
            `<div class="footer-link flex items-center gap-2"><i class="fa fa-map-marker-alt text-gold text-xs"></i> ${esc(city)}</div>`
        )
        .join('');
    }
  }

  function openModal(id) {
    const p = portfolioItems.find((x) => x.id === id);
    if (!p) return;
    const area = document.getElementById('modal-video-area');
    if (area) {
      prewarmVideoUrl(p.video);
      const player = buildModalVideoHtml(p.video);
      area.innerHTML = `<div class="relative w-full h-full">${player}</div>`;
      const wrap = area.firstElementChild;
      let loader = null;
      const iframe = area.querySelector('iframe');
      const video = area.querySelector('video');
      let shown = false;
      const show = () => {
        if (shown || !wrap) return;
        shown = true;
        wrap.insertAdjacentHTML('afterbegin', modalLoaderHtml());
        loader = wrap.querySelector('#modal-loader');
      };
      const done = () => loader && loader.remove();
      const showTimer = window.setTimeout(show, 200);
      if (iframe) iframe.addEventListener('load', done, { once: true });
      if (video) {
        video.addEventListener('loadeddata', done, { once: true });
        video.addEventListener('error', done, { once: true });
      }
      const finish = () => {
        window.clearTimeout(showTimer);
        done();
      };
      if (iframe) iframe.addEventListener('load', finish, { once: true });
      if (video) {
        video.addEventListener('loadeddata', finish, { once: true });
        video.addEventListener('error', finish, { once: true });
      }
      // Safety: never keep the loader forever
      window.setTimeout(finish, 3000);
    }
    document.getElementById('modal-title').textContent = p.title;
    document.getElementById('modal-desc').textContent = p.desc;
    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('modal-dialog')?.focus();
  }

  function closeModal(e) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    if (e && e.target && e.target.id !== 'modal-overlay') return;
    const area = document.getElementById('modal-video-area');
    if (area) {
      const v = area.querySelector('video');
      if (v) {
        try {
          v.pause();
        } catch (_) {}
      }
      area.innerHTML = '';
    }
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function setContactServiceOpen(open) {
    const wrap = document.getElementById('contact-service-wrap');
    const list = document.getElementById('contact-service-list');
    const trigger = document.getElementById('contact-service-trigger');
    if (!wrap || !list || !trigger) return;
    wrap.classList.toggle('is-open', open);
    list.hidden = !open;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeContactServiceDropdown() {
    setContactServiceOpen(false);
  }

  function setupContactServiceDropdownOnce() {
    const wrap = document.getElementById('contact-service-wrap');
    const trigger = document.getElementById('contact-service-trigger');
    const list = document.getElementById('contact-service-list');
    const hidden = document.getElementById('contact-select-service');
    const display = document.getElementById('contact-service-display');
    if (!wrap || !trigger || !list || !hidden || !display) return;
    if (wrap.dataset.qaderDropdownBound === '1') return;
    wrap.dataset.qaderDropdownBound = '1';

    if (!window.__qaderContactServiceDocClose) {
      window.__qaderContactServiceDocClose = true;
      document.addEventListener('click', () => {
        const w = document.getElementById('contact-service-wrap');
        if (w && w.classList.contains('is-open')) closeContactServiceDropdown();
      });
    }

    trigger.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const open = !wrap.classList.contains('is-open');
      setContactServiceOpen(open);
    });

    list.addEventListener('click', (ev) => {
      const li = ev.target.closest('[data-service-option]');
      if (!li) return;
      ev.stopPropagation();
      const val = li.getAttribute('data-value') || '';
      hidden.value = val;
      const ph = window.__qaderContactServicePlaceholder || '';
      display.textContent = val || ph;
      if (val) {
        display.classList.remove('text-gray-500');
        display.classList.add('text-gray-200');
      } else {
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-200');
      }
      list.querySelectorAll('[role="option"]').forEach((opt) => {
        opt.setAttribute('aria-selected', opt === li ? 'true' : 'false');
      });
      closeContactServiceDropdown();
      if (val) {
        clearContactFieldError('service');
        clearContactFormStatus();
      }
    });
  }

  async function submitContact(e) {
    const btn = e?.currentTarget || document.getElementById('contact-submit-btn');
    if (!btn || contactSubmitInFlight) return;

    clearContactFormStatus();
    clearContactFormErrors();

    if (isContactRateLimited()) {
      showContactFormStatus(
        siteContent?.contact?.rateLimitMessage || 'تم تجاوز الحد المسموح من الطلبات. حاول لاحقاً.'
      );
      return;
    }

    const raw = {
      name: document.getElementById('contact-input-name')?.value,
      phone: document.getElementById('contact-input-phone')?.value,
      email: document.getElementById('contact-input-email')?.value,
      service: document.getElementById('contact-select-service')?.value,
      message: document.getElementById('contact-textarea-message')?.value
    };
    const validated = validateContactForm(raw);
    if (!validated.ok) {
      applyContactFieldErrors(validated.errors);
      focusFirstContactError(validated.errors);
      return;
    }
    const payload = validated.payload;

    const cfg = window.QADER_CONFIG || {};
    const sheetUrl = (cfg.contactSheetWebhookUrl || '').trim();
    const defaultLabel = siteContent?.contact?.submitLabel || 'إرسال الطلب ✦';
    const sendingLabel = siteContent?.contact?.sendingLabel || 'جاري الإرسال…';

    contactSubmitInFlight = true;
    setContactSubmitButtonLoading(btn, true, sendingLabel);

    const doneGradient = 'linear-gradient(135deg,#E2C06E,#C9A84C,#A07830)';
    let succeeded = false;

    try {
      let sheetOk = false;
      if (sheetUrl && !sheetUrl.includes('YOUR_')) {
        const body = JSON.stringify(payload);
        try {
          const isGoogleScript =
            /script\.google\.com\/macros/i.test(sheetUrl) ||
            /script\.googleusercontent\.com/i.test(sheetUrl);
          const headers = isGoogleScript
            ? { 'Content-Type': 'text/plain;charset=utf-8' }
            : { 'Content-Type': 'application/json' };
          const r = await fetch(sheetUrl, {
            method: 'POST',
            mode: 'cors',
            headers,
            body,
            redirect: 'follow'
          });
          sheetOk = r.ok;
          if (!sheetOk) {
            const t = await r.text().catch(() => '');
            console.warn('contactSheetWebhookUrl', r.status, t.slice(0, 200));
          }
        } catch (err) {
          console.error('contactSheetWebhookUrl', err);
        }
      }

      let supabaseOk = false;
      if (isConfigured() && supabaseClient) {
        const { error } = await supabaseClient.from('contact_submissions').insert({ payload });
        if (error) console.error(error);
        else supabaseOk = true;
      }

      if (!sheetOk && !supabaseOk) {
        if (sheetUrl && !sheetUrl.includes('YOUR_')) {
          showContactFormStatus(
            'تعذر إرسال الطلب. تحقق من رابط الجدول (تطبيق الويب) في الإعدادات أو حاول لاحقاً.'
          );
        } else if (isConfigured()) {
          showContactFormStatus('تعذر إرسال الطلب. حاول لاحقاً.');
        } else {
          showContactFormStatus(
            'لم يُضبط إرسال الطلبات بعد. أضِف contactSheetWebhookUrl أو إعدادات server في js/config.js — راجع README.'
          );
        }
        return;
      }

      succeeded = true;
      clearContactFormErrors();
      clearContactFormStatus();
      recordContactSuccessSubmit();
      const okMsg = window.__qaderContactSuccess || '✓ تم إرسال طلبك بنجاح!';
      setContactSubmitButtonLabel(btn, okMsg);
      btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
      setTimeout(() => {
        setContactSubmitButtonLabel(btn, defaultLabel);
        btn.style.background = doneGradient;
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        contactSubmitInFlight = false;
      }, 3000);
    } finally {
      if (!succeeded) {
        setContactSubmitButtonLoading(btn, false);
        setContactSubmitButtonLabel(btn, defaultLabel);
        btn.style.background = doneGradient;
        contactSubmitInFlight = false;
      }
    }
  }

  function setupNavbarScroll() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
  }

  function toggleMobile() {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('hamburger');
    if (!menu) return;
    const open = menu.classList.toggle('open');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  window.__qaderToggleMobile = toggleMobile;

  function initHeroTimeline() {
    if (typeof gsap === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);
    window.addEventListener('load', () => {
      gsap
        .timeline()
        .to('#h-tag', { opacity: 1, duration: 0.6, delay: 0.3 })
        .to('#h-title', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.2')
        .to('#h-sub', { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, '-=0.5')
        .to('#h-btns', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.4');
    });
  }

  function initStatCounters() {
    if (typeof ScrollTrigger === 'undefined' || typeof gsap === 'undefined') return;
    document.querySelectorAll('.stat-number').forEach((el) => {
      const target = +el.dataset.target;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          const counter = { val: 0 };
          gsap.to(counter, {
            val: target,
            duration: 1.5,
            ease: 'power2.out',
            onUpdate: () => {
              el.textContent = Math.round(counter.val) + '+';
            }
          });
        }
      });
    });
    statsAnimated = true;
  }

  async function loadFromSupabase() {
    const def = window.DEFAULT_SITE_CONTENT;
    if (!isConfigured()) {
      applyContentToDOM(def, { showFallback: true });
      return;
    }
    // Render immediately, then overwrite when remote content arrives.
    // Do NOT show the fallback banner unless we actually fail to load remote content.
    applyContentToDOM(def, { showFallback: false });
    const supLib = window.supabase;
    if (!supLib || typeof supLib.createClient !== 'function') {
      console.error('Supabase library missing');
      applyContentToDOM(def, { showFallback: true });
      return;
    }
    supabaseClient = supLib.createClient(window.QADER_CONFIG.supabaseUrl, window.QADER_CONFIG.supabaseAnonKey);
    const rowId = window.QADER_CONFIG.siteRowId || 'main';
    const { data, error } = await supabaseClient.from('site_settings').select('content').eq('id', rowId).maybeSingle();
    if (error) {
      console.error(error);
      applyContentToDOM(def, { showFallback: true });
      return;
    }
    const merged = mergeContent(def, data?.content || {});
    applyContentToDOM(merged);

    if (realtimeChannel && supabaseClient) {
      try {
        supabaseClient.removeChannel(realtimeChannel);
      } catch (_) {}
    }
    realtimeChannel = supabaseClient
      .channel('site_settings_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings', filter: `id=eq.${rowId}` },
        (payload) => {
          const newContent = payload.new?.content;
          if (newContent) {
            const m = mergeContent(window.DEFAULT_SITE_CONTENT, newContent);
            applyContentToDOM(m);
          }
        }
      )
      .subscribe();
  }

  function init() {
    setupNavbarScroll();
    initHeroTimeline();
    setupContactFormLiveValidation();
    loadFromSupabase();

    const spinStyle = document.createElement('style');
    spinStyle.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(spinStyle);

    const overlay = document.getElementById('modal-overlay');
    overlay?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.getElementById('modal-overlay')?.classList.contains('open')) closeModal();
        closeContactServiceDropdown();
      }
    });

    window.openModal = openModal;
    window.closeModal = closeModal;
    window.submitContact = submitContact;
  }

  window.applyContentToDOM = function (remotePartial, options) {
    const merged = mergeContent(window.DEFAULT_SITE_CONTENT, remotePartial || {});
    applyContentToDOM(merged, options);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
