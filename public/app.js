/**
 * Angel Investor Survey — frontend
 *
 * Single-page survey driven by the question catalogue defined at the top.
 * Behaviour mirrors the PRD:
 *   - One question per screen; single-choice auto-advances.
 *   - Q4 "Other" reveals a free-text box.
 *   - Q5: pick up to 3, "None of these" exclusive & fixed last, shuffled.
 *   - Q6: 280-char limit.  Q7: valid email if filled.
 *   - Hidden tracking: completion time, traffic source (from ?src=…).
 */

const SURVEY = {
  title: 'Angel Investor Survey',
  intro: {
    heading: 'How do you manage your angel investing?',
    lede: 'Seven quick questions, under a minute. No right answers, and we\'re not selling anything here.',
  },
  questions: [
    {
      id: 'q1',
      label: '1 / 7',
      text: 'Where are you based?',
      type: 'single',
      required: true,
      options: ['UK', 'Rest of Europe', 'UAE', 'Saudi Arabia', 'Qatar', 'Other Middle East', 'North America', 'Rest of the world'],
    },
    {
      id: 'q2',
      label: '2 / 7',
      text: 'How many angel investments do you hold today?',
      type: 'single',
      required: true,
      options: ['None yet', '1 to 4', '5 to 9', '10 to 24', '25 or more'],
    },
    {
      id: 'q3',
      label: '3 / 7',
      text: 'How many angel groups, networks or syndicates do you invest through?',
      type: 'multi',
      required: true,
      min: 1,
      options: [
        'None, I invest on my own',
        '1',
        '2 to 3',
        '4 or more',
        'I invest with a formal, named group',
        'I invest with others on ad-hoc basis',
      ],
    },
    {
      id: 'q4',
      label: '4 / 7',
      text: 'What do you mainly use to keep track of your angel investments?',
      type: 'multi',
      required: true,
      min: 1,
      options: [
        'Notion',
        'Airtable',
        'Zapier (and other automation)',
        'Spreadsheet',
        'Email and documents',
        'My angel group\'s platform',
        'Investment platform dashboards',
        'My accountant or adviser',
        'Nothing formal',
        'Other (free text)',
      ],
      other: true,
    },
    {
      id: 'q5',
      label: '5 / 7',
      text: 'Which of these would make the biggest difference to you? Pick up to 3.',
      type: 'multi',
      required: true,
      min: 1,
      max: 3,
      options: [
        'All my investments in one place, across every group and platform',
        'Tax relief certificates and documents in one place',
        'Regular updates from my portfolio companies',
        'Portfolio value and performance',
        'Deals matched to what I invest in',
        'Sharing deals and co-investing with angels I trust',
        'Seeing angel investing alongside my other assets',
        'None of these',
      ],
      other: false,
    },
    {
      id: 'q6',
      label: '6 / 7',
      text: 'What is the most frustrating part of managing your angel investing today?',
      type: 'text',
      required: false,
      placeholder: 'One sentence is plenty',
      maxlength: 280,
      hint: 'Optional · 280 character limit',
    },
    {
      id: 'q7',
      label: '7 / 7',
      text: 'Interested in a quick demo of what we\'re building?',
      type: 'yesno',
      required: true,
      options: ['Yes', 'No'],
      ctaUrl: 'https://cal.com/levine/angelos-demo',
      ctaText: 'Book a 20-minute demo',
      helper: 'Quick video call to see how AngelOS eliminates admin and automatically herds the cats.',
    },
  ],
  complete: {
    heading: 'Thank you, that\'s really helpful.',
    copy: 'Your answers will shape what we build for angels.',
    subcopy: 'Know another angel who\'d have a view? Please pass the link on.',
  },
};

