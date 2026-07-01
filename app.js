/**
 * AURA Booth - Core Application Logic
 * Premium, client-side web photobooth.
 */

// Global Error Logger for UI debugging
window.addEventListener('error', (e) => {
    let debugDiv = document.getElementById('debug-log');
    if (!debugDiv) {
        debugDiv = document.createElement('div');
        debugDiv.id = 'debug-log';
        debugDiv.style.position = 'fixed';
        debugDiv.style.bottom = '10px';
        debugDiv.style.right = '10px';
        debugDiv.style.background = 'rgba(239, 68, 68, 0.95)';
        debugDiv.style.color = '#fff';
        debugDiv.style.padding = '12px';
        debugDiv.style.borderRadius = '8px';
        debugDiv.style.fontSize = '11px';
        debugDiv.style.zIndex = '99999';
        debugDiv.style.maxWidth = '300px';
        debugDiv.style.wordBreak = 'break-all';
        debugDiv.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
        document.body.appendChild(debugDiv);
    }
    debugDiv.innerHTML = `<strong>JS Error:</strong> ${e.message}<br>at ${e.filename ? e.filename.split('/').pop() : 'unknown'}:${e.lineno}`;
});

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements Query ---
    
    // Steps
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');
    
    // Step 1 Elements
    const startShootBtn = document.getElementById('start-shoot-btn');
    const layoutCards = document.querySelectorAll('.layout-card');
    
    // Step 2 Elements
    const backToLayoutBtn = document.getElementById('back-to-layout-btn');
    const activeLayoutDisplayText = document.getElementById('active-layout-display-text');
    const photoCountBadge = document.getElementById('photo-count-badge');
    const countdownDurationSelect = document.getElementById('countdown-duration');
    const cameraSelect = document.getElementById('camera-select');
    const startCameraBtn = document.getElementById('start-camera-btn');
    
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('filter-canvas');
    const ctx = canvas.getContext('2d');
    
    const gridHelper = document.getElementById('grid-helper');
    const flashOverlay = document.getElementById('flash-overlay');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownNumber = document.getElementById('countdown-number');
    const captureIndicator = document.getElementById('capture-indicator');
    const indicatorText = document.getElementById('indicator-text');
    const captureBtn = document.getElementById('capture-btn');
    
    // Step 3 Elements
    const previewContainer = document.getElementById('preview-container');
    const compiledPreviewImg = document.getElementById('compiled-preview-img');
    const borderThicknessInput = document.getElementById('border-thickness');
    const cornerRadiusInput = document.getElementById('corner-radius');
    const borderValLabel = document.getElementById('border-val');
    const radiusValLabel = document.getElementById('radius-val');
    const stampTextInput = document.getElementById('stamp-text');
    const showDateCheckbox = document.getElementById('show-date');
    const applyGrainCheckbox = document.getElementById('apply-grain');
    
    const framePresetBtns = document.querySelectorAll('.frame-preset-btn');
    const customColorInput = document.getElementById('custom-frame-color');
    const colorHexLabel = document.getElementById('color-hex-label');
    
    const uploadTriggerBtn = document.getElementById('upload-trigger-btn');
    const fileInput = document.getElementById('custom-frame-upload');
    const uploadStatus = document.getElementById('upload-status');
    const uploadFilename = document.getElementById('upload-filename');
    const clearUploadBtn = document.getElementById('clear-upload-btn');
    
    const stickerSelectBtns = document.querySelectorAll('.sticker-select-btn');
    
    const downloadBtn = document.getElementById('download-btn');
    const downloadGifBtn = document.getElementById('download-gif-btn');
    const retakeBtn = document.getElementById('retake-btn');
    
    // Modals
    const viewModal = document.getElementById('view-modal');
    const closeViewBtn = document.getElementById('close-view-btn');
    const viewModalImg = document.getElementById('view-modal-img');
    const viewDownloadBtn = document.getElementById('view-download-btn');
    
    // --- State Variables ---
    let activeStep = 1;
    let cameraStream = null;
    let streamActive = false;
    let activeFilter = 'normal';
    let activeLayout = 'collage'; // matches selected card data-layout
    let activeFramePreset = 'white';
    let activePattern = 'none';
    let isCapturing = false;
    
    let audioCtx = null;
    let soundEnabled = true;
    let capturedFrames = [];
    let currentSessionGalleryId = null;
    
    let customColor = null;
    let customFrameImage = null;
    let placedStickers = [];
    let selectedDeviceId = '';
    let activeStickerTheme = 'none';
    let themeImages = { doraemon: null, masha: null, arcade: null, cosmic: null, girlypop: null, sanrio: null };

    // --- Audio Synthesis System (Web Audio API) ---
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playTickSound() {
        if (!soundEnabled) return;
        initAudio();
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, audioCtx.currentTime); // High pitch click
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.08);
        } catch (e) {
            console.error('Audio synthesis failed:', e);
        }
    }

    function playShutterSound() {
        if (!soundEnabled) return;
        initAudio();
        try {
            // White noise generation for mechanical shutter sound
            const bufferSize = audioCtx.sampleRate * 0.35;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noiseNode = audioCtx.createBufferSource();
            noiseNode.buffer = buffer;
            
            const filterNode = audioCtx.createBiquadFilter();
            filterNode.type = 'bandpass';
            filterNode.frequency.value = 1000;
            filterNode.Q.value = 2;
            
            const gainNode = audioCtx.createGain();
            gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            
            // Retro winding beep sound
            const osc = audioCtx.createOscillator();
            const oscGain = audioCtx.createGain();
            osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.15);
            oscGain.gain.setValueAtTime(0.05, audioCtx.currentTime + 0.15);
            oscGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
            
            // Connections
            noiseNode.connect(filterNode);
            filterNode.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.connect(oscGain);
            oscGain.connect(audioCtx.destination);
            
            noiseNode.start();
            osc.start(audioCtx.currentTime + 0.15);
            osc.stop(audioCtx.currentTime + 0.35);
        } catch (e) {
            console.error('Audio shutter synthesis failed:', e);
        }
    }

    // --- Wizard Navigation System ---

    // --- Wizard Navigation System ---
    function navigateToStep(stepNum) {
        activeStep = stepNum;
        
        step1.classList.remove('active');
        step2.classList.remove('active');
        step3.classList.remove('active');
        
        if (stepNum === 1) {
            step1.classList.add('active');
            stopCamera();
        } else if (stepNum === 2) {
            step2.classList.add('active');
            updateLayoutDetails();
            startCamera();
        } else if (stepNum === 3) {
            step3.classList.add('active');
            stopCamera();
            // Trigger compile for the editor view
            refreshEditorPreview();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function getPhotoCount(layout) {
        switch(layout) {
            case 'polaroid':
            case 'cinema': return 1;
            case 'layout2v':
            case 'layout2h': return 2;
            case 'layout3v': return 3;
            case 'collage':
            case 'filmstrip':
            case 'grid2x2': return 4;
            case 'layout6cut': return 6;
            case 'layout9cut': return 9;
            default: return 4;
        }
    }

    function getLayoutLabel(layout) {
        switch(layout) {
            case 'collage': return 'Layout A (4 Photos)';
            case 'layout3v': return 'Layout B (3 Photos)';
            case 'layout2v': return 'Layout C (2 Photos)';
            case 'layout6cut': return 'Layout D (6 Photos)';
            case 'filmstrip': return 'Traditional (4 Photos)';
            case 'polaroid': return 'Polaroid (1 Photo)';
            case 'grid2x2': return 'Square 2x2 (4 Photos)';
            case 'layout9cut': return '9-Cut Grid (9 Photos)';
            case 'layout2h': return 'Double Wide (2 Photos)';
            case 'cinema': return 'Cinema Wide (1 Photo)';
            default: return 'Custom Layout';
        }
    }

    function updateLayoutDetails() {
        activeLayoutDisplayText.textContent = getLayoutLabel(activeLayout);
        const count = getPhotoCount(activeLayout);
        photoCountBadge.textContent = count;
    }

    // Step 1: Layout Selection click handler
    layoutCards.forEach(card => {
        card.addEventListener('click', () => {
            layoutCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            activeLayout = card.getAttribute('data-layout');
        });
    });

    startShootBtn.addEventListener('click', () => {
        initAudio();
        navigateToStep(2);
    });

    backToLayoutBtn.addEventListener('click', () => {
        navigateToStep(1);
    });

    // Logo home click
    document.getElementById('logo-home').addEventListener('click', () => {
        navigateToStep(1);
    });

    // --- Camera Control and Feeds ---
    function setupWebcamCanvas() {
        streamActive = true;
        document.getElementById('camera-placeholder').classList.add('hidden');
        gridHelper.classList.remove('hidden');
        captureBtn.removeAttribute('disabled');
        
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        
        loadCameraDevices();
        renderLoop();
    }

    async function startCamera() {
        const placeholderP = document.getElementById('camera-placeholder').querySelector('p');
        if (placeholderP) {
            placeholderP.style.color = 'var(--text-secondary)';
            placeholderP.innerHTML = '<span style="color: #ec4899; font-weight: 600;">Menghubungkan ke kamera...</span><br>Silakan izinkan akses jika browser Anda memunculkan dialog konfirmasi di atas.';
        }
        
        try {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
            video.srcObject = null;
            
            const constraints = {
                video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
                audio: false
            };
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("API getUserMedia tidak didukung pada browser ini (pastikan koneksi aman HTTPS/localhost)");
            }
            
            // Promise that resolves when the camera is fully streaming and rendering
            const cameraActivationPromise = new Promise(async (resolve, reject) => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    video.srcObject = stream;
                    
                    function checkReady() {
                        if (video.readyState >= 2) {
                            cameraStream = stream;
                            setupWebcamCanvas();
                            resolve();
                        } else {
                            video.onloadedmetadata = () => {
                                cameraStream = stream;
                                setupWebcamCanvas();
                                resolve();
                            };
                        }
                    }
                    
                    checkReady();
                    video.play().then(() => {
                        // Sometimes autoplay plays before state check
                        if (video.readyState >= 2 && !streamActive) {
                            cameraStream = stream;
                            setupWebcamCanvas();
                            resolve();
                        }
                    }).catch(err => {
                        console.warn("Video play failed or blocked: ", err);
                        cameraStream = stream;
                        setupWebcamCanvas();
                        resolve();
                    });
                } catch (e) {
                    reject(e);
                }
            });
            
            // 5-second timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    const err = new Error("Batas waktu habis (Timeout 5 detik). Kamera berhasil dibuka oleh browser, tetapi perangkat keras kamera tidak mengirimkan data gambar. Kamera kemungkinan sedang dikunci oleh aplikasi lain (seperti Zoom, Discord, OBS, browser lain) atau driver kamera Windows Anda hang.");
                    err.name = "TimeoutError";
                    reject(err);
                }, 5000);
            });
            
            await Promise.race([cameraActivationPromise, timeoutPromise]);
            
        } catch (err) {
            console.error('Kamera gagal diakses: ', err);
            if (placeholderP) {
                placeholderP.style.color = '#f87171';
                placeholderP.innerHTML = `<strong>Gagal terhubung ke kamera:</strong><br>Error: ${err.name} - ${err.message}<br><br>Jika kamera sedang dibuka oleh aplikasi lain (seperti Zoom, Discord, OBS, atau tab browser lain), silakan tutup aplikasi tersebut terlebih dahulu.`;
            }
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
            video.srcObject = null;
        }
    }

    function stopCamera() {
        streamActive = false;
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        video.srcObject = null;
        document.getElementById('camera-placeholder').classList.remove('hidden');
        gridHelper.classList.add('hidden');
        captureBtn.setAttribute('disabled', 'true');
    }

    startCameraBtn.addEventListener('click', () => {
        initAudio();
        startCamera();
    });

    if (cameraSelect) {
        cameraSelect.addEventListener('change', (e) => {
            selectedDeviceId = e.target.value;
            startCamera();
        });
    }

    async function loadCameraDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            if (!cameraSelect) return;
            
            const currentVal = cameraSelect.value;
            cameraSelect.innerHTML = '';
            
            if (videoDevices.length === 0) {
                cameraSelect.innerHTML = '<option value="">No Camera Found</option>';
                return;
            }
            
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Camera ${index + 1}`;
                if (device.deviceId === currentVal || (currentVal === "" && index === 0)) {
                    option.selected = true;
                }
                cameraSelect.appendChild(option);
            });
        } catch (e) {
            console.error("Gagal mendeteksi kamera:", e);
        }
    }

    // Render loop apply webcam filter real-time
    function renderLoop() {
        if (!streamActive || activeStep !== 2) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.filter = getCanvasFilterString(activeFilter);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        requestAnimationFrame(renderLoop);
    }

    function getCanvasFilterString(filter) {
        switch(filter) {
            case 'mono':
                return 'grayscale(100%) contrast(125%) brightness(95%)';
            case 'traditional':
                return 'contrast(108%) saturate(120%) sepia(12%) brightness(105%)';
            case 'sepia':
                return 'sepia(80%) contrast(110%) brightness(92%) saturate(85%)';
            case 'vintage':
                return 'sepia(35%) contrast(90%) brightness(96%) saturate(85%) hue-rotate(-8deg)';
            case 'soft':
                return 'saturate(110%) hue-rotate(180deg) brightness(102%) contrast(105%)';
            case 'noir':
                return 'grayscale(100%) contrast(150%) brightness(80%)';
            case 'vivid':
                return 'contrast(115%) saturate(160%) brightness(102%)';
            case 'normal':
            default:
                return 'none';
        }
    }

    // Filter Buttons selector
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            activeFilter = target.getAttribute('data-filter');
        });
    });

    // --- Capture Sequence Execution ---
    captureBtn.addEventListener('click', async () => {
        if (isCapturing || !streamActive) return;
        isCapturing = true;
        captureBtn.setAttribute('disabled', 'true');
        capturedFrames = [];
        
        initAudio();
        
        const photoCount = getPhotoCount(activeLayout);
        const countdownSeconds = parseInt(countdownDurationSelect.value) || 3;
        
        captureIndicator.classList.remove('hidden');
        
        for (let i = 0; i < photoCount; i++) {
            indicatorText.textContent = `Mengambil Foto ${i + 1}/${photoCount}`;
            
            // Countdown beep loop
            countdownOverlay.classList.remove('hidden');
            for (let count = countdownSeconds; count > 0; count--) {
                countdownNumber.classList.remove('smile-text');
                countdownNumber.textContent = count;
                
                // Force animation restart on each tick
                countdownNumber.style.animation = 'none';
                void countdownNumber.offsetWidth; // trigger reflow
                countdownNumber.style.animation = 'countdownScale 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
                
                playTickSound();
                await delay(1000);
            }
            
            countdownNumber.classList.add('smile-text');
            countdownNumber.textContent = "SMILE!";
            
            countdownNumber.style.animation = 'none';
            void countdownNumber.offsetWidth; // trigger reflow
            countdownNumber.style.animation = 'smilePop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
            
            await delay(600); // slightly longer pause for smile
            countdownOverlay.classList.add('hidden');
            
            // Flash and Capture sound triggers
            flashOverlay.classList.add('flash-active');
            playShutterSound();
            
            const frame = captureFrameFromVideo();
            capturedFrames.push(frame);
            
            await delay(400);
            flashOverlay.classList.remove('flash-active');
            
            if (i < photoCount - 1) {
                await delay(1200); // 1.2s delay before starting the next count
            }
        }
        
        captureIndicator.classList.add('hidden');
        isCapturing = false;
        captureBtn.removeAttribute('disabled');
        
        currentSessionGalleryId = Date.now();
        clearEditorStickers();
        
        // Go straight to Studio Editor (Step 3)
        navigateToStep(3);
    });

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function captureFrameFromVideo() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 640;
        tempCanvas.height = 480;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Selfie mirror scale
        tempCtx.translate(tempCanvas.width, 0);
        tempCtx.scale(-1, 1);
        
        tempCtx.filter = getCanvasFilterString(activeFilter);
        tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        
        return tempCanvas;
    }

    // --- Studio Editor re-rendering logic ---
    function refreshEditorPreview() {
        if (capturedFrames.length === 0) return;
        const compiledUrl = compileCollage(capturedFrames);
        compiledPreviewImg.src = compiledUrl;
    }

    // Listen to changes on customizer controls to refresh canvas immediately
    borderThicknessInput.addEventListener('input', () => {
        const val = borderThicknessInput.value;
        if (val < 20) borderValLabel.textContent = 'S';
        else if (val < 30) borderValLabel.textContent = 'M';
        else borderValLabel.textContent = 'L';
        refreshEditorPreview();
    });

    cornerRadiusInput.addEventListener('input', () => {
        const val = cornerRadiusInput.value;
        if (val == 0) radiusValLabel.textContent = 'Kotak';
        else if (val < 10) radiusValLabel.textContent = 'Sedang';
        else radiusValLabel.textContent = 'Bulat';
        refreshEditorPreview();
    });

    stampTextInput.addEventListener('input', refreshEditorPreview);
    showDateCheckbox.addEventListener('change', refreshEditorPreview);
    applyGrainCheckbox.addEventListener('change', refreshEditorPreview);

    // Sticker theme preset selections
    const stickerThemeBtns = document.querySelectorAll('.sticker-theme-btn');
    stickerThemeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            stickerThemeBtns.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            activeStickerTheme = target.getAttribute('data-theme');
            
            // Enforce stamp input to always display AURA BOOTH
            stampTextInput.value = "AURA BOOTH";
            showDateCheckbox.checked = true;
            
            // Auto apply theme colors for a matching visual look
            if (activeStickerTheme === 'doraemon') {
                activeFramePreset = 'custom';
                customColor = '#38bdf8';
                colorHexLabel.textContent = '#38bdf8';
                customColorInput.value = '#38bdf8';
            } else if (activeStickerTheme === 'masha') {
                activeFramePreset = 'custom';
                customColor = '#16a34a';
                colorHexLabel.textContent = '#16a34a';
                customColorInput.value = '#16a34a';
            } else if (activeStickerTheme === 'arcade') {
                activeFramePreset = 'custom';
                customColor = '#4c1d95';
                colorHexLabel.textContent = '#4c1d95';
                customColorInput.value = '#4c1d95';
            } else if (activeStickerTheme === 'cosmic') {
                activeFramePreset = 'custom';
                customColor = '#7c3aed';
                colorHexLabel.textContent = '#7c3aed';
                customColorInput.value = '#7c3aed';
            } else if (activeStickerTheme === 'girlypop') {
                activeFramePreset = 'pink';
                framePresetBtns.forEach(b => {
                    if (b.getAttribute('data-frame') === 'pink') b.classList.add('active');
                    else b.classList.remove('active');
                });
            } else if (activeStickerTheme === 'sanrio') {
                activeFramePreset = 'custom';
                customColor = '#f5d0fe'; // light pastel violet/pink
                colorHexLabel.textContent = '#F5D0FE';
                customColorInput.value = '#f5d0fe';
            } else if (activeStickerTheme === 'none') {
                activeFramePreset = 'white';
                framePresetBtns.forEach(b => {
                    if (b.getAttribute('data-frame') === 'white') b.classList.add('active');
                    else b.classList.remove('active');
                });
            }
            
            // Load theme image assets dynamically if needed
            if (['doraemon', 'masha', 'arcade', 'cosmic', 'girlypop', 'sanrio'].includes(activeStickerTheme)) {
                getThemeImage(activeStickerTheme).then(() => {
                    refreshEditorPreview();
                });
            } else {
                refreshEditorPreview();
            }
        });
    });

    // Frame preset selections
    framePresetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            framePresetBtns.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            activeFramePreset = target.getAttribute('data-frame');
            
            customColor = null;
            refreshEditorPreview();
        });
    });

    // Pattern presets selections
    const patternPresetBtns = document.querySelectorAll('.pattern-preset-btn');
    patternPresetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            patternPresetBtns.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            activePattern = target.getAttribute('data-pattern');
            refreshEditorPreview();
        });
    });

    // Custom Color picker
    customColorInput.addEventListener('input', (e) => {
        customColor = e.target.value;
        colorHexLabel.textContent = customColor.toUpperCase();
        
        framePresetBtns.forEach(b => b.classList.remove('active'));
        activeFramePreset = 'custom';
        refreshEditorPreview();
    });

    // PNG design overlay upload details
    uploadTriggerBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    customFrameImage = img;
                    uploadFilename.textContent = file.name;
                    uploadStatus.classList.remove('hidden');
                    uploadTriggerBtn.innerHTML = '<i data-lucide="check"></i> Frame Loaded';
                    lucide.createIcons();
                    refreshEditorPreview();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    clearUploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        customFrameImage = null;
        fileInput.value = '';
        uploadStatus.classList.add('hidden');
        uploadTriggerBtn.innerHTML = '<i data-lucide="upload-cloud"></i> Upload Frame PNG';
        lucide.createIcons();
        refreshEditorPreview();
    });

    // --- Stitching Collage Creator ---
    function compileCollage(frames) {
        const stripCanvas = document.createElement('canvas');
        const sCtx = stripCanvas.getContext('2d');
        
        const borderThickness = parseInt(borderThicknessInput.value);
        const radius = parseInt(cornerRadiusInput.value);
        const hasDate = showDateCheckbox.checked;
        let stampText = stampTextInput.value.trim().toUpperCase();
        if (!stampText) {
            stampText = activeLayout === 'filmstrip' ? 'KODAK FILM' : 'AURA BOOTH';
        }
        
        let totalWidth, totalHeight;
        const drawnPhotoCoords = [];
        
        if (activeLayout === 'collage') {
            const photoWidth = 600;
            const photoHeight = 450;
            const gap = borderThickness;
            const bottomSpacing = 95;
            
            totalWidth = photoWidth + (2 * borderThickness);
            totalHeight = (4 * photoHeight) + (5 * gap) + bottomSpacing;
            
            stripCanvas.width = totalWidth;
            stripCanvas.height = totalHeight;
            
            drawFrameBackground(sCtx, totalWidth, totalHeight);
            
            for (let i = 0; i < 4; i++) {
                const px = borderThickness;
                const py = borderThickness + (i * (photoHeight + gap));
                drawnPhotoCoords.push({ x: px, y: py, w: photoWidth, h: photoHeight });
                
                sCtx.save();
                sCtx.beginPath();
                sCtx.roundRect(px, py, photoWidth, photoHeight, radius);
                sCtx.clip();
                sCtx.drawImage(frames[i], 0, 0, frames[i].width, frames[i].height, px, py, photoWidth, photoHeight);
                sCtx.restore();
            }
            
            const stampY = totalHeight - 50;
            drawStamp(sCtx, totalWidth, stampY, stampText, hasDate);
            
        } else if (activeLayout === 'layout3v') {
            const photoWidth = 600;
            const photoHeight = 450;
            const gap = borderThickness;
            const bottomSpacing = 95;
            
            totalWidth = photoWidth + (2 * borderThickness);
            totalHeight = (3 * photoHeight) + (4 * gap) + bottomSpacing;
            
            stripCanvas.width = totalWidth;
            stripCanvas.height = totalHeight;
            
            drawFrameBackground(sCtx, totalWidth, totalHeight);
            
            for (let i = 0; i < 3; i++) {
                const px = borderThickness;
                const py = borderThickness + (i * (photoHeight + gap));
                drawnPhotoCoords.push({ x: px, y: py, w: photoWidth, h: photoHeight });
                
                sCtx.save();
                sCtx.beginPath();
                sCtx.roundRect(px, py, photoWidth, photoHeight, radius);
                sCtx.clip();
                sCtx.drawImage(frames[i], 0, 0, frames[i].width, frames[i].height, px, py, photoWidth, photoHeight);
                sCtx.restore();
            }
            
            const stampY = totalHeight - 50;
            drawStamp(sCtx, totalWidth, stampY, stampText, hasDate);
            
        } else if (activeLayout === 'layout2v') {
            const photoWidth = 600;
            const photoHeight = 450;
            const gap = borderThickness;
            const bottomSpacing = 95;
            
            totalWidth = photoWidth + (2 * borderThickness);
            totalHeight = (2 * photoHeight) + (3 * gap) + bottomSpacing;
            
            stripCanvas.width = totalWidth;
            stripCanvas.height = totalHeight;
            
            drawFrameBackground(sCtx, totalWidth, totalHeight);
            
            for (let i = 0; i < 2; i++) {
                const px = borderThickness;
                const py = borderThickness + (i * (photoHeight + gap));
                drawnPhotoCoords.push({ x: px, y: py, w: photoWidth, h: photoHeight });
                
                sCtx.save();
                sCtx.beginPath();
                sCtx.roundRect(px, py, photoWidth, photoHeight, radius);
                sCtx.clip();
                sCtx.drawImage(frames[i], 0, 0, frames[i].width, frames[i].height, px, py, photoWidth, photoHeight);
                sCtx.restore();
            }
            
            const stampY = totalHeight - 50;
            drawStamp(sCtx, totalWidth, stampY, stampText, hasDate);
            
        } else if (activeLayout === 'layout6cut') {
            const photoWidth = 400;
            const photoHeight = 300;
            const gap = borderThickness;
            const bottomSpacing = 90;
            
            totalWidth = (2 * photoWidth) + (3 * borderThickness);
            totalHeight = (3 * photoHeight) + (4 * gap) + bottomSpacing;
            
            stripCanvas.width = totalWidth;
            stripCanvas.height = totalHeight;
            
            drawFrameBackground(sCtx, totalWidth, totalHeight);
            
            const coords = [
                { x: borderThickness, y: borderThickness },
                { x: 2 * borderThickness + photoWidth, y: borderThickness },
                { x: borderThickness, y: 2 * borderThickness + photoHeight },
                { x: 2 * borderThickness + photoWidth, y: 2 * borderThickness + photoHeight },
                { x: borderThickness, y: 3 * borderThickness + 2 * photoHeight },
                { x: 2 * borderThickness + photoWidth, y: 3 * borderThickness + 2 * photoHeight }
            ];
            
            for (let i = 0; i < 6; i++) {
                const px = coords[i].x;
                const py = coords[i].y;
                drawnPhotoCoords.push({ x: px, y: py, w: photoWidth, h: photoHeight });
                
                sCtx.save();
                sCtx.beginPath();
                sCtx.roundRect(px, py, photoWidth, photoHeight, radius);
                sCtx.clip();
                sCtx.drawImage(frames[i], 0, 0, frames[i].width, frames[i].height, px, py, photoWidth, photoHeight);
                sCtx.restore();
            }
            
            const stampY = totalHeight - 48;
            drawStamp(sCtx, totalWidth, stampY, stampText, hasDate);
            
        } else if (activeLayout === 'filmstrip') {
            const photoWidth = 600;
            const photoHeight = 450;
            const gap = borderThickness;
            const bottomSpacing = 95;
            
            totalWidth = photoWidth + (2 * borderThickness);
            totalHeight = (4 * photoHeight) + (5 * gap) + bottomSpacing;
            
            stripCanvas.width = totalWidth;
            stripCanvas.height = totalHeight;
            
            sCtx.fillStyle = '#121212';
            sCtx.fillRect(0, 0, totalWidth, totalHeight);
            
            const sprocketW = 20;
            const sprocketH = 14;
            const leftX = Math.max(5, borderThickness - 23);
            const rightX = totalWidth - leftX - sprocketW;
            
            for (let y = 15; y < totalHeight - 15; y += 45) {
                sCtx.beginPath();
                sCtx.roundRect(leftX, y, sprocketW, sprocketH, 3);
                sCtx.roundRect(rightX, y, sprocketW, sprocketH, 3);
                sCtx.fill();
            }
            
            sCtx.fillStyle = '#f97316';
            sCtx.font = 'bold 9px monospace';
            sCtx.textAlign = 'left';
            for (let i = 0; i < 4; i++) {
                const py = borderThickness + (i * (photoHeight + gap));
                sCtx.fillText('▷ AURA 400', leftX + sprocketW + 6, py + 12);
                sCtx.fillText(`▷ 0${i+1}`, leftX + sprocketW + 6, py + 26);
            }
            
            for (let i = 0; i < 4; i++) {
                const px = borderThickness;
                const py = borderThickness + (i * (photoHeight + gap));
                drawnPhotoCoords.push({ x: px, y: py, w: photoWidth, h: photoHeight });
                
                sCtx.save();
                sCtx.beginPath();
                sCtx.roundRect(px, py, photoWidth, photoHeight, radius);
                sCtx.clip();
                sCtx.drawImage(frames[i], 0, 0, frames[i].width, frames[i].height, px, py, photoWidth, photoHeight);
                sCtx.restore();
            }
            
            const stampY = totalHeight - 50;
            drawStamp(sCtx, totalWidth, stampY, stampText, hasDate);
            
        } else if (activeLayout === 'polaroid') {
            const photoSize = 500;
            const bottomSpacing = 120;
            
            totalWidth = photoSize + (2 * borderThickness);
            totalHeight = photoSize + (2 * borderThickness) + bottomSpacing;
            
            stripCanvas.width = totalWidth;
            stripCanvas.height = totalHeight;
            
            drawFrameBackground(sCtx, totalWidth, totalHeight);
            
            const px = borderThickness;
            const py = borderThickness;
            drawnPhotoCoords.push({ x: px, y: py, w: photoSize, h: photoSize });
            
            sCtx.save();
            sCtx.beginPath();
            sCtx.roundRect(px, py, photoSize, photoSize, radius);
            sCtx.clip();
            
            const img = frames[0];
            const size = Math.min(img.width, img.height);
            const sx = (img.width - size) / 2;
            const sy = (img.height - size) / 2;
            
            sCtx.drawImage(img, sx, sy, size, size, px, py, photoSize, photoSize);
            sCtx.restore();
            
            const stampY = totalHeight - 55;
            drawStamp(sCtx, totalWidth, stampY, stampText, hasDate);
            
        } else if (activeLayout === 'grid2x2') {
            const photoWidth = 400;
            const photoHeight = 300;
            const gap = borderThickness;
            const bottomSpacing = 90;
            
            totalWidth = (2 * photoWidth) + (3 * borderThickness);
            totalHeight = (2 * photoHeight) + (3 * gap) + bottomSpacing;
            
            stripCanvas.width = totalWidth;
            stripCanvas.height = totalHeight;
            
            drawFrameBackground(sCtx, totalWidth, totalHeight);
            
            const coords = [
                { x: borderThickness, y: borderThickness },
                { x: 2 * borderThickness + photoWidth, y: borderThickness },
                { x: borderThickness, y: 2 * borderThickness + photoHeight },
                { x: 2 * borderThickness + photoWidth, y: 2 * borderThickness + photoHeight }
            ];
            
            for (let i = 0; i < 4; i++) {
                const px = coords[i].x;
                const py = coords[i].y;
                drawnPhotoCoords.push({ x: px, y: py, w: photoWidth, h: photoHeight });
                
                sCtx.save();
                sCtx.beginPath();
                sCtx.roundRect(px, py, photoWidth, photoHeight, radius);
                sCtx.clip();
                sCtx.drawImage(frames[i], 0, 0, frames[i].width, frames[i].height, px, py, photoWidth, photoHeight);
                sCtx.restore();
            }
            
            const stampY = totalHeight - 48;
            drawStamp(sCtx, totalWidth, stampY, stampText, hasDate);
            
        } else if (activeLayout === 'layout2h') {
            const photoWidth = 400;
            const photoHeight = 300;
            const gap = borderThickness;
            const bottomSpacing = 90;
            
            totalWidth = (2 * photoWidth) + (3 * borderThickness);
            totalHeight = photoHeight + (2 * borderThickness) + bottomSpacing;
            
            stripCanvas.width = totalWidth;
            stripCanvas.height = totalHeight;
            
            drawFrameBackground(sCtx, totalWidth, totalHeight);
            
            for (let i = 0; i < 2; i++) {
                const px = borderThickness + i * (photoWidth + gap);
                const py = borderThickness;
                drawnPhotoCoords.push({ x: px, y: py, w: photoWidth, h: photoHeight });
                
                sCtx.save();
                sCtx.beginPath();
                sCtx.roundRect(px, py, photoWidth, photoHeight, radius);
                sCtx.clip();
                sCtx.drawImage(frames[i], 0, 0, frames[i].width, frames[i].height, px, py, photoWidth, photoHeight);
                sCtx.restore();
            }
            
            const stampY = totalHeight - 48;
            drawStamp(sCtx, totalWidth, stampY, stampText, hasDate);
            
        } else if (activeLayout === 'cinema') {
            const photoWidth = 600;
            const photoHeight = 338; // 16:9 ratio
            const bottomSpacing = 90;
            
            totalWidth = photoWidth + (2 * borderThickness);
            totalHeight = photoHeight + (2 * borderThickness) + bottomSpacing;
            
            stripCanvas.width = totalWidth;
            stripCanvas.height = totalHeight;
            
            drawFrameBackground(sCtx, totalWidth, totalHeight);
            
            const px = borderThickness;
            const py = borderThickness;
            drawnPhotoCoords.push({ x: px, y: py, w: photoWidth, h: photoHeight });
            
            sCtx.save();
            sCtx.beginPath();
            sCtx.roundRect(px, py, photoWidth, photoHeight, radius);
            sCtx.clip();
            
            // Crop source frame[0] to 16:9 widescreen
            const img = frames[0];
            const srcW = img.width;
            const srcH = Math.round(img.width * 9 / 16);
            const sx = 0;
            const sy = Math.max(0, (img.height - srcH) / 2);
            
            sCtx.drawImage(img, sx, sy, srcW, srcH, px, py, photoWidth, photoHeight);
            sCtx.restore();
            
            const stampY = totalHeight - 48;
            drawStamp(sCtx, totalWidth, stampY, stampText, hasDate);
            
        } else if (activeLayout === 'layout9cut') {
            const photoWidth = 280;
            const photoHeight = 210;
            const gap = borderThickness;
            const bottomSpacing = 90;
            
            totalWidth = (3 * photoWidth) + (4 * borderThickness);
            totalHeight = (3 * photoHeight) + (4 * gap) + bottomSpacing;
            
            stripCanvas.width = totalWidth;
            stripCanvas.height = totalHeight;
            
            drawFrameBackground(sCtx, totalWidth, totalHeight);
            
            for (let i = 0; i < 9; i++) {
                const row = Math.floor(i / 3);
                const col = i % 3;
                const px = borderThickness + col * (photoWidth + gap);
                const py = borderThickness + row * (photoHeight + gap);
                drawnPhotoCoords.push({ x: px, y: py, w: photoWidth, h: photoHeight });
                
                sCtx.save();
                sCtx.beginPath();
                sCtx.roundRect(px, py, photoWidth, photoHeight, radius);
                sCtx.clip();
                sCtx.drawImage(frames[i], 0, 0, frames[i].width, frames[i].height, px, py, photoWidth, photoHeight);
                sCtx.restore();
            }
            
            const stampY = totalHeight - 48;
            drawStamp(sCtx, totalWidth, stampY, stampText, hasDate);
        }
        
        // Draw Stickers Theme Overlays (Aesthetic Layout)
        if (activeStickerTheme !== 'none') {
            drawAestheticThemeDecorations(sCtx, totalWidth, totalHeight, drawnPhotoCoords);
        }
        
        // Overlay custom transparent PNG design if uploaded
        if (customFrameImage) {
            sCtx.drawImage(customFrameImage, 0, 0, totalWidth, totalHeight);
        }
        
        // Apply grain filter noise
        if (applyGrainCheckbox.checked) {
            const imgData = sCtx.getImageData(0, 0, totalWidth, totalHeight);
            const data = imgData.data;
            const strength = 18;
            for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * strength;
                data[i] = Math.min(255, Math.max(0, data[i] + noise));
                data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
                data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
            }
            sCtx.putImageData(imgData, 0, 0);
        }
        
        return stripCanvas.toDataURL('image/jpeg', 0.88);
    }

    function compileGifFrame(photoIndex) {
        const frameCanvas = document.createElement('canvas');
        const sCtx = frameCanvas.getContext('2d');
        
        const w = 600;
        const h = 600;
        frameCanvas.width = w;
        frameCanvas.height = h;
        
        // 1. Draw theme background color and pattern
        drawFrameBackground(sCtx, w, h);
        
        // 2. Draw the photo inside an inner frame
        const border = 40;
        const photoW = w - (border * 2);
        const photoH = h - (border * 2) - 40; // leave some spacing at bottom
        
        const px = border;
        const py = border;
        const radius = parseInt(cornerRadiusInput.value) || 8;
        
        sCtx.save();
        sCtx.beginPath();
        sCtx.roundRect(px, py, photoW, photoH, radius);
        sCtx.clip();
        
        const frameImg = capturedFrames[photoIndex];
        // Draw image keeping correct cropping
        sCtx.drawImage(frameImg, 0, 0, frameImg.width, frameImg.height, px, py, photoW, photoH);
        sCtx.restore();
        
        // 3. Draw a stamp text at the bottom
        let stampText = stampTextInput.value.trim().toUpperCase() || 'AURA BOOTH';
        sCtx.fillStyle = ['black', 'burgundy', 'maroon'].includes(activeFramePreset) ? '#94a3b8' : '#64748b';
        sCtx.font = `bold 14px var(--font-heading)`;
        sCtx.textAlign = 'center';
        sCtx.letterSpacing = '0.15em';
        sCtx.fillText(stampText, w / 2, h - 35);
        
        // 4. Draw theme-specific sticker for this frame
        if (activeStickerTheme !== 'none') {
            const themeImg = themeImages[activeStickerTheme];
            if (themeImg && themeImg.complete && themeImg.naturalWidth > 0) {
                sCtx.save();
                const sSize = 90;
                const sx = w - border - sSize + 15;
                const sy = border + photoH - sSize + 25;
                
                // Choose sticker based on photo index (so different frames have different stickers!)
                const colWidth = themeImg.width / 4;
                const rowHeight = themeImg.height / 2;
                const idx = photoIndex % 8;
                const col = idx % 4;
                const row = Math.floor(idx / 4);
                
                sCtx.drawImage(
                    themeImg, 
                    col * colWidth, row * rowHeight, colWidth, rowHeight, // source
                    sx, sy, sSize, sSize // destination
                );
                sCtx.restore();
            }
        }
        
        return frameCanvas.toDataURL('image/png');
    }

    function drawAestheticThemeDecorations(sCtx, totalWidth, totalHeight, photoCoords) {
        if (photoCoords.length === 0) return;
        
        sCtx.save();
        
        // Draw border details (clouds, daisies, stars)
        drawThemeFrameBackgroundDetails(sCtx, totalWidth, totalHeight);
        
        const themeImg = themeImages[activeStickerTheme];
        if (!themeImg) {
            sCtx.restore();
            return; // No emojis fallback!
        }
        
        const sw = themeImg.width / 2;
        const sh = themeImg.height / 2;
        
        const p1 = photoCoords[0]; // first photo
        const pLast = photoCoords[photoCoords.length - 1]; // last photo
        const borderThickness = parseInt(borderThicknessInput.value) || 26;
        
        // Sticker 1: Left character (Top-Left quadrant 0) peeking from outer Left border (Top)
        const size1 = Math.round(p1.w * 0.24);
        drawPeekingSticker(sCtx, themeImg, 0, 0, sw, sh, borderThickness - size1 * 0.45, p1.y + p1.h * 0.05, size1, -6, totalWidth);
        
        // Sticker 2: Top-Right accessory (Bottom-Right quadrant 3) sitting at the top-right corner of the first photo
        const size2 = Math.round(p1.w * 0.16);
        drawPeekingSticker(sCtx, themeImg, sw, sh, sw, sh, totalWidth - borderThickness - size2 * 0.85, p1.y + 10, size2, 12, totalWidth);
        
        // Sticker 3: Right character (Top-Right quadrant 1) peeking from outer Right border (Middle)
        const size3 = Math.round(p1.w * 0.23);
        const middleY = totalHeight * 0.45;
        drawPeekingSticker(sCtx, themeImg, sw, 0, sw, sh, totalWidth - borderThickness - size3 * 0.55, middleY, size3, 8, totalWidth);
        
        // Sticker 4: Bottom-Left character (Top-Left quadrant 0) peeking from Left border of the bottom area (only for tall layouts)
        if (photoCoords.length > 2) {
            const size4 = Math.round(p1.w * 0.22);
            drawPeekingSticker(sCtx, themeImg, 0, 0, sw, sh, borderThickness - size4 * 0.45, pLast.y + pLast.h * 0.05, size4, -8, totalWidth);
        }
        
        // Sticker 5: Bottom-Right accessory (Bottom-Left quadrant 2) sitting in the bottom-right corner of the last photo
        const size5 = Math.round(pLast.w * 0.18);
        const qx = (activeStickerTheme === 'doraemon' || activeStickerTheme === 'sanrio') ? 0 : sw;
        const qy = sh;
        drawPeekingSticker(sCtx, themeImg, qx, qy, sw, sh, totalWidth - borderThickness - size5 * 0.85, pLast.y + pLast.h - size5 * 0.85, size5, 6, totalWidth);
        
        sCtx.restore();
    }

    function drawPeekingSticker(sCtx, img, sx, sy, sw, sh, dx, dy, size, degrees, totalWidth) {
        // Clamp the draw coordinates to keep the sticker fully inside the canvas boundaries
        const clampedDx = Math.max(5, Math.min(dx, totalWidth - size - 5));
        
        sCtx.save();
        sCtx.translate(clampedDx + size / 2, dy + size / 2);
        sCtx.rotate((degrees * Math.PI) / 180);
        sCtx.drawImage(img, sx, sy, sw, sh, -size / 2, -size / 2, size, size);
        sCtx.restore();
    }

    function drawThemeFrameBackgroundDetails(sCtx, w, h) {
        const borderThickness = parseInt(borderThicknessInput.value) || 26;
        sCtx.save();
        
        if (activeStickerTheme === 'doraemon') {
            sCtx.fillStyle = 'rgba(255, 255, 255, 0.42)'; // soft clouds
            drawCloud(sCtx, borderThickness / 2, h * 0.12, 24);
            drawCloud(sCtx, w - borderThickness / 2, h * 0.38, 20);
            drawCloud(sCtx, borderThickness / 2, h * 0.62, 22);
            drawCloud(sCtx, w - borderThickness / 2, h * 0.82, 26);
        } else if (activeStickerTheme === 'masha') {
            drawDaisy(sCtx, borderThickness / 2, h * 0.12, 8);
            drawDaisy(sCtx, w - borderThickness / 2, h * 0.38, 6);
            drawDaisy(sCtx, borderThickness / 2, h * 0.62, 9);
            drawDaisy(sCtx, w - borderThickness / 2, h * 0.82, 7);
        } else if (activeStickerTheme === 'cosmic') {
            sCtx.fillStyle = '#ffffff';
            drawStarDot(sCtx, borderThickness / 2, h * 0.12, 2);
            drawStarDot(sCtx, w - borderThickness / 2, h * 0.38, 1.5);
            drawStarDot(sCtx, borderThickness / 2, h * 0.62, 3);
            drawStarDot(sCtx, w - borderThickness / 2, h * 0.82, 2);
            
            // Subtly draw a planetary ring
            sCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            sCtx.lineWidth = 1.5;
            sCtx.beginPath();
            sCtx.arc(w - borderThickness / 2, h * 0.22, 28, 0, Math.PI * 2);
            sCtx.stroke();
        } else if (activeStickerTheme === 'sanrio') {
            sCtx.fillStyle = 'rgba(236, 72, 153, 0.45)'; // soft pink sparkles
            drawDaisy(sCtx, borderThickness / 2, h * 0.12, 6);
            drawDaisy(sCtx, w - borderThickness / 2, h * 0.38, 5);
            drawDaisy(sCtx, borderThickness / 2, h * 0.62, 7);
            drawDaisy(sCtx, w - borderThickness / 2, h * 0.82, 6);
        } else if (activeStickerTheme === 'arcade') {
            sCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            for (let y = h * 0.05; y < h * 0.95; y += h * 0.05) {
                sCtx.fillRect(5, y, 3, 3);
                sCtx.fillRect(w - 8, y + 20, 3, 3);
            }
        }
        
        sCtx.restore();
    }

    function drawCloud(sCtx, cx, cy, r) {
        sCtx.beginPath();
        sCtx.arc(cx, cy, r, 0, Math.PI * 2);
        sCtx.arc(cx + r * 0.5, cy - r * 0.2, r * 0.7, 0, Math.PI * 2);
        sCtx.arc(cx - r * 0.5, cy - r * 0.1, r * 0.6, 0, Math.PI * 2);
        sCtx.fill();
    }

    function drawDaisy(sCtx, cx, cy, size) {
        sCtx.save();
        sCtx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        for (let i = 0; i < 5; i++) {
            sCtx.beginPath();
            sCtx.arc(cx + Math.cos(i * Math.PI * 2 / 5) * size, cy + Math.sin(i * Math.PI * 2 / 5) * size, size * 0.7, 0, Math.PI * 2);
            sCtx.fill();
        }
        sCtx.fillStyle = '#fef08a'; // yellow pistil
        sCtx.beginPath();
        sCtx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.restore();
    }

    function drawStarDot(sCtx, cx, cy, r) {
        sCtx.beginPath();
        sCtx.arc(cx, cy, r, 0, Math.PI * 2);
        sCtx.fill();
    }

    function drawAestheticEmojisFallback(sCtx, totalWidth, totalHeight, photoCoords) {
        sCtx.save();
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        
        const p1 = photoCoords[0];
        const fontSize1 = Math.round(p1.w * 0.11);
        sCtx.font = `${fontSize1}px Arial`;
        const margin = Math.round(p1.w * 0.04);
        
        if (activeStickerTheme === 'girlypop') {
            sCtx.fillText('🎀', p1.x + margin + fontSize1/2, p1.y + margin + fontSize1/2);
            const pLast = photoCoords[photoCoords.length - 1];
            sCtx.fillText('💖', pLast.x + pLast.w - margin - fontSize1/2, pLast.y + pLast.h - margin - fontSize1/2);
            if (photoCoords.length >= 3) {
                const p3 = photoCoords[2];
                sCtx.fillText('✨', p3.x + p3.w - margin - fontSize1/2, p3.y + margin + fontSize1/2);
            }
        } else if (activeStickerTheme === 'mofusand') {
            sCtx.fillText('🐱', p1.x + margin + fontSize1/2, p1.y + margin + fontSize1/2);
            const pLast = photoCoords[photoCoords.length - 1];
            sCtx.fillText('🐾', pLast.x + pLast.w - margin - fontSize1/2, pLast.y + pLast.h - margin - fontSize1/2);
        } else {
            const emojiMap = {
                doraemon: ['🐱', '🚁', '🔔', '🍩'],
                masha: ['👧', '🌲', '🐻', '🍯'],
                arcade: ['🎮', '👾', '🍒', '👻'],
                cosmic: ['🧑‍🚀', '🪐', '🚀', '👽']
            };
            const emojis = emojiMap[activeStickerTheme] || [];
            if (emojis.length >= 4) {
                sCtx.fillText(emojis[0], p1.x + margin + fontSize1/2, p1.y + margin + fontSize1/2);
                const p2 = photoCoords[1] || p1;
                sCtx.fillText(emojis[3], p2.x + p2.w - margin - fontSize1/2, p2.y + p2.h - margin - fontSize1/2);
                if (photoCoords.length >= 3) {
                    const p3 = photoCoords[2];
                    sCtx.fillText(emojis[1], p3.x + p3.w - margin - fontSize1/2, p3.y + margin + fontSize1/2);
                }
                const pLast = photoCoords[photoCoords.length - 1];
                sCtx.fillText(emojis[2], pLast.x + margin + fontSize1/2, pLast.y + pLast.h - margin - fontSize1/2);
            }
        }
        sCtx.restore();
    }

    const themeAssetPaths = {
        doraemon: 'assets/doraemon.png',
        masha: 'assets/masha.png',
        arcade: 'assets/arcade.png',
        cosmic: 'assets/cosmic.png',
        girlypop: 'assets/girlypop.png',
        sanrio: 'assets/sanrio.png'
    };

    function createTransparentStickers(imgUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(img, 0, 0);
                
                try {
                    const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    const data = imgData.data;
                    
                    // Turn solid white/light background to transparent
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i+1];
                        const b = data[i+2];
                        // Slightly relaxed threshold to remove anti-aliasing white halos cleanly
                        if (r > 232 && g > 232 && b > 232) {
                            data[i+3] = 0; // alpha = 0
                        }
                    }
                    tempCtx.putImageData(imgData, 0, 0);
                    
                    const transImg = new Image();
                    transImg.onload = () => resolve(transImg);
                    transImg.onerror = reject;
                    transImg.src = tempCanvas.toDataURL();
                } catch (e) {
                    console.warn("Chroma keying failed, using fallback img", e);
                    resolve(img);
                }
            };
            img.onerror = reject;
            img.src = imgUrl;
        });
    }

    async function getThemeImage(theme) {
        if (!themeAssetPaths[theme]) return null;
        if (themeImages[theme]) return themeImages[theme];
        try {
            const transImg = await createTransparentStickers(themeAssetPaths[theme]);
            themeImages[theme] = transImg;
            return transImg;
        } catch (e) {
            console.error("Gagal memuat gambar tema " + theme + ":", e);
            return null;
        }
    }

    function getQuadrantSource(q, sw, sh) {
        switch(q) {
            case 0: return { sx: 0, sy: 0 };
            case 1: return { sx: sw, sy: 0 };
            case 2: return { sx: 0, sy: sh };
            case 3:
            default:
                return { sx: sw, sy: sh };
        }
    }

    async function preloadThemeImages() {
        const themes = ['doraemon', 'masha', 'arcade', 'cosmic', 'girlypop', 'sanrio'];
        for (const theme of themes) {
            getThemeImage(theme).catch(e => console.warn("Preload failed for theme " + theme, e));
        }
    }

    function drawFrameBackground(sCtx, w, h) {
        if (activeFramePreset === 'custom' && customColor) {
            sCtx.fillStyle = customColor;
        } else {
            // Colors from picker presets
            switch(activeFramePreset) {
                case 'black': sCtx.fillStyle = '#121212'; break;
                case 'pink': sCtx.fillStyle = '#ffd3e8'; break;
                case 'green': sCtx.fillStyle = '#dcfce7'; break;
                case 'blue': sCtx.fillStyle = '#d3e5ff'; break;
                case 'yellow': sCtx.fillStyle = '#fef08a'; break;
                case 'purple': sCtx.fillStyle = '#f3e8ff'; break;
                case 'maroon': sCtx.fillStyle = '#991b1b'; break;
                case 'burgundy': sCtx.fillStyle = '#800020'; break;
                case 'white':
                default:
                    sCtx.fillStyle = '#ffffff';
            }
        }
        sCtx.fillRect(0, 0, w, h);

        // Draw Pattern Overlay
        if (activePattern === 'rainbow') {
            const grad = sCtx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#ffadad');
            grad.addColorStop(0.2, '#ffd3b6');
            grad.addColorStop(0.4, '#ffeaa7');
            grad.addColorStop(0.6, '#caffbf');
            grad.addColorStop(0.8, '#9bf6ff');
            grad.addColorStop(1, '#ffc6ff');
            sCtx.fillStyle = grad;
            sCtx.fillRect(0, 0, w, h);
        } else if (activePattern === 'dots') {
            sCtx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            const dotRadius = Math.max(3, w * 0.008); // scale dots with size
            const spacing = Math.max(20, w * 0.05);
            for (let x = spacing/2; x < w; x += spacing) {
                for (let y = spacing/2; y < h; y += spacing) {
                    sCtx.beginPath();
                    sCtx.arc(x, y, dotRadius, 0, Math.PI * 2);
                    sCtx.fill();
                }
            }
        } else if (activePattern === 'stripes') {
            sCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            const stripeWidth = Math.max(10, w * 0.025);
            sCtx.save();
            sCtx.beginPath();
            sCtx.rect(0, 0, w, h);
            sCtx.clip();
            for (let i = -h; i < w; i += stripeWidth * 2.5) {
                sCtx.beginPath();
                sCtx.moveTo(i, 0);
                sCtx.lineTo(i + stripeWidth, 0);
                sCtx.lineTo(i + stripeWidth + h, h);
                sCtx.lineTo(i + h, h);
                sCtx.closePath();
                sCtx.fill();
            }
            sCtx.restore();
        } else if (activePattern === 'sunset') {
            const grad = sCtx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#ff9a9e');
            grad.addColorStop(0.5, '#fecfef');
            grad.addColorStop(1, '#a1c4fd');
            sCtx.fillStyle = grad;
            sCtx.fillRect(0, 0, w, h);
        } else if (activePattern === 'stars') {
            sCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            // Draw deterministic starry pattern
            for (let i = 0; i < 60; i++) {
                const x = (i * 137 + 59) % w;
                const y = (i * 283 + 97) % h;
                const r = ((i * 17) % 3) + 2;
                sCtx.beginPath();
                sCtx.arc(x, y, r, 0, Math.PI * 2);
                sCtx.fill();
            }
        }
    }

    function drawStamp(sCtx, w, y, text, hasDate) {
        let textColor = '#0f172a'; // dark theme text
        const darkBgs = ['black', 'maroon', 'burgundy'];
        if (darkBgs.includes(activeFramePreset)) {
            textColor = '#f8fafc';
        }
        
        sCtx.fillStyle = textColor;
        sCtx.textAlign = 'center';
        
        sCtx.font = 'bold 24px Georgia, serif';
        sCtx.letterSpacing = '2px';
        sCtx.fillText(text, w / 2, y);
        
        if (hasDate) {
            const today = new Date();
            const dateStr = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`;
            sCtx.font = '500 13px "Outfit", sans-serif';
            sCtx.fillStyle = darkBgs.includes(activeFramePreset) ? '#94a3b8' : '#64748b';
            sCtx.fillText(dateStr, w / 2, y + 25);
        }
    }

    // --- Interactive Sticker Lab (Drag / Scale / Drop) ---
    function clearEditorStickers() {
        placedStickers = [];
        const existing = previewContainer.querySelectorAll('.sticker-item');
        existing.forEach(s => s.remove());
    }

    stickerSelectBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.getAttribute('data-sticker');
            addSticker(emoji);
        });
    });

    function addSticker(emoji) {
        const stickerItem = document.createElement('div');
        stickerItem.className = 'sticker-item';
        stickerItem.textContent = emoji;
        stickerItem.style.left = '50%';
        stickerItem.style.top = '50%';
        stickerItem.style.fontSize = '40px';
        
        previewContainer.appendChild(stickerItem);
        
        const stickerObj = {
            element: stickerItem,
            emoji: emoji,
            x: 0.5,
            y: 0.5,
            size: 40
        };
        
        placedStickers.push(stickerObj);
        makeStickerDraggable(stickerItem, stickerObj);
    }

    function makeStickerDraggable(stickerItem, stickerObj) {
        let isDragging = false;
        let startX, startY;
        let initialLeft, initialTop;
        
        stickerItem.addEventListener('mousedown', startDrag);
        stickerItem.addEventListener('touchstart', startDrag, { passive: false });
        
        function startDrag(e) {
            document.querySelectorAll('.sticker-item').forEach(s => s.classList.remove('selected'));
            stickerItem.classList.add('selected');
            
            isDragging = true;
            const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
            
            startX = clientX;
            startY = clientY;
            
            const rect = stickerItem.getBoundingClientRect();
            const parentRect = previewContainer.getBoundingClientRect();
            initialLeft = rect.left - parentRect.left + rect.width / 2;
            initialTop = rect.top - parentRect.top + rect.height / 2;
            
            document.addEventListener('mousemove', dragMove);
            document.addEventListener('mouseup', dragEnd);
            document.addEventListener('touchmove', dragMove, { passive: false });
            document.addEventListener('touchend', dragEnd);
            
            e.preventDefault();
        }
        
        function dragMove(e) {
            if (!isDragging) return;
            const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
            
            const dx = clientX - startX;
            const dy = clientY - startY;
            
            const newLeft = initialLeft + dx;
            const newTop = initialTop + dy;
            
            const parentRect = previewContainer.getBoundingClientRect();
            
            const pctX = Math.max(0, Math.min(1, newLeft / parentRect.width));
            const pctY = Math.max(0, Math.min(1, newTop / parentRect.height));
            
            stickerItem.style.left = `${pctX * 100}%`;
            stickerItem.style.top = `${pctY * 100}%`;
            
            stickerObj.x = pctX;
            stickerObj.y = pctY;
            
            e.preventDefault();
        }
        
        function dragEnd() {
            isDragging = false;
            document.removeEventListener('mousemove', dragMove);
            document.removeEventListener('mouseup', dragEnd);
            document.removeEventListener('touchmove', dragMove);
            document.removeEventListener('touchend', dragEnd);
        }
        
        stickerItem.addEventListener('dblclick', () => {
            stickerItem.remove();
            placedStickers = placedStickers.filter(s => s !== stickerObj);
        });
        
        stickerItem.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -4 : 4;
            stickerObj.size = Math.max(20, Math.min(120, stickerObj.size + delta));
            stickerItem.style.fontSize = `${stickerObj.size}px`;
        });
    }

    // Combine sticker elements onto download file
    function generateFinalCollageWithStickers(baseCollageUrl) {
        return new Promise((resolve) => {
            if (placedStickers.length === 0) {
                resolve(baseCollageUrl);
                return;
            }
            
            const img = new Image();
            img.onload = () => {
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = img.width;
                finalCanvas.height = img.height;
                const finalCtx = finalCanvas.getContext('2d');
                
                finalCtx.drawImage(img, 0, 0);
                
                placedStickers.forEach(sticker => {
                    finalCtx.save();
                    
                    const cx = sticker.x * finalCanvas.width;
                    const cy = sticker.y * finalCanvas.height;
                    
                    finalCtx.translate(cx, cy);
                    finalCtx.textAlign = 'center';
                    finalCtx.textBaseline = 'middle';
                    
                    const previewRect = previewContainer.getBoundingClientRect();
                    const scaleFactor = finalCanvas.width / previewRect.width;
                    const finalFontSize = sticker.size * scaleFactor;
                    
                    finalCtx.font = `${finalFontSize}px Arial`;
                    finalCtx.fillText(sticker.emoji, 0, 0);
                    finalCtx.restore();
                });
                
                resolve(finalCanvas.toDataURL('image/jpeg', 0.88));
            };
            img.src = baseCollageUrl;
        });
    }

    // --- Action Button triggers ---
    downloadBtn.addEventListener('click', async () => {
        const finalCollageUrl = await generateFinalCollageWithStickers(compiledPreviewImg.src);
        
        const link = document.createElement('a');
        const stampStr = stampTextInput.value.trim().replace(/\s+/g, '_').toLowerCase() || 'aura_booth';
        link.download = `${stampStr}_${Date.now()}.png`;
        link.href = finalCollageUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Save to Local Gallery
        if (currentSessionGalleryId) {
            saveToGallery(finalCollageUrl, currentSessionGalleryId);
        }
    });

    retakeBtn.addEventListener('click', () => {
        // Go back to step 1
        navigateToStep(1);
    });

    // Simulated QR Code Generator Modal removed

    // Real Animated GIF compiler using gifshot
    let isCompilingGif = false;
    downloadGifBtn.addEventListener('click', () => {
        if (capturedFrames.length < 2) {
            alert('GIF compile requires at least 2 camera poses.');
            return;
        }
        if (isCompilingGif) return;
        
        isCompilingGif = true;
        downloadGifBtn.innerHTML = '<i data-lucide="loader" class="spin-loader"></i> Compiling...';
        lucide.createIcons();
        
        // 1. Generate frames as themed data URLs
        const gifFrames = [];
        for (let i = 0; i < capturedFrames.length; i++) {
            gifFrames.push(compileGifFrame(i));
        }
        
        // 2. Use gifshot to create the animated GIF
        gifshot.createGIF({
            images: gifFrames,
            gifWidth: 600,
            gifHeight: 600,
            interval: 0.5, // 500ms delay per frame
            numFrames: capturedFrames.length,
            frameDuration: 5
        }, function(obj) {
            isCompilingGif = false;
            downloadGifBtn.innerHTML = '<i data-lucide="clapperboard"></i> Download GIF';
            lucide.createIcons();
            
            if (!obj.error) {
                const link = document.createElement('a');
                link.download = `aurabooth_animation_${Date.now()}.gif`;
                link.href = obj.image; // actual animated gif base64
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert('Gagal membuat GIF: ' + obj.error);
            }
        });
    });

    // --- Saved Gallery Management ---
    function saveToGallery(imgDataUrl, id) {
        let gallery = [];
        try {
            const saved = localStorage.getItem('aura_booth_gallery');
            if (saved) {
                gallery = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Gallery loading failed, resetting:', e);
        }
        
        const existingIdx = gallery.findIndex(item => item.id === id);
        if (existingIdx !== -1) {
            gallery[existingIdx].data = imgDataUrl;
        } else {
            gallery.unshift({ id, data: imgDataUrl });
        }
        
        // limit history storage size
        if (gallery.length > 12) {
            gallery = gallery.slice(0, 12);
        }
        
        try {
            localStorage.setItem('aura_booth_gallery', JSON.stringify(gallery));
        } catch (e) {
            console.error('Storage full, clearing oldest items:', e);
            if (gallery.length > 3) {
                gallery = gallery.slice(0, 6);
                localStorage.setItem('aura_booth_gallery', JSON.stringify(gallery));
            }
        }
        
        renderGallery();
    }

    function deleteFromGallery(id) {
        let gallery = [];
        const saved = localStorage.getItem('aura_booth_gallery');
        if (saved) {
            gallery = JSON.parse(saved);
        }
        gallery = gallery.filter(item => item.id !== id);
        localStorage.setItem('aura_booth_gallery', JSON.stringify(gallery));
        renderGallery();
    }

    function renderGallery() {
        const galleryGrid = document.getElementById('gallery-grid');
        if (!galleryGrid) return;
        
        galleryGrid.innerHTML = '';
        let gallery = [];
        
        try {
            const saved = localStorage.getItem('aura_booth_gallery');
            if (saved) {
                gallery = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Load gallery error:', e);
        }
        
        if (gallery.length === 0) {
            galleryGrid.innerHTML = `
                <div class="gallery-empty">
                    <i data-lucide="image-off"></i>
                    <p>Belum ada foto yang diambil. Mulai foto sekarang!</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        
        gallery.forEach(item => {
            const card = document.createElement('div');
            card.className = 'gallery-item';
            
            const img = document.createElement('img');
            img.src = item.data;
            img.alt = 'Saved Collage';
            card.appendChild(img);
            
            const overlay = document.createElement('div');
            overlay.className = 'gallery-item-overlay';
            
            const viewBtn = document.createElement('button');
            viewBtn.className = 'gallery-item-btn';
            viewBtn.title = 'Lihat';
            viewBtn.innerHTML = '<i data-lucide="eye"></i>';
            viewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                viewModalImg.src = item.data;
                viewModal.classList.remove('hidden');
            });
            
            const delBtn = document.createElement('button');
            delBtn.className = 'gallery-item-btn btn-delete';
            delBtn.title = 'Hapus';
            delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Hapus foto ini dari galeri Anda?')) {
                    deleteFromGallery(item.id);
                }
            });
            
            overlay.appendChild(viewBtn);
            overlay.appendChild(delBtn);
            card.appendChild(overlay);
            
            galleryGrid.appendChild(card);
        });
        
        lucide.createIcons();
    }

    // Modal view details
    closeViewBtn.addEventListener('click', () => {
        viewModal.classList.add('hidden');
    });
    
    viewDownloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `aura_booth_saved_${Date.now()}.png`;
        link.href = viewModalImg.src;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    viewModal.addEventListener('click', (e) => {
        if (e.target === viewModal) {
            viewModal.classList.add('hidden');
        }
    });

    // Welcome Announcement Modal closing handler
    const welcomeModal = document.getElementById('welcome-modal');
    const closeWelcomeBtn = document.getElementById('close-welcome-btn');
    if (welcomeModal && closeWelcomeBtn) {
        closeWelcomeBtn.addEventListener('click', () => {
            welcomeModal.classList.add('hidden');
        });

        // 1. Mouse Parallax effect on floating blobs
        welcomeModal.addEventListener('mousemove', (e) => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const moveX = (e.clientX / width) - 0.5;
            const moveY = (e.clientY / height) - 0.5;
            
            const blob1 = welcomeModal.querySelector('.blob-1');
            const blob2 = welcomeModal.querySelector('.blob-2');
            const blob3 = welcomeModal.querySelector('.blob-3');
            
            if (blob1) blob1.style.transform = `translate(${moveX * 50}px, ${moveY * 50}px)`;
            if (blob2) blob2.style.transform = `translate(${moveX * -70}px, ${moveY * -70}px)`;
            if (blob3) blob3.style.transform = `translate(${moveX * 30}px, ${moveY * 30}px)`;
        });
    }

    // --- Startups Setup ---
    renderGallery();
    preloadThemeImages();
    
    // No automatic camera query at startup to prevent rendering loop termination.
    // Camera is activated dynamically in Step 2.
});
