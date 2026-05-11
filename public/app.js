let participantNumber = null;
let participantName   = '';
let sessionCodes      = null; // [c1, c2, c3] from QR token
let currentStepEl     = null;

// ── QR session token ─────────────────────────────────────────────────────────
(function applySessionToken() {
  const m = location.pathname.match(/\/sessie\/([A-Za-z0-9_=-]+)/);
  if (!m) return; // no QR — intro shows "scan" message
  try {
    const decoded = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
    const parts   = decoded.split(',');
    if (parts.length !== 3 || parts.some(p => !p)) return;
    sessionCodes = parts;
    document.getElementById('intro-overline').textContent = 'The Social Path · Sessie geregistreerd';
    document.getElementById('intro-no-qr').style.display  = 'none';
    document.getElementById('intro-qr').style.display     = '';
  } catch (_) {}
})();

// ── Step → timeline level map ─────────────────────────────────────────────────
const STEP_LEVELS = {
  'dial-turn':    0,
  'm1-guide':     0.33,
  'm1-code':      0.67,
  'reflection-1': 1,
  'key-turn':     1.25,
  'm2-guide':     1.5,
  'm2-code':      1.75,
  'reflection-2': 2,
  'm3-intro':     2.2,
  'm3-guide':     2.5,
  'm3-code':      2.75,
  'reflection-3': 3,
  'newsletter':   3.5,
  'cert':         4,
};

// ── Step machine ─────────────────────────────────────────────────────────────
function unlock(stepId) {
  const el = document.getElementById('step-' + stepId);
  currentStepEl = el;
  el.classList.remove('locked');
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'fadeUp 0.35s cubic-bezier(.2,.8,.4,1) both';
  if (stepId in STEP_LEVELS) setTimelineProgress(STEP_LEVELS[stepId]);
  setTimeout(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(checkJumpBtn, 700);
  }, 60);
}

function complete(stepId) {
  const el = document.getElementById('step-' + stepId);
  el.style.animation = '';
  el.classList.add('completed');
}

function advanceStep(from, to) {
  complete(from);
  unlock(to);
}

let timelineLevel = -1;

function _fillHeight(level) {
  const lo  = Math.min(Math.floor(level), 4);
  const hi  = Math.min(Math.ceil(level),  4);
  const frac = level - Math.floor(level);
  const n0  = document.getElementById('tl-n' + lo);
  const n1  = document.getElementById('tl-n' + hi);
  return Math.round(n0.offsetTop + (n1.offsetTop - n0.offsetTop) * frac);
}

function setTimelineProgress(level) {
  timelineLevel = level;
  const fill = document.getElementById('tl-fill');
  fill.style.transition = 'height 0.6s cubic-bezier(.2,.8,.4,1)';
  fill.style.height = _fillHeight(level) + 'px';
  const lo = Math.min(Math.floor(level), 4);
  const hi = Math.min(Math.ceil(level),  4);
  for (let i = 0; i < 5; i++) {
    const n = document.getElementById('tl-n' + i);
    n.classList.remove('current', 'done');
    if (i <= lo)  n.classList.add('done');
    if (i === hi) n.classList.add('current');
  }
}

function _applyTimelineFill() {
  if (timelineLevel < 0) return;
  const fill = document.getElementById('tl-fill');
  fill.style.transition = 'none';
  fill.style.height = _fillHeight(timelineLevel) + 'px';
}

new ResizeObserver(_applyTimelineFill).observe(document.getElementById('machine'));
window.addEventListener('resize', _applyTimelineFill);

// ── Jump to current ───────────────────────────────────────────────────────────
function checkJumpBtn() {
  const btn = document.getElementById('jump-btn');
  if (!currentStepEl || !btn) return;
  const rect = currentStepEl.getBoundingClientRect();
  btn.classList.toggle('show', rect.top > window.innerHeight + 80);
}

function jumpToCurrent() {
  if (currentStepEl) currentStepEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.addEventListener('scroll', checkJumpBtn, { passive: true });

// ── Name input ───────────────────────────────────────────────────────────────
document.getElementById('name-input').addEventListener('input', function() {
  document.getElementById('start-btn').disabled = !this.value.trim();
});
document.getElementById('name-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && this.value.trim()) startFlow();
});

function startFlow() {
  participantName = document.getElementById('name-input').value.trim();
  if (!participantName) return;

  // Signal the installation that the participant is ready
  const m = location.pathname.match(/\/sessie\/([A-Za-z0-9_=-]+)/);
  if (m) {
    fetch('/.netlify/functions/codes?action=set-name', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: m[1], name: participantName }),
    }).catch(() => {});
  }

  advanceStep('intro', 'dial-turn');
}

