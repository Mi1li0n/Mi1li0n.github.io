/* Position the shared card stack without changing NexT's theme files. */
(() => {
  'use strict';
  const cards = document.getElementById('sidebar-cards');
  if (!cards) return;
  const profile = cards.closest('.sidebar-inner');
  const header = document.querySelector('.column > .header');
  const content = document.querySelector('.main > .main-inner');
  const mobile = window.matchMedia('(max-width: 991px)');
  const wide = window.matchMedia('(min-width: 1280px)');
  function placeCards() {
    const anchor = wide.matches ? content : mobile.matches ? header : profile;
    // Move the existing nodes so draws, open details and event listeners survive resizing.
    if (anchor && anchor.nextElementSibling !== cards) anchor.after(cards);
    cards.hidden = !anchor;
  }
  placeCards();
  mobile.addEventListener('change', placeCards);
  wide.addEventListener('change', placeCards);
})();
