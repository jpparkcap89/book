/**
 * 제15회 전국어린이독후감쓰기 대회 — 접수 백엔드 (Google Apps Script)
 *
 * 이 코드는 구글 시트에 붙어 있는(컨테이너 바인딩) Apps Script입니다.
 * 처음 한 번 setup()을 실행하면 시트 3개와 작품 폴더가 만들어집니다.
 * 자세한 순서는 저장소의 SETUP.md를 보세요.
 *
 * 시트
 *   설정       key | value | 설명
 *   페이지내용  key | value | 수정일시
 *   접수목록    접수번호, 접수일시, ... (헤더 참고)
 */

var SHEET_SETTINGS = '설정';
var SHEET_CONTENT = '페이지내용';
var SHEET_ENTRIES = '접수목록';

var ENTRY_HEADERS = [
  '접수번호', '접수일시', '학생 이름', '학년', '구분', '지역', '학교(소속)', '선택 도서',
  '보호자 성명', '보호자 휴대전화', '보호자 이메일', '작품 파일', '파일 링크',
  '개인정보 동의', '작품 사용권 동의', '창작 서약', '동의 일시'
];

var DEFAULT_SETTINGS = [
  ['adminMail', '', '접수 알림을 받을 관리자 메일 주소'],
  ['adminPassword', '', '관리자 비밀번호. 처음에는 그대로 입력하면 setup() 또는 첫 로그인 때 자동으로 암호화(해시)됩니다.'],
  ['openAt', '2026-12-10 00:00', '접수 시작 (한국 시간, YYYY-MM-DD HH:mm)'],
  ['deadline', '2027-01-20 16:00', '접수 마감 (한국 시간, YYYY-MM-DD HH:mm)'],
  ['folderId', '', '작품 파일이 저장될 구글 드라이브 폴더 ID (setup()이 자동으로 채움)'],
  ['senderName', '숲속동화문학회', '메일 보낸 사람 이름'],
  ['maxFileMB', '10', '작품 파일 최대 용량(MB)'],
  ['adminPhone', '010-5371-4818', '확인 메일에 적는 문자 문의 번호']
];

var ALLOWED_EXT = ['hwp', 'hwpx'];
var TOKEN_HOURS = 6;
var MAX_LOGIN_FAILS = 5;

/* ------------------------------------------------------------------ */
/*  설치                                                               */
/* ------------------------------------------------------------------ */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var st = ss.getSheetByName(SHEET_SETTINGS) || ss.insertSheet(SHEET_SETTINGS);
  if (st.getLastRow() === 0) {
    st.appendRow(['key', 'value', '설명']);
    st.getRange(2, 1, DEFAULT_SETTINGS.length, 3).setValues(DEFAULT_SETTINGS);
    st.getRange('B:B').setNumberFormat('@');
    st.setFrozenRows(1);
    st.autoResizeColumns(1, 3);
  } else {
    // 빠진 설정만 추가
    var have = getSettings_();
    DEFAULT_SETTINGS.forEach(function (row) {
      if (!(row[0] in have)) st.appendRow(row);
    });
  }

  var ct = ss.getSheetByName(SHEET_CONTENT) || ss.insertSheet(SHEET_CONTENT);
  if (ct.getLastRow() === 0) {
    ct.appendRow(['key', 'value', '수정일시']);
    ct.setFrozenRows(1);
  }

  var et = ss.getSheetByName(SHEET_ENTRIES) || ss.insertSheet(SHEET_ENTRIES);
  if (et.getLastRow() === 0) {
    et.appendRow(ENTRY_HEADERS);
    et.setFrozenRows(1);
    et.getRange(1, 1, 1, ENTRY_HEADERS.length).setFontWeight('bold').setBackground('#e8f3e3');
    et.getRange('A:Q').setNumberFormat('@');
  }

  var s = getSettings_();
  if (!s.folderId) {
    var folder = DriveApp.createFolder('제15회 독후감대회 접수 작품');
    setSetting_('folderId', folder.getId());
  }
  hashPasswordIfPlain_();

  SpreadsheetApp.getUi && safeAlert_('설치가 끝났습니다. 설정 시트에 adminMail과 adminPassword를 입력한 뒤 setup()을 한 번 더 실행하세요.');
}

