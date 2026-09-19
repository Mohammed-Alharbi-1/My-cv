/* Mohammed Al-Harbi — progressively enhanced, framework-free portfolio. */
'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const desktopPointer = matchMedia('(min-width:1024px) and (hover:hover) and (pointer:fine)');
const state = { lang: 'en', lenis: null, media: null, pin: null, active: 0, refreshTimer: 0 };
const gallery = $('.certificate-viewport');
const track = $('.certificate-track');
const cards = $$('.certificate-card');
let focusedBeforeRefresh = null;
let refreshFocusHooksInstalled = false;
const isRTL = () => state.lang === 'ar';
const hasGSAP = () => !!(window.gsap && window.ScrollTrigger);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* LANGUAGE: textContent preserves semantic markup and cannot execute translations. */
function applyLanguage(lang) {
  state.lang = lang === 'ar' ? 'ar' : 'en';
  const ar = isRTL();
  document.documentElement.lang = state.lang;
  document.documentElement.dir = ar ? 'rtl' : 'ltr';
  const dictionary = window.portfolioTranslations[state.lang];
  $$('[data-i18n]').forEach(el => { if (dictionary[el.dataset.i18n] !== undefined) el.textContent = dictionary[el.dataset.i18n]; });
  document.title = ar ? 'محمد الحربي | علوم الحاسب وتطوير البرمجيات' : 'Mohammed Al-Harbi | Computer Science & Software Portfolio';
  $('.lang-toggle').textContent = ar ? 'English' : 'العربية';
  $('.lang-toggle').lang = ar ? 'en' : 'ar';
  $('.lang-toggle').setAttribute('aria-label', ar ? 'Switch to English' : 'التبديل إلى العربية');
  $('.desktop-nav').setAttribute('aria-label', ar ? 'التنقل الرئيسي' : 'Main navigation');
  $('.hero-object').setAttribute('aria-label', ar ? 'اهتماماتي التعليمية' : 'Learning focus');
  gallery.setAttribute('aria-label', ar ? 'معرض الشهادات؛ استخدم الأسهم للتنقل' : 'Certificate gallery; use arrow keys to navigate');
  $('.prev').setAttribute('aria-label', ar ? 'الشهادة السابقة' : 'Previous certificate');
  $('.next').setAttribute('aria-label', ar ? 'الشهادة التالية' : 'Next certificate');
  $$('[data-cert-link]').forEach(link => link.setAttribute('aria-label', `${dictionary.view}: ${dictionary['cert' + link.dataset.certLink]}`));
  cards.forEach((card, i) => $('.preview img', card).alt = `${ar ? 'شهادة' : 'Certificate:'} ${dictionary['cert' + i]}`);
  $('.badge-row img').alt = ar ? 'شارة أساسيات HTML الموثقة من أكاديمية سيسكو للشبكات' : 'Cisco Networking Academy Verified HTML Essentials badge';
  try { localStorage.setItem('portfolio-language', state.lang); } catch { /* Storage may be unavailable for local files. */ }
}
function initLanguageSystem() {
  let saved = 'en';
  try { saved = localStorage.getItem('portfolio-language') || 'en'; } catch {}
  applyLanguage(saved);
  $('.lang-toggle').addEventListener('click', () => {
    const pinned = state.pin && window.scrollY >= state.pin.start && window.scrollY <= state.pin.end;
    const index = state.active;
    teardownMotion();
    applyLanguage(isRTL() ? 'en' : 'ar');
    gallery.scrollLeft = 0;
    initMotion();
    refreshLayout();
    if (pinned) goToCertificate(index, true);
    else updateGallery();
  });
}

