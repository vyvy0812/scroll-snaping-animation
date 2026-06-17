/**
 * Independent scroll animations (not tied to shortcode).
 *
 * Bricks custom attributes:
 * - data-scroll-blur-image      : element blur 0 -> N when top hits viewport top. Optional: data-scroll-blur-scrub (default 1.5) | data-scroll-blur-amount (default 60)
 * - data-scroll-frame-image     : pin wrapper; rect mask (inset from center) opens (scrub); then blur 0->80. On touch/mobile uses simple blur scroll (data-scroll-blur-image behavior) instead of pin + mask.
 *   Optional: data-scroll-frame-target | data-scroll-frame-length (vh mult, default 1.85) | data-scroll-frame-scrub (default 1.55)
 *   Optional: data-scroll-frame-overlap=".panel" — after blur completes, panel fades in + slides up (was hidden until then)
 *   Optional: data-scroll-frame-overlap-dur (timeline segment length, default 0.45) | data-scroll-frame-overlap-from (start yPercent, default 100)
 *   Optional: data-scroll-frame-pin-spacing — default off: pinSpacing false (no extra pin-spacer padding; content below keeps natural layout; triggers after init recalc via global refresh). Use "true"/"1"/"yes" for GSAP default pin spacing, or "margin" for pinSpacing "margin".
 * - data-scroll-frame-image-peek : same as frame-image, but mask starts partly open from center (data-scroll-frame-peek="30" = 30% toward full rect before scroll; default 30)
 * - data-scroll-image-reveal    : image reveal by clip-path (top -> bottom)
 * - data-scroll-fade-blur       : blur 10 -> 0 + fade in
 * - data-scroll-mask-lines      : split text mask per line (dur 0.8s, stagger 0.05, power4.out). Optional: data-scroll-mask-duration | data-scroll-mask-stagger | data-scroll-mask-start (default top 82%)
 * - data-scroll-mask-list       : list items, same mask per line. Optional attrs as mask-lines
 * - data-scroll-text-gradient   : scroll-scrubbed gradient text. Optional: data-scroll-gradient-scrub (default 2.25) | data-scroll-gradient-start (default top 92%) | data-scroll-gradient-end (default top 28%)
 * - data-scroll-subtitle        : subtitle container (fade + blur 10 -> 0)
 * - data-scroll-reveal-text     : optional text node inside subtitle for line reveal
 * - data-scroll-tags-marquee     : tag row; horizontal shift scrubbed to scroll. Optional: data-scroll-tags-track, data-scroll-tags-scroll-start / data-scroll-tags-scroll-end (defaults: top bottom → bottom top). data-scroll-tags-fullwidth="1" for 100vw breakout (off by default — avoids parent overflow clip). data-scroll-tags-scrub (default 1.35)
 * - data-scroll-horizontal       : horizontal scroll section — pins the wrapper and translates its track child left as user scrolls vertically.
 *   Optional: data-scroll-horizontal-track (CSS selector for the track element; defaults to first child)
 *   Optional: data-scroll-horizontal-scrub (numeric scrub, default true = 1:1 scrub with no smoothing)
 * - data-magnetic-hover           : cursor pull via translate3d + lerp (vanilla rAF, no ScrollTrigger). Optional: data-magnetic-strength (0–1, default 0.35) | data-magnetic-lerp (default 0.12). Do not combine with GSAP transform on the same node.
 *   Demo root [data-magnetic-hover-root] + input[data-magnetic-strength-slider] (0–100) adjusts strength for child [data-magnetic-hover] nodes.
 * - data-scroll-parallax          : vertical parallax (vanilla scroll). Optional: data-scroll-parallax-scroll (selector, default window)
 */
