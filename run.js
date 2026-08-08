// ==UserScript==
// @name         Zeta Capture Mask (이름/프사 가리기)
// @namespace    https://github.com/leemango/zeta-userscripts
// @version      1.0
// @description  캡처 시 {{char}}/{{user}} 이름, 프로필 사진을 검은 박스로 덮어서 가림 (프로필/말풍선/나레이터 전부)
// @author       이망고
// @match        https://zeta-ai.io/*
// @match        https://*.zeta-ai.io/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ============================================================
   * ⚙️ CONFIG — devtools로 실제 클래스/testid 확인해서 여기 채워넣기
   * (우클릭 → 검사, 이름/프사 요소 위에서 클래스명 확인)
   * 지금은 일반적으로 흔히 쓰이는 패턴들로 추측해서 넣어둠.
   * 안 먹히는 selector는 지워도 되고, 새로 찾은 selector는 배열에 추가.
   * ============================================================ */
  const CONFIG = {
    // 프사/아바타 이미지 — {{char}}/{{user}} 모두 alt="OO 프로필 이미지" 패턴 (실제 확인됨)
    avatarSelectors: [
      'img[alt$="프로필 이미지"]',
    ],
    // 말풍선 발화자 이름 — caption1 + 색상클래스 조합으로만 매칭 (나레이션/날짜 텍스트는 caption1이 없어서 자동 제외됨, 실제 확인됨)
    nameSelectors: [
      '[class*="caption1"][class*="text-white/70"]',
      '[class*="caption1"][class*="text-primary-200/70"]',
    ],
    // 나레이터 박스 안의 이름/헤더 (INFO_BOX류) — 아직 미확인, 추측치. 안 맞으면 엘리먼트 피커로 확인 필요
    narratorSelectors: [
      '[class*="narrator" i] [class*="name" i]',
      '[class*="info-box" i] [class*="name" i]',
      '[class*="InfoBox" i] [class*="name" i]',
    ],
    // 프로필 패널 상단 헤더 (채팅방 진입 시 보이는 캐릭터 프로필 카드) — 아직 미확인, 추측치
    profileHeaderSelectors: [
      '[class*="chat-header" i] [class*="name" i]',
      '[class*="ChatHeader" i] [class*="name" i]',
      '[class*="profile-header" i]',
    ],
    // 말풍선 지문/대사 텍스트 안에 이름이 그냥 섞여 있는 경우 자동 투명화.
    // 이름은 프사 alt(예: "차강혁 프로필 이미지")와 이름표(caption1) 텍스트에서 자동으로 수집됨.
    // 나레이션에만 나오고 프사/이름표엔 안 나오는 별명 등을 추가로 가리고 싶으면 여기 수동 추가.
    namesToMask: [
    ],
  };

  const STYLE_ID = 'zetaCaptureMaskStyle';
  const BODY_CLASS = 'zeta-capture-mode';
  const BTN_POS_KEY = 'zetaCaptureMaskBtnPos';

  function buildSelectorList(keys) {
    return keys.flatMap((k) => CONFIG[k]);
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const avatarImgSel = buildSelectorList(['avatarSelectors'])
      .map((s) => `body.${BODY_CLASS} ${s}`)
      .join(',\n');

    const nameSel = buildSelectorList(['nameSelectors', 'narratorSelectors', 'profileHeaderSelectors'])
      .map((s) => `body.${BODY_CLASS} ${s}`)
      .join(',\n');

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* 프사: <img>는 opacity:0으로 투명화 (검은 박스 없이 완전히 사라지는 스타일) */
      ${avatarImgSel} {
        opacity: 0 !important;
      }

      /* 이름/닉네임: 텍스트만 투명화 (검은 박스 없이 사라지는 스타일) */
      ${nameSel} {
        color: transparent !important;
      }

      /* 플로팅 토글 버튼 */
      #zetaCaptureMaskBtn {
        position: fixed;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #1a1a1a;
        color: #fff;
        border: 2px solid #444;
        font-size: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        z-index: 2147483647;
        user-select: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        transition: background 0.15s, border-color 0.15s;
      }
      #zetaCaptureMaskBtn.active {
        background: #d0293e;
        border-color: #ff5470;
      }
      #zetaCaptureMaskBtn:active {
        cursor: grabbing;
      }
    `;
    document.head.appendChild(style);
  }

  function showToast(msg) {
    let t = document.getElementById('zetaCaptureMaskToast');
    if (t) t.remove();
    t = document.createElement('div');
    t.id = 'zetaCaptureMaskToast';
    t.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);' +
      'background:#111;color:#0f0;font:12px/1.5 monospace;padding:10px 14px;' +
      'border-radius:8px;z-index:2147483647;white-space:pre-line;max-width:90vw;' +
      'border:1px solid #444;box-shadow:0 2px 10px rgba(0,0,0,0.5);';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  function debugCounts() {
    const avatar = buildSelectorList(['avatarSelectors']);
    const name = buildSelectorList(['nameSelectors', 'narratorSelectors', 'profileHeaderSelectors']);
    let lines = [];
    avatar.forEach((s) => {
      let n = 0;
      try { n = document.querySelectorAll(s).length; } catch (e) { n = -1; }
      lines.push(`아바타 ${n}개: ${s}`);
    });
    name.forEach((s) => {
      let n = 0;
      try { n = document.querySelectorAll(s).length; } catch (e) { n = -1; }
      lines.push(`이름 ${n}개: ${s}`);
    });
    const allNames = [...new Set([...CONFIG.namesToMask.filter(Boolean), ...detectedNames])];
    lines.push(`자동감지된 이름: ${allNames.join(', ') || '(없음)'}`);
    lines.push(`인라인 텍스트 이름 ${document.querySelectorAll('.zeta-inline-name-mask').length}개`);
    return lines.join('\n');
  }

  let rescanInterval = null;

  function toggleMask(btn) {
    const on = document.body.classList.toggle(BODY_CLASS);
    btn.classList.toggle('active', on);
    btn.textContent = on ? '🙈' : '🐵';
    btn.title = on ? '가리기 켜짐 (클릭하면 해제)' : '가리기 꺼짐 (클릭하면 가림)';

    document.querySelectorAll('.zeta-inline-name-mask').forEach(setSpanMaskedState);

    if (on) {
      harvestNames();
      scanForNames(document.body);
      document.querySelectorAll('.zeta-inline-name-mask').forEach(setSpanMaskedState);
      if (!rescanInterval) {
        rescanInterval = setInterval(() => {
          harvestNames();
          scanForNames(document.body);
          document.querySelectorAll('.zeta-inline-name-mask').forEach(setSpanMaskedState);
        }, 500);
      }
    } else if (rescanInterval) {
      clearInterval(rescanInterval);
      rescanInterval = null;
    }
  }

  const detectedNames = new Set();
  const AVATAR_ALT_SUFFIX = /\s*프로필\s*이미지$/;
  const MAX_NAME_LEN = 12;

  function harvestNames() {
    const add = (raw) => {
      const name = raw && raw.trim();
      if (!name || name.length > MAX_NAME_LEN) return;
      detectedNames.add(name);
      // 성 한 글자를 뗀 축약형도 함께 등록 (예: "차강혁" → "강혁"). 2글자 이하 이름엔 적용 안 함.
      if (name.length >= 3) {
        detectedNames.add(name.slice(1));
      }
    };

    buildSelectorList(['avatarSelectors']).forEach((sel) => {
      let els;
      try { els = document.querySelectorAll(sel); } catch (e) { return; }
      els.forEach((img) => {
        const alt = img.getAttribute && img.getAttribute('alt');
        if (!alt || !AVATAR_ALT_SUFFIX.test(alt)) return;
        add(alt.replace(AVATAR_ALT_SUFFIX, ''));
      });
    });

    buildSelectorList(['nameSelectors']).forEach((sel) => {
      let els;
      try { els = document.querySelectorAll(sel); } catch (e) { return; }
      els.forEach((el) => add(el.textContent));
    });
  }

  function shouldSkipNode(node) {
    let el = node.nodeType === 3 ? node.parentElement : node;
    const labelSelectors = buildSelectorList(['nameSelectors', 'narratorSelectors', 'profileHeaderSelectors']);
    while (el) {
      if (
        el.id === 'zetaCaptureMaskBtn' ||
        el.id === 'zetaCaptureMaskToast' ||
        el.id === 'zetaElemPickerOverlay'
      ) return true;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return true;
      if (el.classList && el.classList.contains('zeta-inline-name-mask')) return true;
      // 이름표(caption1 등)는 이미 CSS로 투명화 처리되니 인라인 스캐너가 또 건드리면 안 됨
      if (el.nodeType === 1 && labelSelectors.some((sel) => {
        try { return el.matches(sel); } catch (e) { return false; }
      })) return true;
      el = el.parentElement;
    }
    return false;
  }

  function buildNameRegex() {
    const names = [...new Set([...CONFIG.namesToMask.filter(Boolean), ...detectedNames])];
    if (!names.length) return null;
    const sorted = [...names].sort((a, b) => b.length - a.length);
    const escaped = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp('(' + escaped.join('|') + ')', 'g');
  }

  function setSpanMaskedState(span) {
    const on = document.body.classList.contains(BODY_CLASS);
    const original = span.dataset.zetaOriginal != null ? span.dataset.zetaOriginal : span.textContent;
    span.dataset.zetaOriginal = original;
    span.textContent = on ? '■'.repeat(original.length) : original;
  }

  function maskNamesInTextNode(textNode, re) {
    if (!textNode || !textNode.parentNode) return;
    const text = textNode.nodeValue;
    if (!text) return;
    re.lastIndex = 0;
    if (!re.test(text)) return;
    re.lastIndex = 0;

    const parts = text.split(re);
    if (parts.length <= 1) return;

    const names = [...new Set([...CONFIG.namesToMask.filter(Boolean), ...detectedNames])];
    const parentEl = textNode.parentNode;
    let computedWeight = null;
    let computedColor = null;
    if (parentEl && parentEl.nodeType === 1 && window.getComputedStyle) {
      const cs = window.getComputedStyle(parentEl);
      computedWeight = cs.fontWeight;
      computedColor = cs.color;
    }

    const frag = document.createDocumentFragment();
    parts.forEach((part) => {
      if (names.includes(part)) {
        const span = document.createElement('span');
        span.className = 'zeta-inline-name-mask';
        span.dataset.zetaOriginal = part;
        if (computedWeight) span.style.setProperty('font-weight', computedWeight, 'important');
        if (computedColor) span.style.setProperty('color', computedColor, 'important');
        setSpanMaskedState(span);
        frag.appendChild(span);
      } else if (part) {
        frag.appendChild(document.createTextNode(part));
      }
    });
    textNode.parentNode.replaceChild(frag, textNode);
  }

  function scanForNames(root) {
    const re = buildNameRegex();
    if (!re || !root) return;
    if (root.nodeType === 3) {
      if (!shouldSkipNode(root)) maskNamesInTextNode(root, re);
      return;
    }
    if (root.nodeType !== 1) return;
    if (shouldSkipNode(root)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return shouldSkipNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach((node) => maskNamesInTextNode(node, re));
  }

  function loadBtnPos() {
    try {
      const raw = localStorage.getItem(BTN_POS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { right: 20, bottom: 100 };
  }

  function saveBtnPos(pos) {
    try {
      localStorage.setItem(BTN_POS_KEY, JSON.stringify(pos));
    } catch (e) {}
  }

  function createButton() {
    if (document.getElementById('zetaCaptureMaskBtn')) return;

    const btn = document.createElement('div');
    btn.id = 'zetaCaptureMaskBtn';
    btn.textContent = '🐵';
    btn.title = '클릭: 가리기 켜기/끄기 (드래그: 위치 이동)';

    const pos = loadBtnPos();
    if (pos.left != null) btn.style.left = pos.left + 'px';
    else btn.style.right = pos.right + 'px';
    if (pos.top != null) btn.style.top = pos.top + 'px';
    else btn.style.bottom = pos.bottom + 'px';

    document.body.appendChild(btn);

    // 드래그 + 클릭 구분
    let dragging = false;
    let moved = false;
    let startX, startY;

    btn.addEventListener('pointerdown', (e) => {
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      btn.setPointerCapture(e.pointerId);
    });

    btn.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      if (!moved) return;

      const rect = btn.getBoundingClientRect();
      let newLeft = rect.left + dx;
      let newTop = rect.top + dy;

      newLeft = Math.max(4, Math.min(window.innerWidth - rect.width - 4, newLeft));
      newTop = Math.max(4, Math.min(window.innerHeight - rect.height - 4, newTop));

      btn.style.left = newLeft + 'px';
      btn.style.top = newTop + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';

      startX = e.clientX;
      startY = e.clientY;
    });

    btn.addEventListener('pointerup', (e) => {
      dragging = false;
      if (!moved) {
        toggleMask(btn);
      } else {
        const rect = btn.getBoundingClientRect();
        saveBtnPos({ left: rect.left, top: rect.top });
      }
      btn.releasePointerCapture(e.pointerId);
    });
  }

  function init() {
    injectStyle();
    createButton();
    harvestNames();
    scanForNames(document.body);
  }

  init();

  // SPA 라우팅/새 메시지 추가/스트리밍 텍스트 변경 감지
  const observer = new MutationObserver((mutations) => {
    if (!document.getElementById('zetaCaptureMaskBtn')) {
      createButton();
    }
    if (!document.getElementById(STYLE_ID)) {
      injectStyle();
    }
    harvestNames();
    mutations.forEach((m) => {
      if (m.type === 'childList') {
        m.addedNodes.forEach((node) => scanForNames(node));
      } else if (m.type === 'characterData') {
        scanForNames(m.target);
      }
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