/* NAVIGATION: one scroll observer also drives page progress. */
function scrollToY(y, immediate = false) {
  y = Math.max(0, y);
  if (state.lenis) state.lenis.scrollTo(y, { immediate, duration: .65 });
  else window.scrollTo({ top: y, behavior: immediate || motionPreference.matches ? 'instant' : 'smooth' });
}
function initNavigation() {
  const sections = $$('main section[id]');
  let queued = false;
  function paint() {
    queued = false;
    const maximum = document.documentElement.scrollHeight - innerHeight;
    $('.page-progress').style.transform = `scaleX(${maximum > 0 ? scrollY / maximum : 0})`;
    $('.navbar').classList.toggle('scrolled', scrollY > 40);
    let active = sections[0].id;
    for (const section of sections) if (section.getBoundingClientRect().top <= innerHeight * .35) active = section.id;
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 8) active = 'contact';
    $$('nav a[href^="#"]').forEach(link => {
      if (link.hash === '#' + active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
  addEventListener('resize', paint, { passive: true });
  $$('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    const target = $(link.hash);
    if (!target) return;
    event.preventDefault();
    closeMobileMenu();
    scrollToY(scrollY + target.getBoundingClientRect().top - 105);
    try { history.pushState(null, '', link.hash); } catch {}
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }));
  paint();
}
function closeMobileMenu() {
  const dialog = $('#mobile-menu');
  if (dialog.open) dialog.close();
}
function initMobileMenu() {
  const dialog = $('#mobile-menu');
  const trigger = $('.menu-toggle');
  trigger.addEventListener('click', () => {
    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    state.lenis?.stop();
    document.body.style.overflow = 'hidden';
  });
  $('.menu-close').addEventListener('click', closeMobileMenu);
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeMobileMenu(); } });
  dialog.addEventListener('close', () => {
    trigger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    state.lenis?.start();
  });
  matchMedia('(min-width:1024px)').addEventListener('change', e => { if (e.matches) closeMobileMenu(); });
}

/* GALLERY: native scroll works even if all CDN scripts are unavailable. */
function updateGallery() {
  const bounds = gallery.getBoundingClientRect();
  const center = bounds.left + bounds.width / 2;
  let distance = Infinity, index = 0;
  cards.forEach((card, i) => {
    const r = card.getBoundingClientRect();
    const d = Math.abs(r.left + r.width / 2 - center);
    if (d < distance) { distance = d; index = i; }
  });
  state.active = index;
  cards.forEach((card, i) => card.classList.toggle('is-active', i === index));
  $('.gallery-count').textContent = `${String(index + 1).padStart(2, '0')} / 05`;
  $('.prev').disabled = index === 0;
  $('.next').disabled = index === cards.length - 1;
  $('.certificate-pin').classList.toggle('latest-focus', index === 4);
  const travel = Math.max(1, track.scrollWidth - gallery.clientWidth);
  const progress = state.pin ? state.pin.animation.progress() : Math.min(1, Math.abs(gallery.scrollLeft) / travel);
  $('.gallery-progress>span').style.transform = `scaleX(${.2 + .8 * progress})`;
}
function goToCertificate(index, immediate = false) {
  index = clamp(index, 0, cards.length - 1);
  if (state.pin) {
    const step = cards[0].offsetWidth + parseFloat(getComputedStyle(track).gap);
    const travel = track.scrollWidth - gallery.clientWidth;
    scrollToY(state.pin.start + (state.pin.end - state.pin.start) * Math.min(1, index * step / travel), immediate);
    if (immediate) { ScrollTrigger.update(); state.pin.animation.progress(index * step / travel); }
  } else {
    const r = cards[index].getBoundingClientRect(), v = gallery.getBoundingClientRect();
    gallery.scrollBy({ left: r.left + r.width / 2 - v.left - v.width / 2, behavior: immediate || motionPreference.matches ? 'instant' : 'smooth' });
  }
}
function initCertificateControls() {
  $('.prev').addEventListener('click', () => goToCertificate(state.active - 1));
  $('.next').addEventListener('click', () => goToCertificate(state.active + 1));
  gallery.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') goToCertificate(0);
    else if (event.key === 'End') goToCertificate(cards.length - 1);
    else goToCertificate(state.active + ((event.key === 'ArrowRight') !== isRTL() ? 1 : -1));
  });
  gallery.addEventListener('focusin', event => {
    const card = event.target.closest('.certificate-card');
    if (card && state.pin) { gallery.scrollLeft = 0; goToCertificate(Number(card.dataset.index), true); }
  });
  let scheduled = false;
  gallery.addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; updateGallery(); }); } }, { passive: true });
  updateGallery();
}

