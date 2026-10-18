/** Mount a curated passenger notice strip; retain the host's welcome on failure. */
export function mountMarquee(host) {
  if (!host) return { setPaused() {}, setMotion() {}, destroy() {} };

  const originalNodes = [...host.childNodes];
  const originalTabIndex = host.getAttribute('tabindex');
  const originalLabel = host.getAttribute('aria-label');
  const welcome = host.textContent.trim() || '高雄國際航空站歡迎您　Welcome to Kaohsiung International Airport';
  const abort = new AbortController();
  let destroyed = false;
  let messages = [];
  let resizeObserver;

  function render() {
    if (destroyed || !messages.length) return;
    const track = document.createElement('span');
    track.className = 'notice-track';
    const group = document.createElement('span');
    group.className = 'notice-group';
    for (const message of messages) {
      const text = document.createElement('span');
      text.className = 'notice-item';
      text.textContent = message;
      group.append(text);
    }
    track.append(group);
    host.replaceChildren(track);

    // Each half must cover the viewport, including on a wide external monitor.
    // Only the first copy is exposed to assistive technology.
    const copyWidth = Math.max(group.getBoundingClientRect().width, 1);
    const originals = [...group.children];
    const copies = Math.min(30, Math.ceil(host.clientWidth / copyWidth));
    for (let index = 1; index < copies; index += 1) {
      for (const original of originals) {
        const copy = original.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        group.append(copy);
      }
    }
    const duplicate = group.cloneNode(true);
    duplicate.setAttribute('aria-hidden', 'true');
    duplicate.classList.add('notice-duplicate');
    track.append(duplicate);
    // Keep the motion at a readable speed as wording/font/viewport changes.
    track.style.setProperty('--notice-duration', `${Math.max(25, group.getBoundingClientRect().width / 52)}s`);
  }

  fetch(new URL('./notices.json', import.meta.url), { signal: abort.signal, cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('Notice file unavailable');
      return response.json();
    })
    .then((data) => {
      if (destroyed || !Array.isArray(data?.notices)) return;
      const notices = data.notices.slice(0, 10).filter((entry) => {
        if (typeof entry?.text !== 'string' || !entry.text.trim() || entry.text.length > 500) return false;
        try {
          const source = new URL(entry.source);
          return source.protocol === 'https:' && ['www.kia.gov.tw', 'kol.kia.gov.tw'].includes(source.hostname);
        } catch {
          return false;
        }
      });
      if (!notices.length) return;
      messages = [welcome, ...notices.map((entry) => {
        const english = typeof entry.textEn === 'string' && entry.textEn.length <= 500
          ? entry.textEn.trim() : '';
        return english ? `${entry.text.trim()}　 ${english}` : entry.text.trim();
      })];
      host.classList.add('passenger-marquee');
      host.setAttribute('tabindex', '0');
      host.setAttribute('aria-label', '旅客提醒（依官方旅客指南整理）');
      render();
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(render);
        resizeObserver.observe(host);
      }
      document.fonts?.ready.then(() => { if (!destroyed) render(); }).catch(() => {});
    })
    .catch(() => { /* The original welcome remains readable if loading fails. */ });

  return {
    setPaused(paused) {
      if (!destroyed) host.classList.toggle('notice-paused', Boolean(paused));
    },
    setMotion(mode = 'system') {
      if (destroyed) return;
      host.classList.toggle('notice-motion-enabled', mode === 'on');
      host.classList.toggle('notice-motion-disabled', mode === 'off');
    },
    destroy() {
      destroyed = true;
      abort.abort();
      resizeObserver?.disconnect();
      host.replaceChildren(...originalNodes);
      host.classList.remove('passenger-marquee', 'notice-paused', 'notice-motion-enabled', 'notice-motion-disabled');
      if (originalTabIndex === null) host.removeAttribute('tabindex');
      else host.setAttribute('tabindex', originalTabIndex);
      if (originalLabel === null) host.removeAttribute('aria-label');
      else host.setAttribute('aria-label', originalLabel);
    },
  };
}
