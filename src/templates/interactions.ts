// Enhance ordinary document links with a native dialog. The original articles
// stay in the document, so the same links remain usable without JavaScript.
(function initializeInteractions(): void {
  const dialog = document.getElementById('node-details');
  if (!(dialog instanceof HTMLDialogElement)) return;
  const content = dialog.querySelector('[data-detail-content]');
  if (!content) return;

  let current: HTMLElement | null = null;
  let placeholder: Comment | null = null;
  let origin: Element | null = null;
  let pendingLocation: string | null = null;
  const focus = (element: Element | null) => {
    if (element instanceof HTMLElement || element instanceof SVGElement) element.focus({ preventScroll: true });
  };
  const restore = () => {
    if (current && placeholder) {
      current.querySelectorAll<HTMLElement>('[hidden]').forEach(element => { element.hidden = false; });
      current.removeAttribute('data-contextual');
      current.querySelector<HTMLElement>('[data-detail-context]')!.hidden = true;
      const heading = current.querySelector('[data-location-heading]');
      if (heading) heading.textContent = '在图中定位';
      placeholder.replaceWith(current);
    }
    current = null;
    placeholder = null;
  };
  const show = (id: string, chartId: string | null): void => {
    const article = document.getElementById(id);
    if (!article || article === current) return;
    restore();
    current = article;
    placeholder = document.createComment('entity detail position');
    article.replaceWith(placeholder);
    content.append(article);
    const section = [...article.querySelectorAll<HTMLElement>('[data-detail-chart]')]
      .find(element => element.dataset.detailChart === chartId);
    const chart = section ? chartId : null;
    const caption = article.querySelector<HTMLElement>('[data-detail-context]')!;
    caption.hidden = !section;
    caption.textContent = section?.querySelector('h3')!.textContent ?? '';
    article.toggleAttribute('data-contextual', !!section);
    article.querySelectorAll<HTMLElement>('[data-detail-chart]').forEach(element => {
      element.hidden = element !== section;
    });
    const locations = [...article.querySelectorAll<HTMLElement>('[data-location-chart]')];
    locations.forEach(element => { element.hidden = element.dataset.locationChart === chart; });
    const nav = article.querySelector<HTMLElement>('[data-node-locations]');
    if (nav) nav.hidden = locations.every(element => element.hidden);
    const heading = article.querySelector('[data-location-heading]');
    if (heading) heading.textContent = section ? '在其他图中定位' : '在图中定位';
    dialog.setAttribute('aria-labelledby', article.querySelector('h2')!.id);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    focus(article);
  };
  const clearLocation = () => {
    document.querySelectorAll('[data-located]').forEach(element => element.removeAttribute('data-located'));
  };
  const locate = (id: string) => {
    clearLocation();
    const node = document.getElementById(id);
    if (!node?.matches('svg [data-entity]')) return;
    node.setAttribute('data-located', '');
    node.scrollIntoView({ block: 'center', inline: 'center' });
    focus(node.querySelector('a'));
  };

  let startedOnBackdrop = false;
  const onBackdrop = (event: MouseEvent) => {
    if (event.target !== dialog) return false;
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  dialog.addEventListener('pointerdown', event => {
    startedOnBackdrop = event.button === 0 && onBackdrop(event);
  });
  dialog.addEventListener('pointercancel', () => { startedOnBackdrop = false; });
  dialog.addEventListener('click', event => {
    const dismiss = startedOnBackdrop && onBackdrop(event);
    startedOnBackdrop = false;
    if (dismiss) dialog.close();
  });

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest('a[href]');
    if (!link) {
      if (target && !target.closest('dialog,button,input,select,textarea,summary,[data-entity]')) {
        clearLocation();
        const active = document.activeElement;
        if (active instanceof SVGElement && active.matches('.node-link')) active.blur();
      }
      return;
    }
    const detail = link.getAttribute('data-entity-detail');
    const locationId = link.getAttribute('data-locate-node');
    if (detail) {
      event.preventDefault();
      if (current?.id === detail) return;
      origin = link;
      show(detail, link.getAttribute('data-chart'));
    } else if (locationId && dialog.open) {
      event.preventDefault();
      pendingLocation = locationId;
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    startedOnBackdrop = false;
    restore();
    if (pendingLocation) {
      const id = pendingLocation;
      pendingLocation = null;
      if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
      locate(id);
    } else {
      focus(origin);
    }
    origin = null;
  });
  document.documentElement.classList.add('interactive');
  const showHash = () => {
    const id = location.hash.slice(1);
    locate(id);
    if (/^details-[a-z][a-z0-9-]*$/.test(id)) {
      origin = document.activeElement;
      show(id, null);
    }
  };
  window.addEventListener('hashchange', showHash);
  showHash();
})();