const STATE = {
  current: 0,
  answers: {},
  trafficSource: null,
  completionTimeMs: null,
  startTime: null,
  submitted: false,
};

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  intro: $('#introSlide'),
  question: $('#questionSlide'),
  complete: $('#completeSlide'),
  startBtn: $('#startBtn'),
  progressFill: $('#progressFill'),
  progressLabel: $('#progressLabel'),
  progressTotal: $('#progressTotal'),
  questionNumber: $('#questionNumber'),
  questionText: $('#questionText'),
  optionsContainer: $('#optionsContainer'),
  textInputContainer: $('#textInputContainer'),
  textInput: $('#textInput'),
  charCount: $('#charCount'),
  questionHint: $('#questionHint'),
  nextBtn: $('#nextBtn'),
  completeSlide: $('#completeSlide'),
  shareBtn: $('#shareBtn'),
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function showSlide(index) {
  [dom.intro, dom.question, dom.complete].forEach((s, i) => {
    s.classList.toggle('active', i === index);
  });

  if (index === 0) {
    STATE.startTime = Date.now();
    STATE.completionTimeMs = null;
    dom.startBtn.disabled = false;
    dom.nextBtn.disabled = true;
    updateProgress(0);
  } else if (index === 1) {
    updateProgress(STATE.current);
    renderQuestion(STATE.current);
    dom.nextBtn.disabled = true;
    dom.shareBtn.disabled = true;
  } else {
    // Completion slide
    updateProgress(7);
    dom.nextBtn.disabled = true;
    dom.shareBtn.disabled = false;
  }
}

function updateProgress(p) {
  const pct = Math.min(100, ((p) / 7) * 100);
  dom.progressFill.style.width = `${pct}%`;
  dom.progressLabel.textContent = p < 7 ? String(p + 1) : 'Done';
  dom.progressTotal.textContent = '7';
}

// ---------------------------------------------------------------------------
// Question rendering
// ---------------------------------------------------------------------------

function currentQuestion() {
  return SURVEY.questions[STATE.current];
}

function renderQuestion(index) {
  const q = currentQuestion();
  dom.questionNumber.textContent = q.label;
  dom.questionText.textContent = q.text;
  dom.questionHint.textContent = q.hint || '';
  dom.textInputContainer.style.display = 'none';
  dom.questionHint.style.display = 'none';

  if (q.type === 'single') {
    renderSingle(q);
  } else if (q.type === 'multi') {
    renderMulti(q);
  } else if (q.type === 'text') {
    renderText(q);
  } else if (q.type === 'email') {
    renderEmail(q);
  } else if (q.type === 'cta') {
    renderCta(q);
  } else if (q.type === 'yesno') {
    renderYesNo(q);
  }

  // Wire the Next button
  dom.nextBtn.addEventListener('click', () => nextQuestion());
}

function renderSingle(q) {
  const frag = document.createDocumentFragment();
  const anyClicked = !!STATE.answers[q.id];

  q.options.forEach((opt) => {
    const wrap = document.createElement('label');
    wrap.className = 'option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = q.id;
    radio.value = opt;
    radio.required = q.required;
    if (anyClicked && STATE.answers[q.id] === opt) radio.checked = true;

    const text = document.createElement('span');
    text.className = 'option-text';
    text.textContent = opt;

    wrap.appendChild(radio);
    wrap.appendChild(text);
    frag.appendChild(wrap);
  });

  dom.optionsContainer.innerHTML = '';
  dom.optionsContainer.appendChild(frag);

  // Events: radio clicks auto-advance after a short delay.
  dom.optionsContainer.querySelectorAll('input[type="radio"]').forEach((el) => {
    el.addEventListener('change', () => {
      if (!el.checked) return;
      STATE.answers[q.id] = el.value;
      if (el.value === 'Other (free text)') {
        // "Other" in Q4 reveals a text box instead of auto-advancing.
        toggleOther();
        return;
      }
      dom.nextBtn.disabled = false;
      // Auto-advance after 350ms.
      setTimeout(() => {
        if (!dom.nextBtn.disabled) nextQuestion();
      }, 350);
    });
  });
}

