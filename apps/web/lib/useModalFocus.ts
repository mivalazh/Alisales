'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Modal focus management for the app's overlays (filter drawer, notifications,
 * assistant sheet, photo viewer).
 *
 * While `active`:
 *  · every sibling of the overlay — all the way up to <body> — is marked
 *    `inert`, so the header, page and footer are unreachable by pointer,
 *    keyboard and screen readers;
 *  · Tab/Shift+Tab cycle inside the overlay and cannot escape it;
 *  · Escape calls `onClose`;
 *  · focus moves into the overlay (its first `initialFocus` match, else the
 *    container itself so no mobile keyboard opens);
 *  · on close, focus returns to whatever was focused before it opened.
 *
 * `modal={false}` keeps the overlay non-blocking (the filter drawer on desktop,
 * where the grid beside it must stay usable): focus still moves in and
 * restores afterwards, but nothing is made inert and Tab is free.
 *
 * The container should carry `tabIndex={-1}` so it can receive the fallback
 * focus without entering the tab order.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const NON_VISUAL = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE', 'NOSCRIPT']);

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    if (element.hasAttribute('inert') || element.getAttribute('aria-hidden') === 'true') return false;
    return element.offsetParent !== null || element.getClientRects().length > 0;
  });
}

/** Every sibling along the overlay's ancestor path, excluding <body> itself. */
function backgroundSiblings(node: HTMLElement): HTMLElement[] {
  const siblings: HTMLElement[] = [];
  let current: HTMLElement | null = node;
  while (current && current !== document.body) {
    const parent: HTMLElement | null = current.parentElement;
    if (!parent) break;
    for (const child of Array.from(parent.children as HTMLCollectionOf<HTMLElement>)) {
      if (child === current || NON_VISUAL.has(child.tagName)) continue;
      siblings.push(child);
    }
    current = parent;
  }
  return siblings;
}

export function useModalFocus({
  active,
  containerRef,
  onClose,
  modal = true,
  initialFocus,
  restoreFocus = true,
  restoreTarget,
}: {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose?: () => void;
  modal?: boolean;
  /** Selector for the element that should take focus, e.g. '[data-autofocus]'. */
  initialFocus?: string;
  restoreFocus?: boolean;
  /**
   * Selector for the trigger when it unmounts while the overlay is open (the
   * assistant's orb does); used only if the originally focused node is gone.
   */
  restoreTarget?: string;
}) {
  // Kept in a ref so an inline `onClose` does not re-run the effect (and
  // re-focus the overlay) on every parent render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // <body>/<html> can be the active element when the overlay was opened
    // programmatically or by a pointer that did not focus its button; focusing
    // them back would silently drop the caret to the top of the document.
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const trigger =
      focused && focused !== document.body && focused !== document.documentElement ? focused : null;

    // Only elements this effect actually inerted are un-inerted on cleanup, so
    // a modifier set by anything else survives.
    const inerted: HTMLElement[] = [];
    if (modal) {
      for (const sibling of backgroundSiblings(container)) {
        if (sibling.hasAttribute('inert')) continue;
        sibling.setAttribute('inert', '');
        inerted.push(sibling);
      }
    }

    if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
    const initial = initialFocus ? container.querySelector<HTMLElement>(initialFocus) : null;
    (initial ?? container).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (!modal || event.key !== 'Tab') return;

      const items = focusableWithin(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      const current = document.activeElement as HTMLElement | null;
      const inside = current ? container.contains(current) : false;

      if (event.shiftKey) {
        if (!inside || current === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      for (const element of inerted) element.removeAttribute('inert');
      if (!restoreFocus) return;
      if (trigger?.isConnected) {
        trigger.focus({ preventScroll: true });
        return;
      }
      if (!restoreTarget) return;
      // The trigger is re-mounted by the same state change that closed us, so
      // it may not be in the document yet when this cleanup runs.
      const fallback = document.querySelector<HTMLElement>(restoreTarget);
      if (fallback) fallback.focus({ preventScroll: true });
      else requestAnimationFrame(() => document.querySelector<HTMLElement>(restoreTarget)?.focus({ preventScroll: true }));
    };
    // `containerRef` is stable; `closeRef` is intentionally not a dependency.
  }, [active, modal, initialFocus, restoreFocus, restoreTarget, containerRef]);
}
