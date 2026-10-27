// State variables
let currentInput = '0';
let previousExpression = '';
let shouldResetDisplay = false;
let isDegrees = true;
let history = [];
let savedCursorPos = null;
let lastOp = null;

// DOM Elements
let currentDisplay,
  previousDisplay,
  scientificBlock,
  scientificToggleBtn,
  historyToggleBtn,
  historyPanel,
  angleModeBtn,
  historyList,
  clearHistoryBtn;

window.onload = function () {
  currentDisplay = document.getElementById('currentDisplay');
  previousDisplay = document.getElementById('previousDisplay');
  scientificBlock = document.getElementById('scientificBlock');
  scientificToggleBtn = document.getElementById('scientificToggleBtn');
  historyToggleBtn = document.getElementById('historyToggleBtn');
  historyPanel = document.getElementById('historyPanel');
  angleModeBtn = document.getElementById('angleModeBtn');
  historyList = document.getElementById('historyList');
  clearHistoryBtn = document.getElementById('clearHistoryBtn');

  loadHistoryFromStorage();
  updateDisplay();
  setupEventListeners();
};

function setupEventListeners() {
  if (currentDisplay) {
    currentDisplay.addEventListener('keyup', trackCursor);
    currentDisplay.addEventListener('mouseup', trackCursor);
    currentDisplay.addEventListener('focus', trackCursor);
    currentDisplay.addEventListener('click', trackCursor);
    currentDisplay.addEventListener('input', handleInput);
  }

  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) {
      e.preventDefault();
    }
  });

  function trackCursor() {
    if (currentDisplay && currentDisplay.selectionStart !== null) {
      savedCursorPos = currentDisplay.selectionStart;
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, .btn');
    if (!btn) return;

    if (btn.closest('#historyPanel') || btn.closest('.header-actions')) {
      return;
    }

    const action = btn.dataset.action || btn.getAttribute('data-action');
    let value = btn.dataset.value || btn.getAttribute('data-value');
    const label = btn.innerText ? btn.innerText.trim() : '';

    if (action) {
      handleAction(action);
      return;
    }

    const key = value || label;
    const normalizedKey = key.toLowerCase();

    if (normalizedKey === '=' || normalizedKey === 'calculate') {
      handleAction('calculate');
      return;
    }
    if (normalizedKey === 'ac' || normalizedKey === 'clear') {
      handleAction('clear');
      return;
    }
    if (normalizedKey === '+/-' || normalizedKey === 'negate') {
      handleAction('negate');
      return;
    }
    if (['deg', 'rad', 'scientific', 'history'].includes(normalizedKey)) {
      return;
    }

    if (key) {
      handleNumberOrOperator(key);
    }
  });

  scientificToggleBtn?.addEventListener('click', () => {
    scientificBlock?.classList.toggle('hidden');
    scientificToggleBtn?.classList.toggle('active');
  });

  historyToggleBtn?.addEventListener('click', () => {
    historyPanel?.classList.toggle('hidden');
    historyToggleBtn?.classList.toggle('active');
  });

  angleModeBtn?.addEventListener('click', () => {
    isDegrees = !isDegrees;
    angleModeBtn.innerText = isDegrees ? 'DEG' : 'RAD';
  });

  clearHistoryBtn?.addEventListener('click', () => {
    history = [];
    localStorage.removeItem('calc_history');
    renderHistory();
  });

  document.addEventListener('keydown', handleKeyboardInput);
}

function updateDisplay() {
  currentDisplay.value = currentInput;
  previousDisplay.innerText = previousExpression;

  const pos = savedCursorPos !== null ? savedCursorPos : currentInput.length;
  currentDisplay.focus();
  currentDisplay.setSelectionRange(pos, pos);
}