(function () {
	'use strict';

	if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
		return;
	}

	// if body has attr data-builder-window="iframe"
	var isBuilderWindow = document.body.dataset.builderWindow === 'iframe';
	if (isBuilderWindow) {
		return;
	}

	// is mobile
	var isMobileWindow = window.innerWidth < 600;

	gsap.registerPlugin(ScrollTrigger);

	if ('scrollRestoration' in history) {
		history.scrollRestoration = 'manual';
	}

	var nativeScrollHandler = null;

	/** ScrollTrigger update — smooth scroll module dùng gsap.ticker khi bật. */
	function enableNativeScrollTriggerBridge() {
		if (typeof ScrollTrigger.defaults === 'function') {
			ScrollTrigger.defaults({ ignoreMobileResize: true });
		}
		if (window.EvergreenSmoothScroll && window.EvergreenSmoothScroll.isActive()) {
			if (nativeScrollHandler) {
				window.removeEventListener('scroll', nativeScrollHandler);
				nativeScrollHandler = null;
			}
			return;
		}
		gsap.ticker.lagSmoothing(500, 33);
		if (!nativeScrollHandler) {
			nativeScrollHandler = function () {
				ScrollTrigger.update();
			};
			window.addEventListener('scroll', nativeScrollHandler, { passive: true });
		}
	}

	enableNativeScrollTriggerBridge();
	document.addEventListener('evergreen-smooth-scroll-ready', enableNativeScrollTriggerBridge);

	function mergeScrollTriggerConfig(triggerEl, config) {
		return config || {};
	}

	/** GSAP scrub smoothing: numeric scrub = catch-up time in seconds (higher = smoother, more inertia). Clamped when parsed from data-* attrs. */
	function clampScrollScrub(n, fallback) {
		if (n == null || isNaN(n)) {
			return fallback;
		}
		if (n < 0.15) {
			return 0.15;
		}
		if (n > 3.5) {
			return 3.5;
		}
		return n;
	}

	function parseScrollScrubAttr(el, attr, fallback) {
		if (!el) {
			return fallback;
		}
		return clampScrollScrub(parseFloat(el.getAttribute(attr) || ''), fallback);
	}

	/** Pin scroll distance = innerHeight × mult (viewport heights). data-scroll-frame-length, default 1.85. */
	function parseFrameScrollLengthVh(el, fallback) {
		if (!el) {
			return fallback;
		}
		var n = parseFloat(el.getAttribute('data-scroll-frame-length') || '');
		if (isNaN(n) || n <= 0) {
			return fallback;
		}
		if (n < 0.25) {
			return 0.25;
		}
		if (n > 6) {
			return 6;
		}
		return n;
	}

	/**
	 * @param {HTMLElement} el
	 * @returns {HTMLElement[]}
	 */
	function splitIntoLineMasks(el) {
		if (!el || el.querySelector('.independent-line-mask')) {
			return Array.from(el.querySelectorAll('.independent-line-inner'));
		}

		var lineNodes = el.querySelectorAll('p, .line');
		if (lineNodes.length) {
			var lineInners = [];
			lineNodes.forEach(function (node) {
				var text = node.textContent.replace(/\s+/g, ' ').trim();
				var html = node.innerHTML.trim();
				if (!text || !html) {
					return;
				}
				node.innerHTML = '';
				var mask = document.createElement('span');
				mask.className = 'independent-line-mask';
				mask.style.display = 'block';
				mask.style.overflow = 'hidden';

				var inner = document.createElement('span');
				inner.className = 'independent-line-inner';
				inner.style.display = 'inline-block';
				inner.innerHTML = html;

				mask.appendChild(inner);
				node.appendChild(mask);
				lineInners.push(inner);
			});
			return lineInners;
		}

		var plain = el.textContent.replace(/\s+/g, ' ').trim();
		var html = el.innerHTML.trim();
		if (!plain || !html) {
			return [];
		}

		el.innerHTML = '';
		var mask = document.createElement('span');
		mask.className = 'independent-line-mask';
		mask.style.display = 'block';
		mask.style.overflow = 'hidden';

		var inner = document.createElement('span');
		inner.className = 'independent-line-inner';
		inner.style.display = 'inline-block';
		inner.innerHTML = html;

		mask.appendChild(inner);
		el.appendChild(mask);
		return [inner];
	}

	/**
	 * @param {HTMLElement} imageEl
	 */
	function isCoarsePointerDevice() {
		return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
	}

	/**
	 * @param {HTMLElement} frameEl
	 * @returns {HTMLElement|null}
	 */
	function getFrameScrollTarget(frameEl) {
		if (!frameEl) {
			return null;
		}
		var sel = (frameEl.getAttribute('data-scroll-frame-target') || '').trim();
		if (sel) {
			return frameEl.querySelector(sel);
		}
		return (
			frameEl.querySelector('[data-scroll-frame-image-target]') ||
			frameEl.querySelector('img') ||
			(frameEl.tagName === 'IMG' ? frameEl : null)
		);
	}

	/**
	 * @param {HTMLElement} frameEl
	 * @param {HTMLElement} target
	 */
	function applyFrameBlurAttrsToTarget(frameEl, target) {
		var scrub = frameEl.getAttribute('data-scroll-frame-scrub');
		if (scrub && !target.hasAttribute('data-scroll-blur-scrub')) {
			target.setAttribute('data-scroll-blur-scrub', scrub);
		}
		var blurPx = frameEl.getAttribute('data-scroll-frame-blur');
		if (blurPx && !target.hasAttribute('data-scroll-blur-amount')) {
			target.setAttribute('data-scroll-blur-amount', blurPx);
		}
	}

	/**
	 * @param {HTMLElement} imageEl
	 */
	function initImageBlurOnScroll(imageEl) {
		if (!imageEl || imageEl.getAttribute('data-scroll-blur-ready') === '1') {
			return;
		}
		imageEl.setAttribute('data-scroll-blur-ready', '1');

		// Scrub = catch-up time in seconds (cinematic inertia vs responsiveness).
		// 1.5 keeps the cinematic inertia but pulls visual feedback close enough
		// to the scroll input that the page doesn't feel "stiff" / disconnected.
		// Element can override per-instance via data-scroll-blur-scrub.
		var blurScrub = parseScrollScrubAttr(imageEl, 'data-scroll-blur-scrub', 1.5);
		// 80px is the cheapest blur radius that still reads as "very blurry" on most GPUs;
		// 200+ causes large FPS drops while scrubbing on integrated/mobile GPUs.
		var blurPx = parseFloat(imageEl.getAttribute('data-scroll-blur-amount') || '16');
		if (isNaN(blurPx) || blurPx < 0) {
			blurPx = 80;
		}

		gsap.set(imageEl, {
			filter: 'blur(0px)',
			scale: 0.8,
			opacity: 1,
			transformOrigin: '50% 50%',
			willChange: 'filter, transform, opacity',
			force3D: true,
			backfaceVisibility: 'hidden',
		});

		let tl = gsap.timeline({
			scrollTrigger: mergeScrollTriggerConfig(imageEl, {
				trigger: imageEl,
				start: '50% 50%',
				end: '+=50%',
				scrub: blurScrub,
				invalidateOnRefresh: true,

				onLeave: function () {
					gsap.set(imageEl, { clearProps: 'willChange' });
				},
				onEnterBack: function () {
					gsap.set(imageEl, { willChange: 'filter, transform, opacity' });
				},
				onLeaveBack: function () {
					gsap.set(imageEl, { willChange: 'filter, transform, opacity' });
				},
			}),
		});

		// Timeline is chained via GSAP's relative position parameter ('+=N'), so we
		// only need to think in terms of "how long does each step last" + "how long
		// to hold between steps". No absolute timeline offsets to keep in sync.
		//
		// Story:
		//   lead-in : sharp scroll where nothing happens (lets the image enter the viewport)
		//   zoom    : scale-up to 1.12 (smooth, ~5 scroll-chunks worth of distance)
		//   hold    : keep crisp + zoomed for a beat
		//   blur    : blur 0 → blurPx (smooth, ~4 scroll-chunks worth of distance)
		//   hold    : sit at peak blur so the user feels the climax
		//   fade    : opacity 1 → 0.7 (single continuous tween, no plateau)
		//
		// All tweens use ease:'none' (linear). The "advances per scroll" feel comes
		// from ScrollTrigger scrub, NOT from ease:'steps()'
		// which makes the transitions feel rigid/staircase. Linear scrub stays soft
		// because each delta-scroll moves the animation a tiny continuous amount.
		//
		// fromTo() with explicit start values lets GSAP interpolate deterministically
		// when the user scrubs back and forth — avoids the "snap" you get with to()
		// once the timeline has been played and reversed across the trigger.
		var step = {
			leadIn: 8,
			zoom: 20,
			holdAfterZoom: 5,
			blur: 96,
			holdAtPeak: 8,
			fade: 8,
		};

		tl.fromTo(
			imageEl,
			{ scale: 0.8 },
			{
				scale: 1.12,
				ease: 'none',
				duration: step.zoom,
			},
			step.leadIn
		);

		// add class mask-gradient to the image after the zoom tween
		tl.to(imageEl, {
			className: '+=mask-gradient',
			duration: step.zoom,
		}, '+=' + step.zoom);

		// One long, continuous blur tween. Single fromTo() lets GSAP interpolate the
		// filter value smoothly across the whole scroll range so blur grows gradually
		// with every scroll delta — no boundary re-init glitches.
		tl.fromTo(
			imageEl,
			{ filter: 'blur(0px)' },
			{
				filter: 'blur(' + blurPx + 'px)',
				ease: 'none',
				duration: step.blur,
			},
			'+=' + step.holdAfterZoom
		);

		// Single opacity tween — same pattern as blur (one continuous fromTo, linear
		// ease, scrub-driven). The earlier two-phase dim-then-fade had an artificial
		// plateau at 0.8 that felt disconnected from scrub.
		tl.fromTo(
			imageEl,
			{ opacity: 1 },
			{
				opacity: 0,
				ease: 'none',
				duration: step.fade,
			},
			'+=' + step.holdAtPeak
		);
	}

	/**
	 * Frame image: rectangular mask (inset from center) opens with scroll (scrub), then blur 0 -> 200.
	 * peekPct: 0 = start fully masked; higher = more visible before scroll.
	 * Optional: data-scroll-frame-overlap — panel hidden (autoAlpha 0) until blur ends, then fades in while sliding up. Class `independent-frame-overlap-panel` anchors bottom.
	 *
	 * @param {HTMLElement} frameEl
	 * @param {{ readyAttr: string, peekPct: number }} options
	 */
	function initFrameImageViewportScrollCore(frameEl, options) {
		options = options || {};
		var readyAttr = options.readyAttr || 'data-scroll-frame-image-ready';
		var peekPct = options.peekPct != null ? options.peekPct : 0;

		if (!frameEl || frameEl.getAttribute(readyAttr) === '1') {
			return;
		}

		var target = getFrameScrollTarget(frameEl);

		if (!target) {
			return;
		}

		frameEl.setAttribute(readyAttr, '1');

		var frameLengthVh = parseFrameScrollLengthVh(frameEl, 1.85);

		var frameScrub = parseScrollScrubAttr(frameEl, 'data-scroll-frame-scrub', 0.5);

		var blurPx = parseFloat(frameEl.getAttribute('data-scroll-frame-blur') || '80');
		if (isNaN(blurPx) || blurPx < 0) {
			blurPx = 80;
		}

		var overlapSel = (frameEl.getAttribute('data-scroll-frame-overlap') || '').trim();
		var overlapEl = null;
		if (overlapSel) {
			overlapEl = frameEl.querySelector(overlapSel) || document.querySelector(overlapSel);
		}
		var overlapDur = parseFloat(frameEl.getAttribute('data-scroll-frame-overlap-dur') || '0.45');
		if (isNaN(overlapDur) || overlapDur <= 0) {
			overlapDur = 0.45;
		}
		var overlapFrom = parseFloat(frameEl.getAttribute('data-scroll-frame-overlap-from') || '100');
		if (isNaN(overlapFrom)) {
			overlapFrom = 10;
		}

		var pinSpacingAttr = (frameEl.getAttribute('data-scroll-frame-pin-spacing') || '').trim().toLowerCase();
		var pinSpacing = false;
		if (pinSpacingAttr === 'true' || pinSpacingAttr === '1' || pinSpacingAttr === 'yes') {
			pinSpacing = true;
		} else if (pinSpacingAttr === 'margin') {
			pinSpacing = 'margin';
		}

		var peek = Math.min(Math.max(peekPct, 0), 100);
		function insetRectFromPeek(pct) {
			var inset = 50 * (1 - pct / 100);
			return 'inset(' + inset + '%)';
		}

		var startClipPath = insetRectFromPeek(peek);
		var endClipPath = 'inset(0%)';

		var startScale = 1.06 - 0.06 * (peek / 100);

		gsap.set(target, {
			clipPath: startClipPath,
			filter: 'blur(0px)',
			scale: startScale,
			transformOrigin: '50% 50%',
			willChange: 'clip-path, filter, transform',
			zIndex: overlapEl ? 1 : 'auto',
		});

		var tl = gsap.timeline({
			scrollTrigger: mergeScrollTriggerConfig(frameEl, {
				trigger: frameEl,
				start: 'top top',
				end: function () {
					return '+=' + Math.round(window.innerHeight * frameLengthVh);
				},
				pin: true,
				// anticipatePin: 1,
				invalidateOnRefresh: true,
				scrub: frameScrub,

				onLeave: function () {
					gsap.set(target, { clearProps: 'willChange' });
					if (overlapEl) {
						gsap.set(overlapEl, { clearProps: 'willChange' });
					}
				},
				onEnterBack: function () {
					gsap.set(target, { willChange: 'clip-path, filter, transform' });
					if (overlapEl) {
						gsap.set(overlapEl, { willChange: 'transform, opacity' });
					}
				},
				onLeaveBack: function () {
					gsap.set(target, { willChange: 'clip-path, filter, transform' });
					if (overlapEl) {
						gsap.set(overlapEl, { willChange: 'transform, opacity' });
					}
				},
				pinSpacing: pinSpacing,
			}),
		});

		tl.fromTo(
			target,
			{
				clipPath: startClipPath,
				scale: startScale,
			},
			{
				clipPath: endClipPath,
				scale: 1,
				ease: 'none',
				duration: 1,
			},
			0
		);

		// syncFrameHeight();

		tl.fromTo(
			target,
			{
				filter: 'blur(0px)',
			},
			{
				filter: 'blur(' + blurPx + 'px)',
				ease: 'none',
				duration: 0.65,
			},
			1
		);
	}

	/**
	 * @param {HTMLElement} frameEl
	 */
	function initFrameImageViewportScroll(frameEl) {
		if (isCoarsePointerDevice()) {
			var mobileTarget = getFrameScrollTarget(frameEl);
			if (!mobileTarget || frameEl.getAttribute('data-scroll-frame-image-ready') === '1') {
				return;
			}
			frameEl.setAttribute('data-scroll-frame-image-ready', '1');

			frameEl.querySelectorAll('[data-scroll-frame-image-target]').forEach(function(img) {
				img.style.margin = '32px 0';
				img.style.padding = '0 16px';
				img.style.filter = 'blur(0)';
			});

			frameEl.querySelectorAll('.independent-frame-overlap-panel').forEach(function(panel) {
				panel.classList.remove('independent-frame-overlap-panel');
			});

			// reset all tags has position: absolute to position: relative
			frameEl.querySelectorAll('.brxe-container > div').forEach(function(tag) {
				tag.style.position = 'relative';
				tag.style.top = 'inherit';
				tag.style.left = 'inherit';
				tag.style.right = 'inherit';
				tag.style.bottom = 'inherit';
				tag.style.transform = 'inherit';
				tag.style.height = 'auto';
				tag.style.padding = '60px 0';
			});

			// applyFrameBlurAttrsToTarget(frameEl, mobileTarget);
			// initImageBlurOnScroll(mobileTarget);
			return;
		}

		var p = parseFloat(frameEl.getAttribute('data-scroll-frame-image') || '30');
		if (isNaN(p) || p < 0) {
			p = 30;
		}
		if (p > 100) {
			p = 100;
		}

		initFrameImageViewportScrollCore(frameEl, {
			readyAttr: 'data-scroll-frame-image-ready',
			peekPct: p,
		});
	}

	/**
	 * Image reveal by clip-path (top → bottom) + slight lift.
	 * @param {HTMLElement} el
	 */
	function initImageClipReveal(el) {
		if (!el || el.getAttribute('data-scroll-image-reveal-ready') === '1') {
			return;
		}
		el.setAttribute('data-scroll-image-reveal-ready', '1');

		setTimeout(() => {
			gsap.set(el, {
				clipPath: 'inset(0% 0% 100% 0%)',
				yPercent: 8,
				opacity: 0.65,
				willChange: 'clip-path, transform, opacity',
			});

			gsap.to(el, {
				clipPath: 'inset(0% 0% 0% 0%)',
				yPercent: 0,
				opacity: 1,
				duration: 1.05,
				ease: 'power3.out',
				scrollTrigger: mergeScrollTriggerConfig(el, {
					trigger: el,
					start: 'top 85%',
					toggleActions: 'play none none reverse',
				}),
				onComplete: function () {
					gsap.set(el, { clearProps: 'willChange' });
				},
			});
		
		}, 2000);
	}

	/**
	 * Independent fade + blur reveal.
	 * @param {HTMLElement} el
	 */
	function initFadeBlurReveal(el) {
		if (!el || el.getAttribute('data-scroll-fade-blur-ready') === '1') {
			return;
		}
		el.setAttribute('data-scroll-fade-blur-ready', '1');
		setTimeout(() => {
			gsap.set(el, {
				opacity: 0,
				filter: 'blur(10px)',
				willChange: 'opacity, filter',
			});

			gsap.to(el, {
				opacity: 1,
				filter: 'blur(0px)',
				duration: 0.8,
				ease: 'power2.out',
				scrollTrigger: mergeScrollTriggerConfig(el, {
					trigger: el,
					start: 'top 85%',
					toggleActions: 'play none none reverse',
				}),
				onComplete: function () {
					gsap.set(el, { clearProps: 'willChange' });
				},
			});
		}, 2000);
	}

	/**
	 * @param {HTMLElement} subtitleEl
	 */
	function initSubtitleReveal(subtitleEl) {
		if (!subtitleEl || subtitleEl.getAttribute('data-scroll-subtitle-ready') === '1') {
			return;
		}
		subtitleEl.setAttribute('data-scroll-subtitle-ready', '1');

		var textTarget = subtitleEl.querySelector('[data-scroll-reveal-text]') || subtitleEl;
		var lineInners = splitIntoLineMasks(textTarget);

		gsap.set(subtitleEl, {
			opacity: 0,
			filter: 'blur(10px)',
			willChange: 'opacity, filter',
		});
		if (lineInners.length) {
			gsap.set(lineInners, { yPercent: 100, willChange: 'transform' });
		}

		var tl = gsap.timeline({
			scrollTrigger: mergeScrollTriggerConfig(subtitleEl, {
				trigger: subtitleEl,
				start: 'top 80%',
				toggleActions: 'play none none reverse',
			}),
		});

		tl.to(
			subtitleEl,
			{
				opacity: 1,
				filter: 'blur(0px)',
				duration: 0.65,
				ease: 'power2.out',
			},
			0
		);

		if (lineInners.length) {
			tl.to(
				lineInners,
				{
					yPercent: 0,
					duration: 0.9,
					stagger: 0.07,
					ease: 'power4.out',
				},
				0.05
			);
		}

		tl.call(function () {
			gsap.set(subtitleEl, { clearProps: 'willChange' });
			if (lineInners.length) {
				gsap.set(lineInners, { clearProps: 'willChange' });
			}
		});
	}

	/**
	 * @param {HTMLElement} el
	 * @returns {{ duration: number, stagger: number, ease: string, start: string }}
	 */
	function getSplitMaskAnimOptions(el) {
		var duration = parseFloat(el.getAttribute('data-scroll-mask-duration') || '0.8');
		if (isNaN(duration) || duration <= 0) {
			duration = 0.8;
		}
		var stagger = parseFloat(el.getAttribute('data-scroll-mask-stagger') || '0.05');
		if (isNaN(stagger) || stagger < 0) {
			stagger = 0.05;
		}
		var start = (el.getAttribute('data-scroll-mask-start') || 'top 82%').trim();
		return {
			duration: duration,
			stagger: stagger,
			ease: 'power4.out',
			start: start,
		};
	}

	/**
	 * GSAP split text masking: each line slides up inside overflow:hidden mask.
	 * @param {HTMLElement} triggerEl
	 * @param {HTMLElement[]} lineInners
	 * @param {{ start?: string, delay?: number }} extra
	 */
	function runSplitMaskReveal(triggerEl, lineInners, extra) {
		extra = extra || {};
		var opts = getSplitMaskAnimOptions(triggerEl);
		var start = extra.start || opts.start;

		gsap.set(lineInners, { yPercent: 100, willChange: 'transform' });

		var tweenVars = {
			yPercent: 0,
			duration: opts.duration,
			stagger: opts.stagger,
			ease: opts.ease,
			scrollTrigger: mergeScrollTriggerConfig(triggerEl, {
				trigger: triggerEl,
				start: start,
				toggleActions: 'play none none reverse',
			}),
			onComplete: function () {
				gsap.set(lineInners, { clearProps: 'willChange' });
			},
		};

		if (extra.delay != null && extra.delay > 0) {
			tweenVars.delay = extra.delay;
		}

		gsap.to(lineInners, tweenVars);
	}

	/**
	 * Split text masking by line — light stagger, power4.out, 0.8s per line.
	 * Markup: wrap lines in <p> or .line inside [data-scroll-mask-lines].
	 * @param {HTMLElement} rootEl
	 */
	function initSplitMaskLines(rootEl) {
		if (!rootEl || rootEl.getAttribute('data-scroll-mask-lines-ready') === '1') {
			return;
		}
		rootEl.setAttribute('data-scroll-mask-lines-ready', '1');

		var lineInners = splitIntoLineMasks(rootEl);
		if (!lineInners.length) {
			return;
		}

		runSplitMaskReveal(rootEl, lineInners);
	}

	/**
	 * List: each item gets its own line mask reveal.
	 * @param {HTMLElement} listEl
	 */
	function initSplitMaskList(listEl) {
		if (!listEl || listEl.getAttribute('data-scroll-mask-list-ready') === '1') {
			return;
		}
		listEl.setAttribute('data-scroll-mask-list-ready', '1');

		var items = listEl.querySelectorAll('[data-scroll-mask-item], li, .item');
		if (!items.length) {
			return;
		}

		var listStart =
			(listEl.getAttribute('data-scroll-mask-start') || 'top 88%').trim();

		items.forEach(function (item, idx) {
			var lineInners = splitIntoLineMasks(item);
			if (!lineInners.length) {
				return;
			}

			runSplitMaskReveal(item, lineInners, {
				start: listStart,
				delay: idx * 0.03,
			});
		});
	}

	/**
	 * @param {HTMLElement} root
	 * @returns {HTMLElement[]}
	 */
	function getGradientLineTargets(root) {
		if (!root) {
			return [];
		}

		var existing = root.querySelectorAll('.independent-gradient-line');
		if (existing.length) {
			return Array.from(existing);
		}

		var lines = root.querySelectorAll('[data-scroll-text-line], p, .line');
		var targets = [];

		if (lines.length) {
			lines.forEach(function (lineEl) {
				var text = lineEl.textContent.replace(/\s+/g, ' ').trim();
				if (!text) {
					return;
				}

				var inner = lineEl.querySelector(':scope > .independent-gradient-line');
				if (!inner) {
					inner = document.createElement('span');
					inner.className = 'independent-gradient-line';
					inner.style.display = 'inline';
					inner.innerHTML = lineEl.innerHTML;
					lineEl.innerHTML = '';
					lineEl.appendChild(inner);
				}

				targets.push(inner);
			});

			return targets;
		}

		var rootText = root.textContent.replace(/\s+/g, ' ').trim();
		if (!rootText) {
			return [];
		}

		var fallback = document.createElement('span');
		fallback.className = 'independent-gradient-line';
		fallback.style.display = 'inline';
		fallback.innerHTML = root.innerHTML;
		root.innerHTML = '';
		root.appendChild(fallback);
		return [fallback];
	}

	/**
	 * Scroll text reveal similar to GSAP demo:
	 * dark -> light via background-clip text while scrubbing scroll.
	 *
	 * @param {HTMLElement} el
	 */
	function initScrollGradientText(el) {
		if (!el || el.getAttribute('data-scroll-gradient-ready') === '1') {
			return;
		}
		el.setAttribute('data-scroll-gradient-ready', '1');

		var lineTargets = getGradientLineTargets(el);
		if (!lineTargets.length) {
			return;
		}
		var blurFrom = parseFloat(el.getAttribute('data-scroll-text-blur') || '12');
		if (isNaN(blurFrom) || blurFrom < 0) {
			blurFrom = 12;
		}

		var gradientScrub = parseScrollScrubAttr(el, 'data-scroll-gradient-scrub', 0.5);
		// On mobile, use a delayed gradient trigger for better effect
		var isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
		var gradientStart, gradientEnd;
		if (isMobile) {
			gradientStart = (el.getAttribute('data-scroll-gradient-start-mobile') || 'top 98%').trim();
			gradientEnd = (el.getAttribute('data-scroll-gradient-end-mobile') || 'top 65%').trim();
		} else {
			gradientStart = (el.getAttribute('data-scroll-gradient-start') || 'top 80%').trim();
			gradientEnd = (el.getAttribute('data-scroll-gradient-end') || 'top 5%').trim();
		}

		gsap.set(lineTargets, {
			backgroundImage: 'linear-gradient(to right, rgba(255,255,255, 1) 50%, rgba(255,255,255, 0.22) 50%)',
			backgroundSize: '200% 100%',
			backgroundPositionX: '100%',
			backgroundClip: 'text',
			webkitBackgroundClip: 'text',
			color: 'transparent',
			opacity: 0.42,
			willChange: 'background-position',
		});

		lineTargets.forEach(function (lineTarget) {
			gsap.to(lineTarget, {
				backgroundPositionX: '0%',
				opacity: 1,
				ease: 'power2.inOut',
				scrollTrigger: mergeScrollTriggerConfig(lineTarget, {
					trigger: lineTarget,
					start: gradientStart,
					end: gradientEnd,
					scrub: gradientScrub
				}),
				onComplete: function () {
					gsap.set(lineTarget, { clearProps: 'willChange' });
				},
			});
		});
	}

	/**
	 * Tag row: horizontal motion scrubbed to vertical scroll (no autoplay).
	 * Default scroll range: enter viewport (top bottom) → leave (bottom top). Full-bleed 100vw only if data-scroll-tags-fullwidth="1".
	 *
	 * @param {HTMLElement} root
	 */
	function initTagsHorizontalMarquee(root) {
		if (!root || root.getAttribute('data-scroll-tags-marquee-ready') === '1') {
			return;
		}

		var trackSel = (root.getAttribute('data-scroll-tags-track') || '').trim();
		var host = root;
		if (trackSel) {
			host = root.querySelector(trackSel);
			if (!host) {
				return;
			}
		}

		var row = document.createElement('div');
		row.className = 'independent-tags-marquee-row';

		while (host.firstChild) {
			row.appendChild(host.firstChild);
		}

		if (!row.children.length) {
			return;
		}

		root.setAttribute('data-scroll-tags-marquee-ready', '1');

		var row2 = row.cloneNode(true);
		row2.querySelectorAll('[id]').forEach(function (node) {
			node.removeAttribute('id');
		});
		row2.setAttribute('aria-hidden', 'true');

		var strip = document.createElement('div');
		strip.className = 'independent-tags-marquee-strip';
		strip.appendChild(row);
		strip.appendChild(row2);
		host.appendChild(strip);

		root.classList.add('independent-tags-marquee-root');

		var fullW = (root.getAttribute('data-scroll-tags-fullwidth') || '').trim().toLowerCase();
		if (fullW === '1' || fullW === 'true' || fullW === 'yes') {
			root.classList.add('independent-tags-scroll-full');
		}

		var h = Math.max(strip.offsetHeight, row.offsetHeight, 1);
		root.style.minHeight = h + 'px';

		if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			ScrollTrigger.refresh();
			return;
		}

		var endStr = (root.getAttribute('data-scroll-tags-scroll-end') || '').trim();
		if (!endStr) {
			endStr = 'bottom top';
		}

		var startStr = (root.getAttribute('data-scroll-tags-scroll-start') || '').trim();
		if (!startStr) {
			startStr = 'top bottom';
		}

		var tagsScrub = parseScrollScrubAttr(root, 'data-scroll-tags-scrub', 1.35);

		gsap.fromTo(
			strip,
			{ xPercent: 0, immediateRender: false },
			{
				xPercent: -50,
				ease: 'none',
				immediateRender: false,
				scrollTrigger: mergeScrollTriggerConfig(root, {
					trigger: root,
					start: startStr,
					end: endStr,
					scrub: tagsScrub,
					invalidateOnRefresh: true,
				}),
			}
		);
	}

	/**
	 * Horizontal scroll: click-and-drag (+ touch) to scroll track horizontally.
	 * Section breaks out to full viewport width; track slides via CSS transform.
	 *
	 * Optional attrs on section:
	 *   data-scroll-horizontal-track  — CSS selector for track child (default: first child)
	 *   data-scroll-horizontal-ease   — GSAP ease for momentum coast (default "power3.out")
	 *   data-scroll-horizontal-speed  — momentum multiplier (default 1.8)
	 *
	 * @param {HTMLElement} sectionEl
	 */
	function initHorizontalScroll(sectionEl) {
		if ( window.innerWidth < 768 ) {
			return;
		}

		if (!sectionEl || sectionEl.getAttribute('data-scroll-horizontal-ready') === '1') {
			return;
		}

		var trackSel = (sectionEl.getAttribute('data-scroll-horizontal-track') || '').trim();
		var track = trackSel
			? sectionEl.querySelector(trackSel)
			: sectionEl.firstElementChild;

		if (!track) {
			return;
		}

		sectionEl.setAttribute('data-scroll-horizontal-ready', '1');

		var momentumMult = parseFloat(sectionEl.getAttribute('data-scroll-horizontal-speed') || '1.8');
		if (isNaN(momentumMult) || momentumMult <= 0) { momentumMult = 1.8; }
		var coastEase = (sectionEl.getAttribute('data-scroll-horizontal-ease') || 'power3.out').trim();

		var parent = sectionEl.parentNode;
		var marginLeft = (window.innerWidth - parent.clientWidth) / 2;
		sectionEl.style.marginLeft = -marginLeft + 'px';
		sectionEl.style.width = '100dvw';
		sectionEl.style.maxWidth = '100dvw';
		sectionEl.style.overflow = 'hidden';
		sectionEl.style.position = 'relative';

		track.style.display = 'flex';
		track.style.flexWrap = 'nowrap';
		track.style.willChange = 'transform';
		Array.from(track.children).forEach(function (child) {
			child.style.flexShrink = '0';
		});

		var initialOffset = parseFloat(sectionEl.getAttribute('data-scroll-horizontal-offset') || 600);
		if (isNaN(initialOffset)) { initialOffset = 0; }

		var currentX = initialOffset;
		var targetX = initialOffset;
		var dragging = false;
		var startPointerX = 0;
		var startTrackX = 0;
		var rafId = null;

		var velocityHistory = [];
		var VELOCITY_SAMPLES = 5;

		var setX = gsap.quickSetter(track, 'x', 'px');

		function getMaxScroll() {
			var total = 0;
			Array.from(track.children).forEach(function (child) {
				total += child.offsetWidth;
			});
			var gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
			if (track.children.length > 1) {
				total += gap * (track.children.length - 1);
			}
			return Math.max(0, total - sectionEl.clientWidth);
		}

		function clampX(v) {
			return Math.max(-getMaxScroll(), Math.min(initialOffset, v));
		}

		function renderLoop() {
			currentX += (targetX - currentX) * 0.25;
			if (Math.abs(targetX - currentX) < 0.5) {
				currentX = targetX;
			}
			setX(currentX);
			if (dragging) {
				rafId = requestAnimationFrame(renderLoop);
			}
		}

		function getSmoothedVelocity() {
			if (!velocityHistory.length) { return 0; }
			var sum = 0;
			for (var i = 0; i < velocityHistory.length; i++) {
				sum += velocityHistory[i];
			}
			return sum / velocityHistory.length;
		}

		function onPointerDown(e) {
			if (e.type === 'mousedown' && e.button !== 0) { return; }
			dragging = true;
			gsap.killTweensOf(track);

			var clientX = e.touches ? e.touches[0].clientX : e.clientX;
			startPointerX = clientX;
			startTrackX = currentX;
			targetX = currentX;
			velocityHistory = [];

			sectionEl.style.cursor = 'grabbing';
			sectionEl.style.userSelect = 'none';
			sectionEl.style.webkitUserSelect = 'none';
			sectionEl.classList.add('is-dragging');

			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(renderLoop);
			e.preventDefault();
		}

		function onPointerMove(e) {
			if (!dragging) { return; }
			var clientX = e.touches ? e.touches[0].clientX : e.clientX;
			var dx = clientX - startPointerX;

			targetX = clampX(startTrackX + dx);

			velocityHistory.push(clientX);
			if (velocityHistory.length > VELOCITY_SAMPLES + 1) {
				velocityHistory.shift();
			}

			e.preventDefault();
		}

		function onPointerUp(e) {
			if (!dragging) { return; }
			dragging = false;
			cancelAnimationFrame(rafId);

			currentX = targetX;
			setX(currentX);

			sectionEl.style.cursor = 'grab';
			sectionEl.style.userSelect = '';
			sectionEl.style.webkitUserSelect = '';
			sectionEl.classList.remove('is-dragging');

			var vel = 0;
			if (velocityHistory.length >= 2) {
				vel = velocityHistory[velocityHistory.length - 1] - velocityHistory[0];
			}

			var throwDist = vel * momentumMult;
			var coastTarget = clampX(currentX + throwDist);
			var dist = Math.abs(coastTarget - currentX);

			if (dist > 2) {
				gsap.to(track, {
					x: coastTarget,
					duration: Math.max(0.35, Math.min(dist / 600, 1.6)),
					ease: coastEase,
					onUpdate: function () {
						currentX = gsap.getProperty(track, 'x');
						targetX = currentX;
					},
				});
			}
		}

		sectionEl.addEventListener('mousedown', onPointerDown);
		window.addEventListener('mousemove', onPointerMove);
		window.addEventListener('mouseup', onPointerUp);

		sectionEl.addEventListener('touchstart', onPointerDown, { passive: false });
		window.addEventListener('touchmove', onPointerMove, { passive: false });
		window.addEventListener('touchend', onPointerUp);

		sectionEl.addEventListener('click', function (e) {
			if (Math.abs(gsap.getProperty(track, 'x') - startTrackX) > 5) {
				e.preventDefault();
				e.stopPropagation();
			}
		}, true);

		track.querySelectorAll('img').forEach(function (img) {
			img.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
		});

		sectionEl.style.cursor = 'grab';
		setX(initialOffset);

		window.addEventListener('resize', function () {
			marginLeft = (window.innerWidth - parent.clientWidth) / 2;
			sectionEl.style.marginLeft = -marginLeft + 'px';
			var clamped = clampX(currentX);
			currentX = clamped;
			targetX = clamped;
			setX(clamped);
		});
	}

	/** @param {number} n @param {number} min @param {number} max */
	function clampRange(n, min, max) {
		return Math.min(max, Math.max(min, n));
	}

	/** @param {string|null} raw @param {number} fallback 0–1 */
	function parseUnit01(raw, fallback) {
		if (raw == null || raw === '') {
			return fallback;
		}
		var n = parseFloat(raw);
		if (isNaN(n)) {
			return fallback;
		}
		return clampRange(n, 0, 1);
	}

	/** Magnetic hover — shared rAF pool (isolated from GSAP timelines). */
	var magneticHoverPool = [];
	var magneticHoverRaf = 0;

	function startMagneticHoverLoop() {
		if (magneticHoverRaf) {
			return;
		}
		function tick() {
			var active = false;
			for (var i = 0; i < magneticHoverPool.length; i++) {
				var inst = magneticHoverPool[i];
				var dx = inst.targetX - inst.currentX;
				var dy = inst.targetY - inst.currentY;
				if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
					active = true;
				}
				inst.currentX += dx * inst.lerp;
				inst.currentY += dy * inst.lerp;
				inst.el.style.transform =
					'translate3d(' + inst.currentX + 'px,' + inst.currentY + 'px,0)';
			}
			if (active) {
				magneticHoverRaf = requestAnimationFrame(tick);
			} else {
				magneticHoverRaf = 0;
			}
		}
		magneticHoverRaf = requestAnimationFrame(tick);
	}

	/**
	 * @param {HTMLElement} el
	 */
	function initMagneticHover(el) {
		if (!el || el.getAttribute('data-magnetic-hover-ready') === '1') {
			return;
		}
		el.setAttribute('data-magnetic-hover-ready', '1');

		var inst = {
			el: el,
			strength: parseUnit01(el.getAttribute('data-magnetic-strength'), 0.35),
			lerp: parseUnit01(el.getAttribute('data-magnetic-lerp'), 0.12),
			targetX: 0,
			targetY: 0,
			currentX: 0,
			currentY: 0,
			hovering: false,
		};

		magneticHoverPool.push(inst);

		function setTarget(clientX, clientY) {
			var rect = el.getBoundingClientRect();
			var centerX = rect.left + rect.width / 2;
			var centerY = rect.top + rect.height / 2;
			inst.targetX = (clientX - centerX) * inst.strength;
			inst.targetY = (clientY - centerY) * inst.strength;
			startMagneticHoverLoop();
		}

		function resetTarget() {
			inst.targetX = 0;
			inst.targetY = 0;
			startMagneticHoverLoop();
		}

		el.addEventListener(
			'mouseenter',
			function (e) {
				inst.hovering = true;
				setTarget(e.clientX, e.clientY);
			},
			{ passive: true }
		);

		el.addEventListener(
			'mousemove',
			function (e) {
				if (!inst.hovering) {
					return;
				}
				setTarget(e.clientX, e.clientY);
			},
			{ passive: true }
		);

		el.addEventListener(
			'mouseleave',
			function () {
				inst.hovering = false;
				resetTarget();
			},
			{ passive: true }
		);
	}

	/**
	 * @param {HTMLElement} root
	 */
	function initMagneticHoverDemoRoot(root) {
		if (!root || root.getAttribute('data-magnetic-hover-demo-ready') === '1') {
			return;
		}
		var slider = root.querySelector('[data-magnetic-strength-slider]');
		if (!slider) {
			return;
		}
		root.setAttribute('data-magnetic-hover-demo-ready', '1');

		var targets = root.querySelectorAll('[data-magnetic-hover]');
		targets.forEach(initMagneticHover);

		function applyFromSlider() {
			var pct = parseFloat(slider.value);
			if (isNaN(pct)) {
				pct = 35;
			}
			var strength = clampRange(pct / 100, 0, 1);
			var targetList = Array.from(targets);
			targetList.forEach(function (node) {
				node.setAttribute('data-magnetic-strength', String(strength));
			});
			magneticHoverPool.forEach(function (inst) {
				if (targetList.indexOf(inst.el) !== -1) {
					inst.strength = strength;
				}
			});
		}

		slider.addEventListener('input', applyFromSlider);
		applyFromSlider();
	}

	/** @param {Window|HTMLElement} scroller */
	function getParallaxScrollY(scroller) {
		if (!scroller || scroller === window) {
			return window.scrollY || window.pageYOffset || 0;
		}
		return scroller.offsetTop;
	}

	/**
	 * @param {HTMLElement} root
	 */
	function initScrollParallaxColumns(root) {
		if (!root || root.getAttribute('data-scroll-parallax-ready') === '1') {
			return;
		}
		root.setAttribute('data-scroll-parallax-ready', '1');

		var cols = root.querySelectorAll('[data-scroll-parallax-col]');
		if (!cols.length) {
			return;
		}

		// var scroller = root;

		var items = [];
		var factorStart = 1;
		var factorStep = 0.25;
		cols.forEach(function (col, index) {
			var factor = factorStart + index * factorStep;
			cols[index].setAttribute('data-scroll-parallax-factor', String(factor));
			items.push({ el: col, factor: factor });
		});

		var ticking = false;
		function update() {
			ticking = false;

			if ( window.scrollY - root.offsetTop > -520 ) {
				for (var i = 0; i < items.length; i++) {
					var top = parseFloat(window.getComputedStyle(items[i].el).top);
					var itemFactor = parseFloat(items[i].el.getAttribute('data-scroll-parallax-factor'));
					items[i].el.style.top = (top + itemFactor) + 'px';
				}
			}
		}

		function onScroll() {
			if (ticking) {
				return;
			}

			ticking = true;
			requestAnimationFrame(update);
		}

		var scrollTarget = window;
		scrollTarget.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll, { passive: true });
		update();
	}

	function refreshScrollTrigger() {
		if (typeof ScrollTrigger === 'undefined') {
			return;
		}
		if (typeof ScrollTrigger.sort === 'function') {
			ScrollTrigger.sort();
		}
		ScrollTrigger.refresh();
	}

	function initAll() {
		// Skipped on mobile (coarse pointer): heavy CSS filter blur + background-clip
		// gradient text are GPU-expensive and don't read well on small screens.
		var isMobile = isCoarsePointerDevice();

		if (!isMobile) {
			document.querySelectorAll('[data-scroll-blur-image]').forEach(initImageBlurOnScroll);
		}

		document.querySelectorAll('[data-scroll-frame-image]').forEach(initFrameImageViewportScroll);
		document.querySelectorAll('[data-scroll-image-reveal]').forEach(initImageClipReveal);
		document.querySelectorAll('[data-scroll-fade-blur]').forEach(initFadeBlurReveal);
		document.querySelectorAll('[data-scroll-mask-lines]').forEach(initSplitMaskLines);
		document.querySelectorAll('[data-scroll-mask-list]').forEach(initSplitMaskList);

		document.querySelectorAll('[data-scroll-subtitle]').forEach(initSubtitleReveal);
		document.querySelectorAll('[data-scroll-text-gradient]').forEach(initScrollGradientText);
		document.querySelectorAll('[data-scroll-tags-marquee]').forEach(initTagsHorizontalMarquee);
		document.querySelectorAll('[data-scroll-horizontal]').forEach(initHorizontalScroll);
		document.querySelectorAll('[data-magnetic-hover-root]').forEach(initMagneticHoverDemoRoot);
		document.querySelectorAll('[data-magnetic-hover]').forEach(function (el) {
			if (!el.closest('[data-magnetic-hover-root]')) {
				initMagneticHover(el);
			}
		});
	
		if (window.location.search.includes('home-test')) {
			document.querySelectorAll('[data-scroll-parallax]').forEach(initScrollParallaxColumns);
		}
	

		requestAnimationFrame(function () {
			requestAnimationFrame(function () {
				if (typeof ScrollTrigger.sort === 'function') {
					ScrollTrigger.sort();
				}
				ScrollTrigger.refresh();
			});
		});
	}

	var scrollInitStarted = false;

	function startAll() {
		if (scrollInitStarted) {
			return;
		}
		scrollInitStarted = true;
		initAll();
	}

	function scheduleStartAll() {
		requestAnimationFrame(function () {
			requestAnimationFrame(startAll);
		});
	}

	function bootScrollAnimations() {
		scheduleStartAll();
	}

	if (document.readyState === 'complete' || document.readyState === 'interactive') {
		bootScrollAnimations();
	} else {
		document.addEventListener('DOMContentLoaded', bootScrollAnimations);
	}

	window.addEventListener('load', async function () {
		window.scrollTo(0, 0);

		if (document.fonts && document.fonts.ready) {
			await document.fonts.ready;
		}

		if (typeof ScrollTrigger !== 'undefined') {
			ScrollTrigger.refresh();
		}
	});
})();
