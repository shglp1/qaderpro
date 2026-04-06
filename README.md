# قادر برودكشن — موقع واحد + Supabase

## البنية

| المسار | الوظيفة |
|--------|---------|
| `index.html` | الصفحة العامة الوحيدة |
| `adminqader/index.html` | لوحة التحكم (Auth + JSON) |
| `reference/` | ملفات أقسام قديمة للمرجع فقط |
| `js/default-content.js` | شكل JSON الافتراضي |
| `js/media-urls.js` | تطبيع روابط صور/فيديو (Drive، Dropbox) |
| `js/config.js` | من `config.example.js` — **لا ترفع مفاتيح حقيقية لعام** |

## Supabase

1. نفّذ [`supabase/schema.sql`](supabase/schema.sql) في SQL Editor.
2. أنشئ مستخدماً في Authentication.
3. فعّل Replication لجدول `site_settings` للتحديث الحي.
4. (اختياري لرفع الصور من اللوحة) أنشئ دلو تخزين عاماً باسم `site-media` ثم نفّذ [`supabase/storage-policies.sql`](supabase/storage-policies.sql). أضف `mediaBucket: 'site-media'` في `js/config.js` إن غيّرت الاسم.
5. انسخ Project URL + **anon** إلى `js/config.js`.

**لا تضع `service_role` في المتصفح.**

## إرسال نموذج التواصل إلى جدول (Google Sheet / Excel)

الموقع يرسل JSON بالحقول: `name`, `phone`, `email`, `service`, `message`, `submittedAt`. يُحفَظ في **Supabase** (`contact_submissions`) إن وُجدت الإعدادات، و/أو يُرسل إلى **رابط ويب** تضعه في `js/config.js`:

```js
contactSheetWebhookUrl: 'https://script.google.com/macros/s/XXXX/exec'
```

### Google Sheets + Apps Script (الطريقة الموصى بها)

