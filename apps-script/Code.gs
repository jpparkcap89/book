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
  '개인정보 동의', '작품 사용권 동의', '창작 서약', '동의 일시', '수정일시',
  '동의서 파일', '동의서 링크'
];
// 접수목록 열 위치 (0부터)
var COL = { no: 0, date: 1, name: 2, grade: 3, level: 4, region: 5, school: 6, book: 7, guardian: 8, phone: 9, email: 10, fileName: 11, fileUrl: 12, edited: 17, consentName: 18, consentUrl: 19 };

var DEFAULT_SETTINGS = [
  ['adminMail', '', '접수 알림을 받을 관리자 메일 주소'],
  ['adminPassword', '', '관리자 비밀번호. 처음에는 그대로 입력하면 setup() 또는 첫 로그인 때 자동으로 암호화(해시)됩니다.'],
  ['openAt', '2026-12-10 00:00', '접수 시작 (한국 시간, YYYY-MM-DD HH:mm)'],
  ['deadline', '2027-01-20 16:00', '접수 마감 (한국 시간, YYYY-MM-DD HH:mm)'],
  ['folderId', '', '작품 파일이 저장될 구글 드라이브 폴더 ID (setup()이 자동으로 채움)'],
  ['senderName', '숲속동화문학회', '메일 보낸 사람 이름'],
  ['maxFileMB', '10', '작품 파일 최대 용량(MB)'],
  ['adminPhone', '010-5371-4818', '확인 메일에 적는 문자 문의 번호'],
  ['formUrl', '', '출품 양식(한글 파일) 내려받기 주소 (구글 드라이브 공유 링크)'],
  ['consentUrl', '', '개인정보 수집·이용 동의서 내려받기 주소 (구글 드라이브 공유 링크)'],
  ['acceptMode', 'auto', '접수 받기: auto(기간에 따라) / open(지금 열기) / closed(지금 닫기)']
];

