// Help Center JS
document.addEventListener('DOMContentLoaded', () => {

    /* -------------------------------------------------------------------------- */
    /*                               FAQ ACCORDION                                */
    /* -------------------------------------------------------------------------- */
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');

            // Close all other items
            faqItems.forEach(faq => faq.classList.remove('active'));

            // Toggle current if it wasn't active
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    /* -------------------------------------------------------------------------- */
    /*                               SEARCH FUNCTION                              */
    /* -------------------------------------------------------------------------- */
    const searchInput = document.getElementById('helpSearch');
    const questions = document.querySelectorAll('.faq-item');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();

            questions.forEach(item => {
                const text = item.innerText.toLowerCase();
                if (text.includes(term)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });

            // Optional: Toggle entire sections if empty (advanced)
            // For now, simpler filtering is sufficient.
        });
    }

});
