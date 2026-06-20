// Global App State
let scriptureData = [];
let currentPage = 1;
let totalPages = 29;
let isVertical = false;
let isEditMode = false;
let showZhuyin = true;
let chantCount = 0;
let editedZhuyinMap = {};

// Current active character being edited
let activeEditInfo = null; // { page, colIdx, charIdx, char }

// Audio API State
let audioCtx = null; // Used for Chime synthesis
let audioEnabled = false;
let currentAudioType = 'none'; // 'none', 'rain', 'stream'

// DOM Elements
const scriptureContent = document.getElementById('scriptureContent');
const pageSelect = document.getElementById('pageSelect');
const totalPagesSpan = document.getElementById('totalPages');
const btnPrevPage = document.getElementById('btnPrevPage');
const btnNextPage = document.getElementById('btnNextPage');
const pageSelectBottom = document.getElementById('pageSelectBottom');
const totalPagesSpanBottom = document.getElementById('totalPagesBottom');
const btnPrevPageBottom = document.getElementById('btnPrevPageBottom');
const btnNextPageBottom = document.getElementById('btnNextPageBottom');
const toggleZhuyin = document.getElementById('toggleZhuyin');
const toggleLayout = document.getElementById('toggleLayout');
const toggleEditMode = document.getElementById('toggleEditMode');
const selectAudio = document.getElementById('selectAudio');
const audioStatus = document.getElementById('audioStatus');
const counterVal = document.getElementById('counterVal');
const btnDec = document.getElementById('btnDec');
const btnInc = document.getElementById('btnInc');
const btnReset = document.getElementById('btnReset');
const btnExport = document.getElementById('btnExport');
const btnResetData = document.getElementById('btnResetData');
const fontSizeRange = document.getElementById('fontSizeRange');
const fontSizeDisplay = document.getElementById('fontSizeDisplay');
const btnBackToTop = document.getElementById('btnBackToTop');

// Modal Elements
const editModal = document.getElementById('editModal');
const editChar = document.getElementById('editChar');
const editCurrentZhuyin = document.getElementById('editCurrentZhuyin');
const inputZhuyin = document.getElementById('inputZhuyin');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const btnSaveEdit = document.getElementById('btnSaveEdit');
const btnDeleteZhuyin = document.getElementById('btnDeleteZhuyin');

/* --- Initialize Application --- */
window.addEventListener('DOMContentLoaded', () => {
  loadLocalStorage();
  toggleLayout.textContent = isVertical ? '切換為橫書' : '切換為直書';
  loadScriptureData();
  setupEventListeners();
  setupKeyboardHelper();
});

// Load saved preferences from localStorage
function loadLocalStorage() {
  chantCount = parseInt(localStorage.getItem('yushu_chant_count') || '0');
  counterVal.textContent = chantCount;
  
  const savedEdits = localStorage.getItem('yushu_edited_zhuyin');
  if (savedEdits) {
    try {
      editedZhuyinMap = JSON.parse(savedEdits);
    } catch (e) {
      editedZhuyinMap = {};
    }
  }
  
  const savedFontSize = localStorage.getItem('yushu_font_size') || '1.8';
  fontSizeRange.value = savedFontSize;
  updateFontSize(parseFloat(savedFontSize));
  
  const savedAudio = localStorage.getItem('yushu_bg_audio') || 'none';
  selectAudio.value = savedAudio;
  if (savedAudio !== 'none') {
    setTimeout(() => changeBgAudio(savedAudio), 500);
  }
}

// Fetch structured scripture data
async function loadScriptureData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error('無法載入 data.json 經文資料');
    }
    scriptureData = await response.json();
    totalPages = scriptureData.length;
    totalPagesSpan.textContent = totalPages;
    if (totalPagesSpanBottom) totalPagesSpanBottom.textContent = totalPages;
    
    // Populate page select dropdowns
    pageSelect.innerHTML = '';
    if (pageSelectBottom) pageSelectBottom.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      pageSelect.appendChild(opt);
      
      if (pageSelectBottom) {
        const optBottom = opt.cloneNode(true);
        pageSelectBottom.appendChild(optBottom);
      }
    }
    
    currentPage = 1;
    pageSelect.value = currentPage;
    if (pageSelectBottom) pageSelectBottom.value = currentPage;
    renderPage();
  } catch (error) {
    scriptureContent.innerHTML = `<div class="loading" style="color: #ff8888;">載入失敗: ${error.message}</div>`;
  }
}

