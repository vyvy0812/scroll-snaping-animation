window.addEventListener("load", () => {
    // Delay 1.5s for video recording to catch the start
    setTimeout(() => {
        const tl = gsap.timeline();

        // 1. Heading 1
        tl.to('.heading-text', {
            y: '0%',
            duration: 1.8,
            ease: 'power4.out',
            stagger: 0.15
        }, 0); 

        // 2. "Lạng Sơn" Location
        gsap.set('.location', { filter: 'blur(10px)', opacity: 0 });
        tl.to('.location', {
            filter: 'blur(0px)',
            opacity: 1,
            duration: 0.6
        }, 0.6); 

        // 3. Description
        tl.to('.desc-text', {
            y: '0%',
            duration: 1,
            ease: 'power4.out',
            stagger: 0.15
        }, 0.6); 

        // 4. Line gradient ngang và shape hình bát giác
        gsap.set('.large-octagon-frame, .horizontal-gradient-line', { filter: 'blur(15px)', opacity: 0 });
        tl.to('.large-octagon-frame, .horizontal-gradient-line', {
            filter: 'blur(0px)',
            opacity: 1,
            duration: 0.6
        }, 1.6); 

        // 5. Header navigation
        gsap.set('.header', { y: '-100%', opacity: 0 });
        tl.to('.header', {
            y: '0%',
            opacity: 1,
            duration: 1,
            ease: 'power3.out'
        }, 1.6);
    }, 1500); 
});
