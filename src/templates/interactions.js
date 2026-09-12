// Keep selection and navigation inside this diagram's host fragment.
(function initializeInteractions() {
  const root = document.getElementById("__ROOT_ID__");
  if (!root) return;
  const panel = root.querySelector("[data-details]");
  const viewport = root.querySelector(".diagram-viewport");
  if (!(panel instanceof HTMLElement) || !(viewport instanceof HTMLElement)) return;
  let origin = /** @type {Element | null} */ (null);
  /** @param {Element | null} element */
  const focus = (element) => {
    if (element instanceof HTMLElement || element instanceof SVGElement)
      element.focus({ preventScroll: true });
  };
  const clearLocation = () =>
    root.querySelectorAll("[data-located]").forEach((node) => node.removeAttribute("data-located"));
  const positionDetails = () => {
    if (!origin || !panel.matches(":popover-open")) return;
    if (!origin.getClientRects().length) {
      panel.hidePopover();
      return;
    }
    const anchor = origin.getBoundingClientRect();
    const bounds = root.getBoundingClientRect();
    const left = Math.max(16, bounds.left + 8);
    const right = Math.min(document.documentElement.clientWidth - 16, bounds.right - 8);
    const top = Math.max(16, bounds.top + 8);
    const bottom = Math.min(document.documentElement.clientHeight - 16, bounds.bottom - 8);
    panel.style.width = `${Math.min(360, right - left)}px`;
    panel.style.maxHeight = `${Math.max(0, Math.min(420, bottom - top))}px`;
    const box = panel.getBoundingClientRect();
    // Prefer the side with room; on narrow diagrams use the space below the node.
    let x = anchor.right + 12;
    let y = anchor.top;
    if (x + box.width > right) {
      if (anchor.left - 12 - box.width >= left) x = anchor.left - 12 - box.width;
      else {
        x = anchor.left;
        y = anchor.bottom + 12;
        if (y + box.height > bottom) y = anchor.top - 12 - box.height;
      }
    }
    panel.style.left = `${Math.max(left, Math.min(x, right - box.width))}px`;
    panel.style.top = `${Math.max(top, Math.min(y, bottom - box.height))}px`;
  };
  panel.addEventListener("beforetoggle", (event) => {
    if (event.newState !== "closed") return;
    if (panel.contains(document.activeElement)) focus(origin);
    origin?.removeAttribute("aria-expanded");
    origin = null;
    panel.querySelectorAll("article").forEach((article) => {
      article.hidden = true;
    });
  });
  viewport.addEventListener("scroll", positionDetails);
  new ResizeObserver(positionDetails).observe(root);
  root.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("[data-close-details]")) {
      panel.hidePopover();
      return;
    }
    const link = target.closest("a");
    const detail = link?.getAttribute("data-entity-detail");
    const locationId = link?.getAttribute("data-locate-node");
    if (detail) {
      event.preventDefault();
      if (root.dataset.nodeDetails !== "enabled") return;
      const article = root.querySelector(`#${detail}`);
      if (!(article instanceof HTMLElement)) return;
      origin?.removeAttribute("aria-expanded");
      origin = link;
      origin?.setAttribute("aria-expanded", "true");
      panel.querySelectorAll("article").forEach((item) => {
        item.hidden = item !== article;
      });
      panel.setAttribute("aria-labelledby", `detail-title-${detail.slice("details-".length)}`);
      panel.showPopover();
      panel.scrollTop = 0;
      positionDetails();
      focus(panel.querySelector("[data-close-details]"));
    } else if (locationId) {
      event.preventDefault();
      const node = root.querySelector(`#${locationId}`);
      if (!(node instanceof SVGElement) && !(node instanceof HTMLElement)) return;
      panel.hidePopover();
      clearLocation();
      node.setAttribute("data-located", "");
      node.scrollIntoView({ block: "nearest", inline: "nearest" });
      focus(node.querySelector("a"));
    } else if (!target.closest("[data-details], [data-entity]")) {
      clearLocation();
      const active = document.activeElement;
      if (
        (active instanceof SVGElement || active instanceof HTMLElement) &&
        active.matches(".node-link") &&
        root.contains(active)
      )
        active.blur();
    }
  });
})();
