// Enhance ordinary document links with a native dialog. The original articles
// stay in the document, so the same links remain usable without JavaScript.
function initializeInteractions(): void {
  const dialog = document.getElementById('node-details');
  if (!(dialog instanceof HTMLDialogElement)) return;

  const content = dialog.querySelector('[data-detail-content]');
  if (!content) return;
  let current: HTMLElement | null = null;
  let placeholder: Comment | null = null;

  function restore() {
    if (current && placeholder) placeholder.replaceWith(current);
    current = null;
    placeholder = null;
  }

  const show = (id: string): void => {
    const article = document.getElementById(id);
    if (!article || article === current) return;
    restore();
    current = article;
    placeholder = document.createComment('entity detail position');
    article.replaceWith(placeholder);
    content.append(article);
    dialog.setAttribute('aria-labelledby', article.querySelector('h2')!.id);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    dialog.querySelector('button')?.focus();
  };

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    const detail = link.getAttribute('data-entity-detail');
    if (detail) {
      event.preventDefault();
      show(detail);
    } else if (dialog.open && dialog.contains(link) && link.getAttribute('href')?.startsWith('#')) {
      dialog.close();
    }
  });

  dialog.addEventListener('close', restore);
  document.documentElement.classList.add('interactive');
  function showHash() {
    const id = location.hash.slice(1);
    if (/^details-[a-z][a-z0-9-]*$/.test(id)) show(id);
  }
  window.addEventListener('hashchange', showHash);
  showHash();
}

// The build removes types before this function is serialized for the browser.
export const interactionScript = `(${initializeInteractions.toString()})();`;
