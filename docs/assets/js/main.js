(function () {
  // mark active nav link
  const here = location.pathname.replace(/\/+$/, '');
  document.querySelectorAll('a[data-nav]').forEach(a => {
    const href = a.getAttribute('href').replace(/\/+$/, '');
    if (href && (here.endsWith(href) || (href.endsWith('/index.html') && here.endsWith(href.replace('/index.html',''))))) {
      a.classList.add('active');
    }
  });
})();