/* MOTION LIFECYCLE: matchMedia owns and reverts every responsive GSAP effect. */
function initLenis() {
  if (!window.Lenis || !hasGSAP()) return () => {};
  const lenis = new Lenis({ duration: .8, smoothWheel: true, syncTouch: false, autoRaf: false, prevent: node => node.classList?.contains('certificate-viewport') && !state.pin });
  state.lenis = lenis;
  const tick = time => lenis.raf(time * 1000);
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => { gsap.ticker.remove(tick); lenis.destroy(); state.lenis = null; };
}
function initHeroIntro() {
  if (!hasGSAP() || motionPreference.matches || scrollY > 100) return;
  gsap.timeline({ defaults: { duration: .85, ease: 'power3.out' } })
    .from('.ambient', { opacity: 0, duration: 1 }, 0)
    .from('.hero .eyebrow', { y: 12, opacity: 0 }, .05)
    .from('.name-line>span', { yPercent: 110, stagger: .08 }, .1)
    .from('.hero-subtitle,.hero-description,.actions', { y: 20, opacity: 0, stagger: .08 }, .28)
    .from('.hero-object', { y: 22, opacity: 0, duration: 1 }, .3)
    .from('.scroll-cue', { opacity: 0 }, .55);
}
function initCertificateScroll() {
  const pin = $('.certificate-pin');
  // A centered first and last card makes each credential equally reachable.
  const setPadding = () => {
    track.style.paddingInline = `${Math.max(24, (gallery.clientWidth - cards[0].offsetWidth) / 2)}px`;
    gallery.scrollLeft = 0;
  };
  pin.classList.add('is-pinned');
  // Wheel input must reach the main page during the pinned experience.
  gallery.removeAttribute('data-lenis-prevent');
  setPadding();
  const distance = () => Math.max(0, track.scrollWidth - gallery.clientWidth);
  const tween = gsap.to(track, {
    x: () => (isRTL() ? 1 : -1) * distance(), ease: 'none',
    onUpdate: updateGallery,
    scrollTrigger: { trigger: pin, start: 'top 94px', end: () => '+=' + distance(), pin: true, scrub: .65, invalidateOnRefresh: true, anticipatePin: 1, onRefreshInit: setPadding, onRefresh: updateGallery }
  });
  state.pin = tween.scrollTrigger;
  return () => {
    state.pin = null;
    pin.classList.remove('is-pinned');
    track.style.paddingInline = '';
    gallery.setAttribute('data-lenis-prevent', '');
    gallery.scrollLeft = 0;
  };
}
function initScrollReveal(desktop) {
  $$('.mask>span').forEach(el => gsap.from(el, { yPercent: 108, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: el.parentElement, start: 'top 93%', once: true } }));
  ScrollTrigger.batch('.reveal', { start: 'top 94%', once: true, onEnter: items => gsap.from(items, { y: 24, opacity: 0, duration: .7, stagger: .09, overwrite: 'auto' }) });
  gsap.from('.identity-panel', { x: desktop ? (isRTL() ? 45 : -45) : 0, y: desktop ? 0 : 25, opacity: 0, duration: .9, scrollTrigger: { trigger: '.about-grid', start: 'top 85%', once: true } });
  gsap.from('.about-copy', { x: desktop ? (isRTL() ? -45 : 45) : 0, opacity: 0, duration: .9, scrollTrigger: { trigger: '.about-copy', start: 'top 90%', once: true } });
  gsap.from('.stats>div', { y: 20, opacity: 0, stagger: .12, scrollTrigger: { trigger: '.stats', start: 'top 90%', once: true } });
  $$('.skill-card').forEach((el, i) => gsap.from(el, { y: 30 + i * 10, opacity: 0, scale: .98, duration: .75, scrollTrigger: { trigger: el, start: 'top 95%', once: true } }));
  gsap.from('.timeline-line', { scaleY: 0, ease: 'none', scrollTrigger: { trigger: '.timeline', start: 'top 78%', end: 'bottom 75%', scrub: true } });
  $$('.timeline-item').forEach(el => {
    gsap.from(el, { x: isRTL() ? -20 : 20, opacity: .45, duration: .65, scrollTrigger: { trigger: el, start: 'top 82%', toggleClass: 'is-active' } });
  });
  gsap.from('.preview img', { scale: 1.06, duration: 1.1, stagger: .06, scrollTrigger: { trigger: '.certificate-pin', start: 'top 90%', once: true } });
}
function initHeroScroll() {
  gsap.to('.hero-content', { y: -55, opacity: .4, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-object', { y: -35, scale: .94, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.scroll-cue', { opacity: 0, scrollTrigger: { trigger: '.hero', start: 'top top', end: '25% top', scrub: true } });
}
function initMotion() {
  if (!hasGSAP()) return;
  gsap.registerPlugin(ScrollTrigger);
  if (!refreshFocusHooksInstalled) {
    refreshFocusHooksInstalled = true;
    ScrollTrigger.addEventListener('refreshInit', () => { focusedBeforeRefresh = document.activeElement; });
    ScrollTrigger.addEventListener('refresh', () => {
      if (focusedBeforeRefresh && focusedBeforeRefresh !== document.body && focusedBeforeRefresh.isConnected && document.activeElement === document.body) focusedBeforeRefresh.focus({ preventScroll: true });
      focusedBeforeRefresh = null;
    });
  }
  state.media = gsap.matchMedia();
  state.media.add({ desktop: '(min-width:1024px) and (min-height:760px) and (pointer:fine)', motion: '(prefers-reduced-motion: no-preference)' }, context => {
    if (!context.conditions.motion) return;
    const cleanup = [];
    // Pin first, so all downstream triggers include its scroll distance.
    if (context.conditions.desktop) {
      cleanup.push(initCertificateScroll());
      cleanup.push(initLenis());
      initHeroScroll();
    }
    initScrollReveal(context.conditions.desktop);
    return () => cleanup.reverse().forEach(fn => fn());
  });
  refreshLayout();
}
function teardownMotion() { state.media?.revert(); state.media = null; }
function refreshLayout() {
  if (!state.pin) track.style.paddingInline = `${Math.max(24, (gallery.clientWidth - cards[0].offsetWidth) / 2)}px`;
  if (hasGSAP()) ScrollTrigger.refresh();
  state.lenis?.resize();
  updateGallery();
}
function scheduleRefresh() {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = setTimeout(refreshLayout, 180);
}

/* POINTER INTERACTIONS: one on-demand RAF, no idle animation loop. */
function initPointerEffects() {
  let raf = 0, targetX = 0, targetY = 0, x = 0, y = 0, selected = null, magnetic = null, tilt = null;
  const light = $('.cursor-light');
  const enabled = () => desktopPointer.matches && !motionPreference.matches;
  function reset() {
    cancelAnimationFrame(raf); raf = 0;
    light.style.opacity = '0';
    if (magnetic) magnetic.style.transform = '';
    if (tilt) tilt.style.rotate = '';
    magnetic = tilt = selected = null;
  }
  function paint() {
    x += (targetX - x) * .15; y += (targetY - y) * .15;
    light.style.transform = `translate3d(${x}px,${y}px,0)`;
    if (selected) { const r = selected.getBoundingClientRect(); selected.style.setProperty('--mouse-x', `${targetX-r.left}px`); selected.style.setProperty('--mouse-y', `${targetY-r.top}px`); }
    if (magnetic) { const r = magnetic.getBoundingClientRect(); magnetic.style.transform = `translate(${clamp((targetX-r.left-r.width/2)*.08,-5,5)}px,${clamp((targetY-r.top-r.height/2)*.08,-5,5)}px)`; }
    if (tilt) { const r = tilt.getBoundingClientRect(); tilt.style.rotate = `y ${clamp((targetX-r.left-r.width/2)*.018,-3,3)}deg`; }
    if (Math.abs(targetX-x)+Math.abs(targetY-y)>.6) raf = requestAnimationFrame(paint); else raf = 0;
  }
  document.addEventListener('pointermove', e => {
    if (!enabled()) return;
    targetX=e.clientX; targetY=e.clientY; light.style.opacity='1';
    selected=e.target.closest('.spotlight');
    const next=e.target.closest('.magnetic');
    if (magnetic && magnetic!==next) magnetic.style.transform='';
    magnetic=next;
    const nextTilt=e.target.closest('.hero-object');
    if (tilt && tilt!==nextTilt) tilt.style.rotate='';
    tilt=nextTilt;
    if (!raf) raf=requestAnimationFrame(paint);
  }, { passive:true });
  document.addEventListener('pointerleave', reset);
  desktopPointer.addEventListener('change', reset);
  motionPreference.addEventListener('change', reset);
}

/* BOOT */
initLanguageSystem();
initMobileMenu();
initNavigation();
initCertificateControls();
let animationsStarted = false;
function startAnimationsWhenReady() {
  if (animationsStarted || !hasGSAP() || !window.Lenis) return;
  animationsStarted = true;
  initMotion();
  initHeroIntro();
}
addEventListener('portfolio-library', startAnimationsWhenReady);
startAnimationsWhenReady();
refreshLayout();
initPointerEffects();
$('.print-button').addEventListener('click', () => window.print());
document.fonts?.ready.then(scheduleRefresh);
$$('img').forEach(img => { if (!img.complete) img.addEventListener('load', scheduleRefresh, { once:true }); });
addEventListener('resize', scheduleRefresh, { passive:true });
addEventListener('pageshow', scheduleRefresh);
motionPreference.addEventListener('change', scheduleRefresh);
addEventListener('beforeprint', teardownMotion);
addEventListener('afterprint', initMotion);
