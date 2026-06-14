// Animate the login container (fade-in and move up)
gsap.to(".login-container", {
    duration: 1,
    opacity: 1,
    y: 0,
    ease: "power2.out"
});

// Animate input fields (slide from bottom)
gsap.from(".login-container input[type='text'], .login-container input[type='password']", {
    duration: 0.8,
    y: 30,       // slide up effect
    stagger: 0.2,
    delay: 0.5,
    ease: "back.out(1.7)"
});

// Animate button group as a whole (slide from bottom)
gsap.from(".button-group", {
    duration: 0.8,
    y: 30,
    delay: 0.9,  // slightly after inputs
    ease: "back.out(1.7)"
});


// SIGNUP PAGE
gsap.from(".signup-card", {
    opacity: 0,
    y: 40,
    duration: 1,
    ease: "power3.out"
});

gsap.from(".input-group", {
    opacity: 0,
    y: 20,
    stagger: 0.15,
    delay: 0.4,
    duration: 0.8,
    ease: "power3.out"
});

gsap.from(".signup-btn", {
    opacity: 0,
    scale: 0.9,
    delay: 1.1,
    duration: 0.6,
    ease: "back.out(1.7)"
});

// Fade in container
// gsap.to(".signup-container", {
//     duration: 1,
//     opacity: 1,
//     y: 0,
//     ease: "power2.out"
// });

// Animate input fields
// gsap.from(".signup-container input[type='text'], .signup-container input[type='email'], .signup-container input[type='password']", {
//     duration: 0.8,
//     y: 30,
//     stagger: 0.2,
//     delay: 0.5,
//     ease: "back.out(1.7)"
// });

// Animate button group
// gsap.from(".button-group", {
//     duration: 0.8,
//     y: 30,
//     delay: 0.9,
//     ease: "back.out(1.7)"
// });

 // Tab switching functionality
    document.querySelectorAll('.setup-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Hide all tabs
            document.querySelectorAll('.setup-tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Remove active class from all buttons
            document.querySelectorAll('.setup-tab-btn').forEach(b => {
                b.classList.remove('active');
            });
            
            // Show selected tab and mark button as active
            document.getElementById(tabName).classList.add('active');
            this.classList.add('active');
        });
    });

    // Copy to clipboard function
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Secret key copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy:', err);
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    // Fallback copy for older browsers
    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            alert('Secret key copied to clipboard!');
        } catch (err) {
            console.error('Fallback copy failed:', err);
        }
        document.body.removeChild(textarea);
    }

    // Format code input (remove spaces and limit to numbers)
    const codeInput = document.getElementById('verify-code');
    if (codeInput) {
        codeInput.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 6);
        });

        // Auto-focus when 6 digits entered
        codeInput.addEventListener('keyup', function(e) {
            if (this.value.length === 6) {
                console.log('6-digit code ready for verification');
            }
        });
    }