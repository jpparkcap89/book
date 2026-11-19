(function () {
  'use strict';

  var API = (window.BOOK_API_URL || '').trim();
  var DEFAULT_OPEN = '2026-12-10T00:00:00+09:00';
  var DEFAULT_DEADLINE = '2027-01-20T16:00:00+09:00';
  var MAX_MB = 10;

  var BOOKS = [
    ['34번째 민족대표 프랭크 스코필드', '박서영 글 · 윤지경 그림', '고래책빵'],
    ['고민이 사르르 죽', '김하영 글 · 임수현 그림', '웅진주니어'],
    ['긴 한나절', '고현숙 외 글', '도담소리'],
    ['껌딱지 친구', '황혜진 글 · 김지영 그림', '고래책빵'],
    ['꼬복바위의 비밀', '안선희 글 · 백명식 그림', '고래책빵'],
    ['꽁이 구출 작전', '박정미 글 · 김은아 그림', '고래책빵'],
    ['꿈의 공책', '박선영 글 · 한혜정 그림', '도담소리'],
    ['달섬 소년', '이우 글 · 김지영 그림', '고래책빵'],
    ['독도강치대왕을 아시나요?', '함영연 글 · 이정열 그림', '별빛서재'],
    ['돌로 만든 배', '김정배 글 · 김태현 그림', '봄봄출판사'],
    ['동우와 트라이앵글', '이희갑 글 · 김경수 그림', '삼성당'],
    ['마녀 우체국', '김정숙 글 · 김진희 그림', '한그루'],
    ['명찰 아저씨, 최고야', '신소담 글 · 유재엽 그림', '가문비어린이'],
    ['목판에 새긴 꿈, 대동여지도', '도건영 글 · 어수현 그림', '개암나무'],
    ['복을 그리는 아이', '한현정 글 · 이로우 그림', '시공주니어'],
    ['비행소년 슈퍼맨', '김춘남 글 · 배순아 그림', '초록달팽이'],
    ['사랑별에서 온 아이', '이정순 글 · 김진희 그림', '글라이더'],
    ['신이 된 사람들', '김란 글 · 김진희 그림', '한그루'],
    ['열 살 내 인생', '이옥선 글 · 김도아 그림', '바나나BOOK'],
    ['인생 팥죽', '조현미 글 · 안병현 그림', '잇츠북어린이'],
    ['제비 똥받이 사건', '고현숙 글 · 한혜정 그림', '도담소리'],
    ['천년의 휴가', '송재찬 글 · 신소영 그림', '이오앤북스'],
    ['콩콩이를 잠재운 도깨비 친구들', '배정순 글 · 이혜원 그림', '고래책빵'],
    ['할아버지 집에 용이 살아요', '김정희 글 · 고은 그림', '한그루'],
    ['허물 벗는 나비', '김정련 글 · 김민경 그림', '한그루']
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

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  /* ---------------- 서버 통신 ---------------- */
  function apiGet(params) {
    var q = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(API + '?' + q).then(function (r) { return r.json(); });
  }
  function apiPost(body) {
    // text/plain으로 보내야 Apps Script가 CORS 사전 요청 없이 받습니다.
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res.ok) throw new Error(res.error || '요청을 처리하지 못했습니다.');
      return res;
    });
  }

  /* ---------------- 편집 내용 정리(관리자 입력) ---------------- */
  var BAD_TAGS = 'script,style,iframe,object,embed,link,meta,form,input,button,textarea,select,base';
  function sanitize(html) {
    var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
    var root = doc.body.firstChild;
    $$(BAD_TAGS, root).forEach(function (n) { n.remove(); });
    $$('*', root).forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        var name = a.name.toLowerCase();
        var v = a.value.replace(/\s/g, '').toLowerCase();
        if (name.indexOf('on') === 0 || name === 'contenteditable') n.removeAttribute(a.name);
        else if ((name === 'href' || name === 'src') && /^(javascript|data|vbscript):/.test(v)) n.removeAttribute(a.name);
      });
    });
    return root.innerHTML;
  }

  /* ---------------- 홍보 영상: PC 가로 / 휴대폰 세로 ---------------- */
  var mqPortrait = window.matchMedia('(max-width: 767px), (orientation: portrait) and (max-width: 1024px)');
  function setupVideo() {
    var box = $('#promo');
    var v = $('#promoVideo');
    var btn = $('#soundBtn');
    var current = '';
    function pick() {
      var portrait = mqPortrait.matches;
      var src = portrait ? 'video/promo-portrait.mp4' : 'video/promo-landscape.mp4';
      if (src === current) return;
      current = src;
      box.className = 'promo ' + (portrait ? 'portrait' : 'landscape');
      v.src = src;
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    pick();
    if (mqPortrait.addEventListener) mqPortrait.addEventListener('change', pick);
    else if (mqPortrait.addListener) mqPortrait.addListener(pick);

    btn.addEventListener('click', function () {
      v.muted = !v.muted;
      if (!v.muted) { v.currentTime = 0; v.play(); }
      btn.textContent = v.muted ? '🔇 소리 켜기' : '🔊 소리 끄기';
    });
  }

  /* ---------------- 도서 ---------------- */
  function renderBooks() {
    var grid = $('#bookGrid');
    grid.innerHTML = BOOKS.map(function (b, i) {
      var n = ('0' + (i + 1)).slice(-2);
      return '<div class="book"><div class="cover"><img src="covers/' + n + '.jpg" alt="' + esc(b[0]) + ' 표지" loading="lazy"></div>' +
        '<div class="t">' + esc(b[0]) + '</div><div class="a">' + esc(b[1]) + '<br>' + esc(b[2]) + '</div></div>';
    }).join('');
    var sel = $('#book');
    BOOKS.forEach(function (b) {
      var o = document.createElement('option');
      o.value = b[0];
      o.textContent = b[0] + ' (' + b[2] + ')';
      sel.appendChild(o);
    });
  }

  /* ---------------- 접수 기간 ---------------- */
  var period = { openAt: new Date(DEFAULT_OPEN), deadline: new Date(DEFAULT_DEADLINE) };
  function dday(target) {
    var day = 86400000;
    var kst = function (d) { return Math.floor((d.getTime() + 9 * 3600000) / day); };
    return kst(target) - kst(new Date());
  }
  function fmtDate(d) {
    var k = new Date(d.getTime() + 9 * 3600000);
    return (k.getUTCMonth() + 1) + '월 ' + k.getUTCDate() + '일';
  }
  function phase() {
    var now = new Date();
    if (now < period.openAt) return 'soon';
    if (now > period.deadline) return 'closed';
    return 'open';
  }
  function renderStatus() {
    var pill = $('#statusPill');
    var text = $('#statusText');
    var p = phase();
    pill.className = 'status-pill ' + p;
    if (p === 'soon') {
      var d = dday(period.openAt);
      text.textContent = '접수 예정 · ' + fmtDate(period.openAt) + '부터' + (d > 0 ? ' (D-' + d + ')' : '');
    } else if (p === 'open') {
      var d2 = dday(period.deadline);
      text.textContent = '접수 중 · ' + (d2 > 0 ? '마감까지 D-' + d2 : '오늘 16시 마감!');
    } else {
      text.textContent = '접수가 마감되었습니다';
    }
    var btn = $('#submitBtn');
    var msg = $('#formMsg');
    if (p !== 'open') {
      btn.disabled = true;
      btn.textContent = p === 'soon' ? '📅 ' + fmtDate(period.openAt) + '부터 접수할 수 있어요' : '접수가 마감되었습니다';
      msg.className = 'form-msg info';
      msg.textContent = p === 'soon'
        ? '접수 기간: 2026년 12월 10일(목) ~ 2027년 1월 20일(수) 16시. 기간이 되면 이 화면에서 바로 접수할 수 있어요.'
        : '접수 기간이 끝났습니다. 참여해 주셔서 고맙습니다.';
    } else {
      btn.disabled = false;
      btn.textContent = '📨 접수하기';
      if (msg.classList.contains('info')) msg.className = 'form-msg';
    }
  }

  /* ---------------- 페이지 내용 불러오기 ---------------- */
  function loadContent() {
    if (!API) return Promise.resolve();
    return apiGet({ action: 'content' }).then(function (res) {
      if (!res || !res.ok) return;
      if (res.openAt) period.openAt = new Date(res.openAt);
      if (res.deadline) period.deadline = new Date(res.deadline);
      if (res.maxFileMB) { MAX_MB = res.maxFileMB; $('#fileHint').textContent = '한글 문서만 올릴 수 있어요. 최대 ' + MAX_MB + 'MB'; }
      var c = res.content || {};
      $$('[data-edit]').forEach(function (el) {
        var key = el.getAttribute('data-edit');
        if (Object.prototype.hasOwnProperty.call(c, key) && c[key] !== '') el.innerHTML = sanitize(c[key]);
      });
      renderStatus();
      if (document.body.classList.contains('admin')) addPens();
    }).catch(function () { /* 기본 내용으로 표시 */ });
  }

  /* ---------------- 접수 폼 ---------------- */
  function setupForm() {
    var form = $('#applyForm');
    var msg = $('#formMsg');
    var phone = $('#phone');

    phone.addEventListener('input', function () {
      var d = phone.value.replace(/\D/g, '').slice(0, 11);
      phone.value = d.length < 4 ? d : d.length < 8 ? d.slice(0, 3) + '-' + d.slice(3)
        : d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4);
    });

    var all = $('#agreeAll');
    var ones = $$('.agree-one');
    all.addEventListener('change', function () { ones.forEach(function (c) { c.checked = all.checked; }); });
    ones.forEach(function (c) {
      c.addEventListener('change', function () { all.checked = ones.every(function (x) { return x.checked; }); });
    });

    function fail(text, el) {
      msg.className = 'form-msg err';
      msg.textContent = text;
      if (el) el.focus();
      return false;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (phase() !== 'open') return;
      var f = form.elements;
      var req = [['name', '학생 이름'], ['grade', '학년'], ['region', '지역'], ['school', '학교(소속)'], ['book', '읽은 책'], ['guardian', '보호자 성명']];
      for (var i = 0; i < req.length; i++) {
        if (!f[req[i][0]].value.trim()) return fail(req[i][1] + '을(를) 입력해 주세요.', f[req[i][0]]);
      }
      var digits = f.phone.value.replace(/\D/g, '');
      if (!/^01[016789]\d{7,8}$/.test(digits)) return fail('보호자 휴대전화 번호를 확인해 주세요.', f.phone);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) return fail('보호자 이메일 주소를 확인해 주세요.', f.email);
      var file = f.file.files[0];
      if (!file) return fail('작품 파일을 첨부해 주세요.', f.file);
      if (!/\.(hwp|hwpx)$/i.test(file.name)) return fail('작품은 한글(HWP, HWPX) 파일로 올려 주세요.', f.file);
      if (file.size > MAX_MB * 1024 * 1024) return fail('파일이 너무 커요. ' + MAX_MB + 'MB 이하로 올려 주세요.', f.file);
      if (!(f.agreePrivacy.checked && f.agreeRights.checked && f.agreeOriginal.checked)) return fail('필수 동의 항목 3개에 모두 체크해 주세요.');
      if (!API) return fail('접수 서버가 아직 연결되지 않았습니다. 잠시 뒤에 다시 시도해 주세요.');

      var btn = $('#submitBtn');
      btn.disabled = true;
      btn.textContent = '⏳ 접수하고 있어요… 창을 닫지 마세요';
      msg.className = 'form-msg';

      readBase64(file).then(function (data) {
        return apiPost({
          action: 'apply',
          name: f.name.value.trim(), grade: f.grade.value, region: f.region.value, school: f.school.value.trim(),
          book: f.book.value, guardian: f.guardian.value.trim(), phone: digits, email: f.email.value.trim(),
          agreePrivacy: true, agreeRights: true, agreeOriginal: true, website: f.website.value,
          file: { name: file.name, data: data }
        });
      }).then(function (res) {
        $('#receiptNo').textContent = res.receiptNo;
        form.style.display = 'none';
        $('#doneBox').classList.add('show');
        $('#apply').scrollIntoView();
      }).catch(function (err) {
        fail(err.message || '접수 중 문제가 생겼습니다. 다시 시도해 주세요.');
      }).then(function () {
        btn.disabled = false;
        btn.textContent = '📨 접수하기';
        renderStatus();
      });
    });

    $('#againBtn').addEventListener('click', function () {
      form.reset();
      form.style.display = '';
      $('#doneBox').classList.remove('show');
      $('#name').focus();
    });
  }

  function readBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = function () { reject(new Error('파일을 읽지 못했습니다.')); };
      r.readAsDataURL(file);
    });
  }

  /* ---------------- 관리자 ---------------- */
  var token = store('bookAdminToken');

  function setupAdmin() {
    var dlg = $('#loginDialog');
    function openLogin() {
      if (!API) { toast('관리자 기능은 서버(Apps Script)를 연결한 뒤에 쓸 수 있어요.'); return; }
      $('#loginErr').textContent = '';
      $('#loginPw').value = '';
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      $('#loginPw').focus();
    }
    $('#adminLink').addEventListener('click', function () {
      if (document.body.classList.contains('admin')) location.hash = '#entries'; else openLogin();
    });
    $('#loginCancel').addEventListener('click', function () { dlg.close(); });
    $('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('#loginBtn');
      btn.disabled = true;
      apiPost({ action: 'login', password: $('#loginPw').value }).then(function (res) {
        token = res.token;
        store('bookAdminToken', token);
        dlg.close();
        enterAdmin();
        toast('관리자 모드로 들어왔어요.');
      }).catch(function (err) {
        $('#loginErr').textContent = err.message;
      }).then(function () { btn.disabled = false; });
    });
    $('#logoutBtn').addEventListener('click', function () {
      if (token) apiPost({ action: 'logout', token: token }).catch(function () {});
      leaveAdmin();
      toast('로그아웃했어요.');
    });
    $('#reloadEntries').addEventListener('click', loadEntries);
    $('#entrySearch').addEventListener('input', renderEntries);

    if (/[?&]admin\b/.test(location.search) && !token) openLogin();
    if (token && API) enterAdmin();
  }

  function enterAdmin() {
    document.body.classList.add('admin');
    addPens();
    loadEntries();
  }
  function leaveAdmin() {
    token = null;
    store('bookAdminToken', null);
    document.body.classList.remove('admin');
    $$('.edit-pen').forEach(function (p) { p.remove(); });
    $$('[data-edit][contenteditable]').forEach(function (el) { el.removeAttribute('contenteditable'); });
    $$('.edit-bar').forEach(function (b) { b.remove(); });
  }
  function authError(err) {
    if (/로그인/.test(err.message)) { leaveAdmin(); toast(err.message); return true; }
    return false;
  }

  function addPens() {
    $$('[data-edit]').forEach(function (el) {
      if ($(':scope > .edit-pen', el)) return;
      var pen = document.createElement('button');
      pen.type = 'button';
      pen.className = 'edit-pen';
      pen.title = '이 내용 고치기';
      pen.textContent = '✏️';
      pen.setAttribute('contenteditable', 'false');
      pen.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); startEdit(el); });
      el.appendChild(pen);
    });
  }

  function cleanHtml(el) {
    var c = el.cloneNode(true);
    $$('.edit-pen, .edit-bar', c).forEach(function (n) { n.remove(); });
    return sanitize(c.innerHTML).trim();
  }

  function startEdit(el) {
    if (el.getAttribute('contenteditable') === 'true') return;
    var details = el.closest('details');
    if (details) details.open = true;
    var before = cleanHtml(el);
    el.setAttribute('contenteditable', 'true');
    el.focus();

    var bar = document.createElement('div');
    bar.className = 'edit-bar';
    bar.setAttribute('contenteditable', 'false');
    bar.innerHTML = '<button type="button" class="save">저장</button><button type="button" class="cancel">취소</button>';
    el.appendChild(bar);

    function stop() {
      el.removeAttribute('contenteditable');
      bar.remove();
    }
    $('.cancel', bar).addEventListener('click', function (e) {
      e.stopPropagation();
      stop();
      el.innerHTML = before;
      addPens();
    });
    $('.save', bar).addEventListener('click', function (e) {
      e.stopPropagation();
      var html = cleanHtml(el);
      var save = $('.save', bar);
      save.disabled = true;
      save.textContent = '저장 중…';
      apiPost({ action: 'saveContent', token: token, key: el.getAttribute('data-edit'), value: html }).then(function () {
        stop();
        el.innerHTML = html;
        addPens();
        toast('저장했어요. 방문자에게도 바로 보여요.');
      }).catch(function (err) {
        save.disabled = false;
        save.textContent = '저장';
        if (!authError(err)) toast('저장하지 못했어요: ' + err.message);
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
    var q = $('#entrySearch').value.trim().toLowerCase();
    var qd = q.replace(/\D/g, '');
    var rows = entries.slice().reverse().filter(function (r) {
      if (!q) return true;
      var hay = r.join(' ').toLowerCase();
      return hay.indexOf(q) >= 0 || (qd && r[9].replace(/\D/g, '').indexOf(qd) >= 0);
    });
    $('#entryCount').textContent = '총 ' + entries.length + '건' + (q ? ' · 검색 ' + rows.length + '건' : '');
    if (!rows.length) {
      $('#entryBody').innerHTML = '<tr><td colspan="10">' + (entries.length ? '찾는 접수가 없어요.' : '아직 접수가 없어요.') + '</td></tr>';
      return;
    }
    $('#entryBody').innerHTML = rows.map(function (r) {
      var tel = r[9].replace(/\D/g, '');
      var fileLink = /^https:\/\//.test(r[12]) ? '<a href="' + esc(r[12]) + '" target="_blank" rel="noopener">📄 열기</a>' : esc(r[11]);
      return '<tr>' +
        '<td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td><b>' + esc(r[2]) + '</b></td>' +
        '<td>' + esc(r[3]) + ' <small>(' + esc(r[4]) + ')</small></td>' +
        '<td>' + esc(r[5]) + ' · ' + esc(r[6]) + '</td><td>' + esc(r[7]) + '</td><td>' + esc(r[8]) + '</td>' +
        '<td>' + esc(r[9]) +
          ' <a class="icon-btn" href="tel:' + tel + '" title="전화 걸기" aria-label="' + esc(r[8]) + '에게 전화">📞</a>' +
          '<a class="icon-btn" href="sms:' + tel + '" title="문자 보내기" aria-label="' + esc(r[8]) + '에게 문자">💬</a></td>' +
        '<td><a href="mailto:' + esc(r[10]) + '">' + esc(r[10]) + '</a></td>' +
        '<td>' + fileLink + '</td></tr>';
    }).join('');
  }

  /* ---------------- 시작 ---------------- */
  renderBooks();
  setupVideo();
  renderStatus();
  setupForm();
  setupAdmin();
  loadContent();
  setInterval(renderStatus, 60000);
})();