/* --- Zhuyin Tone Parser --- */
function parseZhuyin(zhuyinStr) {
  if (!zhuyinStr) return { letters: "", tone: "", toneClass: "tone-first" };
  
  let letters = zhuyinStr;
  let tone = "";
  let toneClass = "tone-first";
  
  if (zhuyinStr.includes("˙")) {
    tone = "˙";
    letters = zhuyinStr.replace("˙", "");
    toneClass = "tone-light";
  } else if (zhuyinStr.includes("ˊ")) {
    tone = "ˊ";
    letters = zhuyinStr.replace("ˊ", "");
    toneClass = "tone-second";
  } else if (zhuyinStr.includes("ˇ")) {
    tone = "ˇ";
    letters = zhuyinStr.replace("ˇ", "");
    toneClass = "tone-third";
  } else if (zhuyinStr.includes("ˋ")) {
    tone = "ˋ";
    letters = zhuyinStr.replace("ˋ", "");
    toneClass = "tone-fourth";
  }
  
  return { letters, tone, toneClass };
}

/* --- Render Page Content --- */
function renderPage() {
  if (!scriptureData || scriptureData.length === 0) return;
  
  const pageObj = scriptureData.find(p => p.page === currentPage);
  if (!pageObj) return;
  
  // Sync page selector dropdowns
  pageSelect.value = currentPage;
  if (pageSelectBottom) pageSelectBottom.value = currentPage;
  
  scriptureContent.innerHTML = '';
  
  // Apply visual settings classes
  if (isVertical) {
    scriptureContent.className = 'scripture-paper vertical-mode';
  } else {
    scriptureContent.className = 'scripture-paper horizontal-mode';
  }
  
  if (!showZhuyin) {
    scriptureContent.classList.add('hide-zhuyin');
  }
  
  if (isEditMode) {
    scriptureContent.classList.add('edit-active');
  }
  
  // Render columns
  pageObj.columns.forEach((col, colIdx) => {
    const colDiv = document.createElement('div');
    colDiv.className = 'scripture-column';
    
    col.forEach((charObj, charIdx) => {
      const charSpan = document.createElement('span');
      charSpan.className = 'scripture-char';
      
      const char = charObj.char;
      const isPunc = "，。、；：！？「」『』()（）".includes(char);
      
      if (isPunc) {
        charSpan.classList.add('punctuation');
        charSpan.textContent = char;
      } else {
        // Retrieve edited zhuyin if exists, otherwise default
        const editKey = `${currentPage}_${colIdx}_${charIdx}`;
        let zhuyin = charObj.zhuyin;
        if (editedZhuyinMap[editKey] !== undefined) {
          zhuyin = editedZhuyinMap[editKey];
        }
        
        // Wrap character in ruby tag for zhuyin display
        if (zhuyin) {
          const ruby = document.createElement('ruby');
          ruby.textContent = char;
          const rt = document.createElement('rt');
          
          const parsed = parseZhuyin(zhuyin);
          if (parsed.toneClass === 'tone-light') {
            rt.innerHTML = `
              <span class="zhuyin-wrapper tone-light-layout">
                <span class="zhuyin-tone tone-light">˙</span>
                <span class="zhuyin-letters">${parsed.letters}</span>
              </span>
            `;
          } else if (parsed.tone) {
            rt.innerHTML = `
              <span class="zhuyin-wrapper tone-normal-layout">
                <span class="zhuyin-letters">${parsed.letters}</span>
                <span class="zhuyin-tone">${parsed.tone}</span>
              </span>
            `;
          } else {
            rt.innerHTML = `
              <span class="zhuyin-wrapper tone-first-layout">
                <span class="zhuyin-letters">${parsed.letters}</span>
              </span>
            `;
          }
          
          ruby.appendChild(rt);
          charSpan.appendChild(ruby);
        } else {
          charSpan.textContent = char;
        }
        
        // Setup editing interaction
        charSpan.addEventListener('click', (e) => {
          if (isEditMode) {
            e.stopPropagation();
            openEditModal(currentPage, colIdx, charIdx, char, zhuyin);
          }
        });
      }
      
      colDiv.appendChild(charSpan);
    });
    
    scriptureContent.appendChild(colDiv);
  });
}