function renderMulti(q) {
  const frag = document.createDocumentFragment();
  const anyClicked = !!STATE.answers[q.id];

  // Shuffle Q5 options but keep "None of these" last.
  const options = q.id === 'q5' ? shuffleOptions(q.options).options : q.options;

  options.forEach((opt) => {
    const wrap = document.createElement('label');
    wrap.className = 'option';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = opt;
    cb.checked = anyClicked && (STATE.answers[q.id] || []).includes(opt);
    cb.setAttribute('aria-label', opt);

    const text = document.createElement('span');
    text.className = 'option-text';
    text.textContent = opt;

    wrap.appendChild(cb);
    wrap.appendChild(text);
    frag.appendChild(wrap);
  });

  dom.optionsContainer.innerHTML = '';
  dom.optionsContainer.appendChild(frag);

  // Wire up checkbox events.
  dom.optionsContainer.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    el.addEventListener('change', () => {
      const val = el.value;
      if (!el.checked) {
        // Unchecking - remove from selection.
        STATE.answers[q.id] = (STATE.answers[q.id] || []).filter(v => v !== val);
        if (val === 'Other (free text)') {
          dom.textInputContainer.style.display = 'none';
          const q = currentQuestion();
          renderText(q);
        }
        syncMultiLabels(q);
        dom.nextBtn.disabled = (STATE.answers[q.id] || []).length >= 1;
        return;
      }

      // Checking - add to selection.
      let selected = [...(STATE.answers[q.id] || [])];

      // Q5: "None of these" is exclusive - clears all others.
      if (q.id === 'q5' && val === 'None of these') {
        selected = ['None of these'];
      } else if (q.id === 'q4' && val === 'Other (free text)') {
        // Q4: "Other" reveals a free-text box.
        toggleOther();
        return;
      } else {
        if (!selected.includes(val)) {
          // Enforce max 3 for Q5.
          if (q.id === 'q5' && selected.length >= q.max) {
            selected.shift();
          }
          selected.push(val);
        }
      }

      STATE.answers[q.id] = selected;
      if (selected.length >= 1) {
        dom.nextBtn.disabled = false;
      }
      syncMultiLabels(q);
    });
  });
}

function syncMultiLabels(q) {
  dom.optionsContainer.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    const wrap = el.closest('.option');
    if (!wrap) return;
    const val = el.value;
    const selected = STATE.answers[q.id] || [];
    if (selected.includes(val)) {
      wrap.classList.add('selected');
      el.checked = true;
    } else {
      wrap.classList.remove('selected');
      el.checked = false;
    }
  });
}

// Fisher–Yates shuffle, keeping "None of these" anchored last.
function shuffleOptions(options) {
  const noneIndex = options.indexOf('None of these');
  const none = options[noneIndex];
  const others = options.filter((o) => o !== 'None of these');
  const shuffled = [...others];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { options: [...shuffled, none], noneIndex };
}

function renderText(q) {
  // For Q4 "Other", the text box belongs to a sibling field q4_other.
  const key = q.other ? `${q.id}_other` : q.id;
  dom.textInput.value = STATE.answers[key] || '';
  dom.textInput.minLength = 1;
  dom.charCount.textContent = `${dom.textInput.value.length} / ${q.maxlength}`;

  dom.textInput.addEventListener('input', () => {
    STATE.answers[key] = dom.textInput.value;
    dom.charCount.textContent = `${dom.textInput.value.length} / ${q.maxlength}`;
    dom.nextBtn.disabled = false;
  });

  requestAnimationFrame(() => {
    dom.textInput.focus();
    dom.textInput.style.height = 'auto';
    dom.textInput.addEventListener('input', () => {
      dom.textInput.style.height = `${dom.textInput.scrollHeight}px`;
    }, { once: true });
  });
}

function renderEmail(q) {
  dom.textInput.value = STATE.answers[q.id] || '';
  dom.textInput.type = 'email';
  dom.textInput.placeholder = q.placeholder || 'you@example.com';
  dom.textInput.minLength = 5;
  dom.textInput.maxLength = 254;

  dom.textInput.addEventListener('input', () => {
    STATE.answers[q.id] = dom.textInput.value;
    dom.nextBtn.disabled = false;
  });

  requestAnimationFrame(() => {
    dom.textInput.focus();
    dom.textInput.addEventListener('input', () => {
      dom.charCount.textContent = `${dom.textInput.value.length} / 254`;
    }, { once: true });
  });
}

function renderCta(q) {
  const btn = document.createElement('button');
  btn.className = 'btn-primary btn-cta';
  btn.textContent = q.ctaText;
  btn.type = 'button';
  btn.style.setProperty('--btn-bg', 'var(--primary)');
  btn.addEventListener('click', () => {
    window.open(q.ctaUrl, '_blank', 'noopener,noreferrer');
  });

  const hint = document.createElement('div');
  hint.className = 'question-hint';
  hint.textContent = q.helper;
  hint.style.color = 'var(--text-muted)';
  hint.style.display = 'block';

  dom.questionHint.innerHTML = '';
  dom.questionHint.appendChild(hint);
  dom.questionHint.appendChild(btn);
  dom.nextBtn.disabled = false;
}