var ALLOWED_EXT = ['hwp', 'hwpx', 'pdf', 'doc', 'docx'];      // 독후감: 문서 파일만
var CONSENT_EXT = ['pdf', 'png', 'jpg', 'jpeg'];              // 개인정보 제공 동의서: PDF·그림 파일만
var TOKEN_HOURS = 6;
var MAX_LOGIN_FAILS = 5;
var MAX_LOOKUP_FAILS = 5;   // 같은 이름으로 1시간에 틀릴 수 있는 횟수
var EDIT_MINUTES = 30;      // 접수 확인 뒤 수정할 수 있는 시간

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
    et.getRange('A:T').setNumberFormat('@');
  } else {
    // 새로 생긴 열의 머리글만 채웁니다
    var head = et.getRange(1, 1, 1, ENTRY_HEADERS.length).getValues()[0];
    ENTRY_HEADERS.forEach(function (name, i) {
      if (head[i] === '') et.getRange(1, i + 1).setValue(name).setFontWeight('bold').setBackground('#e8f3e3');
    });
    et.getRange('A:T').setNumberFormat('@');
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
      case 'lookup': return json_(lookup_(body));
      case 'update': return json_(update_(body));
      case 'adminInfo': return json_(adminInfo_(body));
      case 'saveSettings': return json_(saveSettings_(body));
      case 'deleteEntries': return json_(deleteEntries_(body));
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
    maxFileMB: Number(s.maxFileMB) || 10,
    formUrl: safeUrl_(s.formUrl),
    consentUrl: safeUrl_(s.consentUrl),
    acceptMode: acceptMode_(s),
    open: isOpen_(s)
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
  var mode = acceptMode_(s);
  if (mode === 'closed') throw new Error('지금은 접수를 받지 않습니다.');
  if (mode === 'auto' && openAt && now < openAt) throw new Error('아직 접수 기간이 아닙니다. (' + s.openAt + '부터)');
  if (mode === 'auto' && deadline && now > deadline) throw new Error('접수가 마감되었습니다. (' + s.deadline + ' 마감)');

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
  if (ALLOWED_EXT.indexOf(ext) < 0) throw new Error('독후감은 한글(HWP, HWPX), PDF, 워드(DOC, DOCX) 문서로 올려 주세요.');
  if (!f.data) throw new Error('독후감 파일을 첨부해 주세요.');
  var bytes = Utilities.base64Decode(f.data);
  var maxMB = Number(s.maxFileMB) || 10;
  if (bytes.length > maxMB * 1024 * 1024) throw new Error('독후감 파일은 ' + maxMB + 'MB 이하로 올려 주세요.');

  // 개인정보 제공 동의서(보호자 서명)는 PDF나 그림 파일로 따로 받습니다
  var cf = b.consentFile || {};
  if (!cf.data) throw new Error('개인정보 제공 동의서 파일을 첨부해 주세요.');
  var cext = String(cf.name || '').split('.').pop().toLowerCase();
  if (CONSENT_EXT.indexOf(cext) < 0) throw new Error('개인정보 제공 동의서는 PDF나 그림(PNG, JPG) 파일로 올려 주세요.');
  var cbytes = Utilities.base64Decode(cf.data);
  if (cbytes.length > maxMB * 1024 * 1024) throw new Error('개인정보 제공 동의서는 ' + maxMB + 'MB 이하로 올려 주세요.');

  d.phoneFmt = d.phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
  d.level = Number(d.grade) <= 3 ? '저학년' : '고학년';

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var receiptNo, fileUrl, fileName;
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ENTRIES);
    receiptNo = nextReceiptNo_(sh); // 지금 있는 가장 큰 번호 + 1 (모두 지우면 R0001부터)

    // 출품 규정의 파일 제목: 지역_학교명_학생명_도서명
    // 파일 이름: 독후감_지역_학년_학생이름 / 개인정보제공동의서_지역_학년_학생이름
    fileName = fileBase_('독후감', d) + '.' + ext;
    var blob = Utilities.newBlob(bytes, 'application/octet-stream', fileName);
    var folder = DriveApp.getFolderById(s.folderId);
    var file = folder.createFile(blob);
    fileUrl = file.getUrl();
    var cfile = folder.createFile(Utilities.newBlob(cbytes, 'application/octet-stream', fileBase_('개인정보제공동의서', d) + '.' + cext));

    var stamp = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    var row = [
      receiptNo, stamp, d.name, d.grade + '학년', d.level, d.region, d.school, d.book,
      d.guardian, d.phoneFmt, d.email, file.getName(), fileUrl,
      '동의', '동의', '동의', stamp, '', cfile ? cfile.getName() : '', cfile ? cfile.getUrl() : ''
    ].map(noFormula_);
    var r = sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  } finally {
    lock.releaseLock();
  }

  d.receiptNo = receiptNo;
  d.fileName = fileName;
  d.fileUrl = fileUrl;
  d.consentName = cfile ? cfile.getName().replace(/^R\d+_/, '') : '';
  d.consentUrl = cfile ? cfile.getUrl() : '';
  sendMails_(s, d);

  return { ok: true, receiptNo: receiptNo };
}