function handleInput(e) {
  let rawValue = e.target.value;
  let cursorPos = e.target.selectionStart ?? rawValue.length;

  // set to normal
  if (currentInput === 'Error' || rawValue.includes('Error')) {
    const typed = rawValue.replace(/Error/gi, '');
    if (typed === '' || typed === '0') {
      rawValue = '0';
    } else if (isOperator(typed)) {
      rawValue = '0' + typed;
    } else {
      rawValue = typed;
    }
    cursorPos = rawValue.length;
    shouldResetDisplay = false;
  } else if (shouldResetDisplay) {
    const lastChar = rawValue.slice(-1);
    if (isOperator(lastChar)) {
      shouldResetDisplay = false;
    } else if (/[eπ]/.test(lastChar) || /^[a-zA-Z]$/.test(lastChar)) {
      const prevResult = rawValue.slice(0, -1);
      rawValue = prevResult + '×' + lastChar;
      cursorPos += 1;
      shouldResetDisplay = false;
    } else {
      rawValue = lastChar;
      cursorPos = rawValue.length;
      shouldResetDisplay = false;
    }
  }

  const validPrefixes = [
    's',
    'si',
    'sin',
    'c',
    'co',
    'cos',
    't',
    'ta',
    'tan',
    'l',
    'lo',
    'log',
    'ln',
    'sq',
    'sqr',
    'sqrt',
    'a',
    'ab',
    'abs',
    'f',
    'fa',
    'fac',
    'fact',
    'p',
    'pi',
    'e',
  ];

  const tokens =
    rawValue.match(/\d+\.?\d*|\d*\.\d+|[+\-*\/×÷%^().π]|[a-zA-Z]+/g) || [];

  let sanitized = '';
  tokens.forEach((token) => {
    if (/^[\d+\-*\/×÷%^().π]+$/.test(token)) {
      sanitized += token;
    } else {
      const lower = token.toLowerCase();
      if (validPrefixes.includes(lower)) {
        sanitized += lower;
      }
    }
  });

  // sign converison
  sanitized = sanitized.replace(/\*/g, '×').replace(/\//g, '÷');
  sanitized = sanitized.replace(/pi/gi, 'π');
  sanitized = sanitized.replace(/(^|[\+\-\*\/×÷\(^])0+([1-9])/g, '$1$2');

  const funcs = 'sin|cos|tan|log|ln|sqrt|abs|fact';
  // Insert multiplication before function
  sanitized = sanitized.replace(
    new RegExp(`([\\d\\.\\)eπ])(${funcs}|[eπ])`, 'gi'),
    '$1×$2'
  );

  sanitized = sanitized.replace(new RegExp(`(${funcs})(?!\\()`, 'gi'), '$1(');

  currentInput = sanitized === '' ? '0' : sanitized;
  savedCursorPos = Math.min(
    cursorPos + (currentInput.length - rawValue.length),
    currentInput.length
  );
  if (savedCursorPos < 0) savedCursorPos = currentInput.length;

  updateDisplay();
}

function formatNumber(val) {
  if (val === 'Error' || val === 'NaN' || val === 'Infinity') return val;

  if (/[÷×+\-%^()]/.test(val) && val.length > 1) {
    return val;
  }

  const parts = val.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

function handleNumberOrOperator(val) {
  // remove error text
  if (currentInput === 'Error') {
    currentInput = '0';
    previousExpression = '';
    shouldResetDisplay = false;
  }

  let startPos =
    document.activeElement === currentDisplay
      ? currentDisplay.selectionStart
      : currentInput.length;
  let endPos =
    document.activeElement === currentDisplay
      ? currentDisplay.selectionEnd
      : currentInput.length;

  if (shouldResetDisplay) {
    if (isOperator(val)) {
      shouldResetDisplay = false;
    } else {
      previousExpression = '';
      currentInput = val === '.' ? '0.' : '';
      shouldResetDisplay = false;
      startPos = currentInput.length;
      endPos = currentInput.length;
    }
  }

  if (currentInput === '0' && val !== '.' && !isOperator(val)) {
    currentInput = val;
    startPos = 1;
  } else {
    const charBefore = startPos > 0 ? currentInput.charAt(startPos - 1) : '';
    const beforeText = currentInput.substring(0, startPos);

    // replace zero before digit
    if (/^[1-9]$/.test(val) && /(^|[\+\-\*\/×÷\(^])0$/.test(beforeText)) {
      currentInput =
        currentInput.substring(0, startPos - 1) +
        val +
        currentInput.substring(endPos);
      savedCursorPos = startPos;
      updateDisplay();
      if (document.activeElement === currentDisplay) {
        currentDisplay.setSelectionRange(startPos, startPos);
      }
      return;
    }

    // one op at a time
    if (isOperator(val) && isOperator(charBefore)) {
      currentInput =
        currentInput.substring(0, startPos - 1) +
        val +
        currentInput.substring(endPos);
      updateDisplay();
      if (document.activeElement === currentDisplay) {
        currentDisplay.setSelectionRange(startPos, startPos);
      }
      return;
    }

    if (val === '.' && (currentInput.slice(-1) === '.' || charBefore === '.'))
      return;

    const toInsert = charBefore === '%' && /[\d\(]/.test(val) ? '*' + val : val;

    currentInput =
      currentInput.substring(0, startPos) +
      toInsert +
      currentInput.substring(endPos);
    startPos += toInsert.length;
  }

  savedCursorPos = startPos;
  updateDisplay();

  if (document.activeElement === currentDisplay) {
    currentDisplay.setSelectionRange(startPos, startPos);
  }
}

function isOperator(char) {
  return ['+', '-', '×', '÷', '%', '^', '*', '/'].includes(char);
}

function handleAction(action) {
  switch (action) {
    case 'clear':
      currentInput = '0';
      previousExpression = '';
      shouldResetDisplay = false;
      lastOp = null;
      break;

    case 'backspace':
      if (currentInput === 'Error') {
        currentInput = '0';
        shouldResetDisplay = false;
        savedCursorPos = 1;
        updateDisplay();
        return;
      }

      if (shouldResetDisplay) {
        shouldResetDisplay = false;
      }

      let startPos =
        document.activeElement === currentDisplay &&
        currentDisplay.selectionStart !== null
          ? currentDisplay.selectionStart
          : savedCursorPos !== null
          ? savedCursorPos
          : currentInput.length;
      let endPos =
        document.activeElement === currentDisplay &&
        currentDisplay.selectionEnd !== null
          ? currentDisplay.selectionEnd
          : startPos;

      if (startPos !== endPos) {
        currentInput =
          currentInput.substring(0, startPos) + currentInput.substring(endPos);
      } else if (startPos > 0) {
        currentInput =
          currentInput.substring(0, startPos - 1) +
          currentInput.substring(startPos);
        startPos -= 1;
      }

      if (currentInput === '' || currentInput === '-') currentInput = '0';

      savedCursorPos = startPos;
      updateDisplay();

      if (document.activeElement === currentDisplay) {
        currentDisplay.setSelectionRange(startPos, startPos);
      }
      break;

    case 'negate':
      if (currentInput !== '0') {
        const match = currentInput.match(/(\(-\d+\.?\d*\)|\d+\.?\d*)$/);

        if (match) {
          const target = match[0];
          const prefix = currentInput.slice(0, -target.length);
          let toggled;

          if (target.startsWith('(-') && target.endsWith(')')) {
            toggled = target.slice(2, -1);
          } else {
            toggled = `(-${target})`;
          }

          currentInput = prefix + toggled;
          savedCursorPos = currentInput.length;
        }
      }
      break;

    case 'calculate':
      computeResult();
      break;

    // Scientific functions
    case 'sin':
    case 'cos':
    case 'tan':
    case 'log':
    case 'ln':
    case 'sqrt':
    case 'abs':
      insertFunctionCall(`${action}(`);
      break;

    case 'inv':
      insertFunctionCall('1/(');
      break;

    case 'fact':
      applyPostfixFactorial();
      break;

    case 'pow':
      applySquarePower();
      break;

    case 'power':
      if (currentInput === 'Error') {
        currentInput = '0';
        shouldResetDisplay = false;
      }
      if (shouldResetDisplay) shouldResetDisplay = false;
      if (currentInput !== '0') {
        currentInput += '^';
        savedCursorPos = currentInput.length;
      }
      break;

    case 'pi':
      insertConstant('π');
      break;

    case 'e':
      insertConstant('e');
      break;
  }

  updateDisplay();
}

function insertAtCursor(textToInsert) {
  let startPos = currentInput.length;
  let endPos = currentInput.length;

  if (
    document.activeElement === currentDisplay &&
    currentDisplay.selectionStart !== null
  ) {
    startPos = currentDisplay.selectionStart;
    endPos = currentDisplay.selectionEnd;
  }

  if (currentInput === '0' || shouldResetDisplay) {
    currentInput = textToInsert;
    shouldResetDisplay = false;
  } else {
    currentInput =
      currentInput.substring(0, startPos) +
      textToInsert +
      currentInput.substring(endPos);
  }

  updateDisplay();
}

function insertConstant(val) {
  if (currentInput === 'Error') {
    currentInput = '0';
    shouldResetDisplay = false;
  }

  if (shouldResetDisplay) {
    currentInput = currentInput + '×' + val;
    shouldResetDisplay = false;
    savedCursorPos = currentInput.length;
    updateDisplay();
    if (document.activeElement === currentDisplay) {
      currentDisplay.setSelectionRange(savedCursorPos, savedCursorPos);
    }
    return;
  }

  let startPos = currentInput.length;
  let endPos = currentInput.length;

  if (
    document.activeElement === currentDisplay &&
    currentDisplay.selectionStart !== null
  ) {
    startPos = currentDisplay.selectionStart;
    endPos = currentDisplay.selectionEnd;
  } else if (savedCursorPos !== null && savedCursorPos <= currentInput.length) {
    startPos = savedCursorPos;
    endPos = savedCursorPos;
  }

  const charBefore = startPos > 0 ? currentInput.charAt(startPos - 1) : '';
  const beforeText = currentInput.substring(0, startPos);

  let toInsert = val;
  if (/(sin|cos|tan|log|ln|sqrt|abs|fact)$/i.test(beforeText)) {
    toInsert = '(' + val;
  } else if (/[\d\.\)eπ]/.test(charBefore)) {
    toInsert = '×' + val;
  }

  if (currentInput === '0') {
    currentInput = val;
    startPos = val.length;
  } else {
    currentInput =
      currentInput.substring(0, startPos) +
      toInsert +
      currentInput.substring(endPos);
    startPos += toInsert.length;
  }

  savedCursorPos = startPos;
  updateDisplay();

  if (document.activeElement === currentDisplay) {
    currentDisplay.setSelectionRange(startPos, startPos);
  }
}

function insertFunctionCall(funcName) {
  let startPos =
    document.activeElement === currentDisplay &&
    currentDisplay.selectionStart !== null
      ? currentDisplay.selectionStart
      : savedCursorPos !== null
      ? savedCursorPos
      : currentInput.length;
  let endPos =
    document.activeElement === currentDisplay &&
    currentDisplay.selectionEnd !== null
      ? currentDisplay.selectionEnd
      : startPos;

  // append ×funcName
  if (shouldResetDisplay) {
    currentInput = currentInput + '×' + funcName;
    shouldResetDisplay = false;
    savedCursorPos = currentInput.length;
    updateDisplay();
    if (document.activeElement === currentDisplay) {
      currentDisplay.setSelectionRange(savedCursorPos, savedCursorPos);
    }
    return;
  }

  const charBefore = startPos > 0 ? currentInput.charAt(startPos - 1) : '';
  const toInsert = /[\d\.\)]/.test(charBefore) ? '×' + funcName : funcName;

  if (currentInput === '0') {
    currentInput = funcName;
    startPos = funcName.length;
  } else {
    currentInput =
      currentInput.substring(0, startPos) +
      toInsert +
      currentInput.substring(endPos);
    startPos += toInsert.length;
  }

  savedCursorPos = startPos;
  updateDisplay();

  if (document.activeElement === currentDisplay) {
    currentDisplay.setSelectionRange(startPos, startPos);
  }
}

function applyPostfixFactorial() {
  if (currentInput === '0' || currentInput === 'Error') return;
  if (shouldResetDisplay) shouldResetDisplay = false;

  const match = currentInput.match(/(\([^()]+\)|\d+\.?\d*)$/);
  if (match) {
    const target = match[0];
    const prefix = currentInput.slice(0, -target.length);
    currentInput = `${prefix}fact(${target})`;
    savedCursorPos = currentInput.length;
  }
}

function applySquarePower() {
  if (currentInput === '0' || currentInput === 'Error') return;
  if (shouldResetDisplay) shouldResetDisplay = false;

  const match = currentInput.match(/(\([^()]+\)|\d+\.?\d*)$/);
  if (match) {
    const target = match[0];
    const prefix = currentInput.slice(0, -target.length);
    currentInput = `${prefix}${target}^2`;
  } else {
    currentInput += '^2';
  }
  savedCursorPos = currentInput.length;
}

function applyUnaryFunction(func) {
  try {
    let val = parseFloat(currentInput);
    let res = 0;

    switch (func) {
      case 'sin':
        let radSin = isDegrees ? (val * Math.PI) / 180 : val;
        res = Math.sin(radSin);
        break;
      case 'cos':
        let radCos = isDegrees ? (val * Math.PI) / 180 : val;
        res = Math.cos(radCos);
        break;
      case 'tan':
        let radTan = isDegrees ? (val * Math.PI) / 180 : val;
        res = Math.tan(radTan);
        break;
      case 'log':
        res = Math.log10(val);
        break;
      case 'ln':
        res = Math.log(val);
        break;
      case 'sqrt':
        res = Math.sqrt(val);
        break;
      case 'abs':
        res = Math.abs(val);
        break;
      case 'inv':
        res = 1 / val;
        break;
      case 'fact':
        res = factorial(val);
        break;
    }

    if (isNaN(res) || !isFinite(res)) {
      currentInput = 'Error';
    } else {
      const expr = `${func}(${currentInput})`;
      addHistory(expr, res.toString());
      previousExpression = expr + ' =';
      currentInput = res.toString();
      shouldResetDisplay = true;
    }
  } catch (err) {
    currentInput = 'Error';
  }
}

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function tanDeg(angle) {
  const normalized = Math.abs(angle) % 180;
  if (Math.abs(normalized - 90) < 1e-10) return Infinity;
  return Math.tan((Math.PI / 180) * angle);
}

// find last operation
function extractLastOp(expr) {
  let depth = 0;
  for (let i = expr.length - 1; i >= 0; i--) {
    const char = expr[i];
    if (char === ')') depth++;
    else if (char === '(') depth--;
    else if (
      depth === 0 &&
      ['+', '-', '×', '÷', '%', '^', '*', '/'].includes(char)
    ) {
      if (i > 0) {
        const op = expr[i];
        const operand = expr.substring(i + 1);
        const fullOp = op + operand;
        if (fullOp !== expr && fullOp.trim() !== expr.trim()) {
          return fullOp;
        }
      }
    }
  }
  return null;
}

function computeResult() {
  if (!currentInput || currentInput === 'Error') return;

  if (shouldResetDisplay && lastOp) {
    currentInput += lastOp;
  }

  // auto-close parenthesis
  const openParens = (currentInput.match(/\(/g) || []).length;
  const closeParens = (currentInput.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    currentInput += ')'.repeat(openParens - closeParens);
  }

  let expressionToEvaluate = currentInput;

  lastOp = extractLastOp(expressionToEvaluate);

  try {
    let parsedExpr = currentInput
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/\^/g, '**')
      .replace(/%(\d)/g, '/100*$1')
      .replace(/%/g, '/100')
      // multiplication before function
      .replace(/(\d|\))(?=\()/g, '$1*')
      .replace(/(\))(?=\d)/g, '$1*')
      .replace(/(\d|\))(?=π)/g, '$1*')
      .replace(/(\d|\))(?=e(?![+-]?\d))/g, '$1*')
      // fn names and constants
      .replace(/sqrt\(/g, 'Math.sqrt(')
      .replace(/abs\(/g, 'Math.abs(')
      .replace(/log\(/g, 'Math.log10(')
      .replace(/ln\(/g, 'Math.log(')
      .replace(/π/g, 'Math.PI')
      .replace(/(?<![a-zA-Z0-9_])e(?![+-]?\d|[a-zA-Z0-9_])/g, 'Math.E');

    // Trigo precison
    const sinDeg = (angle) => {
      const res = Math.sin((Math.PI / 180) * angle);
      return Math.abs(res) < 1e-15 ? 0 : res;
    };
    const cosDeg = (angle) => {
      const res = Math.cos((Math.PI / 180) * angle);
      return Math.abs(res) < 1e-15 ? 0 : res;
    };

    if (isDegrees) {
      parsedExpr = parsedExpr
        .replace(/sin\(/g, 'sinDeg(')
        .replace(/cos\(/g, 'cosDeg(')
        .replace(/tan\(/g, 'tanDeg(');
    } else {
      parsedExpr = parsedExpr
        .replace(/sin\(/g, 'Math.sin(')
        .replace(/cos\(/g, 'Math.cos(')
        .replace(/tan\(/g, 'Math.tan(');
    }

    const evalFunc = new Function(
      'fact',
      'sinDeg',
      'cosDeg',
      'tanDeg',
      `'use strict'; return (${parsedExpr})`
    );
    let result = evalFunc(factorial, sinDeg, cosDeg, tanDeg);

    if (result === undefined || isNaN(result) || !isFinite(result)) {
      currentInput = 'Error';
    } else {
      result = Number(result.toPrecision(12));

      addHistory(expressionToEvaluate, result.toString());
      previousExpression = expressionToEvaluate + ' =';
      currentInput = result.toString();
      shouldResetDisplay = true;
      savedCursorPos = currentInput.length;
    }
  } catch (e) {
    currentInput = 'Error';
    shouldResetDisplay = true;
  }
  updateDisplay();
}

function addHistory(expr, result) {
  // avoid spam in history
  if (
    history.length > 0 &&
    history[0].expr === expr &&
    history[0].result === result
  ) {
    return;
  }

  history.unshift({ expr, result });
  if (history.length > 20) history.pop();
  saveHistoryToStorage();
  renderHistory();
}

function saveHistoryToStorage() {
  try {
    localStorage.setItem('calc_history', JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

function loadHistoryFromStorage() {
  try {
    const saved = localStorage.getItem('calc_history');
    if (saved) {
      history = JSON.parse(saved);
      renderHistory();
    }
  } catch (e) {
    history = [];
  }
}

function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = `<div class="empty-history">No calculation history yet</div>`;
    return;
  }

  historyList.innerHTML = history
    .map(
      (item, index) => `
        <div class="history-item" data-index="${index}">
            <div style="font-size: 12px; color: #64748b;">${item.expr} =</div>
            <div style="font-size: 16px; font-weight: 600; color: #2563eb;">${item.result}</div>
        </div>
    `
    )
    .join('');

  // history recall
  document.querySelectorAll('.history-item').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = el.dataset.index;
      currentInput = history[idx].result;
      shouldResetDisplay = false;
      updateDisplay();
    });
  });
}

function handleKeyboardInput(e) {
  // Allow shortcut and nav keys
  if (
    e.ctrlKey ||
    e.metaKey ||
    ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab', 'Shift'].includes(e.key)
  ) {
    return;
  }

  if (e.key === 'Enter' || e.key === '=') {
    e.preventDefault();
    handleAction('calculate');
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    handleAction('clear');
    return;
  }

  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    handleAction('backspace');
    return;
  }

  const key = e.key;

  // Handle numbers,decimal point and parentheses
  if ((key >= '0' && key <= '9') || key === '.' || key === '(' || key === ')') {
    e.preventDefault();
    handleNumberOrOperator(key);
    return;
  }

  // Handle keyboard inputs
  if (key === '+' || key === '-') {
    e.preventDefault();
    handleNumberOrOperator(key);
    return;
  }
  if (key === '*' || key === '×') {
    e.preventDefault();
    handleNumberOrOperator('×');
    return;
  }
  if (key === '/' || key === '÷') {
    e.preventDefault();
    handleNumberOrOperator('÷');
    return;
  }
  if (key === '%') {
    e.preventDefault();
    handleNumberOrOperator('%');
    return;
  }
  if (key === '^') {
    e.preventDefault();
    handleNumberOrOperator('^');
    return;
  }

  if (/^[a-zA-Z]$/.test(key)) {
    const effectiveInput = currentInput === 'Error' ? '' : currentInput;

    const startPos =
      document.activeElement === currentDisplay &&
      currentDisplay.selectionStart !== null
        ? currentDisplay.selectionStart
        : effectiveInput.length;

    const beforeCursor = effectiveInput.substring(0, startPos);
    const lastWordMatch = beforeCursor.match(/[a-zA-Z]+$/);
    const currentWord = lastWordMatch ? lastWordMatch[0] : '';
    const futureWord = (currentWord + key).toLowerCase();

    const validPrefixes = [
      's',
      'si',
      'sin',
      'c',
      'co',
      'cos',
      't',
      'ta',
      'tan',
      'l',
      'lo',
      'log',
      'ln',
      'sq',
      'sqr',
      'sqrt',
      'a',
      'ab',
      'abs',
      'f',
      'fa',
      'fac',
      'fact',
      'p',
      'pi',
      'e',
    ];

    if (!validPrefixes.includes(futureWord)) {
      e.preventDefault();
      return;
    }
    return;
  }

  e.preventDefault();
}