/* --- Setup Event Listeners --- */
function setupEventListeners() {
  // Navigation
  btnPrevPage.addEventListener('click', navigatePrev);
  btnNextPage.addEventListener('click', navigateNext);
  pageSelect.addEventListener('change', (e) => {
    currentPage = parseInt(e.target.value);
    renderPage();
  });
  
  if (btnPrevPageBottom) btnPrevPageBottom.addEventListener('click', navigatePrev);
  if (btnNextPageBottom) btnNextPageBottom.addEventListener('click', navigateNext);
  if (pageSelectBottom) {
    pageSelectBottom.addEventListener('change', (e) => {
      currentPage = parseInt(e.target.value);
      renderPage();
    });
  }
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    // Disable navigation if user is entering text in modal
    if (document.activeElement === inputZhuyin) return;
    
    if (e.key === 'ArrowLeft') {
      if (isVertical) {
        navigateNext(); // Vertical read right-to-left, next is left
      } else {
        navigatePrev(); // Horizontal read left-to-right, prev is left
      }
    } else if (e.key === 'ArrowRight') {
      if (isVertical) {
        navigatePrev();
      } else {
        navigateNext();
      }
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      // Spacebar adds counter
      e.preventDefault();
      incrementCounter();
    }
  });
  
  // Font size control
  fontSizeRange.addEventListener('input', (e) => {
    const size = parseFloat(e.target.value);
    updateFontSize(size);
    localStorage.setItem('yushu_font_size', size);
  });
  
  // Toggle controls
  toggleZhuyin.addEventListener('change', (e) => {
    showZhuyin = e.target.checked;
    if (showZhuyin) {
      scriptureContent.classList.remove('hide-zhuyin');
    } else {
      scriptureContent.classList.add('hide-zhuyin');
    }
  });
  
  toggleLayout.addEventListener('click', () => {
    isVertical = !isVertical;
    if (isVertical) {
      toggleLayout.textContent = '切換為橫書';
    } else {
      toggleLayout.textContent = '切換為直書';
    }
    renderPage();
  });
  
  toggleEditMode.addEventListener('change', (e) => {
    isEditMode = e.target.checked;
    if (isEditMode) {
      scriptureContent.classList.add('edit-active');
    } else {
      scriptureContent.classList.remove('edit-active');
    }
  });
  
  // Chanting Counter
  btnInc.addEventListener('click', incrementCounter);
  btnDec.addEventListener('click', decrementCounter);
  btnReset.addEventListener('click', resetCounter);
  
  // Export and reset
  btnExport.addEventListener('click', exportEdits);
  btnResetData.addEventListener('click', resetAllEdits);
  
  // Audio switch dropdown
  selectAudio.addEventListener('change', (e) => {
    const val = e.target.value;
    changeBgAudio(val);
    localStorage.setItem('yushu_bg_audio', val);
  });
  
  // Modal buttons
  btnCancelEdit.addEventListener('click', closeEditModal);
  btnSaveEdit.addEventListener('click', saveZhuyinEdit);
  btnDeleteZhuyin.addEventListener('click', deleteZhuyinEdit);
  
  // Close modal when clicking overlay
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
      closeEditModal();
    }
  });
  
  // Back to top scroll and click events
  window.addEventListener('scroll', handleScroll);
  if (scriptureContent) {
    scriptureContent.addEventListener('scroll', handleScroll);
  }
  if (btnBackToTop) {
    btnBackToTop.addEventListener('click', scrollToTop);
  }
}

function navigatePrev() {
  if (currentPage > 1) {
    currentPage--;
    pageSelect.value = currentPage;
    renderPage();
  }
}

function navigateNext() {
  if (currentPage < totalPages) {
    currentPage++;
    pageSelect.value = currentPage;
    renderPage();
  }
}