function safeAlert_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/* ------------------------------------------------------------------ */
/*  웹앱 진입점                                                        */
/* ------------------------------------------------------------------ */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'content';
  try {
    if (action === 'content') return json_(publicContent_());
    return json_({ ok: false, error: '알 수 없는 요청입니다.' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: '요청 형식이 올바르지 않습니다.' });
  }
  try {
    switch (body.action) {
      case 'apply': return json_(apply_(body));
      case 'login': return json_(login_(body));
      case 'logout': return json_(logout_(body));
      case 'saveContent': return json_(saveContent_(body));
      case 'list': return json_(listEntries_(body));
      default: return json_({ ok: false, error: '알 수 없는 요청입니다.' });
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/*  공개 내용                                                          */
/* ------------------------------------------------------------------ */

function publicContent_() {
  var s = getSettings_();
  var now = new Date();
  var openAt = parseKst_(s.openAt);
  var deadline = parseKst_(s.deadline);
  return {
    ok: true,
    content: getContent_(),
    openAt: openAt ? openAt.toISOString() : null,
    deadline: deadline ? deadline.toISOString() : null,
    now: now.toISOString(),
    maxFileMB: Number(s.maxFileMB) || 10
  };
}

function getContent_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONTENT);
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (r[0]) out[String(r[0])] = String(r[1]);
  });
  return out;
}

/* ------------------------------------------------------------------ */
/*  접수                                                               */
/* ------------------------------------------------------------------ */