1. أنشئ [جدول Google](https://sheets.google.com) وسمِّ الورقة مثلاً `Leads`.
2. الصف الأول (عناوين): `التاريخ` | `الاسم` | `الجوال` | `البريد` | `الخدمة` | `الرسالة`.
3. **Extensions → Apps Script** والصق نصاً مثل:

استخدم **رابط نشر تطبيق الويب** من Apps Script (ينتهي غالباً بـ `/exec`)، وليس رابط فتح الجدول في المتصفح. إن ظهرت رسالة خطأ عند الإرسال، افتح رابط الـ Web App مرة واحدة في المتصفح ووافق على الأذونات، ثم أعد النشر إذا عدّلت السكربت.

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  const body = JSON.parse(e.postData.contents);
  sheet.appendRow([
    new Date(),
    body.name || '',
    body.phone || '',
    body.email || '',
    body.service || '',
    body.message || ''
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. **Deploy → New deployment → Web app**: نفِّذ كـ **Me**، وصول **Anyone** (أو من لديه الرابط).
5. انسخ **URL** النهائي إلى `contactSheetWebhookUrl` في `config.js`.

يمكنك لاحقاً تنزيل نفس الجدول كملف **Excel** من القائمة: ملف → تنزيل → Microsoft Excel.

### أمان نموذج التواصل (ملخص)

- **الواجهة**: التحقق من الحقول (اسم، بريد أو جوال، خدمة، طول النصوص)، وتعطيل الزر أثناء الإرسال مع مؤشر تحميل لتفادي النقر المتكرر.
- **حد مبدئي**: لا يُسجَّل أكثر من **5 طلبات ناجحة في الساعة** لكل متصفح (`localStorage`) — يمكن للمستخدم الجاد تجاوزه بمسح التخزين؛ للحماية القوية أضِف تحققاً في **Apps Script** أو **Supabase** (Edge Function / سياسات).
- **XSS**: المحتوى المُعرَض في الموقع يُمرَّر عبر `textContent` / تهريب HTML حيث يلزم؛ الحقول تُقصُّ وتُنظَّف قبل الإرسال.
- **SQL injection**: الإدراج عبر عميل Supabase يستخدم واجهة REST مُعلَمَة — لا يُبنى SQL من نص المستخدم في المتصفح.

### Microsoft Excel مباشرة (365)

استخدم **Power Automate** مع مشغّل «When an HTTP request is received» وخطوة «Add a row into a table» على ملف Excel في OneDrive/SharePoint، ثم أرسل نفس الحقول JSON إلى عنوان الـ HTTP الذي يعطيك إياه Power Automate.

## الفيديو في المعرض

حقل `portfolio.items[].video`:

- **YouTube** — يُضمَّن تلقائياً.
- **Vimeo** — يُضمَّن تلقائياً.
- **Google Drive** — رابط مشاركة الملف (`/file/d/...`) يُعرَض داخل مشغّل المعاينة (iframe). يجب أن يكون الملف مناسباً للمعاينة وأن تسمح مشاركته.
- **رابط مباشر** ينتهي بـ `.mp4` أو `.webm` أو `.ogg` — تشغيل عبر `<video>` (روابط Dropbox تُحوَّل تلقائياً إلى `raw=1` عند الحاجة).
- **روابط أخرى** (إنستغرام، X، …) — غالباً لا تسمح بالتضمين؛ يظهر زر فتح في نافذة جديدة.

## الصور (معرض الأعمال + شعارات العملاء)

- **`js/media-urls.js`** يحوّل تلقائياً روابط **Google Drive** و**Dropbox** إلى صيغة أنسب لعرض `<img>` (مع بقاء القيود الأمنية لدى Google: الملف يجب أن يكون مُشارَكاً للعرض).
- للأداء والموثوقية: استخدم **رفع صورة** في لوحة التحكم (يملأ الرابط من **Supabase Storage** بعد إعداد الدلو `site-media`).

لا تختبر التضمين والصور من مسار `file://`؛ شغّل الموقع عبر **http://localhost** أو استضافة حقيقية.

## عملاءنا + واتساب (JSON)

- **`clients`** — `eyebrow`, `titleBefore`, `titleHighlight`, `subtitle`, و`logos`: مصفوفة `{ name, imageUrl, href }`. الشريط المتحرك يُملأ من `imageUrl` (أو اسم النص إذا فارغ).
- **`whatsappFab`** — `enabled`, `label`, `phone` (أرقام فقط مثل `966578258199`), `displayPhone`, `message` (تُمرَّر في رابط واتساب).

## SEO (ظهور في Google و Bing)

**لا يمكن ضمان الترتيب الأول** في نتائج البحث: يعتمد على المنافسة، جودة المحتوى، الروابط الخارجية، وسلوك المستخدم. ما يمكن تنفيذه تقنياً في المشروع:

- **عنوان ووصف عربي + إنجليزي + كلمات مفتاحية** من لوحة التحكم (قسم «عام و SEO») و`meta` و`og:*` و`twitter:*`.
- **`robots`** مع فهرسة وفتح معاينات للصور والمقتطفات حيث يسمح المحرك.
- **`hreflang`** (عربي / إنجليزي / x-default) يشير إلى `canonicalUrl`.
- **JSON-LD** (`Organization` + `WebSite`) مع الشعار، الروابط الاجتماعية، والمنطقة (SA).
- **شريط العملاء** يتحرك بشكل مستمر؛ السرعة تُضبط تلقائياً بعد تحميل الصور (مع احترام `prefers-reduced-motion` بتباطؤ الحركة).

**خطواتك خارج الكود:** إرسال الموقع إلى [Google Search Console](https://search.google.com/search-console) و [Bing Webmaster Tools](https://www.bing.com/webmasters)، إنشاء **sitemap.xml** يشير إلى الصفحة الرئيسية، وروابط حقيقية من مواقع ذات صلة.

## النشر

انشر المجلد كاملاً بحيث يعمل `/adminqader/` و`/index.html`. حدّث `meta.canonicalUrl` في JSON ليطابق النطاق الفعلي (نفس القيمة تُحدَّث روابط `hreflang` و JSON-LD).
