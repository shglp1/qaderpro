/**
 * Normalize share links for <img> / <video> and detect Google Drive preview embeds.
 * Loaded before app.js and admin-forms (admin loads it for hints only if needed).
 */
(function () {
  'use strict';

  function googleDriveFileId(url) {
    if (!url || typeof url !== 'string') return null;
    const s = url.trim();
    let m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m && /drive\.google\.com/i.test(s)) return m[1];
    return null;
  }

  function isGoogleDriveUrl(url) {
    return /drive\.google\.com/i.test(url || '');
  }

  function isDropboxUrl(url) {
    return /(?:www\.)?dropbox\.com/i.test(url || '');
  }

  /**
   * For <img src="...">: Drive view links → uc?export=view; Dropbox → raw=1
   */
  function normalizeImageUrl(url) {
    const u = (url || '').trim();
    if (!u) return u;
    if (isGoogleDriveUrl(u)) {
      const id = googleDriveFileId(u);
      if (id) return 'https://drive.google.com/uc?export=view&id=' + id;
    }
    if (isDropboxUrl(u)) {
      if (/[?&]dl=0/.test(u)) return u.replace(/([?&])dl=0/, '$1raw=1');
      if (/[?&]raw=1/.test(u)) return u;
      return u + (u.includes('?') ? '&' : '?') + 'raw=1';
    }
    return u;
  }

  /**
   * Google Drive file preview in iframe (video or any file the preview player supports).
   */
  function googleDrivePreviewEmbedUrl(url) {
    const u = (url || '').trim();
    if (!isGoogleDriveUrl(u)) return null;
    const id = googleDriveFileId(u);
    if (!id) return null;
    return 'https://drive.google.com/file/d/' + id + '/preview';
  }

  /**
   * Dropbox share links: use raw=1 for direct file streaming in <video>
   */
  function normalizeDirectMediaUrl(url) {
    const u = (url || '').trim();
    if (!u) return u;
    if (isDropboxUrl(u)) {
      if (/[?&]dl=0/.test(u)) return u.replace(/([?&])dl=0/, '$1raw=1');
      if (/[?&]raw=1/.test(u)) return u;
      return u + (u.includes('?') ? '&' : '?') + 'raw=1';
    }
    return u;
  }

  window.QaderMediaUrls = {
    googleDriveFileId,
    normalizeImageUrl,
    googleDrivePreviewEmbedUrl,
    normalizeDirectMediaUrl,
    isGoogleDriveUrl,
    isDropboxUrl
  };
})();