function confirmKeyTurn() {
  document.getElementById('key-confirm-btn').style.display = 'none';
  const el = document.getElementById('key-confirmed');
  el.style.display = '';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Per-step code inputs: digits only, Enter = validate ──────────────────────
[['code-1', 0], ['code-2', 1], ['code-3', 2]].forEach(([id, step]) => {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    el.value = el.value.replace(/\D/g, '').slice(0, 4);
    document.getElementById('code-' + (step + 1) + '-error').classList.remove('show');
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter') validateStepCode(step); });
});

function showStepError(errorEl, msg) {
  errorEl.textContent = '⚠ ' + msg;
  errorEl.classList.add('show');
}

async function validateStepCode(step) {
  const inputEl = document.getElementById('code-' + (step + 1));
  const errorEl = document.getElementById('code-' + (step + 1) + '-error');
  const btn     = document.getElementById('btn-' + (step + 1));
  const val     = inputEl.value.trim();
  const num     = parseInt(val);

  if (!val || isNaN(num) || val.length < 4) {
    showStepError(errorEl, 'Vul de 4-cijferige code in.');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'VERIFIËREN...';

  try {
    if (num !== parseInt(sessionCodes[step])) {
      inputEl.value = '';
      showStepError(errorEl, 'Code onjuist — controleer het scherm van de machine.');
      return;
    }

    errorEl.classList.remove('show');
    const codeStepIds = ['m1-code', 'm2-code', 'm3-code'];
    const nextStepIds = ['reflection-1', 'reflection-2', null];

    complete(codeStepIds[step]);

    if (step < 2) {
      unlock(nextStepIds[step]);
    } else {
      // All three codes correct — register with Netlify and proceed
      const token = location.pathname.match(/\/sessie\/([A-Za-z0-9_=-]+)/)[1];
      const res   = await fetch('/.netlify/functions/codes?action=validate-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token })
      });
      const data = await res.json();
      participantNumber = data.participantNumber ?? null;
      unlock('reflection-3');
    }
  } catch {
    showStepError(errorEl, 'Verbindingsfout. Probeer opnieuw.');
  } finally {
    btn.disabled    = false;
    btn.textContent = step < 2 ? 'Code verifiëren →' : 'Codes verifiëren →';
  }
}

// ── Reflections ──────────────────────────────────────────────────────────────
const REFLECTIONS = {
  'reflection-1': [
    { correct: false, text: 'Dat klopt deels — energie kost inspanning. Maar bij AI gaat het om rekenkracht en data, niet om fysieke energie. Wat je wel oefende: balans vinden tussen snelheid en controle.' },
    { correct: true,  text: 'Precies. Een AI heeft enorme rekenkracht nodig om te trainen. Te snel trainen zonder controle leidt tot fouten — net als oververhitten. De balans is cruciaal.' },
    { correct: false, text: 'Energie is nodig, maar snelheid alleen is niet genoeg. Een te hoge trainingssnelheid zonder sturing leidt juist tot instabiliteit — dat is wat het oververhitten symboliseerde.' },
  ],
  'reflection-2': [
    { correct: true,  text: 'Klopt. Je gebruikte wat je eerder had geleerd om nieuwe input te interpreteren. Dat is precies wat een getraind model doet.' },
    { correct: false, text: 'Dat voelt logisch — je probeerde de juiste keuze te maken. Maar je keuzes waren gebaseerd op patronen uit je data, niet op feiten. Soms klopt dat. Soms niet.' },
    { correct: false, text: 'Logisch voor wie? Je logica was gevormd door je data. Een ander model, andere data — andere conclusies.' },
  ],
  'reflection-3': [
    { correct: true,  text: 'Precies. Het doel was herkenning — niet de handeling zelf. Een goed model optimaliseert altijd de route naar het resultaat.' },
    { correct: false, text: 'Begrijpelijk, want dat was de meest zichtbare actie. Maar snelheid zonder efficiëntie is verspilling. Had je een kortere weg kunnen vinden?' },
    { correct: false, text: 'Er waren geen regels — alleen een doel. Als je regels volgde, heb je jezelf gelimiteerd. Een AI optimaliseert, het gehoorzaamt niet.' },
  ],
};

function selectReflection(id, choice) {
  const step = document.getElementById('step-' + id);
  step.querySelectorAll('.mc-opt').forEach(b => b.disabled = true);
  const fb    = REFLECTIONS[id][choice];
  const fbEl  = document.getElementById('fb-' + id);
  fbEl.textContent = (fb.correct ? '✓ ' : '✗ ') + fb.text;
  fbEl.className   = 'mc-feedback show ' + (fb.correct ? 'correct' : 'wrong');
  setTimeout(() => {
    const btn = document.getElementById('got-it-' + id);
    btn.style.display = '';
    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 2200);
}

// ── Newsletter ───────────────────────────────────────────────────────────────
async function subscribeNewsletter() {
  const email     = document.getElementById('nl-email').value.trim();
  const errorEl   = document.getElementById('nl-error');
  const successEl = document.getElementById('nl-success');
  const btn       = document.getElementById('nl-btn');

  errorEl.classList.remove('show');
  successEl.classList.remove('show');

  if (!email || !email.includes('@')) {
    errorEl.textContent = '⚠ Vul een geldig e-mailadres in.';
    errorEl.classList.add('show');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Bezig...';

  try {
    const res = await fetch('/.netlify/functions/subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error();

    successEl.textContent = '✓ Aangemeld! Je hoort snel van ons.';
    successEl.classList.add('show');
    setTimeout(showCert, 1800);
  } catch {
    errorEl.textContent = '⚠ Aanmelden mislukt. Probeer opnieuw.';
    errorEl.classList.add('show');
    btn.disabled    = false;
    btn.textContent = 'Aanmelden →';
  }
}

function showCert() {
  document.getElementById('cert-heading').textContent = 'Gefeliciteerd, ' + participantName;
  advanceStep('newsletter', 'cert');
  const date = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  setTimeout(() => drawCertificate(participantName, participantNumber, date), 80);
}

// ── Certificate download ─────────────────────────────────────────────────────
function downloadCert() {
  const canvas = document.getElementById('cert-canvas');
  const a      = document.createElement('a');
  a.download   = 'certificaat-' + (participantName.replace(/\s+/g, '-').toLowerCase() || 'otac') + '.png';
  a.href       = canvas.toDataURL('image/png');
  a.click();
}

// ── Certificate Drawing ──────────────────────────────────────────────────────

function drawSeal(ctx, x, y, r) {
  ctx.strokeStyle = '#1a2744'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x,y,r*0.76,0,Math.PI*2); ctx.stroke();
  for (let i=0; i<20; i++) {
    const a = (i/20)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(x+Math.cos(a)*r*0.79, y+Math.sin(a)*r*0.79);
    ctx.lineTo(x+Math.cos(a)*r*0.98, y+Math.sin(a)*r*0.98);
    ctx.stroke();
  }
  ctx.fillStyle = '#1a2744'; ctx.textAlign = 'center';
  ctx.font = `bold ${r*0.26}px Georgia,serif`; ctx.fillText('OTAC', x, y+r*0.07);
  ctx.font = `${r*0.155}px Georgia,serif`; ctx.fillText('TSP', x, y+r*0.29);
}

function drawCorner(ctx, cx, cy, rot) {
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot);
  ctx.strokeStyle = '#c8952a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0,28); ctx.lineTo(0,0); ctx.lineTo(28,0); ctx.stroke();
  ctx.fillStyle = '#c8952a';
  [[0,0,3],[14,0,1.5],[0,14,1.5]].forEach(([x,y,r]) => {
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  });
  ctx.restore();
}

function diamond(ctx, x, y, s) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4);
  ctx.fillStyle = '#c8952a'; ctx.fillRect(-s,-s,s*2,s*2); ctx.restore();
}

