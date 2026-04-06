/**
 * Visual form editor — same JSON shape as DEFAULT_SITE_CONTENT / site_settings.content.
 */
(function () {
  'use strict';

  const SECTIONS = [
    { id: 'meta', title: 'عام و SEO' },
    { id: 'brand', title: 'العلامة التجارية' },
    { id: 'nav', title: 'القائمة' },
    { id: 'hero', title: 'الواجهة الرئيسية' },
    { id: 'stats', title: 'الأرقام' },
    { id: 'about', title: 'من نحن' },
    { id: 'services', title: 'الخدمات' },
    { id: 'portfolio', title: 'معرض الأعمال' },
    { id: 'methodology', title: 'منهجيتنا' },
    { id: 'clients', title: 'عملاءنا' },
    { id: 'whatsapp', title: 'واتساب' },
    { id: 'whyUs', title: 'لماذا نحن' },
    { id: 'contact', title: 'التواصل' },
    { id: 'footer', title: 'التذييل' },
    { id: 'social', title: 'السوشيال' },
    { id: 'contactInfo', title: 'معلومات التواصل' },
    { id: 'modal', title: 'نافذة الفيديو' }
  ];

  let panelsRoot = null;
  let navRoot = null;

  function el(tag, cls, attrs) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'text') n.textContent = v;
        else n.setAttribute(k, v);
      });
    }
    return n;
  }

  function fieldWrap(labelText, inputNode, hint) {
    const w = el('div', 'space-y-1.5');
    const lab = el('label', 'block text-sm font-medium text-gray-400');
    lab.textContent = labelText;
    if (inputNode.id) lab.setAttribute('for', inputNode.id);
    w.append(lab, inputNode);
    if (hint) {
      const h = el('p', 'text-xs text-gray-600');
      h.textContent = hint;
      w.append(h);
    }
    return w;
  }

  function textInput(id, ph) {
    const i = el(
      'input',
      'w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30'
    );
    i.type = 'text';
    if (id) i.id = id;
    if (ph) i.placeholder = ph;
    return i;
  }

  function textArea(id, rows) {
    const t = el(
      'textarea',
      'w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 resize-y min-h-[4rem]'
    );
    if (id) t.id = id;
    t.rows = rows || 3;
    t.dir = 'auto';
    return t;
  }

  function numInput(id) {
    const i = el('input', 'w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-gold focus:outline-none');
    i.type = 'number';
    if (id) i.id = id;
    return i;
  }

  function panelCard(title) {
    const card = el('div', 'rounded-2xl border border-white/10 bg-charcoal-light/80 p-5 md:p-6 space-y-4');
    const h = el('h3', 'text-base font-bold text-gold border-b border-white/10 pb-3 mb-1');
    h.textContent = title;
    card.append(h);
    return card;
  }

  function repeaterBox(addLabel, onAdd) {
    const wrap = el('div', 'space-y-3');
    const list = el('div', 'space-y-3');
    const btn = el(
      'button',
      'text-sm font-bold text-gold border border-gold/40 rounded-xl px-4 py-2 hover:bg-gold/10 transition-colors',
      { type: 'button' }
    );
    btn.textContent = addLabel;
    btn.addEventListener('click', () => onAdd(list));
    wrap.append(list, btn);
    return { wrap, list };
  }

  function rowDel(onDel) {
    const b = el('button', 'shrink-0 px-2 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm', { type: 'button' });
    b.textContent = 'حذف';
    b.addEventListener('click', onDel);
    return b;
  }

  function bindImageUpload(fileInput, uploadBtn, targetTextInput) {
    uploadBtn.type = 'button';
    uploadBtn.className =
      'text-xs font-bold px-3 py-2 rounded-xl border border-gold/40 text-gold hover:bg-gold/10 transition-colors shrink-0';
    uploadBtn.textContent = 'رفع صورة';
    fileInput.type = 'file';
    fileInput.className = 'sr-only';
    fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif';
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      if (!window.QaderAdminUpload || typeof window.QaderAdminUpload.uploadImage !== 'function') {
        alert('الرفع غير متاح — سجّل الدخول وأنشئ دلو site-media (انظر README).');
        fileInput.value = '';
        return;
      }
      uploadBtn.disabled = true;
      try {
        targetTextInput.value = await window.QaderAdminUpload.uploadImage(f);
      } catch (err) {
        alert(err.message || String(err));
      }
      uploadBtn.disabled = false;
      fileInput.value = '';
    });
  }

  function buildMeta(p) {
    const c = panelCard('عنوان الموقع والوصف');
    c.append(
      fieldWrap('عنوان الصفحة (title)', textInput('fld-meta-title')),
      fieldWrap('الوصف (description)', textArea('fld-meta-description', 3)),
      fieldWrap('عنوان إنجليزي (SEO / JSON-LD)', textInput('fld-meta-titleEn')),
      fieldWrap('وصف إنجليزي (SEO)', textArea('fld-meta-descriptionEn', 2)),
      fieldWrap('كلمات مفتاحية (مفصولة بفاصلة)', textArea('fld-meta-keywords', 2)),
      fieldWrap('صورة المشاركة (ogImage)', textInput('fld-meta-ogImage', 'https://...')),
      fieldWrap('الرابط الأساسي (canonical)', textInput('fld-meta-canonicalUrl', 'https://...'))
    );
    p.append(c);
  }

  function buildBrand(p) {
    const c = panelCard('العلامة');
    c.append(
      fieldWrap('الاسم بالعربية', textInput('fld-brand-nameAr')),
      fieldWrap('الاسم بالإنجليزية', textInput('fld-brand-nameEn')),
      fieldWrap('حرف الشعار', textInput('fld-brand-logoLetter'))
    );
    p.append(c);
  }

  function buildNav(p) {
    const c = panelCard('روابط القائمة');
    const { wrap, list } = repeaterBox('+ إضافة رابط', (ul) => addNavRow(ul, { href: '', label: '' }));
    list.id = 'rep-nav-items';
    c.append(fieldWrap('نص زر التواصل', textInput('fld-nav-ctaLabel')), fieldWrap('رابط زر التواصل', textInput('fld-nav-ctaHref')));
    c.append(wrap);
    p.append(c);
  }

  function addNavRow(list, it) {
    const row = el('div', 'flex flex-wrap items-end gap-2 p-3 rounded-xl bg-black/25 border border-white/10');
    const href = textInput(null, '#about');
    href.classList.add('flex-1', 'min-w-[120px]');
    href.value = it.href || '';
    const label = textInput(null, 'التسمية');
    label.classList.add('flex-1', 'min-w-[120px]');
    label.value = it.label || '';
    row.append(fieldWrap('المسار', href), fieldWrap('النص', label), rowDel(() => row.remove()));
    list.append(row);
  }

  function buildHero(p) {
    const c = panelCard('العنوان والأزرار');
    c.append(
      fieldWrap('السطر الصغير (مثل QADER PRODUCTION)', textInput('fld-hero-tag')),
      fieldWrap('السطر 1 (فارغ = مخفي)', textInput('fld-hero-line1')),
      fieldWrap('السطر 2', textInput('fld-hero-line2')),
      fieldWrap('السطر 3', textInput('fld-hero-line3')),
      fieldWrap('النص التوضيحي', textArea('fld-hero-subtitle', 3)),
      fieldWrap('زر 1 — النص', textInput('fld-hero-cta1Label')),
      fieldWrap('زر 1 — الرابط', textInput('fld-hero-cta1Href')),
      fieldWrap('زر 2 — النص', textInput('fld-hero-cta2Label')),
      fieldWrap('زر 2 — الرابط', textInput('fld-hero-cta2Href'))
    );
    p.append(c);
  }

  function buildStats(p) {
    const c = panelCard('الأرقام');
    const { wrap, list } = repeaterBox('+ إضافة رقم', (ul) => addStatRow(ul, { target: 0, label: '' }));
    list.id = 'rep-stats';
    c.append(wrap);
    p.append(c);
  }

  function addStatRow(list, s) {
    const row = el('div', 'flex flex-wrap gap-2 items-end p-3 rounded-xl bg-black/25 border border-white/10');
    const t = numInput(null);
    t.value = s.target != null ? String(s.target) : '0';
    const lab = textInput(null, 'التسمية');
    lab.classList.add('flex-1', 'min-w-[140px]');
    lab.value = s.label || '';
    row.append(fieldWrap('الرقم', t), fieldWrap('الوصف', lab), rowDel(() => row.remove()));
    list.append(row);
  }

  function buildAbout(p) {
    const c = panelCard('من نحن');
    c.append(
      fieldWrap('التسمية الصغيرة', textInput('fld-about-eyebrow')),
      fieldWrap('العنوان — السطر الأول', textInput('fld-about-titleLine1')),
      fieldWrap('الجزء المميز', textInput('fld-about-titleHighlight')),
      fieldWrap('النص الطويل', textArea('fld-about-body', 5)),
      fieldWrap('عنوان الرؤية', textInput('fld-about-visionTitle')),
      fieldWrap('نص الرؤية', textArea('fld-about-visionText', 2)),
      fieldWrap('عنوان الرسالة', textInput('fld-about-missionTitle')),
      fieldWrap('نص الرسالة', textArea('fld-about-missionText', 2)),
      fieldWrap('عنوان الشارة', textInput('fld-about-badgeTitle')),
      fieldWrap('نص الشارة الفرعي', textInput('fld-about-badgeSub')),
      fieldWrap('نص تحت حرف Q', textInput('fld-about-decoSub')),
      fieldWrap('الوسوم (سطر لكل وسوم)', textArea('fld-about-tags', 4))
    );
    p.append(c);
  }

  function buildServices(p) {
    const c = panelCard('عناوين قسم الخدمات');
    c.append(
      fieldWrap('التسمية الصغيرة', textInput('fld-svc-eyebrow')),
      fieldWrap('قبل التمييز', textInput('fld-svc-titleBefore')),
      fieldWrap('الجزء المميز', textInput('fld-svc-titleHighlight')),
      fieldWrap('بعد التمييز', textInput('fld-svc-titleAfter'))
    );
    const { wrap, list } = repeaterBox('+ إضافة خدمة', (ul) => addServiceRow(ul, { icon: 'fa-film', title: '', items: [] }));
    list.id = 'rep-services';
    c.append(el('p', 'text-sm text-gray-500', { text: 'أيقونة Font Awesome (مثل fa-film). النقاط: سطر لكل نقطة.' }));
    c.append(wrap);
    p.append(c);
  }

  function addServiceRow(list, s) {
    const row = el('div', 'p-4 rounded-xl bg-black/25 border border-white/10 space-y-3');
    const icon = textInput(null, 'fa-film');
    icon.value = s.icon || '';
    const title = textInput(null, 'عنوان الخدمة');
    title.value = s.title || '';
    const bullets = textArea(null, 5);
    bullets.placeholder = 'سطر لكل نقطة';
    bullets.value = Array.isArray(s.items) ? s.items.join('\n') : '';
    const head = el('div', 'flex flex-wrap gap-2 items-start');
    head.append(fieldWrap('الأيقونة', icon), fieldWrap('العنوان', title), rowDel(() => row.remove()));
    row.append(head, fieldWrap('النقاط', bullets));
    list.append(row);
  }

  function buildPortfolio(p) {
    const c = panelCard('فلاتر المعرض');
    const fl = repeaterBox('+ فلتر', (ul) => addPfFilterRow(ul, { key: '', label: '' }));
    fl.list.id = 'rep-pf-filters';
    c.append(fl.wrap);
    const c2 = panelCard('عناصر المعرض');
    c2.append(
      fieldWrap('التسمية الصغيرة', textInput('fld-pf-eyebrow')),
      fieldWrap('قبل العنوان', textInput('fld-pf-titleBefore')),
      fieldWrap('جزء مميز', textInput('fld-pf-titleHighlight'))
    );
    const it = repeaterBox('+ مشروع', (ul) =>
      addPfItemRow(ul, {
        id: Date.now(),
        title: '',
        cat: 'all',
        tag: '',
        desc: '',
        color: '#1a1a1a',
        imageUrl: '',
        video: ''
      })
    );
    it.list.id = 'rep-pf-items';
    c2.append(it.wrap);
    p.append(c, c2);
  }

  function addPfFilterRow(list, f) {
    const row = el('div', 'flex flex-wrap gap-2 items-end p-3 rounded-xl bg-black/25 border border-white/10');
    const key = textInput(null, 'key');
    key.value = f.key || '';
    const label = textInput(null, 'التسمية');
    label.value = f.label || '';
    row.append(fieldWrap('المفتاح', key), fieldWrap('الاسم', label), rowDel(() => row.remove()));
    list.append(row);
  }

  function addPfItemRow(list, item) {
    const row = el('div', 'p-4 rounded-xl bg-black/30 border border-gold/20 space-y-3');
    const top = el('div', 'flex justify-between items-center gap-2');
    top.append(el('span', 'text-xs text-gray-500', { text: 'مشروع' }), rowDel(() => row.remove()));
    row.append(top);
    const idIn = numInput(null);
    idIn.value = item.id != null ? String(item.id) : '';
    const title = textInput(null);
    title.value = item.title || '';
    const cat = textInput(null);
    cat.value = item.cat || '';
    const tag = textInput(null);
    tag.value = item.tag || '';
    const desc = textArea(null, 2);
    desc.value = item.desc || '';
    const color = textInput(null);
    color.value = item.color || '';
    const img = textInput(null);
    img.value = item.imageUrl || '';
    const vid = textInput(null);
    vid.value = item.video || '';
    row._pfInputs = { idIn, title, cat, tag, desc, color, img, vid };
    const g = el('div', 'grid sm:grid-cols-2 gap-3');
    g.append(
      fieldWrap('المعرف', idIn),
      fieldWrap('العنوان', title),
      fieldWrap('التصنيف (cat)', cat),
      fieldWrap('الوسم', tag),
      fieldWrap('الوصف', desc),
      fieldWrap('اللون', color),
      fieldWrap('رابط الصورة', img),
      fieldWrap('رابط الفيديو', vid)
    );
    const upFile = el('input');
    const upBtn = el('button');
    bindImageUpload(upFile, upBtn, img);
    const upRow = el('div', 'flex flex-wrap items-center gap-2 w-full');
    upRow.append(upBtn, upFile);
    const upHint = el('span', 'text-[11px] text-gray-600');
    upHint.textContent = 'رفع إلى السحابة يملأ الرابط أعلاه (أسرع من روابط Drive).';
    upRow.append(upHint);
    row.append(g, upRow);
    list.append(row);
  }

  function buildMethodology(p) {
    const c = panelCard('الخطوات');
    c.append(
      fieldWrap('التسمية الصغيرة', textInput('fld-met-eyebrow')),
      fieldWrap('قبل العنوان', textInput('fld-met-titleBefore')),
      fieldWrap('جزء مميز', textInput('fld-met-titleHighlight'))
    );
    const { wrap, list } = repeaterBox('+ خطوة', (ul) => addStepRow(ul, { num: '', title: '', desc: '' }));
    list.id = 'rep-met-steps';
    c.append(wrap);
    p.append(c);
  }

  function addStepRow(list, s) {
    const row = el('div', 'flex flex-wrap gap-2 p-3 rounded-xl bg-black/25 border border-white/10');
    const num = textInput(null, '١');
    num.value = s.num || '';
    const title = textInput(null);
    title.value = s.title || '';
    const desc = textInput(null);
    desc.value = s.desc || '';
    row.append(
      fieldWrap('الرقم', num),
      fieldWrap('العنوان', title),
      fieldWrap('الوصف', desc),
      rowDel(() => row.remove())
    );
    list.append(row);
  }

  function buildClients(p) {
    const c = panelCard('عملاءنا');
    c.append(
      fieldWrap('التسمية الصغيرة', textInput('fld-cl-eyebrow')),
      fieldWrap('قبل العنوان', textInput('fld-cl-titleBefore')),
      fieldWrap('جزء مميز', textInput('fld-cl-titleHighlight')),
      fieldWrap('وصف فرعي', textInput('fld-cl-subtitle'))
    );
    const { wrap, list } = repeaterBox('+ شعار', (ul) => addLogoRow(ul, { name: '', imageUrl: '', href: '' }));
    list.id = 'rep-cl-logos';
    c.append(wrap);
    p.append(c);
  }

  function addLogoRow(list, logo) {
    const row = el('div', 'flex flex-wrap gap-2 items-end p-3 rounded-xl bg-black/25 border border-white/10');
    const name = textInput(null);
    name.value = logo.name || '';
    const url = textInput(null, 'رابط مباشر أو Drive/Dropbox');
    url.value = logo.imageUrl || '';
    const href = textInput(null);
    href.value = logo.href || '';
    const upFile = el('input');
    const upBtn = el('button');
    bindImageUpload(upFile, upBtn, url);
    const upPair = el('div', 'flex items-center gap-2 shrink-0');
    upPair.append(upBtn, upFile);
    row.append(
      fieldWrap('الاسم / alt', name),
      fieldWrap('رابط الصورة', url),
      upPair,
      fieldWrap('رابط عند النقر', href),
      rowDel(() => row.remove())
    );
    row._logoInputs = { name, url, href };
    list.append(row);
  }

  function buildWhatsapp(p) {
    const c = panelCard('زر واتساب');
    const w = el('div', 'flex items-center gap-3');
    const cbx = el('input', 'rounded border-white/20 bg-black/40 text-gold w-4 h-4');
    cbx.type = 'checkbox';
    cbx.id = 'fld-wa-enabled';
    const lab = el('label', 'text-sm text-gray-300 cursor-pointer', { for: 'fld-wa-enabled' });
    lab.textContent = 'تفعيل الزر';
    w.append(cbx, lab);
    c.append(
      w,
      fieldWrap('النص فوق الزر', textInput('fld-wa-label')),
      fieldWrap('الرقم (966...)', textInput('fld-wa-phone')),
      fieldWrap('عرض الرقم', textInput('fld-wa-displayPhone')),
      fieldWrap('الرسالة الجاهزة', textArea('fld-wa-message', 3))
    );
    p.append(c);
  }

  function buildWhyUs(p) {
    const c = panelCard('لماذا نحن');
    c.append(
      fieldWrap('التسمية الصغيرة', textInput('fld-wu-eyebrow')),
      fieldWrap('قبل العنوان', textInput('fld-wu-titleBefore')),
      fieldWrap('مميز', textInput('fld-wu-titleHighlight')),
      fieldWrap('بعد العنوان', textInput('fld-wu-titleAfter'))
    );
    const { wrap, list } = repeaterBox('+ عنصر', (ul) => addWhyRow(ul, { icon: 'fa-star', title: '', desc: '' }));
    list.id = 'rep-why';
    c.append(wrap);
    p.append(c);
  }

  function addWhyRow(list, it) {
    const row = el('div', 'flex flex-wrap gap-2 p-3 rounded-xl bg-black/25 border border-white/10');
    const icon = textInput(null);
    icon.value = it.icon || '';
    const title = textInput(null);
    title.value = it.title || '';
    const desc = textInput(null);
    desc.value = it.desc || '';
    row.append(
      fieldWrap('أيقونة', icon),
      fieldWrap('العنوان', title),
      fieldWrap('الوصف', desc),
      rowDel(() => row.remove())
    );
    list.append(row);
  }

  function buildContact(p) {
    const c = panelCard('عناوين التواصل');
    c.append(
      fieldWrap('التسمية الصغيرة', textInput('fld-ct-eyebrow')),
      fieldWrap('قبل العنوان', textInput('fld-ct-titleBefore')),
      fieldWrap('مميز', textInput('fld-ct-titleHighlight')),
      fieldWrap('بعد العنوان', textInput('fld-ct-titleAfter'))
    );
    const c2 = panelCard('تسميات الحقول');
    const keys = ['name', 'phone', 'email', 'service', 'message'];
    const ar = ['الاسم', 'الجوال', 'البريد', 'الخدمة', 'الرسالة'];
    keys.forEach((k, i) => c2.append(fieldWrap(ar[i], textInput('fld-ct-l-' + k))));
    const c3 = panelCard('عناصر نائبة (placeholder)');
    keys.forEach((k, i) => c3.append(fieldWrap(ar[i], textInput('fld-ct-p-' + k))));
    const c4 = panelCard('خيارات ورسائل');
    c4.append(
      fieldWrap('خيارات نوع الخدمة (سطر لكل خيار)', textArea('fld-ct-serviceOptions', 6)),
      fieldWrap('المدن (سطر لكل مدينة)', textArea('fld-ct-cities', 3)),
      fieldWrap('نص الزر', textInput('fld-ct-submitLabel')),
      fieldWrap('أثناء الإرسال', textInput('fld-ct-sendingLabel')),
      fieldWrap('رسالة النجاح', textInput('fld-ct-successMessage')),
      fieldWrap('تجاوز الحد', textArea('fld-ct-rateLimitMessage', 2))
    );
    p.append(c, c2, c3, c4);
  }

  function buildFooter(p) {
    const c = panelCard('التذييل');
    c.append(
      fieldWrap('الشعار النصي', textArea('fld-ft-tagline', 2)),
      fieldWrap('عنوان عمود الخدمات', textInput('fld-ft-servicesTitle')),
      fieldWrap('عنوان المزيد', textInput('fld-ft-moreTitle')),
      fieldWrap('عنوان المدن', textInput('fld-ft-citiesTitle')),
      fieldWrap('زر التواصل', textInput('fld-ft-ctaLabel')),
      fieldWrap('حقوق النشر', textInput('fld-ft-copyright')),
      fieldWrap('صُنع في', textInput('fld-ft-madeIn'))
    );
    const l1 = repeaterBox('+ رابط خدمة', (ul) => addLinkRow(ul, { label: '', href: '' }));
    l1.list.id = 'rep-ft-svc';
    const l2 = repeaterBox('+ رابط إضافي', (ul) => addLinkRow(ul, { label: '', href: '' }));
    l2.list.id = 'rep-ft-more';
    c.append(el('p', 'text-sm text-gray-500', { text: 'روابط الخدمات' }), l1.wrap);
    c.append(el('p', 'text-sm text-gray-500 mt-4', { text: 'روابط المزيد' }), l2.wrap);
    p.append(c);
  }

  function addLinkRow(list, l) {
    const row = el('div', 'flex flex-wrap gap-2 items-end p-3 rounded-xl bg-black/25 border border-white/10');
    const label = textInput(null);
    label.value = l.label || '';
    const href = textInput(null);
    href.value = l.href || '';
    row.append(fieldWrap('النص', label), fieldWrap('الرابط', href), rowDel(() => row.remove()));
    list.append(row);
  }

  function buildSocial(p) {
    const c = panelCard('وسائل التواصل');
    const keys = ['instagram', 'twitter', 'snapchat', 'tiktok', 'youtube'];
    const names = ['إنستغرام', 'تويتر / X', 'سناب شات', 'تيك توك', 'يوتيوب'];
    keys.forEach((k, i) => c.append(fieldWrap(names[i], textInput('fld-soc-' + k, 'https://'))));
    p.append(c);
  }

  function buildContactInfo(p) {
    const c = panelCard('معلومات إضافية (اختياري)');
    c.append(
      fieldWrap('واتساب', textInput('fld-ci-whatsapp')),
      fieldWrap('البريد', textInput('fld-ci-email')),
      fieldWrap('عرض واتساب', textInput('fld-ci-displayWhatsapp')),
      fieldWrap('عرض البريد', textInput('fld-ci-displayEmail'))
    );
    p.append(c);
  }

  function buildModal(p) {
    const c = panelCard('النافذة المنبثقة للفيديو');
    c.append(
      fieldWrap('نص بدون فيديو', textInput('fld-md-videoHint')),
      fieldWrap('رسالة الروابط الخارجية', textArea('fld-md-externalVideoMessage', 2)),
      fieldWrap('نص زر الفتح', textInput('fld-md-openExternalLabel'))
    );
    p.append(c);
  }

  const BUILDERS = {
    meta: buildMeta,
    brand: buildBrand,
    nav: buildNav,
    hero: buildHero,
    stats: buildStats,
    about: buildAbout,
    services: buildServices,
    portfolio: buildPortfolio,
    methodology: buildMethodology,
    clients: buildClients,
    whatsapp: buildWhatsapp,
    whyUs: buildWhyUs,
    contact: buildContact,
    footer: buildFooter,
    social: buildSocial,
    contactInfo: buildContactInfo,
    modal: buildModal
  };

  function mount(container) {
    if (!container) return;
    container.innerHTML = '';
    const grid = el('div', 'flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-[50vh]');
    panelsRoot = el('div', 'flex-1 min-w-0 space-y-2 order-1');
    navRoot = el(
      'nav',
      'flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:w-52 shrink-0 border-b lg:border-b-0 lg:border-l border-white/10 lg:pl-4 order-2'
    );
    SECTIONS.forEach((s, i) => {
      const btn = el(
        'button',
        'whitespace-nowrap lg:w-full text-right px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border ' +
          (i === 0 ? 'bg-gold/15 text-gold border-gold/30' : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'),
        { type: 'button', 'data-section': s.id }
      );
      btn.textContent = s.title;
      btn.addEventListener('click', () => showSection(s.id));
      navRoot.append(btn);
    });
    SECTIONS.forEach((s) => {
      const panel = el('div', 'section-panel hidden');
      panel.dataset.section = s.id;
      BUILDERS[s.id](panel);
      panelsRoot.append(panel);
    });
    grid.append(panelsRoot, navRoot);
    container.append(grid);
    showSection(SECTIONS[0].id);
  }

  function showSection(id) {
    if (!navRoot || !panelsRoot) return;
    navRoot.querySelectorAll('button[data-section]').forEach((b) => {
      const on = b.getAttribute('data-section') === id;
      b.className =
        'whitespace-nowrap lg:w-full text-right px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border ' +
        (on ? 'bg-gold/15 text-gold border-gold/30' : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5');
    });
    panelsRoot.querySelectorAll('.section-panel').forEach((p) => {
      p.classList.toggle('hidden', p.dataset.section !== id);
    });
  }

  function val(id) {
    const e = document.getElementById(id);
    return e ? String(e.value || '').trim() : '';
  }
  function set(id, v) {
    const e = document.getElementById(id);
    if (e) e.value = v != null ? String(v) : '';
  }
  function linesFromTextarea(id) {
    const t = val(id);
    if (!t) return [];
    return t
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }
  function setTextareaLines(id, arr) {
    set(id, Array.isArray(arr) ? arr.join('\n') : '');
  }

  function loadNavItems(items) {
    const list = document.getElementById('rep-nav-items');
    if (!list) return;
    list.innerHTML = '';
    (items || []).forEach((it) => addNavRow(list, it));
    if (!list.children.length) addNavRow(list, { href: '#about', label: 'من نحن' });
  }
  function readNavItems() {
    const list = document.getElementById('rep-nav-items');
    if (!list) return [];
    return Array.from(list.children).map((row) => {
      const inputs = row.querySelectorAll('input');
      return { href: inputs[0]?.value?.trim() || '', label: inputs[1]?.value?.trim() || '' };
    });
  }
  function loadStats(stats) {
    const list = document.getElementById('rep-stats');
    if (!list) return;
    list.innerHTML = '';
    (stats || []).forEach((s) => addStatRow(list, s));
    if (!list.children.length) addStatRow(list, { target: 0, label: '' });
  }
  function readStats() {
    const list = document.getElementById('rep-stats');
    if (!list) return [];
    return Array.from(list.children).map((row) => {
      const inputs = row.querySelectorAll('input');
      const target = parseInt(inputs[0]?.value, 10);
      return { target: Number.isFinite(target) ? target : 0, label: inputs[1]?.value?.trim() || '' };
    });
  }
  function loadServices(items) {
    const list = document.getElementById('rep-services');
    if (!list) return;
    list.innerHTML = '';
    (items || []).forEach((s) => addServiceRow(list, s));
    if (!list.children.length) addServiceRow(list, { icon: 'fa-film', title: '', items: [] });
  }
  function readServices() {
    const list = document.getElementById('rep-services');
    if (!list) return [];
    return Array.from(list.children).map((row) => {
      const inputs = row.querySelectorAll('input');
      const tas = row.querySelectorAll('textarea');
      return {
        icon: inputs[0]?.value?.trim() || 'fa-film',
        title: inputs[1]?.value?.trim() || '',
        items: (tas[0]?.value || '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
      };
    });
  }
  function loadPfFilters(filters) {
    const list = document.getElementById('rep-pf-filters');
    if (!list) return;
    list.innerHTML = '';
    (filters || []).forEach((f) => addPfFilterRow(list, f));
    if (!list.children.length) addPfFilterRow(list, { key: 'all', label: 'الكل' });
  }
  function readPfFilters() {
    const list = document.getElementById('rep-pf-filters');
    if (!list) return [];
    return Array.from(list.children).map((row) => {
      const inputs = row.querySelectorAll('input');
      return { key: inputs[0]?.value?.trim() || '', label: inputs[1]?.value?.trim() || '' };
    });
  }
  function loadPfItems(items) {
    const list = document.getElementById('rep-pf-items');
    if (!list) return;
    list.innerHTML = '';
    (items || []).forEach((it) => addPfItemRow(list, it));
    if (!list.children.length)
      addPfItemRow(list, { id: 1, title: '', cat: 'all', tag: '', desc: '', color: '#1a1a1a', imageUrl: '', video: '' });
  }
  function readPfItems() {
    const list = document.getElementById('rep-pf-items');
    if (!list) return [];
    return Array.from(list.children)
      .map((row) => {
        const inp = row._pfInputs;
        if (!inp) return null;
        const id = parseInt(inp.idIn.value, 10);
        return {
          id: Number.isFinite(id) ? id : Date.now(),
          title: inp.title.value.trim(),
          cat: inp.cat.value.trim(),
          tag: inp.tag.value.trim(),
          desc: inp.desc.value.trim(),
          color: inp.color.value.trim() || '#1a1a1a',
          imageUrl: inp.img.value.trim(),
          video: inp.vid.value.trim()
        };
      })
      .filter(Boolean);
  }
  function loadSteps(steps) {
    const list = document.getElementById('rep-met-steps');
    if (!list) return;
    list.innerHTML = '';
    (steps || []).forEach((s) => addStepRow(list, s));
    if (!list.children.length) addStepRow(list, { num: '١', title: '', desc: '' });
  }
  function readSteps() {
    const list = document.getElementById('rep-met-steps');
    if (!list) return [];
    return Array.from(list.children).map((row) => {
      const inputs = row.querySelectorAll('input');
      return {
        num: inputs[0]?.value?.trim() || '',
        title: inputs[1]?.value?.trim() || '',
        desc: inputs[2]?.value?.trim() || ''
      };
    });
  }
  function loadLogos(logos) {
    const list = document.getElementById('rep-cl-logos');
    if (!list) return;
    list.innerHTML = '';
    (logos || []).forEach((l) => addLogoRow(list, l));
    if (!list.children.length) addLogoRow(list, { name: '', imageUrl: '', href: '' });
  }
  function readLogos() {
    const list = document.getElementById('rep-cl-logos');
    if (!list) return [];
    return Array.from(list.children).map((row) => {
      if (row._logoInputs) {
        const { name, url, href } = row._logoInputs;
        return {
          name: name.value.trim(),
          imageUrl: url.value.trim(),
          href: href.value.trim()
        };
      }
      const inputs = row.querySelectorAll('input[type="text"]');
      return {
        name: inputs[0]?.value?.trim() || '',
        imageUrl: inputs[1]?.value?.trim() || '',
        href: inputs[2]?.value?.trim() || ''
      };
    });
  }
  function loadWhy(items) {
    const list = document.getElementById('rep-why');
    if (!list) return;
    list.innerHTML = '';
    (items || []).forEach((it) => addWhyRow(list, it));
    if (!list.children.length) addWhyRow(list, { icon: 'fa-star', title: '', desc: '' });
  }
  function readWhy() {
    const list = document.getElementById('rep-why');
    if (!list) return [];
    return Array.from(list.children).map((row) => {
      const inputs = row.querySelectorAll('input');
      return {
        icon: inputs[0]?.value?.trim() || 'fa-star',
        title: inputs[1]?.value?.trim() || '',
        desc: inputs[2]?.value?.trim() || ''
      };
    });
  }
  function loadFooterLinks(id, links) {
    const list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = '';
    (links || []).forEach((l) => addLinkRow(list, l));
    if (!list.children.length) addLinkRow(list, { label: '', href: '#' });
  }
  function readFooterLinks(id) {
    const list = document.getElementById(id);
    if (!list) return [];
    return Array.from(list.children).map((row) => {
      const inputs = row.querySelectorAll('input');
      return { label: inputs[0]?.value?.trim() || '', href: inputs[1]?.value?.trim() || '#' };
    });
  }

  function load(obj) {
    if (!obj || !panelsRoot) return;
    const c = obj;
    set('fld-meta-title', c.meta?.title);
    set('fld-meta-description', c.meta?.description);
    set('fld-meta-titleEn', c.meta?.titleEn);
    set('fld-meta-descriptionEn', c.meta?.descriptionEn);
    set('fld-meta-keywords', c.meta?.keywords);
    set('fld-meta-ogImage', c.meta?.ogImage);
    set('fld-meta-canonicalUrl', c.meta?.canonicalUrl);
    set('fld-brand-nameAr', c.brand?.nameAr);
    set('fld-brand-nameEn', c.brand?.nameEn);
    set('fld-brand-logoLetter', c.brand?.logoLetter);
    loadNavItems(c.nav?.items);
    set('fld-nav-ctaLabel', c.nav?.ctaLabel);
    set('fld-nav-ctaHref', c.nav?.ctaHref);
    set('fld-hero-tag', c.hero?.tag);
    set('fld-hero-line1', c.hero?.line1);
    set('fld-hero-line2', c.hero?.line2);
    set('fld-hero-line3', c.hero?.line3);
    set('fld-hero-subtitle', c.hero?.subtitle);
    set('fld-hero-cta1Label', c.hero?.cta1Label);
    set('fld-hero-cta1Href', c.hero?.cta1Href);
    set('fld-hero-cta2Label', c.hero?.cta2Label);
    set('fld-hero-cta2Href', c.hero?.cta2Href);
    loadStats(c.stats);
    set('fld-about-eyebrow', c.about?.eyebrow);
    set('fld-about-titleLine1', c.about?.titleLine1);
    set('fld-about-titleHighlight', c.about?.titleHighlight);
    set('fld-about-body', c.about?.body);
    set('fld-about-visionTitle', c.about?.visionTitle);
    set('fld-about-visionText', c.about?.visionText);
    set('fld-about-missionTitle', c.about?.missionTitle);
    set('fld-about-missionText', c.about?.missionText);
    set('fld-about-badgeTitle', c.about?.badgeTitle);
    set('fld-about-badgeSub', c.about?.badgeSub);
    set('fld-about-decoSub', c.about?.decoSub);
    setTextareaLines('fld-about-tags', c.about?.tags);
    set('fld-svc-eyebrow', c.services?.eyebrow);
    set('fld-svc-titleBefore', c.services?.titleBefore);
    set('fld-svc-titleHighlight', c.services?.titleHighlight);
    set('fld-svc-titleAfter', c.services?.titleAfter);
    loadServices(c.services?.items);
    set('fld-pf-eyebrow', c.portfolio?.eyebrow);
    set('fld-pf-titleBefore', c.portfolio?.titleBefore);
    set('fld-pf-titleHighlight', c.portfolio?.titleHighlight);
    loadPfFilters(c.portfolio?.filters);
    loadPfItems(c.portfolio?.items);
    set('fld-met-eyebrow', c.methodology?.eyebrow);
    set('fld-met-titleBefore', c.methodology?.titleBefore);
    set('fld-met-titleHighlight', c.methodology?.titleHighlight);
    loadSteps(c.methodology?.steps);
    set('fld-cl-eyebrow', c.clients?.eyebrow);
    set('fld-cl-titleBefore', c.clients?.titleBefore);
    set('fld-cl-titleHighlight', c.clients?.titleHighlight);
    set('fld-cl-subtitle', c.clients?.subtitle);
    loadLogos(c.clients?.logos);
    const wa = c.whatsappFab || {};
    const waChk = document.getElementById('fld-wa-enabled');
    if (waChk) waChk.checked = wa.enabled !== false;
    set('fld-wa-label', wa.label);
    set('fld-wa-phone', wa.phone);
    set('fld-wa-displayPhone', wa.displayPhone);
    set('fld-wa-message', wa.message);
    set('fld-wu-eyebrow', c.whyUs?.eyebrow);
    set('fld-wu-titleBefore', c.whyUs?.titleBefore);
    set('fld-wu-titleHighlight', c.whyUs?.titleHighlight);
    set('fld-wu-titleAfter', c.whyUs?.titleAfter);
    loadWhy(c.whyUs?.items);
    const ct = c.contact || {};
    set('fld-ct-eyebrow', ct.eyebrow);
    set('fld-ct-titleBefore', ct.titleBefore);
    set('fld-ct-titleHighlight', ct.titleHighlight);
    set('fld-ct-titleAfter', ct.titleAfter);
    const L = ct.labels || {};
    set('fld-ct-l-name', L.name);
    set('fld-ct-l-phone', L.phone);
    set('fld-ct-l-email', L.email);
    set('fld-ct-l-service', L.service);
    set('fld-ct-l-message', L.message);
    const P = ct.placeholders || {};
    set('fld-ct-p-name', P.name);
    set('fld-ct-p-phone', P.phone);
    set('fld-ct-p-email', P.email);
    set('fld-ct-p-service', P.service);
    set('fld-ct-p-message', P.message);
    setTextareaLines('fld-ct-serviceOptions', ct.serviceOptions);
    setTextareaLines('fld-ct-cities', ct.cities);
    set('fld-ct-submitLabel', ct.submitLabel);
    set('fld-ct-sendingLabel', ct.sendingLabel);
    set('fld-ct-successMessage', ct.successMessage);
    set('fld-ct-rateLimitMessage', ct.rateLimitMessage);
    const ft = c.footer || {};
    set('fld-ft-tagline', ft.tagline);
    set('fld-ft-servicesTitle', ft.servicesTitle);
    set('fld-ft-moreTitle', ft.moreTitle);
    set('fld-ft-citiesTitle', ft.citiesTitle);
    set('fld-ft-ctaLabel', ft.ctaLabel);
    set('fld-ft-copyright', ft.copyright);
    set('fld-ft-madeIn', ft.madeIn);
    loadFooterLinks('rep-ft-svc', ft.serviceLinks);
    loadFooterLinks('rep-ft-more', ft.moreLinks);
    const soc = c.social || {};
    set('fld-soc-instagram', soc.instagram);
    set('fld-soc-twitter', soc.twitter);
    set('fld-soc-snapchat', soc.snapchat);
    set('fld-soc-tiktok', soc.tiktok);
    set('fld-soc-youtube', soc.youtube);
    const ci = c.contactInfo || {};
    set('fld-ci-whatsapp', ci.whatsapp);
    set('fld-ci-email', ci.email);
    set('fld-ci-displayWhatsapp', ci.displayWhatsapp);
    set('fld-ci-displayEmail', ci.displayEmail);
    const md = c.modal || {};
    set('fld-md-videoHint', md.videoHint);
    set('fld-md-externalVideoMessage', md.externalVideoMessage);
    set('fld-md-openExternalLabel', md.openExternalLabel);
  }

  function readInto(out) {
    if (!out || !panelsRoot) return;
    out.version = typeof out.version === 'number' ? out.version : 1;
    out.meta = {
      title: val('fld-meta-title'),
      description: val('fld-meta-description'),
      titleEn: val('fld-meta-titleEn'),
      descriptionEn: val('fld-meta-descriptionEn'),
      keywords: val('fld-meta-keywords'),
      ogImage: val('fld-meta-ogImage'),
      canonicalUrl: val('fld-meta-canonicalUrl')
    };
    out.brand = {
      nameAr: val('fld-brand-nameAr'),
      nameEn: val('fld-brand-nameEn'),
      logoLetter: val('fld-brand-logoLetter')
    };
    out.nav = { items: readNavItems(), ctaLabel: val('fld-nav-ctaLabel'), ctaHref: val('fld-nav-ctaHref') };
    out.hero = {
      tag: val('fld-hero-tag'),
      line1: val('fld-hero-line1'),
      line2: val('fld-hero-line2'),
      line3: val('fld-hero-line3'),
      subtitle: val('fld-hero-subtitle'),
      cta1Label: val('fld-hero-cta1Label'),
      cta1Href: val('fld-hero-cta1Href'),
      cta2Label: val('fld-hero-cta2Label'),
      cta2Href: val('fld-hero-cta2Href')
    };
    out.stats = readStats();
    out.about = {
      eyebrow: val('fld-about-eyebrow'),
      titleLine1: val('fld-about-titleLine1'),
      titleHighlight: val('fld-about-titleHighlight'),
      body: val('fld-about-body'),
      visionTitle: val('fld-about-visionTitle'),
      visionText: val('fld-about-visionText'),
      missionTitle: val('fld-about-missionTitle'),
      missionText: val('fld-about-missionText'),
      badgeTitle: val('fld-about-badgeTitle'),
      badgeSub: val('fld-about-badgeSub'),
      decoSub: val('fld-about-decoSub'),
      tags: linesFromTextarea('fld-about-tags')
    };
    out.services = {
      eyebrow: val('fld-svc-eyebrow'),
      titleBefore: val('fld-svc-titleBefore'),
      titleHighlight: val('fld-svc-titleHighlight'),
      titleAfter: val('fld-svc-titleAfter'),
      items: readServices()
    };
    out.portfolio = {
      eyebrow: val('fld-pf-eyebrow'),
      titleBefore: val('fld-pf-titleBefore'),
      titleHighlight: val('fld-pf-titleHighlight'),
      filters: readPfFilters(),
      items: readPfItems()
    };
    out.methodology = {
      eyebrow: val('fld-met-eyebrow'),
      titleBefore: val('fld-met-titleBefore'),
      titleHighlight: val('fld-met-titleHighlight'),
      steps: readSteps()
    };
    out.clients = {
      eyebrow: val('fld-cl-eyebrow'),
      titleBefore: val('fld-cl-titleBefore'),
      titleHighlight: val('fld-cl-titleHighlight'),
      subtitle: val('fld-cl-subtitle'),
      logos: readLogos()
    };
    const waEl = document.getElementById('fld-wa-enabled');
    out.whatsappFab = {
      enabled: waEl ? waEl.checked : true,
      label: val('fld-wa-label'),
      phone: val('fld-wa-phone'),
      displayPhone: val('fld-wa-displayPhone'),
      message: val('fld-wa-message')
    };
    out.whyUs = {
      eyebrow: val('fld-wu-eyebrow'),
      titleBefore: val('fld-wu-titleBefore'),
      titleHighlight: val('fld-wu-titleHighlight'),
      titleAfter: val('fld-wu-titleAfter'),
      items: readWhy()
    };
    out.contact = {
      eyebrow: val('fld-ct-eyebrow'),
      titleBefore: val('fld-ct-titleBefore'),
      titleHighlight: val('fld-ct-titleHighlight'),
      titleAfter: val('fld-ct-titleAfter'),
      labels: {
        name: val('fld-ct-l-name'),
        phone: val('fld-ct-l-phone'),
        email: val('fld-ct-l-email'),
        service: val('fld-ct-l-service'),
        message: val('fld-ct-l-message')
      },
      placeholders: {
        name: val('fld-ct-p-name'),
        phone: val('fld-ct-p-phone'),
        email: val('fld-ct-p-email'),
        service: val('fld-ct-p-service'),
        message: val('fld-ct-p-message')
      },
      serviceOptions: linesFromTextarea('fld-ct-serviceOptions'),
      cities: linesFromTextarea('fld-ct-cities'),
      submitLabel: val('fld-ct-submitLabel'),
      sendingLabel: val('fld-ct-sendingLabel'),
      successMessage: val('fld-ct-successMessage'),
      rateLimitMessage: val('fld-ct-rateLimitMessage')
    };
    out.footer = {
      tagline: val('fld-ft-tagline'),
      servicesTitle: val('fld-ft-servicesTitle'),
      moreTitle: val('fld-ft-moreTitle'),
      citiesTitle: val('fld-ft-citiesTitle'),
      ctaLabel: val('fld-ft-ctaLabel'),
      copyright: val('fld-ft-copyright'),
      madeIn: val('fld-ft-madeIn'),
      serviceLinks: readFooterLinks('rep-ft-svc'),
      moreLinks: readFooterLinks('rep-ft-more')
    };
    out.social = {
      instagram: val('fld-soc-instagram'),
      twitter: val('fld-soc-twitter'),
      snapchat: val('fld-soc-snapchat'),
      tiktok: val('fld-soc-tiktok'),
      youtube: val('fld-soc-youtube')
    };
    out.contactInfo = {
      whatsapp: val('fld-ci-whatsapp'),
      email: val('fld-ci-email'),
      displayWhatsapp: val('fld-ci-displayWhatsapp'),
      displayEmail: val('fld-ci-displayEmail')
    };
    out.modal = {
      videoHint: val('fld-md-videoHint'),
      externalVideoMessage: val('fld-md-externalVideoMessage'),
      openExternalLabel: val('fld-md-openExternalLabel')
    };
  }

  window.QaderAdminForms = { mount, load, readInto, showSection };
})();