function sendMails_(s, d, edited) {
  var sender = s.senderName || '숲속동화문학회';
  var phone = s.adminPhone || '010-5371-4818';
  var title = edited ? '접수 내용이 수정되었습니다' : '접수가 완료되었습니다';
  var howEdit = '접수 내용을 고치려면 book.cap89.com → 접수하기 → "접수 확인·수정"에서 학생 이름과 보호자 휴대전화 뒷 4자리를 넣으세요. (접수 기간 안에만 고칠 수 있습니다)';
  var rows = [
    ['접수번호', d.receiptNo],
    ['학생 이름', d.name],
    ['학년', d.grade + '학년 (' + d.level + ')'],
    ['지역 / 학교', d.region + ' / ' + d.school],
    ['선택 도서', d.book],
    ['보호자', d.guardian],
    ['휴대전화', d.phoneFmt],
    ['이메일', d.email],
    ['독후감 파일', d.fileName],
    ['개인정보 제공 동의서', d.consentName || '-']
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
      subject: '[제15회 전국어린이독후감쓰기 대회] ' + title,
      body: title + '.\n\n' + textRows +
        '\n\n' + howEdit +
        '\n\n수상자 발표: 2027년 2월 4일(목) 16:00\n문의: ' + phone + ' (문자)\n\n' + sender,
      htmlBody: '<div style="font-family:sans-serif;line-height:1.6">' +
        '<h2 style="color:#3b63f6">' + title + '.</h2>' +
        '<p>' + esc_(d.guardian) + ' 님, ' + esc_(d.name) + ' 학생의 독후감이 잘 ' + (edited ? '수정' : '접수') + '되었습니다.</p>' + table +
        '<p style="margin-top:16px;color:#555;font-size:13px">' + esc_(howEdit) + '</p>' +
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
        subject: '[독후감대회 ' + (edited ? '수정' : '접수') + '] ' + d.receiptNo + ' ' + d.name + ' (' + d.school + ')',
        body: title + '.\n\n' + textRows + '\n파일 링크: ' + d.fileUrl,
        htmlBody: '<div style="font-family:sans-serif;line-height:1.6"><h2 style="color:#3b63f6">' + title + '.</h2>' + table +
          '<p><a href="' + esc_(d.fileUrl) + '">작품 파일 열기</a>' + (d.consentUrl ? ' · <a href="' + esc_(d.consentUrl) + '">개인정보 동의서 열기</a>' : '') + '</p></div>'
      });
    } catch (e) { console.error('관리자 메일 실패', e); }
  }
}

/* ------------------------------------------------------------------ */
/*  접수 확인·수정 (학생 이름 + 보호자 휴대전화 뒷 4자리)              */
/* ------------------------------------------------------------------ */

function lookup_(b) {
  var name = clean_(b.name, 30);
  var last4 = String(b.last4 || '').replace(/[^0-9]/g, '');
  if (!name || !/^\d{4}$/.test(last4)) throw new Error('학생 이름과 휴대전화 뒷 4자리를 입력해 주세요.');

  // 같은 이름으로 뒷자리를 하나씩 넣어 보는 것을 막습니다
  var cache = CacheService.getScriptCache();
  var key = 'lk_' + digestHex_(name);
  var fails = Number(cache.get(key) || 0);
  if (fails >= MAX_LOOKUP_FAILS) throw new Error('확인 시도가 너무 많습니다. 1시간 뒤에 다시 시도해 주세요.');

  var rows = entryRows_();
  var found = [];
  rows.forEach(function (r) {
    if (String(r[COL.name]).trim() === name && String(r[COL.phone]).replace(/\D/g, '').slice(-4) === last4) {
      found.push(r);
    }
  });
  if (!found.length) {
    cache.put(key, String(fails + 1), 3600);
    Utilities.sleep(600);
    throw new Error('일치하는 접수가 없습니다. 학생 이름과 휴대전화 뒷 4자리를 확인해 주세요.');
  }
  cache.remove(key);

  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('ed_' + token, JSON.stringify(found.map(function (r) { return r[COL.no]; })), EDIT_MINUTES * 60);

  var s = getSettings_();
  return {
    ok: true,
    editToken: token,
    minutes: EDIT_MINUTES,
    canEdit: isOpen_(s),
    entries: found.map(function (r) {
      return {
        receiptNo: r[COL.no],
        date: r[COL.date],
        edited: r[COL.edited] || '',
        name: r[COL.name],
        grade: String(r[COL.grade]).replace(/\D/g, ''),
        region: r[COL.region],
        school: r[COL.school],
        book: r[COL.book],
        guardian: r[COL.guardian],
        phoneMasked: maskPhone_(r[COL.phone]),
        emailMasked: maskEmail_(r[COL.email]),
        fileName: r[COL.fileName],
        consentName: r[COL.consentName] || ''
      };
    })
  };
}