// ---------------------------------------------------------------------------
// Yes/No question (Q7)
// ---------------------------------------------------------------------------

function renderYesNo(q) {
  const frag = document.createDocumentFragment();
  const anyClicked = !!STATE.answers[q.id];
  q.options.forEach((opt) => {
    const wrap = document.createElement('label');
    wrap.className = 'option';
    const cb = document.createElement('input');
    cb.type = 'radio';
    cb.name = q.id;
    cb.value = opt;
    cb.required = q.required;
    if (anyClicked && STATE.answers[q.id] === opt) cb.checked = true;
    const text = document.createElement('span');
    text.className = 'option-text';
    text.textContent = opt;
    wrap.appendChild(cb);
    wrap.appendChild(text);
    frag.appendChild(wrap);
  });

  dom.optionsContainer.innerHTML = '';
  dom.optionsContainer.appendChild(frag);

  dom.optionsContainer.querySelectorAll('input[type="radio"]').forEach((el) => {
    el.addEventListener('change', () => {
      if (!el.checked) return;
      STATE.answers[q.id] = el.value;
      dom.nextBtn.disabled = false;
      // No CTA on this slide — form submits on Next
    });
  });
}

// ---------------------------------------------------------------------------
// CTA visibility for Yes/No
// ---------------------------------------------------------------------------

