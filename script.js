/* =========================================================
   BIRTHDAY WEBSITE — vanilla JS
   Sections:
   1. Background decoration (stars / particles / petals)
   2. Candle interactions (tap + state)
   3. Microphone blow detection (Web Audio API)
   4. Celebration (confetti + floating hearts)
   5. Page transition (wish -> letter)
   6. Music + replay controls
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------------------------------------------------
     1. BACKGROUND DECORATION
     --------------------------------------------------------- */
  function buildStars(){
    const container = document.getElementById('stars');
    if (!container) return;
    const count = window.innerWidth < 480 ? 45 : 80;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++){
      const s = document.createElement('span');
      s.className = 'star';
      const size = (Math.random() * 2 + 1).toFixed(1);
      s.style.width = `${size}px`;
      s.style.height = `${size}px`;
      s.style.top = `${Math.random() * 100}%`;
      s.style.left = `${Math.random() * 100}%`;
      s.style.animationDelay = `${(Math.random() * 3).toFixed(2)}s`;
      s.style.animationDuration = `${(2.4 + Math.random() * 2).toFixed(2)}s`;
      frag.appendChild(s);
    }
    container.appendChild(frag);
  }

  function buildParticles(){
    const container = document.getElementById('particles');
    if (!container) return;
    const count = window.innerWidth < 480 ? 10 : 18;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++){
      const p = document.createElement('span');
      p.className = 'particle';
      const size = (Math.random() * 6 + 4).toFixed(0);
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.left = `${Math.random() * 100}%`;
      p.style.bottom = `-${Math.random() * 20}px`;
      p.style.animationDuration = `${(6 + Math.random() * 6).toFixed(2)}s`;
      p.style.animationDelay = `${(Math.random() * 6).toFixed(2)}s`;
      frag.appendChild(p);
    }
    container.appendChild(frag);
  }

  function buildPetals(){
    const container = document.getElementById('petals');
    if (!container) return;
    const emojis = ['🌸','✨','💛','🌷'];
    const count = window.innerWidth < 480 ? 10 : 16;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++){
      const s = document.createElement('span');
      s.className = 'petal';
      s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      s.style.left = `${Math.random() * 100}%`;
      s.style.animationDuration = `${(7 + Math.random() * 6).toFixed(2)}s`;
      s.style.animationDelay = `${(Math.random() * 6).toFixed(2)}s`;
      s.style.fontSize = `${(0.8 + Math.random() * 0.8).toFixed(2)}rem`;
      frag.appendChild(s);
    }
    container.appendChild(frag);
  }

  buildStars();
  buildParticles();
  buildPetals();

  /* ---------------------------------------------------------
     2. CANDLES
     --------------------------------------------------------- */
  const candles = Array.from(document.querySelectorAll('.candle'));
  const blowSound = document.getElementById('blow-sound');

  function playBlowSound(){
    if (!blowSound) return;
    try{
      blowSound.currentTime = 0;
      const p = blowSound.play();
      if (p && p.catch) p.catch(() => {}); // ignore if file missing / blocked
    } catch(e){ /* no-op: audio is optional */ }
  }

  function extinguishCandle(candle){
    if (!candle || candle.classList.contains('is-out')) return;
    candle.classList.add('is-out');
    playBlowSound();
    checkAllOut();
  }

  candles.forEach(c => {
    c.addEventListener('click', () => extinguishCandle(c));
  });

  let celebrationStarted = false;

  function checkAllOut(){
    const allOut = candles.every(c => c.classList.contains('is-out'));
    if (allOut && !celebrationStarted){
      celebrationStarted = true;
      celebrate();
    }
  }

  /* ---------------------------------------------------------
     3. MICROPHONE BLOW DETECTION
     --------------------------------------------------------- */
  const micButton = document.getElementById('mic-button');
  const micStatus = document.getElementById('mic-status');

  let audioCtx = null;
  let analyser = null;
  let micStream = null;
  let micActive = false;
  let rafId = null;
  let lastBlowTime = 0;

  const BLOW_THRESHOLD = 42;      // amplitude threshold to count as a "blow"
  const BLOW_COOLDOWN_MS = 700;   // avoid extinguishing all candles in one breath

  async function startMic(){
    if (micActive) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      micStatus.textContent = 'Mic not supported here — tap the candles instead';
      return;
    }

    try{
      micStatus.textContent = 'Requesting microphone…';
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(micStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      micActive = true;
      micButton.classList.add('is-listening');
      micStatus.textContent = 'Listening… blow into the mic 🎤';
      monitorVolume();
    } catch(err){
      // Permission denied or device unavailable — degrade gracefully
      micStatus.textContent = 'Mic unavailable — tap the candles instead';
      micActive = false;
    }
  }

  function stopMic(){
    micActive = false;
    micButton.classList.remove('is-listening', 'is-blowing');
    if (rafId) cancelAnimationFrame(rafId);
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    if (audioCtx && audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
    micStream = null; audioCtx = null; analyser = null;
    micStatus.textContent = 'Tap mic to blow, or tap the candles';
  }

  function monitorVolume(){
    if (!micActive || !analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!micActive) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;

      if (avg > BLOW_THRESHOLD){
        const now = Date.now();
        if (now - lastBlowTime > BLOW_COOLDOWN_MS){
          lastBlowTime = now;
          micButton.classList.add('is-blowing');
          micStatus.textContent = 'Blow detected! 💨';
          blowOutNextCandle();
          setTimeout(() => micButton.classList.remove('is-blowing'), 350);
        }
      }

      rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  function blowOutNextCandle(){
    const remaining = candles.filter(c => !c.classList.contains('is-out'));
    if (remaining.length === 0) return;
    // Extinguish one candle per detected blow, so a long breath sweeps through all of them
    extinguishCandle(remaining[0]);
    if (remaining.length === 1){
      micStatus.textContent = 'All candles out! 🎉';
    }
  }

  micButton.addEventListener('click', () => {
    if (micActive){
      stopMic();
    } else {
      startMic();
    }
  });

  /* ---------------------------------------------------------
     4. CELEBRATION — confetti + floating hearts
     --------------------------------------------------------- */
  const confettiCanvas = document.getElementById('confetti-canvas');
  const ctx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
  const confettiColors = ['#ff7fc0', '#ffd88c', '#c9a8ff', '#ff9fc7', '#fff6c9'];

  function resizeCanvas(){
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function launchConfetti(){
    if (!ctx) return;
    const pieces = [];
    const total = window.innerWidth < 480 ? 70 : 120;

    for (let i = 0; i < total; i++){
      pieces.push({
        x: Math.random() * confettiCanvas.width,
        y: -20 - Math.random() * confettiCanvas.height * 0.4,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        vy: 2 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 2,
        life: 0
      });
    }

    const duration = 3200;
    const start = performance.now();

    function frame(now){
      const elapsed = now - start;
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

      pieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = elapsed > duration - 500 ? Math.max(0, (duration - elapsed) / 500) : 1;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (elapsed < duration){
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }
    requestAnimationFrame(frame);
  }

  function launchHearts(){
    const hearts = ['💛','💕','✨'];
    const count = 10;
    for (let i = 0; i < count; i++){
      setTimeout(() => {
        const h = document.createElement('span');
        h.className = 'floating-heart';
        h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        h.style.left = `${5 + Math.random() * 90}%`;
        h.style.fontSize = `${(1 + Math.random() * 1.2).toFixed(2)}rem`;
        document.body.appendChild(h);
        setTimeout(() => h.remove(), 3300);
      }, i * 120);
    }
  }

  function celebrate(){
    launchConfetti();
    launchHearts();
    if (micActive) stopMic();
    setTimeout(goToLetterPage, 1600);
  }

  /* ---------------------------------------------------------
     5. PAGE TRANSITION
     --------------------------------------------------------- */
  const wishPage = document.getElementById('wish-page');
  const letterPage = document.getElementById('letter-page');

  function goToLetterPage(){
    wishPage.classList.remove('page--active');
    letterPage.classList.add('page--active');
    // restart the letter's entrance animation each time it appears
    const card = document.querySelector('.letter-card');
    if (card){
      card.style.animation = 'none';
      // force reflow so the animation can restart
      void card.offsetWidth;
      card.style.animation = '';
    }
  }

  function resetExperience(){
    letterPage.classList.remove('page--active');
    wishPage.classList.add('page--active');
    celebrationStarted = false;

    candles.forEach(c => c.classList.remove('is-out'));

    const music = document.getElementById('bg-music');
    if (music && !music.paused){
      music.pause();
      music.currentTime = 0;
      updateMusicLabel(false);
    }
  }

  /* ---------------------------------------------------------
     6. MUSIC + REPLAY CONTROLS
     --------------------------------------------------------- */
  const musicToggle = document.getElementById('music-toggle');
  const musicLabel = document.getElementById('music-label');
  const bgMusic = document.getElementById('bg-music');
  const replayButton = document.getElementById('replay-button');

  function updateMusicLabel(playing){
    if (!musicLabel) return;
    musicLabel.textContent = playing ? 'Pause music' : 'Play music';
  }

  if (musicToggle && bgMusic){
    musicToggle.addEventListener('click', () => {
      if (bgMusic.paused){
        const playPromise = bgMusic.play();
        if (playPromise && playPromise.catch){
          playPromise
            .then(() => updateMusicLabel(true))
            .catch(() => {
              // File missing or autoplay blocked — fail silently, keep UI honest
              updateMusicLabel(false);
            });
        } else {
          updateMusicLabel(true);
        }
      } else {
        bgMusic.pause();
        updateMusicLabel(false);
      }
    });
  }

  if (replayButton){
    replayButton.addEventListener('click', resetExperience);
  }

});
