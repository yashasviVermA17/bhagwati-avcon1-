(function() {
  function setVH() {
    var vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }
  setVH();
  window.addEventListener('resize', setVH);

  var impactSection = document.getElementById('impact');
  var techSection = document.getElementById('technology');

  // --- Impact Section ---
  if (impactSection) {
    var cards = impactSection.querySelectorAll('.impact-content');
    var arrow = impactSection.querySelector('.impact-arrows');

    if (cards.length) {
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('invisible');
        cards[i].style.backgroundColor = '#fffaf6';
        cards[i].style.padding = '2rem';
        cards[i].style.borderRadius = '0.5rem';
      }
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function updateImpact(progress) {
    if (!impactSection) return;
    var impactCards = impactSection.querySelectorAll('.impact-content');
    var arrow = impactSection.querySelector('.impact-arrows');
    if (!impactCards.length) return;

    var total = impactCards.length;
    for (var i = 0; i < total; i++) {
      var start = i / total;
      var end = (i + 1) / total;
      var cp = (progress - start) / (end - start);
      cp = Math.max(0, Math.min(1, cp));
      var eased = ease(cp);
      impactCards[i].style.opacity = eased;
      impactCards[i].style.visibility = eased > 0.01 ? 'visible' : 'hidden';
      impactCards[i].style.transform = 'translate3d(0px, ' + lerp(50, 0, eased) + 'px, 0px)';
    }

    if (arrow) {
      arrow.style.transform = 'translate3d(0px, 0px, 0px) rotate(' + lerp(309.468, 669.468, progress) + 'deg)';
    }
  }

  function update() {
    // Update Impact
    if (impactSection) {
      var rect = impactSection.getBoundingClientRect();
      var vh = window.innerHeight;
      var scrollable = rect.height - vh;
      if (scrollable > 0) {
        var progress = Math.max(0, Math.min(1, -rect.top / scrollable));
        updateImpact(progress);
      }
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
})();
