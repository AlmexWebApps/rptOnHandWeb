
$(function () {
    'use strict';

    console.log('🚀 Inicializando Digitalizador VUCEM...');

    // Configurar PDF.js worker
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        console.log('✓ PDF.js configurado');
    } else {
        console.error('✗ PDF.js no está cargado');
    }

    // Verificar PDF-lib
    if (typeof PDFLib !== 'undefined') {
        console.log('✓ PDF-lib cargado');
    } else {
        console.error('✗ PDF-lib no está cargado');
    }

    // feature detection for drag&drop upload
    var isAdvancedUpload = function () {
        var div = document.createElement('div');
        return (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && 'FormData' in window && 'FileReader' in window;
    }();

    /**
     * Convierte una página PDF a imagen en escala de grises a 300 DPI
     */
    async function convertPageToGrayscaleImage(page, pageNumber) {
        const scale = 300 / 72; // 300 DPI (PDF default es 72 DPI)
        const viewport = page.getViewport({ scale: scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        // Convertir a escala de grises
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            data[i] = gray;     // R
            data[i + 1] = gray; // G
            data[i + 2] = gray; // B
        }

        context.putImageData(imageData, 0, 0);

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Error al convertir canvas a blob'));
                }
            }, 'image/jpeg', 0.85);
        });
    }

    /**
     * Procesa PDF para cumplir con especificaciones VUCEM
     */
    var processPDFForVucem = async function(file, progressCallback) {
        console.log('🔄 Iniciando procesamiento de:', file.name);

        return new Promise(async (resolve, reject) => {
            try {
                // VALIDACIÓN 1: Tamaño máximo 10 MB
                const maxInputSize = 10 * 1024 * 1024;
                if (file.size > maxInputSize) {
                    reject({error: 'El archivo original excede 10 MB'});
                    return;
                }

                // VALIDACIÓN 2: Debe ser PDF
                if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
                    reject({error: 'El archivo debe ser un PDF válido'});
                    return;
                }

                // VALIDACIÓN 3: Librerías
                if (typeof pdfjsLib === 'undefined') {
                    reject({error: 'PDF.js no está cargado. Recarga la página.'});
                    return;
                }

                if (typeof PDFLib === 'undefined') {
                    reject({error: 'PDF-lib no está cargado. Recarga la página.'});
                    return;
                }

                progressCallback && progressCallback('Leyendo PDF...', 10);

                const arrayBuffer = await file.arrayBuffer();

                progressCallback && progressCallback('Validando documento...', 20);

                const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
                const pdfDoc = await loadingTask.promise;
                const numPages = pdfDoc.numPages;

                console.log(`📄 Páginas detectadas: ${numPages}`);

                // VALIDACIÓN 4: Número de páginas
                if (numPages > 50) {
                    reject({error: `El PDF tiene ${numPages} páginas. Máximo permitido: 50`});
                    return;
                }

                if (numPages < 1) {
                    reject({error: 'El PDF debe tener al menos 1 página'});
                    return;
                }

                progressCallback && progressCallback('Creando PDF optimizado...', 30);

                // Crear nuevo PDF
                const newPdfDoc = await PDFLib.PDFDocument.create();

                // Metadata VUCEM
                newPdfDoc.setTitle(file.name.replace('.pdf', ''));
                newPdfDoc.setProducer('VUCEM Digitalizador');
                newPdfDoc.setCreator('Sistema VUCEM');
                newPdfDoc.setCreationDate(new Date());
                newPdfDoc.setModificationDate(new Date());

                // Procesar cada página
                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                    const progress = 30 + (pageNum / numPages) * 50;
                    progressCallback && progressCallback(`Procesando página ${pageNum}/${numPages}...`, progress);

                    console.log(`⚙️ Procesando página ${pageNum}/${numPages}`);

                    const page = await pdfDoc.getPage(pageNum);
                    const imageBlob = await convertPageToGrayscaleImage(page, pageNum);
                    const imageBytes = await imageBlob.arrayBuffer();

                    const image = await newPdfDoc.embedJpg(imageBytes);

                    const viewport = page.getViewport({ scale: 1 });
                    const pdfPage = newPdfDoc.addPage([viewport.width, viewport.height]);

                    pdfPage.drawImage(image, {
                        x: 0,
                        y: 0,
                        width: viewport.width,
                        height: viewport.height
                    });
                }

                progressCallback && progressCallback('Generando archivo final...', 85);

                console.log('💾 Guardando PDF...');

                const pdfBytes = await newPdfDoc.save({
                    useObjectStreams: true,
                    addDefaultPage: false,
                    objectsPerTick: 50
                });

                progressCallback && progressCallback('Validando tamaño...', 90);

                const finalSize = pdfBytes.length;
                const finalSizeMB = (finalSize / (1024 * 1024)).toFixed(2);

                console.log(`📊 Tamaño final: ${finalSizeMB} MB`);

                // VALIDACIÓN 5: Tamaño final < 3 MB
                const maxOutputSize = 3 * 1024 * 1024;
                if (finalSize > maxOutputSize) {
                    reject({
                        error: `El PDF procesado tiene ${finalSizeMB} MB. Límite VUCEM: 3 MB. Reduce el número de páginas.`
                    });
                    return;
                }

                progressCallback && progressCallback('¡Completado!', 100);

                const optimizedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                const optimizedFile = new File(
                    [optimizedBlob],
                    file.name.replace('.pdf', '_VUCEM.pdf'),
                    { type: 'application/pdf' }
                );

                console.log('✅ Proceso completado');

                resolve({
                    success: true,
                    file: optimizedFile,
                    name: optimizedFile.name,
                    originalName: file.name,
                    pages: numPages,
                    size: finalSize,
                    sizeMB: finalSizeMB,
                    originalSize: file.size,
                    originalSizeMB: (file.size / (1024 * 1024)).toFixed(2),
                    optimized: true,
                    specs: {
                        format: 'PDF',
                        colorDepth: 'Escala de grises 8 bits',
                        resolution: '300 DPI',
                        secure: 'Sin contraseñas ni JavaScript',
                        compliant: true
                    }
                });

            } catch (error) {
                console.error('❌ Error:', error);
                reject({error: 'Error procesando PDF: ' + error.message});
            }
        });
    };

    // Aplicar a todos los formularios con clase .box
    var forms = document.querySelectorAll('.box');
    console.log(`📝 Formularios encontrados: ${forms.length}`);

    Array.prototype.forEach.call(forms, function (form) {
        var input = form.querySelector('input[type="file"]'),
            label = form.querySelector('label'),
            errorMsg = form.querySelector('.box__error span'),
            restart = form.querySelectorAll('.box__restart'),
            droppedFiles = false,
            processedFile = null,
            showFiles = function (files) {
                label.textContent = files.length > 1 ?
                    (input.getAttribute('data-multiple-caption') || '').replace('{count}', files.length) :
                    files[0].name;
            };

        console.log('✓ Formulario inicializado');

        // Crear barra de progreso
        var progressContainer = document.createElement('div');
        progressContainer.className = 'box__progress-container';
        progressContainer.style.cssText = 'display: none; margin-top: 20px;';
        progressContainer.innerHTML = `
            <div class="box__progress-text" style="margin-bottom: 10px; text-align: center; color: #666; font-weight: bold;"></div>
            <div style="width: 100%; height: 25px; background: #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                <div class="box__progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); transition: width 0.3s ease;"></div>
            </div>
        `;
        form.appendChild(progressContainer);

        var progressBar = form.querySelector('.box__progress-bar');
        var progressText = form.querySelector('.box__progress-text');

        // Evento de selección de archivo
        input.addEventListener('change', function (e) {
            console.log('📎 Archivo seleccionado');

            if (this.files[0] != null) {
                if (this.files[0].size > 10485760) {
                    alert("El archivo supera 10 MB.");
                    this.value = "";
                } else if (!this.files[0].name.toLowerCase().endsWith('.pdf')) {
                    alert("Solo se permiten archivos PDF.");
                    this.value = "";
                } else {
                    showFiles(e.target.files);
                    $('#btnDigitalizar').prop('disabled', false);
                    console.log('✓ Archivo válido, botón habilitado');
                }
            }
        });

        // Drag & Drop
        if (isAdvancedUpload) {
            form.classList.add('has-advanced-upload');
            console.log('✓ Drag & Drop habilitado');

            ['drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach(function (event) {
                form.addEventListener(event, function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            ['dragover', 'dragenter'].forEach(function (event) {
                form.addEventListener(event, function () {
                    form.classList.add('is-dragover');
                });
            });

            ['dragleave', 'dragend', 'drop'].forEach(function (event) {
                form.addEventListener(event, function () {
                    form.classList.remove('is-dragover');
                });
            });

            form.addEventListener('drop', function (e) {
                droppedFiles = e.dataTransfer.files;
                console.log('📎 Archivo arrastrado');

                if (droppedFiles[0] && !droppedFiles[0].name.toLowerCase().endsWith('.pdf')) {
                    alert("Solo se permiten archivos PDF.");
                    droppedFiles = false;
                    return;
                }

                if (droppedFiles[0] && droppedFiles[0].size > 10485760) {
                    alert("El archivo supera 10 MB.");
                    droppedFiles = false;
                    return;
                }

                showFiles(droppedFiles);
                $('#btnDigitalizar').prop('disabled', false);
            });
        }

        // EVENTO PRINCIPAL: Submit del formulario
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            console.log('🚀 Botón Digitalizar presionado');

            if (form.classList.contains('is-uploading')) {
                console.log('⚠️ Ya hay un proceso en curso');
                return false;
            }

            form.classList.add('is-uploading');
            form.classList.remove('is-error', 'is-success');
            progressContainer.style.display = 'block';

            try {
                const file = droppedFiles ? droppedFiles[0] : input.files[0];
                console.log('📄 Archivo a procesar:', file ? file.name : 'ninguno');

                if (!file) {
                    throw new Error('No se ha seleccionado ningún archivo');
                }

                // Callback de progreso
                const updateProgress = (text, percent) => {
                    progressText.textContent = text;
                    progressBar.style.width = percent + '%';
                };

                // PROCESAR PDF
                const result = await processPDFForVucem(file, updateProgress);

                form.classList.remove('is-uploading');
                progressContainer.style.display = 'none';

                if (result.success) {
                    console.log('✅ Procesamiento exitoso');
                    form.classList.add('is-success');
                    processedFile = result.file;

                    const downloadUrl = URL.createObjectURL(result.file);

                    $("#ligaDescarga").attr("href", downloadUrl);
                    $("#ligaDescarga").attr("download", result.name);

                    let infoHTML = `
                        <strong>${result.name}</strong> 
                        <span style="color: Tomato;"><i class="fas fa-file-download"></i></span>
                        <br><br>
                        <small style="color: #666;">
                            📄 Páginas: ${result.pages} | 
                            💾 Tamaño: ${result.sizeMB} MB (Original: ${result.originalSizeMB} MB)<br>
                            ✓ Formato: ${result.specs.format} | 
                            ✓ ${result.specs.colorDepth} | 
                            ✓ ${result.specs.resolution}<br>
                            <span style="color: green; font-weight: bold;">✓ CUMPLE CON ESPECIFICACIONES VUCEM</span>
                        </small>
                    `;

                    $('#ligaDescarga').html(infoHTML);
                }

            } catch (error) {
                console.error('❌ Error capturado:', error);
                form.classList.remove('is-uploading');
                form.classList.add('is-error');
                progressContainer.style.display = 'none';

                const errorMessage = error.error || error.message || 'Error procesando el archivo';
                errorMsg.textContent = errorMessage;
            }
        });

        // Botón Reiniciar
        Array.prototype.forEach.call(restart, function (entry) {
            entry.addEventListener('click', function (e) {
                e.preventDefault();
                console.log('🔄 Reiniciando formulario');

                form.classList.remove('is-error', 'is-success');
                progressContainer.style.display = 'none';

                if (processedFile) {
                    const downloadLink = $("#ligaDescarga").attr("href");
                    if (downloadLink && downloadLink.startsWith('blob:')) {
                        URL.revokeObjectURL(downloadLink);
                    }
                    processedFile = null;
                }

                droppedFiles = false;
                input.value = '';
                label.textContent = 'Elija un archivo pdf';
                $('#btnDigitalizar').prop('disabled', true);
            });
        });

        // Firefox focus fix
        input.addEventListener('focus', function () { input.classList.add('has-focus'); });
        input.addEventListener('blur', function () { input.classList.remove('has-focus'); });
    });

    console.log('✅ Digitalizador VUCEM inicializado correctamente');
});