function update_(b) {
  var cache = CacheService.getScriptCache();
  var allowed = JSON.parse(cache.get('ed_' + String(b.editToken || '')) || '[]');
  var receiptNo = String(b.receiptNo || '');
  if (allowed.indexOf(receiptNo) < 0) throw new Error('확인 시간이 지났습니다. 이름과 휴대전화 뒷 4자리로 다시 확인해 주세요.');

  var s = getSettings_();
  if (!isOpen_(s)) throw new Error('접수 기간이 아니라서 수정할 수 없습니다.');

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
  if (d.phone && !/^01[016789][0-9]{7,8}$/.test(d.phone)) throw new Error('보호자 휴대전화 번호를 확인해 주세요.');
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw new Error('보호자 이메일 주소를 확인해 주세요.');

  var f = b.file || null, bytes = null, ext = '';
  if (f && f.data) {
    ext = String(f.name || '').split('.').pop().toLowerCase();
    if (ALLOWED_EXT.indexOf(ext) < 0) throw new Error('독후감은 한글(HWP, HWPX), PDF, 워드(DOC, DOCX) 문서로 올려 주세요.');
    bytes = Utilities.base64Decode(f.data);
    var maxMB = Number(s.maxFileMB) || 10;
    if (bytes.length > maxMB * 1024 * 1024) throw new Error('독후감 파일은 ' + maxMB + 'MB 이하로 올려 주세요.');
  }
  var cf = b.consentFile || null, cbytes = null, cext = '';
  if (cf && cf.data) {
    cext = String(cf.name || '').split('.').pop().toLowerCase();
    if (CONSENT_EXT.indexOf(cext) < 0) throw new Error('개인정보 제공 동의서는 PDF나 그림(PNG, JPG) 파일로 올려 주세요.');
    cbytes = Utilities.base64Decode(cf.data);
    if (cbytes.length > (Number(s.maxFileMB) || 10) * 1024 * 1024) throw new Error('개인정보 제공 동의서는 ' + (Number(s.maxFileMB) || 10) + 'MB 이하로 올려 주세요.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ENTRIES);
    var n = sh.getLastRow();
    var ids = n >= 2 ? sh.getRange(2, 1, n - 1, 1).getDisplayValues() : [];
    var rowIdx = -1;
    for (var i = 0; i < ids.length; i++) if (ids[i][0] === receiptNo) { rowIdx = i + 2; break; }
    if (rowIdx < 0) throw new Error('접수를 찾지 못했습니다.');
    var old = sh.getRange(rowIdx, 1, 1, ENTRY_HEADERS.length).getDisplayValues()[0];

    var phoneFmt = d.phone ? d.phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3') : old[COL.phone];
    var email = d.email || old[COL.email];
    var level = Number(d.grade) <= 3 ? '저학년' : '고학년';
    var baseName = fileBase_('독후감', d);
    var fileName = old[COL.fileName], fileUrl = old[COL.fileUrl];
    var oldFile = null;
    var m = /\/d\/([^/]+)/.exec(fileUrl);
    if (m) { try { oldFile = DriveApp.getFileById(m[1]); } catch (e) { oldFile = null; } }

    if (bytes) {
      // 새 작품 파일을 올리고, 예전 파일은 휴지통으로 보냅니다
      var file = DriveApp.getFolderById(s.folderId).createFile(Utilities.newBlob(bytes, 'application/octet-stream', baseName + '.' + ext));
      if (oldFile) oldFile.setTrashed(true);
      fileName = file.getName();
      fileUrl = file.getUrl();
    } else if (oldFile) {
      // 지역·학년·이름·도서가 바뀌면 파일 제목도 맞춰 바꿉니다
      var oldExt = String(fileName).split('.').pop();
      oldFile.setName(baseName + '.' + oldExt);
      fileName = oldFile.getName();
    }

    var stamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    var vals = [d.name, d.grade + '학년', level, d.region, d.school, d.book, d.guardian, phoneFmt, email, fileName, fileUrl].map(noFormula_);
    sh.getRange(rowIdx, COL.name + 1, 1, vals.length).setNumberFormat('@').setValues([vals]);
    sh.getRange(rowIdx, COL.edited + 1).setNumberFormat('@').setValue(stamp);

    var consentName = old[COL.consentName], consentUrl = old[COL.consentUrl];
    if (cbytes) {
      var oc = /\/d\/([^/]+)/.exec(consentUrl || '');
      if (oc) { try { DriveApp.getFileById(oc[1]).setTrashed(true); } catch (e) {} }
      var nc = DriveApp.getFolderById(s.folderId).createFile(Utilities.newBlob(cbytes, 'application/octet-stream', fileBase_('개인정보제공동의서', d) + '.' + cext));
      consentName = nc.getName(); consentUrl = nc.getUrl();
      sh.getRange(rowIdx, COL.consentName + 1, 1, 2).setNumberFormat('@').setValues([[consentName, consentUrl].map(noFormula_)]);
    } else {
      var ocm = /\/d\/([^/]+)/.exec(consentUrl || '');
      if (ocm) {
        try {
          var ocf = DriveApp.getFileById(ocm[1]);
          ocf.setName(fileBase_('개인정보제공동의서', d) + '.' + String(consentName).split('.').pop());
          consentName = ocf.getName();
          sh.getRange(rowIdx, COL.consentName + 1).setNumberFormat('@').setValue(noFormula_(consentName));
        } catch (e) {}
      }
    }
  } finally {
    lock.releaseLock();
  }

  d.receiptNo = receiptNo;
  d.level = level;
  d.phoneFmt = phoneFmt;
  d.email = email;
  d.fileName = fileName.replace(/^R\d+_/, '');
  d.fileUrl = fileUrl;
  d.consentName = String(consentName || '').replace(/^R\d+_/, '');
  d.consentUrl = consentUrl;
  sendMails_(s, d, true);
  return { ok: true, receiptNo: receiptNo };
}

function entryRows_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ENTRIES);
  var n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, ENTRY_HEADERS.length).getDisplayValues()
    .filter(function (r) { return String(r[COL.no]).trim() !== ''; });
}

