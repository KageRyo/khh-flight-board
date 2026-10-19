// Keep dismissal tied to the warning state, rather than its changing age text.
export function mountNotice(container, onVisibilityChange = () => {}) {
  const message = document.createElement('span');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'notice-close';
  close.textContent = '×';
  close.setAttribute('aria-label', '關閉提示');
  close.title = '關閉提示';
  container.replaceChildren(message, close);
  let currentKey = '', dismissed = false;
  function setVisible(visible) {
    const changed = container.hidden === visible;
    container.hidden = !visible;
    if (changed) onVisibilityChange();
  }
  close.addEventListener('click', () => {
    dismissed = true;
    setVisible(false);
  });
  return {
    update(text, key = text) {
      if (key !== currentKey) { currentKey = key; dismissed = false; }
      message.textContent = text;
      setVisible(Boolean(text) && !dismissed);
    }
  };
}
