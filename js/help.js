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



});
