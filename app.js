/* ============================================
   WebP Converter — Application Logic
   ============================================ */

(() => {
    'use strict';

    // --- DOM refs ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const controlsCard = document.getElementById('controls-card');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    const convertBtn = document.getElementById('convert-btn');
    const btnText = convertBtn.querySelector('.btn-text');
    const btnLoader = convertBtn.querySelector('.btn-loader');
    const fileList = document.getElementById('file-list');
    const resultsCard = document.getElementById('results-card');
    const resultsList = document.getElementById('results-list');
    const downloadAll = document.getElementById('download-all-btn');

    // --- State ---
    let selectedFiles = [];       // { file, objectURL }
    let convertedResults = [];    // { name, originalSize, blob, blobURL }

    // ============================
    //  Quality Slider
    // ============================
    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = qualitySlider.value + '%';
    });

    // ============================
    //  Drag & Drop
    // ============================
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
        fileInput.value = '';
    });

    // ============================
    //  Handle incoming files
    // ============================
    function handleFiles(fileListObj) {
        const newFiles = [...fileListObj].filter(f => f.type.startsWith('image/'));
        if (newFiles.length === 0) return;

        newFiles.forEach(file => {
            selectedFiles.push({ file, objectURL: URL.createObjectURL(file) });
        });

        renderFileList();
        controlsCard.classList.remove('hidden');
        controlsCard.style.animation = 'fadeInUp 0.4s ease forwards';
    }

    function renderFileList() {
        fileList.innerHTML = '';
        selectedFiles.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'file-item';
            div.style.animationDelay = `${idx * 0.05}s`;
            div.innerHTML = `
                <img class="file-item-thumb" src="${item.objectURL}" alt="">
                <span class="file-item-name">${item.file.name}</span>
                <span class="file-item-size">${formatBytes(item.file.size)}</span>
                <button class="file-item-remove" data-idx="${idx}" title="Remove">✕</button>
            `;
            fileList.appendChild(div);
        });

        // Remove handler
        fileList.querySelectorAll('.file-item-remove').forEach(btn => {
            btn.addEventListener('click', e => {
                const i = parseInt(e.currentTarget.dataset.idx);
                URL.revokeObjectURL(selectedFiles[i].objectURL);
                selectedFiles.splice(i, 1);
                renderFileList();
                if (selectedFiles.length === 0) {
                    controlsCard.classList.add('hidden');
                }
            });
        });
    }

    // ============================
    //  Conversion
    // ============================
    convertBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;

        // UI state
        convertBtn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');

        const quality = parseInt(qualitySlider.value) / 100;

        // Clean previous results
        convertedResults.forEach(r => URL.revokeObjectURL(r.blobURL));
        convertedResults = [];

        // Convert each file
        for (const item of selectedFiles) {
            try {
                const result = await convertToWebP(item.file, quality);
                convertedResults.push(result);
            } catch (err) {
                console.error('Conversion failed for', item.file.name, err);
            }
        }

        // Restore button
        convertBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');

        // Show results
        renderResults();
    });

    function convertToWebP(file, quality) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const imgURL = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(imgURL);

                // Helper: convert canvas to blob at a given quality
                function toBlob(q) {
                    return new Promise((res, rej) => {
                        canvas.toBlob(blob => {
                            if (!blob) return rej(new Error('Canvas toBlob failed'));
                            res(blob);
                        }, 'image/webp', q);
                    });
                }

                // Smart conversion: guarantee output ≤ original size
                (async () => {
                    let currentQuality = quality;
                    let blob = await toBlob(currentQuality);

                    // If the WebP is larger than the original, step down quality
                    // until the file is smaller (min quality = 0.01)
                    while (blob.size >= file.size && currentQuality > 0.01) {
                        currentQuality = Math.max(currentQuality - 0.05, 0.01);
                        blob = await toBlob(currentQuality);
                    }

                    const baseName = file.name.replace(/\.[^.]+$/, '');
                    resolve({
                        name: baseName + '.webp',
                        originalName: file.name,
                        originalSize: file.size,
                        blob,
                        blobURL: URL.createObjectURL(blob),
                        originalObjectURL: URL.createObjectURL(file),
                        actualQuality: Math.round(currentQuality * 100)
                    });
                })().catch(reject);
            };
            img.onerror = () => { URL.revokeObjectURL(imgURL); reject(new Error('Image load failed')); };
            img.src = imgURL;
        });
    }

    // ============================
    //  Render Results
    // ============================
    function renderResults() {
        if (convertedResults.length === 0) return;

        resultsList.innerHTML = '';
        resultsCard.classList.remove('hidden');
        resultsCard.style.animation = 'fadeInUp 0.4s ease forwards';

        convertedResults.forEach((r, idx) => {
            const savings = ((1 - r.blob.size / r.originalSize) * 100);
            const savingsStr = savings >= 0
                ? `−${savings.toFixed(1)}%`
                : `+${Math.abs(savings).toFixed(1)}%`;
            const savingsClass = savings >= 0 ? 'savings-positive' : 'savings-negative';
            const barWidth = Math.min((r.blob.size / r.originalSize) * 100, 100);
            const requestedQuality = parseInt(qualitySlider.value);
            const qualityNote = r.actualQuality < requestedQuality
                ? `<span class="quality-auto-note" title="Quality was auto-reduced from ${requestedQuality}% to keep file smaller than original">Q: ${r.actualQuality}%</span>`
                : '';

            const div = document.createElement('div');
            div.className = 'result-item';
            div.style.animationDelay = `${idx * 0.08}s`;

            div.innerHTML = `
                <div class="result-item-top">
                    <img class="result-thumb" src="${r.blobURL}" alt="">
                    <div class="result-info">
                        <div class="result-name">${r.name}</div>
                        <div class="result-sizes">
                            <span>${formatBytes(r.originalSize)}</span>
                            <span class="result-arrow">→</span>
                            <span class="result-new-size">${formatBytes(r.blob.size)}</span>
                            <span class="result-savings ${savingsClass}">${savingsStr}</span>
                            ${qualityNote}
                        </div>
                    </div>
                </div>
                <div class="result-bar-wrapper">
                    <div class="result-bar" style="width: 0%;" data-target-width="${barWidth}%"></div>
                </div>
                <div class="result-actions">
                    <button class="btn-download" data-idx="${idx}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download
                    </button>
                    <button class="btn-preview" data-idx="${idx}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        Preview
                    </button>
                </div>
            `;

            resultsList.appendChild(div);

            // Animate bar after a tick
            requestAnimationFrame(() => {
                const bar = div.querySelector('.result-bar');
                setTimeout(() => { bar.style.width = bar.dataset.targetWidth; }, 100);
            });
        });

        // Download individual
        resultsList.querySelectorAll('.btn-download').forEach(btn => {
            btn.addEventListener('click', e => {
                const i = parseInt(e.currentTarget.dataset.idx);
                downloadBlob(convertedResults[i].blobURL, convertedResults[i].name);
            });
        });

        // Preview
        resultsList.querySelectorAll('.btn-preview').forEach(btn => {
            btn.addEventListener('click', e => {
                const i = parseInt(e.currentTarget.dataset.idx);
                showPreviewModal(convertedResults[i]);
            });
        });

        // Scroll into view
        resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ============================
    //  Download helpers
    // ============================
    function downloadBlob(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    downloadAll.addEventListener('click', () => {
        convertedResults.forEach(r => downloadBlob(r.blobURL, r.name));
    });

    // ============================
    //  Preview Modal
    // ============================
    function showPreviewModal(result) {
        // Remove existing modal
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content">
                <button class="modal-close">✕</button>
                <div class="modal-comparison">
                    <div>
                        <img src="${result.originalObjectURL}" alt="Original">
                        <p>Original · ${formatBytes(result.originalSize)}</p>
                    </div>
                    <div>
                        <img src="${result.blobURL}" alt="WebP">
                        <p>WebP · ${formatBytes(result.blob.size)}</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Close handlers
        overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove();
        });
        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', handler); }
        });
    }

    // ============================
    //  Utility
    // ============================
    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
})();