function acceptMode_(s) {
  var m = String(s.acceptMode || 'auto').trim().toLowerCase();
  return m === 'open' || m === 'closed' ? m : 'auto';
}

function isOpen_(s) {
  var mode = acceptMode_(s);
  if (mode === 'open') return true;
  if (mode === 'closed') return false;
  var now = new Date(), openAt = parseKst_(s.openAt), deadline = parseKst_(s.deadline);
  return !(openAt && now < openAt) && !(deadline && now > deadline);
}

/* ------------------------------------------------------------------ */
/*  관리 페이지                                                        */
/* ------------------------------------------------------------------ */

function adminInfo_(b) {
  requireAdmin_(b);
  var s = getSettings_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rows = entryRows_();
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var stats = { total: rows.length, low: 0, high: 0, today: 0, noConsent: 0 };
  rows.forEach(function (r) {
    if (r[COL.level] === '저학년') stats.low++; else if (r[COL.level] === '고학년') stats.high++;
    if (String(r[COL.date]).indexOf(today) === 0) stats.today++;
    if (!r[COL.consentUrl]) stats.noConsent++;
  });
  var folderUrl = '';
  try { if (s.folderId) folderUrl = DriveApp.getFolderById(s.folderId).getUrl(); } catch (e) { folderUrl = ''; }
  return {
    ok: true,
    acceptMode: acceptMode_(s),
    open: isOpen_(s),
    openAt: s.openAt || '',
    deadline: s.deadline || '',
    consentUrl: s.consentUrl || '',
    formUrl: s.formUrl || '',
    maxFileMB: Number(s.maxFileMB) || 10,
    adminMail: s.adminMail || '',
    links: {
      folder: folderUrl,
      sheet: ss.getUrl(),
      script: 'https://script.google.com/d/' + ScriptApp.getScriptId() + '/edit'
    },
    stats: stats
  };
}