function apply_(b) {
  if (b.website) return { ok: true, receiptNo: '-' }; // 스팸 방지용 숨은 칸

  var s = getSettings_();
  var now = new Date();
  var openAt = parseKst_(s.openAt);
  var deadline = parseKst_(s.deadline);
  if (openAt && now < openAt) throw new Error('아직 접수 기간이 아닙니다. (' + s.openAt + '부터)');
  if (deadline && now > deadline) throw new Error('접수가 마감되었습니다. (' + s.deadline + ' 마감)');

  var d = {
    name: clean_(b.name, 30),
    grade: clean_(b.grade, 2),
    region: clean_(b.region, 20),
    school: clean_(b.school, 50),
    book: clean_(b.book, 60),
    guardian: clean_(b.guardian, 30),
    phone: String(b.phone || '').replace(/[^0-9]/g, ''),
    email: clean_(b.email, 100).toLowerCase()
  };

  if (!d.name || !d.guardian || !d.region || !d.school || !d.book) throw new Error('필수 항목을 모두 입력해 주세요.');
  if (!/^[1-6]$/.test(d.grade)) throw new Error('학년을 선택해 주세요.');
  if (!/^01[016789][0-9]{7,8}$/.test(d.phone)) throw new Error('보호자 휴대전화 번호를 확인해 주세요.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw new Error('보호자 이메일 주소를 확인해 주세요.');
  if (!(b.agreePrivacy && b.agreeRights && b.agreeOriginal)) throw new Error('필수 동의 항목에 모두 동의해 주세요.');

  var f = b.file || {};
  var ext = String(f.name || '').split('.').pop().toLowerCase();
  if (ALLOWED_EXT.indexOf(ext) < 0) throw new Error('작품은 한글(HWP, HWPX) 파일로 제출해 주세요.');
  if (!f.data) throw new Error('작품 파일을 첨부해 주세요.');
  var bytes = Utilities.base64Decode(f.data);
  var maxMB = Number(s.maxFileMB) || 10;
  if (bytes.length > maxMB * 1024 * 1024) throw new Error('작품 파일은 ' + maxMB + 'MB 이하로 올려 주세요.');

  d.phoneFmt = d.phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
  d.level = Number(d.grade) <= 3 ? '저학년' : '고학년';

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var receiptNo, fileUrl, fileName;
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ENTRIES);
    receiptNo = 'R' + Utilities.formatString('%04d', sh.getLastRow()); // 헤더 1줄 → 첫 접수 R0001

    // 출품 규정의 파일 제목: 지역_학교명_학생명_도서명
    fileName = [d.region, d.school, d.name, d.book].join('_').replace(/[\\/:*?"<>|]/g, '') + '.' + ext;
    var blob = Utilities.newBlob(bytes, 'application/octet-stream', receiptNo + '_' + fileName);
    var folder = DriveApp.getFolderById(s.folderId);
    var file = folder.createFile(blob);
    fileUrl = file.getUrl();

    var stamp = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    var row = [
      receiptNo, stamp, d.name, d.grade + '학년', d.level, d.region, d.school, d.book,
      d.guardian, d.phoneFmt, d.email, file.getName(), fileUrl,
      '동의', '동의', '동의', stamp
    ].map(noFormula_);
    var r = sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  } finally {
    lock.releaseLock();
  }

  d.receiptNo = receiptNo;
  d.fileName = fileName;
  d.fileUrl = fileUrl;
  sendMails_(s, d);

  return { ok: true, receiptNo: receiptNo };
}

function sendMails_(s, d) {
  var sender = s.senderName || '숲속동화문학회';
  var phone = s.adminPhone || '010-5371-4818';
  var rows = [
    ['접수번호', d.receiptNo],
    ['학생 이름', d.name],
    ['학년', d.grade + '학년 (' + d.level + ')'],
    ['지역 / 학교', d.region + ' / ' + d.school],
    ['선택 도서', d.book],
    ['보호자', d.guardian],
    ['휴대전화', d.phoneFmt],
    ['이메일', d.email],
    ['작품 파일', d.fileName]
  ];
  var table = '<table style="border-collapse:collapse;font-size:14px">' + rows.map(function (r) {
    return '<tr><th style="text-align:left;padding:6px 12px;background:#eef6ea;border:1px solid #d5e6cd">' + esc_(r[0]) +
      '</th><td style="padding:6px 12px;border:1px solid #d5e6cd">' + esc_(r[1]) + '</td></tr>';
  }).join('') + '</table>';
  var textRows = rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');

  // 1) 접수자(보호자)에게 확인 메일
  try {
    MailApp.sendEmail({
      to: d.email,
      name: sender,
      subject: '[제15회 전국어린이독후감쓰기 대회] 접수가 완료되었습니다',
      body: '접수가 완료되었습니다.\n\n' + textRows +
        '\n\n수상자 발표: 2027년 2월 4일(목) 16:00\n문의: ' + phone + ' (문자)\n\n' + sender,
      htmlBody: '<div style="font-family:sans-serif;line-height:1.6">' +
        '<h2 style="color:#2f6b3a">접수가 완료되었습니다.</h2>' +
        '<p>' + esc_(d.guardian) + ' 님, ' + esc_(d.name) + ' 학생의 독후감이 잘 접수되었습니다.</p>' + table +
        '<p style="margin-top:16px">수상자 발표: <b>2027년 2월 4일(목) 16:00</b><br>문의: ' + esc_(phone) + ' (문자)</p>' +
        '<p style="color:#888;font-size:12px">이 메일은 발신 전용입니다. ' + esc_(sender) + '</p></div>'
    });
  } catch (e) { console.error('접수자 메일 실패', e); }

  // 2) 관리자에게 알림 메일
  if (s.adminMail) {
    try {
      MailApp.sendEmail({
        to: s.adminMail,
        name: sender,
        subject: '[독후감대회 접수] ' + d.receiptNo + ' ' + d.name + ' (' + d.school + ')',
        body: '접수가 완료되었습니다.\n\n' + textRows + '\n파일 링크: ' + d.fileUrl,
        htmlBody: '<div style="font-family:sans-serif;line-height:1.6"><h2 style="color:#2f6b3a">접수가 완료되었습니다.</h2>' + table +
          '<p><a href="' + esc_(d.fileUrl) + '">작품 파일 열기</a></p></div>'
      });
    } catch (e) { console.error('관리자 메일 실패', e); }
  }
}

/* ------------------------------------------------------------------ */
/*  관리자                                                             */
/* ------------------------------------------------------------------ */

function login_(b) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('loginFails') || 0);
  if (fails >= MAX_LOGIN_FAILS) throw new Error('로그인 시도가 너무 많습니다. 10분 뒤에 다시 시도해 주세요.');

  hashPasswordIfPlain_();
  var stored = getSettings_().adminPassword || '';
  if (!stored) throw new Error('설정 시트에 관리자 비밀번호가 없습니다.');
  if (!b.password || hash_(String(b.password)) !== stored) {
    cache.put('loginFails', String(fails + 1), 600);
    Utilities.sleep(800);
    throw new Error('비밀번호가 맞지 않습니다.');
  }
  cache.remove('loginFails');
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  cache.put('tok_' + token, '1', TOKEN_HOURS * 3600);
  return { ok: true, token: token, hours: TOKEN_HOURS };
}

