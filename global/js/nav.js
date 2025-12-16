function switchMainView(viewName) {
    const slider = document.getElementById('viewSlider');
    const bmAmp = document.getElementById('bm-amplifier');
    const bmFlat = document.getElementById('bm-flatten');

    if (viewName === 'amplifier') {
        // Show Top Page (Translate Y to 0)
        slider.style.transform = 'translateY(0)';
        bmAmp.classList.add('active');
        bmFlat.classList.remove('active');
    } else {
        // Show Bottom Page (Translate Y to -50% because container is 200vh)
        slider.style.transform = 'translateY(-50%)';
        bmAmp.classList.remove('active');
        bmFlat.classList.add('active');
    }
}