function saveSettings_(b) {
  requireAdmin_(b);
  var v = b.values || {};
  var out = {};
  if ('acceptMode' in v) {
    var m = String(v.acceptMode);
    if (['auto', 'open', 'closed'].indexOf(m) < 0) throw new Error('접수 상태 값이 올바르지 않습니다.');
    out.acceptMode = m;
  }
  ['openAt', 'deadline'].forEach(function (k) {
    if (!(k in v)) return;
    var t = String(v[k]).trim().replace('T', ' ');
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(t) || !parseKst_(t)) throw new Error('날짜 형식이 올바르지 않습니다. (예: 2026-12-10 00:00)');
    out[k] = t;
  });
  if (out.openAt && out.deadline && parseKst_(out.openAt) >= parseKst_(out.deadline)) throw new Error('접수 시작이 마감보다 앞서야 합니다.');
  ['consentUrl', 'formUrl'].forEach(function (k) {
    if (!(k in v)) return;
    var u = String(v[k]).trim();
    if (u && !safeUrl_(u)) throw new Error('주소는 https:// 로 시작해야 합니다.');
    out[k] = u;
  });
  if ('maxFileMB' in v) {
    var mb = Number(v.maxFileMB);
    if (!(mb >= 1 && mb <= 20)) throw new Error('파일 최대 용량은 1~20MB 사이로 정해 주세요.');
    out.maxFileMB = String(Math.round(mb));
  }
  Object.keys(out).forEach(function (k) { setSetting_(k, out[k]); });
  return adminInfo_(b);
}

function safeUrl_(u) {
  u = String(u || '').trim();
  return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '';
}

function maskPhone_(p) {
  var d = String(p).replace(/\D/g, '');
  return d.length >= 10 ? d.slice(0, 3) + '-****-' + d.slice(-4) : '****';
}

function maskEmail_(e) {
  var parts = String(e).split('@');
  if (parts.length !== 2) return '***';
  return parts[0].slice(0, 1) + '***@' + parts[1];
}

function digestHex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
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
  var rows = sh.getRange(2, 1, n - 1, ENTRY_HEADERS.length).getDisplayValues()
    .filter(function (r) { return String(r[COL.no]).trim() !== ''; }); // 비어 있는 줄은 빼고 보냅니다
  return { ok: true, headers: ENTRY_HEADERS, rows: rows };
}

/** 접수 삭제: 시트에서 줄을 지우고, 작품·동의서 파일은 드라이브 휴지통으로 보냅니다(30일 안에 되살릴 수 있음). */
function deleteEntries_(b) {
  requireAdmin_(b);
  var want = (b.receiptNos || []).map(String).filter(function (x) { return /^R\d+$/.test(x); });
  if (!want.length) throw new Error('삭제할 접수를 골라 주세요.');
  if (want.length > 200) throw new Error('한 번에 200건까지 지울 수 있어요.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var deleted = [], trashed = 0;
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ENTRIES);
    var n = sh.getLastRow();
    if (n < 2) return { ok: true, deleted: [], trashed: 0 };
    var rows = sh.getRange(2, 1, n - 1, ENTRY_HEADERS.length).getDisplayValues();
    // 아래 줄부터 지워야 위쪽 줄 번호가 밀리지 않습니다
    for (var i = rows.length - 1; i >= 0; i--) {
      var r = rows[i];
      if (want.indexOf(String(r[COL.no])) < 0) continue;
      [r[COL.fileUrl], r[COL.consentUrl]].forEach(function (u) {
        var m = /\/d\/([^/]+)/.exec(u || '');
        if (m) { try { DriveApp.getFileById(m[1]).setTrashed(true); trashed++; } catch (e) { console.error('파일 휴지통 이동 실패', u, e); } }
      });
      sh.deleteRow(i + 2);
      deleted.push(String(r[COL.no]));
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: true, deleted: deleted, trashed: trashed };
}

// 개인정보제공동의서_지역_학년_학생이름 / 독후감_지역_학년_학생이름_도서명
function fileBase_(kind, d) {
  var parts = [kind, d.region, d.grade + '학년', d.name];
  if (kind === '독후감') parts.push(d.book);
  return parts.join('_').replace(/[\\/:*?"<>|]/g, '').trim();
}

function nextReceiptNo_(sh) {
  var n = sh.getLastRow(), max = 0;
  if (n >= 2) sh.getRange(2, 1, n - 1, 1).getDisplayValues().forEach(function (r) {
    var m = /^R(\d+)$/.exec(String(r[0]).trim());
    if (m) max = Math.max(max, Number(m[1]));
  });
  return 'R' + Utilities.formatString('%04d', max + 1);
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
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(String(s || '').trim());
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