function logout_(b) {
  if (b.token) CacheService.getScriptCache().remove('tok_' + b.token);
  return { ok: true };
}

function requireAdmin_(b) {
  if (!b.token || !CacheService.getScriptCache().get('tok_' + b.token)) {
    throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  }
}

function saveContent_(b) {
  requireAdmin_(b);
  var key = String(b.key || '');
  if (!/^[a-zA-Z0-9_.-]{1,60}$/.test(key)) throw new Error('잘못된 항목입니다.');
  var value = String(b.value == null ? '' : b.value);
  if (value.length > 20000) throw new Error('내용이 너무 깁니다.');

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONTENT);
  var stamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  var n = sh.getLastRow();
  if (n >= 2) {
    var keys = sh.getRange(2, 1, n - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === key) {
        sh.getRange(i + 2, 2, 1, 2).setValues([[value, stamp]]);
        return { ok: true };
      }
    }
  }
  sh.appendRow([key, value, stamp]);
  return { ok: true };
}

function listEntries_(b) {
  requireAdmin_(b);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ENTRIES);
  var n = sh.getLastRow();
  if (n < 2) return { ok: true, headers: ENTRY_HEADERS, rows: [] };
  var rows = sh.getRange(2, 1, n - 1, ENTRY_HEADERS.length).getDisplayValues();
  return { ok: true, headers: ENTRY_HEADERS, rows: rows };
}

/* ------------------------------------------------------------------ */
/*  도구                                                               */
/* ------------------------------------------------------------------ */

function getSettings_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) {
    if (r[0]) out[String(r[0]).trim()] = String(r[1]).trim();
  });
  return out;
}

function setSetting_(key, value) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  var n = sh.getLastRow();
  var keys = n >= 2 ? sh.getRange(2, 1, n - 1, 1).getValues() : [];
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === key) {
      sh.getRange(i + 2, 2).setNumberFormat('@').setValue(value);
      return;
    }
  }
  sh.appendRow([key, value, '']);
}

/** 설정 시트의 비밀번호가 평문이면 해시로 바꿔 저장합니다. */
function hashPasswordIfPlain_() {
  var pw = getSettings_().adminPassword || '';
  if (pw && pw.indexOf('sha256:') !== 0) setSetting_('adminPassword', hash_(pw));
}

function hash_(pw) {
  var salt = PropertiesService.getScriptProperties().getProperty('pwSalt');
  if (!salt) {
    salt = Utilities.getUuid();
    PropertiesService.getScriptProperties().setProperty('pwSalt', salt);
  }
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw, Utilities.Charset.UTF_8);
  return 'sha256:' + raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** 'YYYY-MM-DD HH:mm' (한국 시간) → Date */
function parseKst_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(s || '').trim());
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], (+m[4] || 0) - 9, +m[5] || 0));
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

/** 시트 수식으로 해석되지 않게 막습니다. */
function noFormula_(v) {
  v = String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
