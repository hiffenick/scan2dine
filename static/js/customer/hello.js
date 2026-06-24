/* ============================================================
   Kans Resto — Welcome Screen interactions
   Seat picker (signature element) + entrance choreography
   ============================================================ */

(function () {
    "use strict";

    var MAX_SEATS = 10;
    var guests = 1;

    var seatRow = document.getElementById("seatRow");
    var guestCountEl = document.getElementById("guestCount");
    var guestInput = document.getElementById("guestInput");
    var minusBtn = document.getElementById("minusBtn");
    var plusBtn = document.getElementById("plusBtn");

    function renderSeats() {
        seatRow.innerHTML = "";
        for (var i = 0; i < MAX_SEATS; i++) {
            var dot = document.createElement("span");
            dot.className = "seat-dot" + (i < guests ? " filled" : "");
            seatRow.appendChild(dot);
        }
        guestCountEl.textContent = guests;
        guestInput.value = guests;
        minusBtn.disabled = guests <= 1;
        plusBtn.disabled = guests >= MAX_SEATS;
    }

    function bumpSeat(index) {
        var dot = seatRow.children[index];
        if (!dot || typeof gsap === "undefined") return;
        gsap.fromTo(dot, { scale: 0.5 }, { scale: 1, duration: 0.35, ease: "back.out(3)" });
    }

    plusBtn.addEventListener("click", function () {
        if (guests >= MAX_SEATS) return;
        guests++;
        renderSeats();
        bumpSeat(guests - 1);
    });

    minusBtn.addEventListener("click", function () {
        if (guests <= 1) return;
        guests--;
        renderSeats();
    });

    renderSeats();

    // UX animation only — NOT navigation
    document.getElementById("customerForm").addEventListener("submit", function () {
        if (typeof gsap === "undefined") return;
        gsap.to("#doneBtn", {
            scale: 0.96,
            duration: 0.1,
            yoyo: true,
            repeat: 1
        });
    });

    // ---------------- Entrance choreography ----------------
    if (typeof gsap !== "undefined") {
        var tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        tl.from(".card", { y: 24, opacity: 0, duration: 0.6 })
          .to(".card-top", { opacity: 1, y: 0, duration: 0.45 }, "-=0.25")
          .from(".card-top", { y: 10 }, "<")
          .to(".greet", { opacity: 1, duration: 0.5 }, "-=0.2")
          .from(".greet", { y: 14 }, "<")
          .to(".field", { opacity: 1, duration: 0.45, stagger: 0.1 }, "-=0.15")
          .from(".field", { y: 14, stagger: 0.1 }, "<")
          .to(".done-btn", { opacity: 1, y: 0, duration: 0.45 }, "-=0.1")
          .from(".done-btn", { y: 14 }, "<");
    } else {
        // Fallback: no GSAP, just reveal everything
        var els = document.querySelectorAll(".card-top, .greet, .field, .done-btn");
        els.forEach(function (el) { el.style.opacity = "1"; });
    }
})();