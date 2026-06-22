'use strict';

/* -------------------------
   Error Helper
------------------------- */
function setError(id, message) {
    const el = document.getElementById(id);
    if (el) el.textContent = message;
}

/* -------------------------
   OTP Input Navigation
------------------------- */
function otpInput(el, index) {
    el.value = el.value.replace(/\D/g, '').slice(0, 1);

    if (el.value) {
        el.classList.add('otp-filled');
    } else {
        el.classList.remove('otp-filled');
    }

    const boxes = document.querySelectorAll('.pay-otp-input');

    if (el.value && index < boxes.length - 1) {
        boxes[index + 1].focus();
    }
}

function otpKeydown(event, index) {
    const boxes = document.querySelectorAll('.pay-otp-input');

    if (
        event.key === 'Backspace' &&
        !event.target.value &&
        index > 0
    ) {
        boxes[index - 1].focus();
    }

    if (event.key === 'Enter') {
        verifyTotp();
    }
}

/* -------------------------
   OTP Paste Support
------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    const boxes = document.querySelectorAll('.pay-otp-input');

    boxes.forEach(input => {
        input.addEventListener('paste', (e) => {
            e.preventDefault();

            const pasted = (
                e.clipboardData.getData('text') || ''
            )
            .replace(/\D/g, '')
            .slice(0, 6);

            pasted.split('').forEach((char, i) => {
                if (boxes[i]) {
                    boxes[i].value = char;
                    boxes[i].classList.add('otp-filled');
                }
            });

            const nextIndex = Math.min(
                pasted.length,
                boxes.length - 1
            );

            boxes[nextIndex]?.focus();
        });
    });
});

/* -------------------------
   Get OTP Value
------------------------- */
function getOtpCode() {
    return [...document.querySelectorAll('.pay-otp-input')]
        .map(input => input.value)
        .join('');
}

/* -------------------------
   Verify OTP
------------------------- */
function verifyTotp() {
    const code = getOtpCode();

    if (code.length !== 6) {
        setError(
            'totp-error',
            'Please enter all 6 digits.'
        );
        return;
    }

    setError('totp-error', '');

    console.log('OTP Submitted:', code);

    /*
    fetch('/verify-totp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
    })
    .then(res => res.json())
    .then(data => {
        ...
    });
    */
}