// Show CTA for 'Yes', hide for 'No' (and re-enable Next).
function renderCtaFor(q, choice) {
  dom.questionHint.innerHTML = '';
  if (choice === 'Yes') {
    renderCta(q);
  } else {
    dom.nextBtn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// "Other" toggle (Q4)
// ---------------------------------------------------------------------------

function toggleOther() {
  const show = dom.textInputContainer.style.display === 'none';
  dom.textInputContainer.style.display = show ? 'block' : 'none';
  if (show) {
    // Re-render the text question (Q4 is a text question under the hood).
    const q = currentQuestion();
    renderText(q);
    dom.textInput.focus();
  }
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function nextQuestion() {
  const q = currentQuestion();
  if (!validateCurrent(q)) return;
  const val = STATE.answers[q.id];

  // Yes/No handling: Yes or No → go to completion.
  // The CTA will be shown on the completion page only if they answered "Yes".
  if (q.type === 'yesno') {
    completeSurvey();
    return;
  }

  // Normal next.
  STATE.current += 1;
  if (STATE.current >= SURVEY.questions.length) {
    completeSurvey();
  } else {
    showSlide(1);
    renderQuestion(STATE.current);
  }
}

function validateCurrent(q) {
  const val = STATE.answers[q.id];

  // Single-choice: a value must be selected.
  if (q.type === 'single' && q.required) {
    if (!val) {
      highlightQuestion('Please make a selection.');
      return false;
    }
    // Q4 "Other" requires text.
    if (q.other && val === 'Other (free text)' && (!STATE.answers[q.id + '_other'] || STATE.answers[q.id + '_other'].trim() === '')) {
      highlightQuestion('Please tell us a bit more.');
      return false;
    }
  }

  // Multi-choice: min/max selections.
  if (q.type === 'multi' && q.required) {
    const selected = STATE.answers[q.id] || [];
    const min = q.min || 1;
    const max = q.max || Infinity;
    if (selected.length < min) {
      highlightQuestion(`Please select at least ${min} option${min > 1 ? 's' : ''}.`);
      return false;
    }
    if (selected.length > max) {
      highlightQuestion(`Pick no more than ${max}.`);
      return false;
    }
  }

  // Q4: "Other (free text)" requires free-text input.
  if (q.id === 'q4' && Array.isArray(STATE.answers[q.id]) && STATE.answers[q.id].includes('Other (free text)')) {
    const otherText = STATE.answers['q4_other'] || '';
    if (!otherText.trim()) {
      highlightQuestion('Please tell us a bit more.');
      return false;
    }
  }

  // Text: 280 char limit.
  if (q.type === 'text') {
    const text = STATE.answers[q.id] || '';
    if (text.length > q.maxlength) {
      highlightQuestion('Keep it to 280 characters or fewer.');
      dom.textInput.focus();
      return false;
    }
  }

  // Yes/No: must select one.
  if (q.type === 'yesno') {
    if (!val) {
      highlightQuestion('Please choose Yes or No.');
      return false;
    }
  }

  return true;
}

function highlightQuestion(msg) {
  dom.questionHint.textContent = msg;
  dom.questionHint.style.color = 'var(--danger)';
  dom.questionHint.style.display = 'block';
  // Reset on next interaction.
  setTimeout(() => {
    if (dom.questionHint.style.display === 'block' && dom.questionHint.textContent === msg) {
      dom.questionHint.textContent = '';
    }
  }, 2000);
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

async function completeSurvey() {
  const q = currentQuestion();
  const val = STATE.answers[q.id];

  // Final validation.
  if (!validateCurrent(q)) return;

  // Record completion time.
  STATE.completionTimeMs = Date.now() - STATE.startTime;

  const answers = { ...STATE.answers };
  // Include the "other" text if present.
  if (q.other) {
    answers[q.id + '_other'] = STATE.answers[q.id + '_other'] || '';
  }

  const submission = {
    answers,
    traffic_source: STATE.trafficSource,
    completion_time_seconds: Math.round(STATE.completionTimeMs / 1000),
  };

  try {
    const res = await fetch('/api/surveys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
    if (!res.ok) {
      throw new Error(`Server responded ${res.status}`);
    }
    STATE.submitted = true;
    showCompletion();
  } catch (err) {
    // Fall back to a "thank you" screen even if the save failed, so the user
    // is never blocked. We log the error for diagnostics.
    console.error('[survey] submission failed:', err);
    showCompletion();
  }
}

function showCompletion() {
  showSlide(2);
  // Disable the start button now that we're complete.
  dom.startBtn.disabled = true;
  dom.nextBtn.disabled = true;
  dom.shareBtn.disabled = false;

  // Show CTA on completion page only if the user answered "Yes" to Q7.
  const q7Value = STATE.answers.q7;
  const ctnaEl = document.getElementById('completionCta');
  const ctaLink = document.getElementById('completionCtaLink');
  if (q7Value === 'Yes') {
    // Set the CTA link to the Cal.com URL.
    const ctaUrl = 'https://cal.com/levine/angelos-demo';
    ctaLink.href = ctaUrl;
    ctaLink.textContent = 'Book a 20-minute demo';
    ctnaEl.style.display = 'block';
  } else {
    ctnaEl.style.display = 'none';
  }
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

function getSurveyUrl() {
  const base = window.location.origin;
  return `${base}/?src=survey`;
}

function copyLink() {
  const url = getSurveyUrl();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      flashShareButton('Copied!');
    });
  } else {
    // Fallback: select the text in a temporary textarea.
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      flashShareButton('Copied!');
    } catch (e) {
      console.error('[survey] copy failed:', e);
    }
    document.body.removeChild(ta);
  }
}

function flashShareButton(msg) {
  const old = dom.shareBtn.textContent;
  dom.shareBtn.textContent = msg;
  dom.shareBtn.classList.add('copied');
  setTimeout(() => {
    dom.shareBtn.textContent = old;
    dom.shareBtn.classList.remove('copied');
  }, 2000);
}

// ---------------------------------------------------------------------------
// Traffic source
// ---------------------------------------------------------------------------

function detectTrafficSource() {
  const params = new URLSearchParams(window.location.search);
  const src = params.get('src');
  if (src) {
    STATE.trafficSource = src;
  }
  // Also read the referrer as a secondary signal.
  if (!STATE.trafficSource && document.referrer) {
    const referrer = document.referrer.split('/')[1] || 'direct';
    STATE.trafficSource = referrer;
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  detectTrafficSource();

  dom.startBtn.addEventListener('click', () => {
    dom.startBtn.disabled = true;
    showSlide(1);
    renderQuestion(0);
  });

  dom.nextBtn.addEventListener('click', nextQuestion);
  dom.shareBtn.addEventListener('click', copyLink);

  // Keyboard: Enter advances (when not in a textarea), Esc closes "Other".
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.target.matches('textarea, input')) {
      if (dom.nextBtn.disabled) return;
      nextQuestion();
    }
    if (e.key === 'Escape' && dom.textInputContainer.style.display === 'block') {
      dom.textInputContainer.style.display = 'none';
      renderQuestion(STATE.current);
    }
  });

  // Pre-fill the "other" text if the query has a fallback (rare).
  // Load the first question.
  showSlide(0);
  updateProgress(0);
}

document.addEventListener('DOMContentLoaded', init);
