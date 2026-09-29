/* Position the shared card stack without changing NexT's theme files. */
(() => {
  'use strict';
  const cards = document.getElementById('sidebar-cards');
  if (!cards) return;
  const profile = cards.closest('.sidebar-inner');
  const header = document.querySelector('.column > .header');
  const mobile = window.matchMedia('(max-width: 991px)');
  function placeCards() {
    const anchor = mobile.matches ? header : profile;
    if (anchor) anchor.after(cards);
    cards.hidden = !anchor;
  }
  placeCards();
  mobile.addEventListener('change', placeCards);
})();