function updateFontSize(size) {
  scriptureContent.style.setProperty('--scripture-font-size', `${size}rem`);
  
  let label = '中';
  if (size < 1.6) label = '小';
  else if (size >= 1.6 && size < 2.2) label = '中';
  else if (size >= 2.2 && size < 2.7) label = '大';
  else label = '特大';
  
  fontSizeDisplay.textContent = `${label} (${size.toFixed(1)}rem)`;
}

/* --- Chanting Counter Logic --- */
function incrementCounter() {
  chantCount++;
  localStorage.setItem('yushu_chant_count', chantCount);
  counterVal.textContent = chantCount;
  
  // Trigger bounce animation on counter display
  counterVal.style.transform = 'scale(1.2)';
  counterVal.style.color = '#ffffff';
  setTimeout(() => {
    counterVal.style.transform = 'scale(1)';
    counterVal.style.color = 'var(--color-gold-bright)';
  }, 200);
  
  // Play chime sound
  playChime();
}

function decrementCounter() {
  if (chantCount > 0) {
    chantCount--;
    localStorage.setItem('yushu_chant_count', chantCount);
    counterVal.textContent = chantCount;
  }
}

function resetCounter() {
  if (confirm('確定要將念誦次數重設歸零嗎？')) {
    chantCount = 0;
    localStorage.setItem('yushu_chant_count', chantCount);
    counterVal.textContent = chantCount;
  }
}

/* --- Zhuyin Edit Modal Logic --- */
function openEditModal(page, colIdx, charIdx, char, zhuyin) {
  activeEditInfo = { page, colIdx, charIdx, char };
  
  editChar.textContent = char;
  editCurrentZhuyin.textContent = zhuyin ? zhuyin : '(無注音)';
  inputZhuyin.value = zhuyin ? zhuyin : '';
  
  editModal.classList.add('open');
  inputZhuyin.focus();
}

function closeEditModal() {
  editModal.classList.remove('open');
  activeEditInfo = null;
}

function saveZhuyinEdit() {
  if (!activeEditInfo) return;
  
  const val = inputZhuyin.value.trim().replace(/\s+/g, '');
  const key = `${activeEditInfo.page}_${activeEditInfo.colIdx}_${activeEditInfo.charIdx}`;
  
  editedZhuyinMap[key] = val;
  localStorage.setItem('yushu_edited_zhuyin', JSON.stringify(editedZhuyinMap));
  
  renderPage();
  closeEditModal();
}

function deleteZhuyinEdit() {
  if (!activeEditInfo) return;
  
  const key = `${activeEditInfo.page}_${activeEditInfo.colIdx}_${activeEditInfo.charIdx}`;
  
  editedZhuyinMap[key] = ""; // empty means no zhuyin
  localStorage.setItem('yushu_edited_zhuyin', JSON.stringify(editedZhuyinMap));
  
  renderPage();
  closeEditModal();
}

// Reset all customized edits
function resetAllEdits() {
  if (confirm('確定要清除所有手動校正的注音，恢復到 PDF 原始的注音嗎？')) {
    editedZhuyinMap = {};
    localStorage.removeItem('yushu_edited_zhuyin');
    renderPage();
  }
}