function drawCertificate(name, participantNumber, date) {
  const canvas = document.getElementById('cert-canvas');
  const ctx    = canvas.getContext('2d');
  const W = 900, H = 640;
  canvas.width = W; canvas.height = H;

  // Parchment
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#faf6ed'); bg.addColorStop(0.5,'#f4eedd'); bg.addColorStop(1,'#ece7d3');
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Texture
  for (let i=0; i<4000; i++) {
    ctx.fillStyle = `rgba(110,75,30,${Math.random()*0.025})`;
    ctx.fillRect(Math.random()*W, Math.random()*H, 1, 1);
  }

  // Watermark
  ctx.save(); ctx.translate(W/2,H/2+10); ctx.rotate(-0.28);
  ctx.font = 'bold 108px Georgia,serif'; ctx.fillStyle = 'rgba(26,39,68,0.038)';
  ctx.textAlign = 'center';
  ctx.fillText('OPLEIDING', 0, -42); ctx.fillText('TOT AI CHATBOT', 0, 76);
  ctx.restore();

  // Borders
  ctx.strokeStyle='#1a2744'; ctx.lineWidth=7; ctx.strokeRect(14,14,W-28,H-28);
  ctx.lineWidth=1; ctx.strokeRect(22,22,W-44,H-44);
  ctx.strokeStyle='#c8952a'; ctx.lineWidth=2; ctx.strokeRect(29,29,W-58,H-58);
  ctx.lineWidth=0.5; ctx.strokeRect(36,36,W-72,H-72);

  drawCorner(ctx,44,44,0); drawCorner(ctx,W-44,44,Math.PI/2);
  drawCorner(ctx,W-44,H-44,Math.PI); drawCorner(ctx,44,H-44,-Math.PI/2);

  // Institution header
  ctx.textAlign='center'; ctx.fillStyle='#1a2744'; ctx.font='10px Georgia,serif';
  ctx.fillText('T H E   S O C I A L   P A T H   ·   T H E - S O C I A L - P A T H . N L', W/2, 73);
  ctx.strokeStyle='#c8952a'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(W/2-165,82); ctx.lineTo(W/2-13,82);
  ctx.moveTo(W/2+13,82); ctx.lineTo(W/2+165,82); ctx.stroke();
  diamond(ctx,W/2,82,4);

  // Title
  ctx.font='bold 50px Georgia,serif'; ctx.fillStyle='#1a2744';
  ctx.fillText('CERTIFICAAT', W/2, 150);
  ctx.font='italic 17px Georgia,serif'; ctx.fillStyle='#c8952a';
  ctx.fillText('van Voltooiing — Opleiding tot AI Chatbot', W/2, 179);

  // Divider
  ctx.strokeStyle='#1a2744'; ctx.lineWidth=0.7;
  ctx.beginPath(); ctx.moveTo(W/2-230,198); ctx.lineTo(W/2-14,198);
  ctx.moveTo(W/2+14,198); ctx.lineTo(W/2+230,198); ctx.stroke();
  ctx.save(); ctx.translate(W/2,198); ctx.rotate(Math.PI/4);
  ctx.strokeStyle='#1a2744'; ctx.lineWidth=0.7; ctx.strokeRect(-5,-5,10,10); ctx.restore();

  // Body
  ctx.font='15px Georgia,serif'; ctx.fillStyle='#2c3e5a';
  ctx.fillText('Hierbij wordt officieel verklaard dat', W/2, 247);

  ctx.font='bold italic 40px Georgia,serif'; ctx.fillStyle='#1a2744';
  ctx.fillText(name, W/2, 303);

  const nw = Math.min(ctx.measureText(name).width+60, 500);
  ctx.strokeStyle='#c8952a'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(W/2-nw/2,315); ctx.lineTo(W/2+nw/2,315); ctx.stroke();

  ctx.font='15px Georgia,serif'; ctx.fillStyle='#2c3e5a';
  ctx.fillText('met goed gevolg het theorie-examen van de', W/2, 353);
  ctx.font='bold 21px Georgia,serif'; ctx.fillStyle='#1a2744';
  ctx.fillText('Opleiding tot AI Chatbot', W/2, 383);
  ctx.font='14px Georgia,serif'; ctx.fillStyle='#2c3e5a';
  ctx.fillText(`heeft afgerond op ${date}`, W/2, 412);

  // Sig divider
  ctx.strokeStyle='#c8952a'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(W/2-295,435); ctx.lineTo(W/2+295,435); ctx.stroke();

  // Left sig
  ctx.font='italic 13px Georgia,serif'; ctx.fillStyle='#1a2744';
  ctx.fillText('Lord Jelte Burggraaf', 210, 512);
  ctx.font='9.5px Georgia,serif'; ctx.fillStyle='#5a6a8a';
  ctx.fillText('The Social Path', 210, 527);
  ctx.strokeStyle='#1a2744'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(120,500); ctx.lineTo(300,500); ctx.stroke();

  // Right sig
  ctx.font='italic 13px Georgia,serif'; ctx.fillStyle='#1a2744';
  ctx.fillText('prof. Wannart Burggraaf', 690, 512);
  ctx.font='9.5px Georgia,serif'; ctx.fillStyle='#5a6a8a';
  ctx.fillText('Directeur Academie', 690, 527);
  ctx.beginPath(); ctx.moveTo(585,500); ctx.lineTo(795,500); ctx.stroke();

  drawSeal(ctx, W/2, 498, 44);

  // Participant number
  ctx.font = '9px "Courier New", monospace';
  ctx.fillStyle = '#1a2744';
  ctx.textAlign = 'center';
  const pNum = participantNumber != null ? String(participantNumber).padStart(4, '0') : '????';
  ctx.fillText(`Deelnemer #${pNum}  ·  ${date}`, W/2, 572);

  // Footer
  const cid = 'CERT-OTAC-' + Math.random().toString(36).slice(2,8).toUpperCase();
  ctx.font='8px Georgia,serif'; ctx.fillStyle='#bbb'; ctx.textAlign='center';
  ctx.fillText(`${cid}  ·  Uitgegeven door The Social Path`, W/2, 591);
  ctx.fillText('Opleiding tot AI Chatbot is een project van The Social Path — onderzoek naar AI en sociale ontwikkeling van jongeren — the-social-path.nl', W/2, 603);
}
