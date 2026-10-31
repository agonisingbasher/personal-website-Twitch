// The destination inbox is configured only in the Basin dashboard, never in this repository.
const FEEDBACK_ENDPOINT = 'https://usebasin.com/f/b73fbcbad424';

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_QUALITY = 0.82;

const messages = {
  "pt-BR": {
    ready: 'Preencha os campos e envie quando estiver pronto.',
    endpointMissing: 'O envio está temporariamente indisponível. Tente novamente mais tarde.',
    imagesTooMany: 'Selecione no máximo 5 imagens.',
    invalidImage: 'Selecione apenas arquivos de imagem.',
    imageTooLarge: 'Uma das imagens passa do limite de 40 MB.',
    invalidVideo: 'Selecione um arquivo de vídeo.',
    videoTooLarge: 'O vídeo deve ter no máximo 20 MB.',
    preparing: 'Preparando os arquivos…',
    sending: 'Enviando seu feedback…',
    progress: 'Enviando seu feedback… {percent}%',
    sent: 'Feedback enviado com sucesso. Obrigado!',
    failed: 'Não foi possível enviar o feedback. Verifique sua conexão e tente novamente.',
    serverFailed: 'O serviço não aceitou o envio (HTTP {status}). Tente novamente mais tarde.',
    timeout: 'O envio demorou demais. Tente novamente com arquivos menores.'
  },
  en: {
    ready: 'Fill in the fields and send when you are ready.',
    endpointMissing: 'Sending is temporarily unavailable. Please try again later.',
    imagesTooMany: 'Please select no more than 5 images.',
    invalidImage: 'Please select image files only.',
    imageTooLarge: 'One of the images exceeds the 40 MB limit.',
    invalidVideo: 'Please select a video file.',
    videoTooLarge: 'The video must be 20 MB or smaller.',
    preparing: 'Preparing the files…',
    sending: 'Sending your feedback…',
    progress: 'Sending your feedback… {percent}%',
    sent: 'Your feedback was sent successfully. Thank you!',
    failed: 'The feedback could not be sent. Check your connection and try again.',
    serverFailed: 'The service did not accept the submission (HTTP {status}). Please try again later.',
    timeout: 'The upload took too long. Please try again with smaller files.'
  }
};

const form = document.getElementById('feedback-form');
const statusMessage = document.getElementById('feedback-status');
const progressBar = document.getElementById('feedback-progress');
const submitButton = form.querySelector('[type="submit"]');
const imagesInput = document.getElementById('feedback-images');
const videoInput = document.getElementById('feedback-video');
const languageInput = document.getElementById('feedback-language');
const categoryInput = document.getElementById('feedback-category');
const categoryValue = document.getElementById('feedback-category-value');
let language = document.documentElement.lang === 'en' ? 'en' : 'pt-BR';
let statusKey = 'ready';
let statusState = 'info';
let statusParams = {};

function normalizeCategory(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function applyCategory() {
  const params = new URLSearchParams(window.location.search);
  const requested = normalizeCategory(params.get('categoria') || params.get('category'));
  if (requested) categoryInput.value = requested;
  categoryValue.textContent = categoryInput.value;
}

applyCategory();

function renderStatus() {
  let message = messages[language][statusKey] || messages[language].failed;
  Object.entries(statusParams).forEach(([name, value]) => {
    message = message.replace(`{${name}}`, value);
  });
  statusMessage.textContent = message;
  statusMessage.dataset.state = statusState;
}

function setStatus(key, state = 'info', params = {}) {
  statusKey = key;
  statusState = state;
  statusParams = params;
  renderStatus();
}

function syncLanguage(event) {
  const nextLanguage = event && event.detail ? event.detail.language : document.documentElement.lang;
  language = nextLanguage === 'en' ? 'en' : 'pt-BR';
  if (languageInput) languageInput.value = language === 'en' ? 'English' : 'Português (Brasil)';
  renderStatus();
}

document.addEventListener('site-language-change', syncLanguage);

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image decode failed'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compressImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= 550 * 1024) return file;

  let image;
  try {
    image = await loadImage(file);
  } catch (error) {
    return file;
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(width, height));
  if (scale === 1 && file.size <= 900 * 1024) return file;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) return file;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToBlob(canvas, 'image/webp', IMAGE_QUALITY);
  if (!blob || (scale === 1 && blob.size >= file.size)) return file;

  const extension = blob.type === 'image/webp' ? '.webp' : blob.type === 'image/jpeg' ? '.jpg' : '.png';
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${baseName}${extension}`, {
    type: blob.type || 'image/webp',
    lastModified: Date.now()
  });
}

function sendFeedback(payload) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', FEEDBACK_ENDPOINT);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.timeout = 180000;

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      progressBar.hidden = false;
      progressBar.value = percent;
      setStatus('progress', 'info', { percent });
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      const error = new Error('server');
      error.status = xhr.status;
      reject(error);
    });
    xhr.addEventListener('error', () => reject(new Error('network')));
    xhr.addEventListener('timeout', () => reject(new Error('timeout')));
    xhr.send(payload);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitButton.disabled) return;

  if (form.elements.website.value) {
    form.reset();
    applyCategory();
    setStatus('sent', 'success');
    return;
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const imageFiles = Array.from(imagesInput.files);
  const videoFile = videoInput.files[0] || null;

  if (imageFiles.length > MAX_IMAGES) {
    setStatus('imagesTooMany', 'error');
    return;
  }
  if (imageFiles.some((file) => !file.type.startsWith('image/'))) {
    setStatus('invalidImage', 'error');
    return;
  }
  if (imageFiles.some((file) => file.size > MAX_IMAGE_BYTES)) {
    setStatus('imageTooLarge', 'error');
    return;
  }
  if (videoFile && !videoFile.type.startsWith('video/')) {
    setStatus('invalidVideo', 'error');
    return;
  }
  if (videoFile && videoFile.size > MAX_VIDEO_BYTES) {
    setStatus('videoTooLarge', 'error');
    return;
  }
  if (!FEEDBACK_ENDPOINT) {
    console.warn('Feedback endpoint is not configured.');
    setStatus('endpointMissing', 'error');
    return;
  }

  submitButton.disabled = true;
  progressBar.hidden = true;
  progressBar.value = 0;

  try {
    setStatus('preparing', 'info');
    const preparedImages = [];
    for (const file of imageFiles) {
      preparedImages.push(await compressImage(file));
    }

    const payload = new FormData();
    payload.append('name', form.elements.name.value.trim());
    payload.append('email', form.elements.email.value.trim());
    payload.append('title', form.elements.title.value.trim());
    payload.append('description', form.elements.description.value.trim());
    payload.append('Categoria', form.elements.category.value);
    payload.append('language', language === 'en' ? 'English' : 'Português (Brasil)');
    payload.append('page', `${window.location.origin}${window.location.pathname}`);
    [...preparedImages, videoFile].filter(Boolean).forEach((file, index) => {
      payload.append(`attachment_${index + 1}`, file, file.name);
    });

    setStatus('sending', 'info');
    await sendFeedback(payload);
    form.reset();
    applyCategory();
    if (languageInput) languageInput.value = language === 'en' ? 'English' : 'Português (Brasil)';
    progressBar.hidden = true;
    setStatus('sent', 'success');
  } catch (error) {
    progressBar.hidden = true;
    if (error.status) {
      setStatus('serverFailed', 'error', { status: error.status });
    } else if (error.message === 'timeout') {
      setStatus('timeout', 'error');
    } else {
      setStatus('failed', 'error');
    }
  } finally {
    submitButton.disabled = false;
  }
});

syncLanguage();