// Export JSON file with customizations merged
function exportEdits() {
  // Create a deep copy of the original dataset, apply edits, and export
  const exportData = scriptureData.map(pageObj => {
    const pageNum = pageObj.page;
    const colsCopy = pageObj.columns.map((col, colIdx) => {
      return col.map((charObj, charIdx) => {
        const key = `${pageNum}_${colIdx}_${charIdx}`;
        let finalZhuyin = charObj.zhuyin;
        if (editedZhuyinMap[key] !== undefined) {
          finalZhuyin = editedZhuyinMap[key];
        }
        return {
          char: charObj.char,
          zhuyin: finalZhuyin
        };
      });
    });
    return {
      page: pageNum,
      columns: colsCopy
    };
  });
  
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = '九天應元雷聲普化天尊玉樞寶經_已校對.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Bopomofo helper keyboard click logic
function setupKeyboardHelper() {
  const keys = document.querySelectorAll('.zhuyin-keyboard .key');
  keys.forEach(keyBtn => {
    keyBtn.addEventListener('click', () => {
      const text = keyBtn.textContent;
      if (keyBtn.classList.contains('btn-clear')) {
        inputZhuyin.value = '';
      } else {
        inputZhuyin.value += text;
      }
      inputZhuyin.focus();
    });
  });
}

/* --- Audio System (Using locally hosted nature sounds) --- */
let bgAudio = null;
let muyuInterval = null;

// Synthesis of the wooden fish (muyu) block sound
function playMuyuSound() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {
      return;
    }
  }
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const now = audioCtx.currentTime;
  const freq = 560; // fundamental resonance frequency of temple block
  
  // Principal resonance body (sine wave with pitch bend down on mallet impact)
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.88, now + 0.08);
  
  gainNode.gain.setValueAtTime(0.4, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  
  // Mallet impact sound (wood clack transient, high frequency, very short)
  const oscHigh = audioCtx.createOscillator();
  const gainHigh = audioCtx.createGain();
  oscHigh.type = 'sine';
  oscHigh.frequency.setValueAtTime(freq * 1.8, now);
  
  gainHigh.gain.setValueAtTime(0.12, now);
  gainHigh.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  oscHigh.connect(gainHigh);
  gainHigh.connect(audioCtx.destination);
  
  osc.start(now);
  osc.stop(now + 0.15);
  
  oscHigh.start(now);
  oscHigh.stop(now + 0.05);
}

function startMuyu() {
  stopMuyu(); // stop any active loop
  
  playMuyuSound(); // play immediately
  
  // Loop every 1.25 seconds (around 48 BPM, solemn chanting tempo)
  muyuInterval = setInterval(() => {
    playMuyuSound();
  }, 1250);
}

function stopMuyu() {
  if (muyuInterval) {
    clearInterval(muyuInterval);
    muyuInterval = null;
  }
}

function changeBgAudio(type) {
  currentAudioType = type;
  
  // Stop muyu timer if running
  stopMuyu();
  
  // Pause and release current audio
  if (bgAudio) {
    try {
      bgAudio.pause();
      bgAudio = null;
    } catch(e){}
  }
  
  if (type === 'none') {
    audioStatus.textContent = '音效已關閉';
    audioStatus.style.color = 'var(--color-text-muted)';
    return;
  }
  
  if (type === 'muyu') {
    startMuyu();
    audioStatus.textContent = '木魚靜心敲擊中...';
    audioStatus.style.color = 'var(--color-gold-bright)';
    return;
  }
  
  let src = 'rain.mp3';
  let volume = 0.22;
  let label = '森林細雨播放中...';
  
  if (type === 'forest_stream') {
    src = 'forest_stream.mp3';
    volume = 0.20;
    label = '林間小溪播放中...';
  } else if (type === 'rain') {
    src = 'rain.mp3';
    volume = 0.22;
    label = '森林細雨播放中...';
  }
  
  bgAudio = new Audio(src);
  bgAudio.loop = true;
  bgAudio.volume = volume;
  
  bgAudio.play().then(() => {
    audioStatus.textContent = label;
    audioStatus.style.color = 'var(--color-gold-bright)';
  }).catch(e => {
    console.warn("自動播放受阻，等待使用者點擊網頁:", e);
    audioStatus.textContent = '音效載入中，請點擊網頁啟用...';
    audioStatus.style.color = 'var(--color-gold)';
  });
}

// Synthesis of the sacred Buddhist temple chime/bowl sound
function playChime() {
  // Use Web Audio API only for the instant chime feedback
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {
      return;
    }
  }
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const now = audioCtx.currentTime;
  const frequencies = [280, 420, 560, 765, 1020];
  const gains = [0.10, 0.05, 0.03, 0.015, 0.008];
  
  frequencies.forEach((f, idx) => {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = f;
    
    gainNode.gain.setValueAtTime(gains[idx], now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 3.5);
  });
}

// Scroll detection to show/hide back-to-top button
function handleScroll() {
  const windowScroll = window.scrollY || document.documentElement.scrollTop;
  const paperScroll = scriptureContent ? scriptureContent.scrollTop : 0;
  
  if (windowScroll > 200 || paperScroll > 200) {
    btnBackToTop.classList.add('visible');
  } else {
    btnBackToTop.classList.remove('visible');
  }
}

// Scroll smooth back to top (both page window and paper area)
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (scriptureContent) {
    scriptureContent.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }
}
