/*
 * 제15회 전국어린이독후감쓰기 대회 — 페이지 스크립트
 * 인터랙션 요소 일부는 Lucian UX/UI Prompt(MIT License (c) 2026 Seokwoooo, https://lucianlabs.dev/uxui-prompt/)의
 * #039 #242 #252 #251 #032 #068 #062 #070 스크립트를 이 페이지에 맞게 옮긴 것입니다. 각 블록 머리에 번호를 적었습니다.
 */
(function () {
  'use strict';

  var API = (window.BOOK_API_URL || '').trim();
  var DEFAULT_OPEN = '2026-12-10T00:00:00+09:00';
  var DEFAULT_DEADLINE = '2027-01-20T16:00:00+09:00';
  var MAX_MB = 10;
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 제목, 지은이, 출판사, 예스24 상품 번호 (표지 이미지 출처: 예스24)
  var BOOKS = [
    ['34번째 민족대표 프랭크 스코필드', '박서영 글 · 윤지경 그림', '고래책빵', '122496719'],
    ['고민이 사르르 죽', '김하영 글 · 임수현 그림', '웅진주니어', '195413656'],
    ['긴 한나절', '고현숙 외 글', '도담소리', '179604868'],
    ['껌딱지 친구', '황혜진 글 · 김지영 그림', '고래책빵', '193991048'],
    ['꼬복바위의 비밀', '안선희 글 · 백명식 그림', '고래책빵', '143343860'],
    ['꽁이 구출 작전', '박정미 글 · 김은아 그림', '고래책빵', '125992278'],
    ['꿈의 공책', '박선영 글 · 한혜정 그림', '도담소리', '196677660'],
    ['달섬 소년', '이우 글 · 김지영 그림', '고래책빵', '148875660'],
    ['독도강치대왕을 아시나요?', '함영연 글 · 이정열 그림', '별빛서재', '182785725'],
    ['돌로 만든 배', '김정배 글 · 김태현 그림', '봄봄출판사', '176445935'],
    ['동우와 트라이앵글', '이희갑 글 · 김경수 그림', '삼성당', '1933413'],
    ['마녀 우체국', '김정숙 글 · 김진희 그림', '한그루', '195776047'],
    ['명찰 아저씨, 최고야', '신소담 글 · 유재엽 그림', '가문비어린이', '194923631'],
    ['목판에 새긴 꿈, 대동여지도', '도건영 글 · 어수현 그림', '개암나무', '125994393'],
    ['복을 그리는 아이', '한현정 글 · 이로우 그림', '시공주니어', '125922616'],
    ['비행소년 슈퍼맨', '김춘남 글 · 배순아 그림', '초록달팽이', '155049811'],
    ['사랑별에서 온 아이', '이정순 글 · 김진희 그림', '글라이더', '117931204'],
    ['신이 된 사람들', '김란 글 · 김진희 그림', '한그루', '103654440'],
    ['열 살 내 인생', '이옥선 글 · 김도아 그림', '바나나BOOK', '91006900'],
    ['인생 팥죽', '조현미 글 · 안병현 그림', '잇츠북어린이', '197055438'],
    ['제비 똥받이 사건', '고현숙 글 · 한혜정 그림', '도담소리', '183545467'],
    ['천년의 휴가', '송재찬 글 · 신소영 그림', '이오앤북스', '167434231'],
    ['콩콩이를 잠재운 도깨비 친구들', '배정순 글 · 이혜원 그림', '고래책빵', '197981780'],
    ['할아버지 집에 용이 살아요', '김정희 글 · 고은 그림', '한그루', '155060092'],
    ['허물 벗는 나비', '김정련 글 · 김민경 그림', '한그루', '198961845']
  ];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function store(key, val) {
    try {
      if (val === undefined) return sessionStorage.getItem(key);
      if (val === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, val);
    } catch (e) { return null; }
  }
  function shake(el) {
    if (el.animate) el.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 300 });
  }

  /* ================= 서버 통신 ================= */
  function apiGet(params) {
    var q = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(API + '?' + q).then(function (r) { return r.json(); });
  }
  function apiPost(body) {
    // text/plain으로 보내야 Apps Script가 CORS 사전 요청 없이 받습니다.
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (res) { if (!res.ok) throw new Error(res.error || '요청을 처리하지 못했습니다.'); return res; });
  }

  /* ================= 관리자가 쓴 내용 정리 ================= */
  var BAD_TAGS = 'script,style,iframe,object,embed,link,meta,form,input,button,textarea,select,base';
  function sanitize(html) {
    var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
    var root = doc.body.firstChild;
    $$(BAD_TAGS, root).forEach(function (n) { n.remove(); });
    $$('*', root).forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        var name = a.name.toLowerCase(), v = a.value.replace(/\s/g, '').toLowerCase();
        if (name.indexOf('on') === 0 || name === 'contenteditable') n.removeAttribute(a.name);
        else if ((name === 'href' || name === 'src') && /^(javascript|data|vbscript):/.test(v)) n.removeAttribute(a.name);
      });
    });
    return root.innerHTML;
  }

  /* ================= #070 겹쳐 쌓이는 토스트 ================= */
  var toast = (function () {
    var root = $('#toasts');
    var zone = $('.u070-zone', root), live = $('.u070-live', root);
    var ICON = { ok: '<svg viewBox="0 0 18 18"><path d="M4 9.4l3.2 3.2L14 5.6"/></svg>', err: '<svg viewBox="0 0 18 18"><path d="M9 5v5M9 13h.01"/></svg>', info: '<svg viewBox="0 0 18 18"><path d="M3.5 4.5h11v7h-6l-3 2.5v-2.5h-2z"/></svg>', wait: '<i></i>' };
    var COLOR = { ok: 'var(--ux-mint)', err: 'var(--ux-danger)', info: 'var(--ux-accent)', wait: 'var(--ux-warn)' };
    var list = [], open = false, DUR = 4500;
    function layout() {
      var acc = 0;
      list.forEach(function (t, i) {
        var el = t.el;
        el.classList.toggle('back', !open && i > 0);
        if (open) { el.style.setProperty('--y', -acc + 'px'); el.style.setProperty('--s', 1); el.style.setProperty('--o', 1); acc += el.offsetHeight + 8; }
        else { el.style.setProperty('--y', -(i * 14) + 'px'); el.style.setProperty('--s', (1 - i * 0.06).toFixed(2)); el.style.setProperty('--o', i > 2 ? 0 : 1); }
        el.style.zIndex = 50 - i;
        el.inert = !open && i > 0;
      });
    }
    function remove(t, dir) {
      var i = list.indexOf(t);
      if (i < 0) return;
      list.splice(i, 1);
      t.el.classList.add('leave');
      if (dir) { t.el.style.setProperty('--dir', dir); t.el.classList.add('side'); }
      setTimeout(function () { t.el.remove(); }, 450);
      if (!list.length) open = false;
      layout();
    }
    function push(kind, title, sub) {
      kind = ICON[kind] ? kind : 'info';
      var el = document.createElement('div');
      el.className = 'u070-t enter';
      el.style.setProperty('--c', COLOR[kind]);
      el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
      el.innerHTML = '<span class="u070-ic" aria-hidden="true">' + ICON[kind] + '</span><span class="u070-tx"><b></b><small></small></span><button class="u070-x" type="button" aria-label="알림 닫기"><svg viewBox="0 0 14 14"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg></button><span class="u070-bar" aria-hidden="true"></span>';
      $('b', el).textContent = title;
      $('small', el).textContent = sub || '';
      if (!sub) $('small', el).remove();
      var t = { el: el, left: kind === 'wait' ? Infinity : DUR };
      zone.appendChild(el);
      list.unshift(t);
      while (list.length > 4) remove(list[list.length - 1]);
      void el.offsetWidth;
      el.classList.remove('enter');
      layout();
      live.textContent = title;
      $('.u070-x', el).addEventListener('click', function () { remove(t); });
      var sx = 0, dx = 0, down = false;
      el.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; down = true; sx = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); el.classList.add('drag'); });
      el.addEventListener('pointermove', function (e) { if (!down) return; dx = e.clientX - sx; el.style.setProperty('--dx', dx + 'px'); el.style.setProperty('--o', Math.max(0.2, 1 - Math.abs(dx) / 260)); });
      var end = function () { if (!down) return; down = false; el.classList.remove('drag'); if (Math.abs(dx) > 90) remove(t, dx > 0 ? 1 : -1); else { el.style.setProperty('--dx', '0px'); layout(); } };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
      return {
        done: function (k2, title2, sub2) { // '기다리는 중' 알림을 결과로 바꿉니다
          if (list.indexOf(t) < 0) return;
          el.style.setProperty('--c', COLOR[k2]);
          $('.u070-ic', el).innerHTML = ICON[k2];
          $('b', el).textContent = title2;
          var sm = $('small', el);
          if (sub2) { if (!sm) { sm = document.createElement('small'); $('.u070-tx', el).appendChild(sm); } sm.textContent = sub2; } else if (sm) sm.remove();
          live.textContent = title2;
          t.left = DUR;
        },
        close: function () { remove(t); }
      };
    }
    var last = performance.now();
    (function loop(now) {
      var dt = now - last; last = now;
      if (!open) list.slice().forEach(function (t, i) {
        if (i > 0 || t.left === Infinity) return;
        t.left -= dt;
        t.el.style.setProperty('--left', Math.max(0, t.left / DUR).toFixed(3));
        if (t.left <= 0) remove(t);
      });
      requestAnimationFrame(loop);
    })(last);
    function setOpen(v) { if (open === v) return; open = v; layout(); }
    // 알림 위에 커서를 올리면 펼쳐지고, 밖으로 나가면 다시 겹칩니다
    zone.addEventListener('pointerover', function (e) { if (e.pointerType === 'mouse' && list.length > 1) setOpen(true); });
    zone.addEventListener('pointerout', function (e) { if (e.pointerType === 'mouse' && !(e.relatedTarget && zone.contains(e.relatedTarget)) && !zone.contains(document.activeElement)) setOpen(false); });
    zone.addEventListener('focusin', function () { setOpen(true); });
    zone.addEventListener('focusout', function (e) { if (!zone.contains(e.relatedTarget)) setOpen(false); });
    zone.addEventListener('click', function (e) { if (!e.target.closest('button') && list.length > 1) setOpen(!open); });
    return push;
  })();

  /* ================= 메뉴: PC는 #039 탭, 휴대폰은 #242 칩 바 ================= */
  var nav = (function () {
    var head = $('#siteHead');
    var mqTab = window.matchMedia('(min-width: 900px)');
    var tabRoot = $('.u039');
    var pill = $('.u039-pill', tabRoot);
    var chipBar = $('.u242-cb'), chipRow = $('.u242-cr'), chipUl = $('.u242-ul');
    var current = null;

    function visibleTabs() { return $$('.u039-tab', tabRoot).filter(function (t) { return !t.hidden; }); }
    function visibleChips() { return $$('.u242-ch', chipRow).filter(function (c) { return !c.hidden; }); }
    function ids() { return visibleTabs().map(function (t) { return t.getAttribute('data-target'); }); }
    function panel(id) { return document.getElementById(id); }
    function headH() { return head.offsetHeight; }

    // #039: 알약을 고른 탭 자리로 늘이며 옮깁니다
    function movePill(animate) {
      var t = visibleTabs().filter(function (x) { return x.getAttribute('aria-selected') === 'true'; })[0];
      if (!t) return;
      if (!animate) pill.style.transition = 'none';
      pill.style.setProperty('--x', t.offsetLeft + 'px');
      pill.style.setProperty('--w', t.offsetWidth + 'px');
      if (!animate) { void pill.offsetWidth; pill.style.transition = ''; }
    }
    function markTabs(id) {
      $$('.u039-tab', tabRoot).forEach(function (t) {
        var on = t.getAttribute('data-target') === id;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
    }

    // #242: 밑줄 알약을 지금 칩으로 옮기고, 칩 줄을 그 칩이 가운데쯤 오도록 밉니다
    var chipCur = null;
    function markChip(id) {
      if (id === chipCur) return;
      chipCur = id;
      var b = null;
      visibleChips().forEach(function (c) {
        var on = c.getAttribute('data-target') === id;
        c.setAttribute('aria-current', on ? 'true' : 'false');
        if (on) b = c;
      });
      if (!b) return;
      chipUl.style.width = b.offsetWidth + 'px';
      chipUl.style.transform = 'translateX(' + b.offsetLeft + 'px)';
      var x = b.offsetLeft - (chipRow.clientWidth - b.offsetWidth) / 2, x0 = chipRow.scrollLeft, t0 = performance.now();
      x = Math.max(0, Math.min(chipRow.scrollWidth - chipRow.clientWidth, x));
      (function f(now) { var k = RM ? 1 : Math.min(1, (now - t0) / 320), e = 1 - Math.pow(1 - k, 3); chipRow.scrollLeft = x0 + (x - x0) * e; if (k < 1) requestAnimationFrame(f); })(t0);
    }

    // PC: 패널을 탭처럼 바꿔 보여 줍니다. 새 패널은 옮겨 간 방향에서 들어옵니다(#039 목록 전환 값)
    function showTab(id, opts) {
      opts = opts || {};
      var list = ids();
      if (list.indexOf(id) < 0) id = 'guide';
      var prev = current;
      current = id;
      markTabs(id);
      movePill(!!prev);
      list.concat(['entries']).forEach(function (pid) {
        var p = panel(pid);
        if (p) p.classList.toggle('is-active', pid === id);
      });
      var p = panel(id);
      if (prev && prev !== id && !RM) {
        var dir = list.indexOf(id) > list.indexOf(prev) ? 1 : -1;
        p.classList.remove('u039-enter');
        p.style.transform = 'translateX(' + (dir * 40) + 'px)';
        p.style.opacity = '0';
        void p.offsetWidth;
        p.classList.add('u039-enter');
        p.style.transform = '';
        p.style.opacity = '';
      }
      if (opts.focus) { var t = visibleTabs().filter(function (x) { return x.getAttribute('data-target') === id; })[0]; if (t) t.focus(); }
      if (opts.scroll !== false) window.scrollTo({ top: 0, behavior: 'instant' });
      document.dispatchEvent(new CustomEvent('panelshown', { detail: id }));
    }

    // 휴대폰: 그 구역 머리까지 부드럽게 내려갑니다(#242)
    var lock = 0;
    function scrollToSection(id) {
      var p = panel(id);
      if (!p) return;
      markChip(id);
      lock = Date.now() + (RM ? 0 : 700);
      var to = p.getBoundingClientRect().top + window.scrollY - headH() + 2;
      window.scrollTo({ top: to, behavior: RM ? 'instant' : 'smooth' });
    }
    function spy() {
      chipBar.classList.toggle('is-stuck', window.scrollY > 4);
      if (mqTab.matches || Date.now() < lock) return;
      var y = window.scrollY + headH() + (window.innerHeight - headH()) * 0.3, found = 'guide';
      ids().forEach(function (id) { var p = panel(id); if (p && p.getBoundingClientRect().top + window.scrollY <= y) found = id; });
      if (window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 2) {
        var l = ids(); found = l[l.length - 1];
      }
      markChip(found);
    }

    function go(id, push) {
      if (ids().indexOf(id) < 0) return false;
      if (push !== false && location.hash !== '#' + id) history.pushState(null, '', '#' + id);
      if (mqTab.matches) showTab(id); else scrollToSection(id);
      return true;
    }

    function applyMode() {
      var tabbed = mqTab.matches;
      document.body.classList.toggle('tabbed', tabbed);
      $$('.panel').forEach(function (p) {
        if (tabbed) { p.setAttribute('role', 'tabpanel'); p.setAttribute('tabindex', '-1'); }
        else { p.removeAttribute('role'); p.removeAttribute('tabindex'); p.classList.remove('u039-enter'); p.style.transform = ''; p.style.opacity = ''; }
      });
      if (tabbed) { current = null; showTab(location.hash.slice(1) || 'guide', { scroll: false }); }
      else { chipCur = null; spy(); }
    }

    // 탭 클릭·방향키 (#039)
    visibleTabs().concat($$('.u039-tab[hidden]', tabRoot)).forEach(function (t) {
      var id = t.getAttribute('data-target');
      t.setAttribute('aria-controls', id);
      t.id = 'tab-' + id;
      panel(id).setAttribute('aria-labelledby', 'tab-' + id);
      t.addEventListener('click', function () { go(id); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var l = ids(), n = l[(l.indexOf(id) + d + l.length) % l.length];
        go(n);
        var nt = document.getElementById('tab-' + n);
        if (nt) nt.focus();
      });
    });
    $$('.u242-ch', chipRow).forEach(function (c) { c.addEventListener('click', function () { go(c.getAttribute('data-target')); }); });

    // 페이지 안의 #링크도 탭/스크롤로 처리합니다
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      if (go(id)) e.preventDefault();
    });
    window.addEventListener('popstate', function () {
      var id = location.hash.slice(1) || 'guide';
      if (mqTab.matches) showTab(id); else scrollToSection(id);
    });
    window.addEventListener('scroll', spy, { passive: true });
    window.addEventListener('resize', function () { movePill(false); chipCur = null; spy(); });
    if (mqTab.addEventListener) mqTab.addEventListener('change', applyMode); else mqTab.addListener(applyMode);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { movePill(false); chipCur = null; spy(); });

    applyMode();
    if (!mqTab.matches && location.hash) setTimeout(function () { scrollToSection(location.hash.slice(1)); }, 60);

    return {
      go: go,
      setAdmin: function (on) {
        $$('[data-admin]').forEach(function (el) { el.hidden = !on; });
        if (!on && current === 'entries') go('guide');
        movePill(false); chipCur = null; spy();
      },
      isTabbed: function () { return mqTab.matches; }
    };
  })();

  /* ================= #251 스크롤하면 차례로 떠오르는 카드 ================= */
  (function () {
    var R = $$('.u251 [data-rv]');
    if (RM || !('IntersectionObserver' in window)) { R.forEach(function (el) { el.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) e.target.classList.add('is-in');
        else if (e.boundingClientRect.top > e.rootBounds.bottom - 1) e.target.classList.remove('is-in');
      });
    }, { threshold: 0.18 });
    R.forEach(function (el) { io.observe(el); });
  })();

  /* ================= 홍보 영상: PC 가로 / 휴대폰 세로 ================= */
  (function () {
    var mq = window.matchMedia('(max-width: 767px), (orientation: portrait) and (max-width: 1024px)');
    var box = $('#promo'), v = $('#promoVideo'), btn = $('#soundBtn'), current = '';
    function pick() {
      var portrait = mq.matches;
      var src = portrait ? 'video/promo-portrait.mp4' : 'video/promo-landscape.mp4';
      if (src === current) return;
      current = src;
      box.className = 'promo ' + (portrait ? 'portrait' : 'landscape');
      v.src = src;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
    pick();
    if (mq.addEventListener) mq.addEventListener('change', pick); else mq.addListener(pick);
    btn.addEventListener('click', function () {
      v.muted = !v.muted;
      if (!v.muted) { v.currentTime = 0; v.play(); }
      btn.textContent = v.muted ? '🔇 소리 켜기' : '🔊 소리 끄기';
    });
    // 다른 탭으로 가면 영상을 멈추고, 돌아오면 다시 재생합니다
    document.addEventListener('panelshown', function (e) {
      if (e.detail === 'guide') { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
    });
  })();

  /* ================= 포스터 크게 보기 ================= */
  (function () {
    var dlg = $('#posterDialog');
    $$('[data-poster]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
        dlg.scrollTop = 0;
        $('#posterClose').focus();
      });
    });
    $('#posterClose').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  })();

  /* ================= 도서 목록 (표지 출처: 예스24) ================= */
  (function () {
    $('#bookGrid').innerHTML = BOOKS.map(function (b, i) {
      var n = ('0' + (i + 1)).slice(-2);
      return '<a class="tile book" href="https://www.yes24.com/Product/Goods/' + b[3] + '" target="_blank" rel="noopener" title="예스24에서 ' + esc(b[0]) + ' 보기">' +
        '<div class="cover"><img src="covers/' + n + '.jpg" alt="' + esc(b[0]) + ' 표지 (출처: 예스24)" loading="lazy"></div>' +
        '<div class="t">' + esc(b[0]) + '</div><div class="a">' + esc(b[1]) + '<br>' + esc(b[2]) + '</div></a>';
    }).join('');
    var sel = $('#book');
    BOOKS.forEach(function (b) {
      var o = document.createElement('option');
      o.value = b[0];
      o.textContent = b[0] + ' (' + b[1].split(' 글')[0] + ' 저)';
      sel.appendChild(o);
    });
  })();

  /* ================= 접수 기간 ================= */
  var period = { openAt: new Date(DEFAULT_OPEN), deadline: new Date(DEFAULT_DEADLINE) };
  function dday(target) {
    var day = 86400000, kst = function (d) { return Math.floor((d.getTime() + 9 * 3600000) / day); };
    return kst(target) - kst(new Date());
  }
  function fmtDate(d) { var k = new Date(d.getTime() + 9 * 3600000); return (k.getUTCMonth() + 1) + '월 ' + k.getUTCDate() + '일'; }
  function phase() { var now = new Date(); return now < period.openAt ? 'soon' : now > period.deadline ? 'closed' : 'open'; }

  /* ================= #252 반짝 지나가며 펼쳐지는 공지 알약 ================= */
  var notice = (function () {
    var root = $('#notice');
    var pl = $('.u252-pl', root), rs = $('.u252-rs', root), pn = $('.u252-pn', root), tag = $('#noticeTag');
    var LOG = [['12.10', '접수 시작', '2027. 1. 20.(수) 16시까지 온라인 접수'], ['2.4', '수상자 발표', '카페 공지 · 수상자 개별 문자'], ['2.27', '시상식', '시간과 장소는 추후 안내']];
    var H = 20, NEWS = [], k = 0, open = false, vis = true, t = 0;
    LOG.forEach(function (l, i) {
      var d = document.createElement('div'); d.className = 'u252-it'; d.style.transitionDelay = (0.08 + i * 0.07) + 's';
      d.innerHTML = '<time>' + l[0] + '</time><div><b>' + l[1] + '</b><span>' + l[2] + '</span></div>';
      pn.appendChild(d);
    });
    function label() { pl.setAttribute('aria-label', (NEWS[k % NEWS.length] || '') + ' · 주요 일정 펼치기'); }
    var sig = '';
    function set(tagText, news) {
      var s = tagText + '|' + news.join('|');
      if (s === sig) return;
      sig = s;
      tag.textContent = tagText;
      NEWS = news; k = 0;
      rs.style.transition = 'none'; rs.style.transform = 'translateY(0)';
      rs.innerHTML = '';
      NEWS.concat(NEWS[0]).forEach(function (n) { var s = document.createElement('span'); s.textContent = n; rs.appendChild(s); });
      label();
    }
    // 4초마다 빛줄기를 훑고 문구를 다음 소식으로 굴립니다. 펼쳐 둔 동안과 화면 밖에서는 쉽니다
    function tick() {
      clearTimeout(t); t = setTimeout(tick, 4000);
      if (open || !vis || RM || NEWS.length < 2) return;
      root.classList.remove('is-shine'); void root.offsetWidth; root.classList.add('is-shine');
      k += 1; rs.style.transition = ''; rs.style.transform = 'translateY(' + (-H * k) + 'px)'; label();
      if (k === NEWS.length) setTimeout(function () { rs.style.transition = 'none'; k = 0; rs.style.transform = 'translateY(0)'; label(); }, 560);
    }
    pl.addEventListener('click', function () { open = !open; root.classList.toggle('is-open', open); pl.setAttribute('aria-expanded', open); });
    document.addEventListener('click', function (e) { if (open && !root.contains(e.target)) { open = false; root.classList.remove('is-open'); pl.setAttribute('aria-expanded', 'false'); } });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }).observe(root);
    t = setTimeout(tick, 1600);
    return { set: set };
  })();

  function renderStatus() {
    var p = phase(), btn = $('#submitBtn'), msg = $('#formMsg');
    if (p === 'soon') {
      var d = dday(period.openAt);
      notice.set(d > 0 ? 'D-' + d : '접수 예정', [fmtDate(period.openAt) + '부터 접수를 시작해요', '상장 받는 친구 37명!', '추천 도서 25권 중 1권 골라 읽기']);
    } else if (p === 'open') {
      var d2 = dday(period.deadline);
      notice.set('접수 중', [(d2 > 0 ? '마감까지 D-' + d2 + ' · 지금 접수하세요' : '오늘 16시에 마감해요!'), '상장 받는 친구 37명!', '추천 도서 25권 중 1권 골라 읽기']);
    } else {
      notice.set('마감', ['접수가 마감되었어요', '수상자 발표 2월 4일(목) 16시', '참여해 주셔서 고맙습니다']);
    }
    if (p !== 'open') {
      btn.disabled = true;
      btn.textContent = p === 'soon' ? '📅 ' + fmtDate(period.openAt) + '부터 접수할 수 있어요' : '접수가 마감되었습니다';
      msg.className = 'form-msg info';
      msg.textContent = p === 'soon'
        ? '접수 기간: 2026년 12월 10일(목) ~ 2027년 1월 20일(수) 16시. 기간이 되면 이 화면에서 바로 접수할 수 있어요.'
        : '접수 기간이 끝났습니다. 참여해 주셔서 고맙습니다.';
    } else if (!sending) {
      btn.disabled = false;
      btn.textContent = editing ? '✏️ 수정 내용 저장' : '📨 접수하기';
      if (msg.classList.contains('info')) msg.className = 'form-msg';
    }
  }

  /* ================= 페이지 내용 불러오기 ================= */
  function loadContent() {
    if (!API) return;
    apiGet({ action: 'content' }).then(function (res) {
      if (!res || !res.ok) return;
      if (res.openAt) period.openAt = new Date(res.openAt);
      if (res.deadline) period.deadline = new Date(res.deadline);
      if (res.maxFileMB) { MAX_MB = res.maxFileMB; $('#uploadHint').textContent = '한글 문서(HWP, HWPX) · 최대 ' + MAX_MB + 'MB'; }
      var c = res.content || {};
      $$('[data-edit]').forEach(function (el) {
        var key = el.getAttribute('data-edit');
        if (Object.prototype.hasOwnProperty.call(c, key) && c[key] !== '') el.innerHTML = sanitize(c[key]);
      });
      renderStatus();
      if (document.body.classList.contains('admin')) addPens();
    }).catch(function () { /* 기본 내용으로 보여 줍니다 */ });
  }

  /* ================= #032 끌어다 놓는 업로드 (실제 파일 읽기 진행률) ================= */
  var upload = (function () {
    var root = $('#upload');
    var zone = $('.u032-zone', root), pick = $('.u032-file', root), list = $('.u032-list', root);
    var TYPE = { hwp: '#3b63f6', hwpx: '#2bb39a' };
    var chosen = null, reader = null;
    function size(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
    function row(name) {
      var ext = (name.split('.').pop() || '').toLowerCase();
      list.innerHTML = '';
      var li = document.createElement('li');
      li.className = 'u032-row';
      li.innerHTML = '<span class="u032-ic" style="--c:' + (TYPE[ext] || '#98a2b3') + '" aria-hidden="true">' + (esc(ext.slice(0, 4).toUpperCase()) || 'FILE') + '</span><span class="u032-meta"><b></b><small></small></span><span class="u032-st"></span><span class="u032-bar" aria-hidden="true"></span>';
      $('b', li).textContent = name;
      list.appendChild(li);
      return li;
    }
    function fail(li, text) {
      li.classList.add('fail');
      li.style.setProperty('--p', '1');
      $('small', li).textContent = text;
      $('.u032-st', li).outerHTML = '<button class="u032-retry" type="button">다시 고르기</button>';
      $('.u032-retry', li).addEventListener('click', function () { pick.click(); });
    }
    function add(file) {
      if (reader) { reader.abort(); reader = null; }
      chosen = null;
      var li = row(file.name), sm = $('small', li), st = $('.u032-st', li);
      if (!/\.(hwp|hwpx)$/i.test(file.name)) return fail(li, '한글(HWP, HWPX) 파일만 올릴 수 있어요');
      if (file.size > MAX_MB * 1024 * 1024) return fail(li, size(file.size) + ' · ' + MAX_MB + 'MB보다 커요');
      if (!file.size) return fail(li, '빈 파일이에요');
      st.innerHTML = '<span class="u032-spin" aria-hidden="true"></span>';
      var r = reader = new FileReader();
      r.onprogress = function (e) {
        if (!e.lengthComputable) return;
        var p = e.loaded / e.total;
        li.style.setProperty('--p', p.toFixed(3));
        sm.textContent = size(e.loaded) + ' / ' + size(e.total) + ' · ' + Math.round(p * 100) + '%';
      };
      r.onload = function () {
        if (r !== reader) return;
        chosen = { name: file.name, data: String(r.result).split(',')[1] };
        li.style.setProperty('--p', '1');
        li.classList.add('done');
        sm.textContent = size(file.size) + ' · 준비됐어요';
        st.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.4"/></svg>';
      };
      r.onerror = function () { if (r === reader) fail(li, '파일을 읽지 못했어요'); };
      r.readAsDataURL(file);
    }
    zone.addEventListener('click', function () { pick.click(); });
    pick.addEventListener('change', function () { if (pick.files[0]) add(pick.files[0]); pick.value = ''; });
    var depth = 0;
    zone.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; root.classList.add('is-over'); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); });
    zone.addEventListener('dragleave', function () { if (--depth <= 0) { depth = 0; root.classList.remove('is-over'); } });
    zone.addEventListener('drop', function (e) {
      e.preventDefault(); depth = 0; root.classList.remove('is-over');
      if (e.dataTransfer.files[0]) add(e.dataTransfer.files[0]);
    });
    return {
      get: function () { return chosen; },
      busy: function () { return !!reader && !chosen && !$('.u032-row.fail', root); },
      add: add,
      reset: function () { if (reader) reader.abort(); reader = null; chosen = null; list.innerHTML = ''; },
      focus: function () { zone.focus(); shake(zone); }
    };
  })();

  /* ================= #068 끝까지 읽고 동의하는 약관 ================= */
  var consent = (function () {
    var root = $('#consent');
    var txt = $('.u068-txt', root), doc = $('.u068-doc', root), readMsg = $('.u068-read span', root);
    var all = $('.u068-all', root), subs = $$('.u068-list input:not(.u068-all)', root);
    var read = false, ts = [];
    function unlock() {
      if (read) return;
      read = true;
      root.classList.add('is-read');
      readMsg.textContent = '끝까지 읽었어요 · 이제 동의할 수 있어요';
      subs.forEach(function (s) { s.disabled = false; });
    }
    function onScroll() {
      var max = txt.scrollHeight - txt.clientHeight, p = max > 0 ? txt.scrollTop / max : 1;
      doc.style.setProperty('--p', Math.min(1, p).toFixed(3));
      if (p > 0.97) unlock();
    }
    txt.addEventListener('scroll', onScroll, { passive: true });
    function sync() {
      var on = subs.filter(function (s) { return s.checked; }).length;
      all.checked = on === subs.length;
      all.indeterminate = on > 0 && on < subs.length;
    }
    // ‘모두 동의’는 항목을 위에서부터 하나씩 차례로 체크합니다
    all.addEventListener('change', function () {
      var v = all.checked;
      if (!read) { all.checked = false; shake(txt); readMsg.textContent = '먼저 위 내용을 끝까지 내려 주세요'; txt.focus(); return; }
      ts.forEach(clearTimeout); ts = [];
      subs.forEach(function (s, i) { ts.push(setTimeout(function () { s.checked = v; sync(); }, i * 90)); });
    });
    subs.forEach(function (s) { s.addEventListener('change', sync); });
    // 화면이 넓어 스크롤할 내용이 없으면 바로 엽니다
    document.addEventListener('panelshown', function (e) { if (e.detail === 'apply') onScroll(); });
    setTimeout(function () { if (txt.offsetParent && txt.scrollHeight <= txt.clientHeight) onScroll(); }, 300);
    return {
      ok: function () { return subs.every(function (s) { return s.checked; }); },
      reset: function () { ts.forEach(clearTimeout); subs.forEach(function (s) { s.checked = false; }); sync(); },
      focus: function () { root.scrollIntoView({ block: 'center' }); shake(root); if (!read) readMsg.textContent = '먼저 위 내용을 끝까지 내려 주세요'; }
    };
  })();

  /* ================= 접수 폼 ================= */
  var sending = false, editing = null, startEntryEdit = function () {}, endEntryEdit = function () {};
  (function () {
    var form = $('#applyForm'), msg = $('#formMsg'), phone = $('#phone');
    phone.addEventListener('input', function () {
      var d = phone.value.replace(/\D/g, '').slice(0, 11);
      phone.value = d.length < 4 ? d : d.length < 8 ? d.slice(0, 3) + '-' + d.slice(3) : d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4);
    });
    $$('.field', form).forEach(function (f) { f.addEventListener('input', function () { f.classList.remove('bad'); }); });

    function fail(text, el) {
      msg.className = 'form-msg err';
      msg.textContent = text;
      if (el && el.classList) { el.classList.add('bad'); el.focus(); }
      return false;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (phase() !== 'open' || sending) return;
      var ed = editing;
      var f = form.elements;
      var req = [['name', '학생 이름'], ['grade', '학년'], ['region', '지역'], ['school', '학교(소속)'], ['book', '읽은 책'], ['guardian', '보호자 성명']];
      for (var i = 0; i < req.length; i++) {
        if (!f[req[i][0]].value.trim()) return fail(req[i][1] + '을(를) 입력해 주세요.', f[req[i][0]]);
      }
      var digits = f.phone.value.replace(/\D/g, '');
      var email = f.email.value.trim();
      // 수정할 때는 전화번호·이메일을 비워 두면 그대로 둡니다
      if ((!ed || digits) && !/^01[016789]\d{7,8}$/.test(digits)) return fail('보호자 휴대전화 번호를 확인해 주세요.', f.phone);
      if ((!ed || email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('보호자 이메일 주소를 확인해 주세요.', f.email);
      if (upload.busy()) return fail('작품 파일을 읽고 있어요. 잠시 뒤에 다시 눌러 주세요.');
      var file = upload.get();
      if (!ed && !file) { upload.focus(); return fail('작품 파일을 올려 주세요.'); }
      if (!ed && !consent.ok()) { consent.focus(); return fail('필수 동의 항목 3개에 모두 체크해 주세요.'); }
      if (!API) return fail('접수 서버가 아직 연결되지 않았습니다. 잠시 뒤에 다시 시도해 주세요.');

      var btn = $('#submitBtn');
      sending = true;
      btn.disabled = true;
      btn.textContent = ed ? '⏳ 수정하고 있어요… 창을 닫지 마세요' : '⏳ 접수하고 있어요… 창을 닫지 마세요';
      msg.className = 'form-msg';
      var note = toast('wait', ed ? '수정 내용을 저장하고 있어요…' : '접수하고 있어요…', file ? file.name : ed.receiptNo);

      var body = {
        name: f.name.value.trim(), grade: f.grade.value, region: f.region.value, school: f.school.value.trim(),
        book: f.book.value, guardian: f.guardian.value.trim(), phone: digits, email: email,
        file: file ? { name: file.name, data: file.data } : null
      };
      if (ed) { body.action = 'update'; body.editToken = ed.token; body.receiptNo = ed.receiptNo; }
      else { body.action = 'apply'; body.agreePrivacy = true; body.agreeRights = true; body.agreeOriginal = true; body.website = f.website.value; }

      apiPost(body).then(function (res) {
        note.done('ok', ed ? '수정이 완료되었습니다' : '접수가 완료되었습니다', '접수번호 ' + res.receiptNo);
        $('#doneTitle').textContent = ed ? '수정이 완료되었습니다!' : '접수가 완료되었습니다!';
        $('#receiptNo').textContent = res.receiptNo;
        endEntryEdit(true);
        form.style.display = 'none';
        $('#doneBox').classList.add('show');
        $('#apply').scrollIntoView();
      }).catch(function (err) {
        note.done('err', ed ? '수정하지 못했어요' : '접수하지 못했어요', err.message);
        fail(err.message || '문제가 생겼습니다. 다시 시도해 주세요.');
      }).then(function () {
        sending = false;
        renderStatus();
      });
    });

    $('#againBtn').addEventListener('click', function () {
      form.reset();
      upload.reset();
      consent.reset();
      form.style.display = '';
      $('#doneBox').classList.remove('show');
      $('#name').focus();
    });

    /* ---------- 수정 모드 ---------- */
    var HINT = { phone: $('#phoneHint').textContent, email: $('#emailHint').textContent };
    startEntryEdit = function (token, en) {
      editing = { token: token, receiptNo: en.receiptNo };
      form.reset();
      upload.reset();
      form.classList.add('editing');
      form.style.display = '';
      $('#doneBox').classList.remove('show');
      var f = form.elements;
      f.name.value = en.name; f.grade.value = en.grade; f.region.value = en.region;
      f.school.value = en.school; f.guardian.value = en.guardian;
      if (!$$('#book option').some(function (o) { return o.value === en.book; })) {
        var o = document.createElement('option'); o.value = en.book; o.textContent = en.book; $('#book').appendChild(o);
      }
      f.book.value = en.book;
      f.phone.required = false; f.email.required = false;
      f.phone.placeholder = en.phoneMasked; f.email.placeholder = en.emailMasked;
      $('#phoneHint').textContent = '바꿀 때만 새 번호를 입력하세요. 비워 두면 그대로예요.';
      $('#emailHint').textContent = '바꿀 때만 새 주소를 입력하세요. 비워 두면 그대로예요. 수정 확인 메일은 이 주소로 가요.';
      var fc = $('#fileCurrent');
      fc.hidden = false;
      fc.textContent = '📄 지금 제출된 파일: ' + String(en.fileName || '').replace(/^R\d+_/, '') + ' · 새 파일을 올리면 바뀌고, 올리지 않으면 그대로예요.';
      $('#editNo').textContent = en.receiptNo;
      $('#editBanner').hidden = false;
      msg.className = 'form-msg';
      renderStatus();
      $('#editBanner').scrollIntoView({ block: 'center' });
    };
    endEntryEdit = function (keepFormHidden) {
      if (!editing) return;
      editing = null;
      form.classList.remove('editing');
      form.reset();
      upload.reset();
      var f = form.elements;
      f.phone.required = true; f.email.required = true;
      f.phone.placeholder = '010-0000-0000'; f.email.placeholder = 'example@email.com';
      $('#phoneHint').textContent = HINT.phone; $('#emailHint').textContent = HINT.email;
      $('#fileCurrent').hidden = true;
      $('#editBanner').hidden = true;
      if (!keepFormHidden) msg.className = 'form-msg';
      renderStatus();
    };
    $('#editCancel').addEventListener('click', function () { endEntryEdit(); toast('info', '수정을 취소했어요'); });
  })();

  /* ================= 접수 확인 (학생 이름 + 휴대전화 뒷 4자리) ================= */
  (function () {
    var tg = $('#lookupToggle'), body = $('#lookupBody'), lf = $('#lookupForm'), msg = $('#lookupMsg'), list = $('#lookupList');
    var last4 = $('#lkLast4');
    tg.addEventListener('click', function () {
      var open = tg.getAttribute('aria-expanded') !== 'true';
      tg.setAttribute('aria-expanded', String(open));
      body.hidden = !open;
      if (open) $('#lkName').focus();
    });
    last4.addEventListener('input', function () { last4.value = last4.value.replace(/\D/g, '').slice(0, 4); });
    lf.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#lkName').value.trim(), l4 = last4.value;
      list.innerHTML = '';
      if (!name) { msg.className = 'form-msg err'; msg.textContent = '학생 이름을 입력해 주세요.'; $('#lkName').focus(); return; }
      if (!/^\d{4}$/.test(l4)) { msg.className = 'form-msg err'; msg.textContent = '휴대전화 뒷 4자리 숫자를 입력해 주세요.'; last4.focus(); return; }
      if (!API) { msg.className = 'form-msg err'; msg.textContent = '접수 서버가 아직 연결되지 않았습니다.'; return; }
      var btn = $('#lookupBtn');
      btn.disabled = true; btn.textContent = '찾는 중…';
      msg.className = 'form-msg';
      apiPost({ action: 'lookup', name: name, last4: l4 }).then(function (res) {
        msg.className = 'form-msg info';
        msg.textContent = res.entries.length + '건을 찾았어요.' + (res.canEdit ? ' 고칠 접수의 [수정하기]를 눌러 주세요. (' + res.minutes + '분 안에 저장해 주세요)' : ' 지금은 접수 기간이 아니라서 확인만 할 수 있어요.');
        list.innerHTML = res.entries.map(function (en, i) {
          return '<li class="tile"><div class="meta"><span class="no">' + esc(en.receiptNo) + '</span><b>' + esc(en.name) + '</b> · ' + esc(en.grade) + '학년 · ' + esc(en.region) + ' ' + esc(en.school) +
            '<br>📖 ' + esc(en.book) + '<br><span class="muted">접수 ' + esc(en.date) + (en.edited ? ' · 수정 ' + esc(en.edited) : '') + ' · 📞 ' + esc(en.phoneMasked) + ' · ✉️ ' + esc(en.emailMasked) + '</span></div>' +
            (res.canEdit ? '<button type="button" class="btn primary small" data-i="' + i + '">✏️ 수정하기</button>' : '') + '</li>';
        }).join('');
        $$('button[data-i]', list).forEach(function (b) {
          b.addEventListener('click', function () { startEntryEdit(res.editToken, res.entries[Number(b.getAttribute('data-i'))]); });
        });
      }).catch(function (err) {
        msg.className = 'form-msg err';
        msg.textContent = err.message;
      }).then(function () { btn.disabled = false; btn.textContent = '확인'; });
    });
  })();

  /* ================= #062 관리자 로그인 ================= */
  var token = store('bookAdminToken');
  var login = (function () {
    var dlg = $('#loginDialog'), root = $('#loginCard');
    var form = $('.u062-login', root), hi = $('.u062-hi', root);
    var pwF = $('.u062-pw', root), pw = $('input', pwF), err = $('#loginErr');
    var eye = $('.u062-eye', root), caps = $('.u062-caps', root), go = $('.u062-go', root);
    var busy = false;
    err.id = 'loginErr'; pw.setAttribute('aria-describedby', 'loginErr');
    eye.addEventListener('click', function () {
      var on = eye.getAttribute('aria-pressed') !== 'true';
      eye.setAttribute('aria-pressed', String(on));
      eye.setAttribute('aria-label', on ? '비밀번호 숨기기' : '비밀번호 보기');
      pw.type = on ? 'text' : 'password';
    });
    pw.addEventListener('keyup', function (e) { if (e.getModifierState) caps.classList.toggle('on', e.getModifierState('CapsLock')); });
    pw.addEventListener('input', function () { pwF.classList.remove('bad'); pw.removeAttribute('aria-invalid'); });
    function reset() {
      busy = false;
      root.classList.remove('is-in', 'shake');
      form.inert = false; hi.setAttribute('aria-hidden', 'true');
      go.classList.remove('busy', 'ok'); go.removeAttribute('aria-label');
      pw.value = ''; pw.type = 'password'; eye.setAttribute('aria-pressed', 'false');
      pwF.classList.remove('bad'); err.textContent = '';
    }
    // 제출하면 버튼이 동그라미로 줄며 돌고, 결과에 따라 흔들리거나 체크로 바뀝니다
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      busy = true;
      go.classList.add('busy');
      go.setAttribute('aria-label', '확인하는 중');
      apiPost({ action: 'login', password: pw.value }).then(function (res) {
        go.classList.remove('busy');
        go.classList.add('ok');
        go.setAttribute('aria-label', '로그인 성공');
        token = res.token;
        store('bookAdminToken', token);
        setTimeout(function () {
          root.classList.add('is-in');
          form.inert = true; hi.setAttribute('aria-hidden', 'false');
          setTimeout(function () { dlg.close(); enterAdmin(); toast('ok', '관리자 모드로 들어왔어요', '연필을 눌러 내용을 고칠 수 있어요'); }, RM ? 200 : 1100);
        }, RM ? 0 : 650);
      }).catch(function (ex) {
        busy = false;
        go.classList.remove('busy');
        go.removeAttribute('aria-label');
        err.textContent = ex.message;
        pwF.classList.add('bad');
        pw.setAttribute('aria-invalid', 'true');
        root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake');
        pw.select();
      });
    });
    root.addEventListener('animationend', function (e) { if (e.target === root) root.classList.remove('shake'); });
    $('#loginCancel').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    return {
      open: function () {
        if (!API) { toast('info', '관리자 기능은 서버 연결 뒤에 쓸 수 있어요', 'SETUP.md를 참고해 주세요'); return; }
        reset();
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
        pw.focus();
      }
    };
  })();

  /* ================= 관리자 모드 ================= */
  function enterAdmin() {
    document.body.classList.add('admin');
    nav.setAdmin(true);
    addPens();
    loadEntries();
  }
  function leaveAdmin() {
    token = null;
    store('bookAdminToken', null);
    document.body.classList.remove('admin');
    nav.setAdmin(false);
    $$('.edit-pen, .edit-bar').forEach(function (p) { p.remove(); });
    $$('[data-edit][contenteditable]').forEach(function (el) { el.removeAttribute('contenteditable'); });
  }
  function authError(err) {
    if (/로그인/.test(err.message)) { leaveAdmin(); toast('err', '로그인이 만료되었어요', '다시 로그인해 주세요'); return true; }
    return false;
  }
  $('#adminLink').addEventListener('click', function () {
    if (document.body.classList.contains('admin')) nav.go('entries'); else login.open();
  });
  $('#logoutBtn').addEventListener('click', function () {
    if (token) apiPost({ action: 'logout', token: token }).catch(function () {});
    leaveAdmin();
    toast('info', '로그아웃했어요');
  });

  function addPens() {
    $$('[data-edit]').forEach(function (el) {
      if ($(':scope > .edit-pen', el)) return;
      var pen = document.createElement('button');
      pen.type = 'button';
      pen.className = 'edit-pen';
      pen.title = '이 내용 고치기';
      pen.setAttribute('aria-label', '이 내용 고치기');
      pen.textContent = '✏️';
      pen.setAttribute('contenteditable', 'false');
      pen.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); startInlineEdit(el); });
      el.appendChild(pen);
    });
  }
  function cleanHtml(el) {
    var c = el.cloneNode(true);
    $$('.edit-pen, .edit-bar', c).forEach(function (n) { n.remove(); });
    return sanitize(c.innerHTML).trim();
  }
  function startInlineEdit(el) {
    if (el.getAttribute('contenteditable') === 'true') return;
    var before = cleanHtml(el);
    el.setAttribute('contenteditable', 'true');
    el.focus();
    var bar = document.createElement('div');
    bar.className = 'edit-bar';
    bar.setAttribute('contenteditable', 'false');
    bar.innerHTML = '<button type="button" class="save">저장</button><button type="button" class="cancel">취소</button>';
    el.appendChild(bar);
    function stop() { el.removeAttribute('contenteditable'); bar.remove(); }
    $('.cancel', bar).addEventListener('click', function (e) { e.stopPropagation(); stop(); el.innerHTML = before; addPens(); });
    $('.save', bar).addEventListener('click', function (e) {
      e.stopPropagation();
      var html = cleanHtml(el), save = $('.save', bar);
      save.disabled = true; save.textContent = '저장 중…';
      apiPost({ action: 'saveContent', token: token, key: el.getAttribute('data-edit'), value: html }).then(function () {
        stop(); el.innerHTML = html; addPens();
        toast('ok', '저장했어요', '방문자에게도 바로 보여요');
      }).catch(function (err) {
        save.disabled = false; save.textContent = '저장';
        if (!authError(err)) toast('err', '저장하지 못했어요', err.message);
      });
    });
  }

  var entries = [];
  function loadEntries() {
    $('#entryBody').innerHTML = '<tr><td colspan="10">불러오는 중…</td></tr>';
    apiPost({ action: 'list', token: token }).then(function (res) {
      entries = res.rows || [];
      renderEntries();
    }).catch(function (err) {
      if (!authError(err)) $('#entryBody').innerHTML = '<tr><td colspan="10">' + esc(err.message) + '</td></tr>';
    });
  }
  function renderEntries() {
    var q = $('#entrySearch').value.trim().toLowerCase(), qd = q.replace(/\D/g, '');
    var rows = entries.slice().reverse().filter(function (r) {
      if (!q) return true;
      return r.join(' ').toLowerCase().indexOf(q) >= 0 || (qd && String(r[9]).replace(/\D/g, '').indexOf(qd) >= 0);
    });
    $('#entryCount').textContent = '총 ' + entries.length + '건' + (q ? ' · 검색 ' + rows.length + '건' : '');
    if (!rows.length) {
      $('#entryBody').innerHTML = '<tr><td colspan="10">' + (entries.length ? '찾는 접수가 없어요.' : '아직 접수가 없어요.') + '</td></tr>';
      return;
    }
    $('#entryBody').innerHTML = rows.map(function (r) {
      var tel = String(r[9]).replace(/\D/g, '');
      var fileLink = /^https:\/\//.test(r[12]) ? '<a href="' + esc(r[12]) + '" target="_blank" rel="noopener">📄 열기</a>' : esc(r[11]);
      return '<tr>' +
        '<td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + (r[17] ? '<br><small>✏️ 수정 ' + esc(r[17]) + '</small>' : '') + '</td><td><strong>' + esc(r[2]) + '</strong></td>' +
        '<td>' + esc(r[3]) + ' <small>(' + esc(r[4]) + ')</small></td>' +
        '<td>' + esc(r[5]) + ' · ' + esc(r[6]) + '</td><td>' + esc(r[7]) + '</td><td>' + esc(r[8]) + '</td>' +
        '<td>' + esc(r[9]) +
          ' <a class="icon-btn" href="tel:' + tel + '" title="전화 걸기" aria-label="' + esc(r[8]) + '에게 전화">📞</a>' +
          '<a class="icon-btn" href="sms:' + tel + '" title="문자 보내기" aria-label="' + esc(r[8]) + '에게 문자">💬</a></td>' +
        '<td><a href="mailto:' + esc(r[10]) + '">' + esc(r[10]) + '</a></td>' +
        '<td>' + fileLink + '</td></tr>';
    }).join('');
  }
  $('#reloadEntries').addEventListener('click', loadEntries);
  $('#entrySearch').addEventListener('input', renderEntries);

  /* ================= 시작 ================= */
  renderStatus();
  loadContent();
  setInterval(renderStatus, 60000);
  if (/[?&]admin\b/.test(location.search) && !token) login.open();
  if (token && API) enterAdmin();
})();
