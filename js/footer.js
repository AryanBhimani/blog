// js/footer.js
fetch("./components/footer.html")
  .then(res => res.text())
  .then(data => {
    document.getElementById("footer-placeholder").innerHTML = data;
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
      yearSpan.textContent = new Date().getFullYear();
    }
  });
