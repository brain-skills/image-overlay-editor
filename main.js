const canvas = document.getElementById("editor-canvas");
const ctx = canvas.getContext("2d");

const backgroundSourceSelect = document.getElementById("background-source");
const uploadBackgroundControls = document.getElementById("upload-background-controls");
const gradientBackgroundControls = document.getElementById("gradient-background-controls");

const imageUpload = document.getElementById("image-upload");
const overlayImageUpload = document.getElementById("overlay-image-upload");
const generateGradientBtn = document.getElementById("generate-gradient-btn");
const removeOverlayBtn = document.getElementById("remove-overlay-btn");

const exportWidthInput = document.getElementById("export-width");
const exportHeightInput = document.getElementById("export-height");

const textInput = document.getElementById("text-input");
const fontSelect = document.getElementById("font-select");
const fontSizeInput = document.getElementById("font-size");
const fontSizeValue = document.getElementById("font-size-value");
const lineHeightInput = document.getElementById("line-height");
const lineHeightValue = document.getElementById("line-height-value");
const textColorInput = document.getElementById("text-color");
const strokeColorInput = document.getElementById("stroke-color");
const strokeWidthInput = document.getElementById("stroke-width");
const strokeWidthValue = document.getElementById("stroke-width-value");
const strokeEnabledInput = document.getElementById("stroke-enabled");
const strokeSettings = document.getElementById("stroke-settings");

const addLayerBtn = document.getElementById("add-layer-btn");
const deleteLayerBtn = document.getElementById("delete-layer-btn");
const layersList = document.getElementById("layers-list");

const downloadBtn = document.getElementById("download-btn");
const resetBtn = document.getElementById("reset-btn");
const savedWrapper = document.getElementById("saved-wrapper");
const emptyState = document.getElementById("empty-state");

let backgroundMode = "upload";
let currentImage = null;
let currentImageName = "edited-image";
let imageDrawRect = null;

let gradientBackground = null;

let overlayImage = null;
let overlayImageName = "overlay-image";
let overlayRect = null;
let overlaySelected = false;
let isDraggingOverlay = false;
let overlayDragOffsetX = 0;
let overlayDragOffsetY = 0;

let isResizingOverlay = false;
let overlayResizeHandleSize = 18;
let overlayStartRect = null;
let overlayResizeStart = null;

let textLayers = [];
let activeLayerId = null;
let layerCounter = 1;

let isDraggingLayer = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

let savedVersions = localStorage.getItem("savedImageVersions")
  ? JSON.parse(localStorage.getItem("savedImageVersions"))
  : [];

const colorPalettes = [
  ["#ff4fd8", "#7b2cff", "#00d4ff", "#ffd6f5"],
  ["#ff5f6d", "#ffc371", "#00f5d4", "#3a0ca3"],
  ["#ffb3c6", "#ff9f1c", "#00d68f", "#fff3b0"],
  ["#ff006e", "#8338ec", "#3a86ff", "#00f5d4"],
  ["#f72585", "#b5179e", "#4cc9f0", "#fefae0"]
];

const loadedFonts = new Set();

function getPrimaryFontFamily(fontValue) {
  if (!fontValue) {
    return "Arial";
  }

  return fontValue
    .split(",")[0]
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

async function ensureFontLoaded(fontValue, fontSize = 48) {
  const family = getPrimaryFontFamily(fontValue);

  if (!family || family.toLowerCase() === "arial") {
    return;
  }

  const cacheKey = `${family}-${fontSize}`;

  if (loadedFonts.has(cacheKey)) {
    return;
  }

  try {
    await document.fonts.load(`${fontSize}px "${family}"`);
    await document.fonts.ready;
    loadedFonts.add(cacheKey);
  } catch (error) {
    console.warn("Font load failed:", family, error);
  }
}

function toggleStrokeSettingsVisibility() {
  if (strokeEnabledInput.checked) {
    strokeSettings.classList.remove("hidden");
  } else {
    strokeSettings.classList.add("hidden");
  }
}

function updateBackgroundModeUI() {
  if (backgroundMode === "upload") {
    uploadBackgroundControls.classList.remove("hidden");
    gradientBackgroundControls.classList.add("hidden");
  } else {
    uploadBackgroundControls.classList.add("hidden");
    gradientBackgroundControls.classList.remove("hidden");
  }
}

function getExportSize() {
  const width = Math.max(100, Number(exportWidthInput?.value) || canvas.width);
  const height = Math.max(100, Number(exportHeightInput?.value) || canvas.height);

  return { width, height };
}

function randomPercent(min = 10, max = 90) {
  return `${Math.floor(Math.random() * (max - min + 1)) + min}%`;
}

function getRandomPalette() {
  const palette = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
  const shuffled = [...palette].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.random() > 0.5 ? 4 : 3);
}

function generateGradientObject() {
  const colors = getRandomPalette();

  while (colors.length < 4) {
    colors.push("transparent");
  }

  const baseColors = ["#0f172a", "#111827", "#1e1b4b", "#101828", "#0b1020"];
  const baseBg = baseColors[Math.floor(Math.random() * baseColors.length)];

  return {
    color1: colors[0],
    color2: colors[1],
    color3: colors[2],
    color4: colors[3],
    x1: randomPercent(),
    y1: randomPercent(),
    x2: randomPercent(),
    y2: randomPercent(),
    x3: randomPercent(),
    y3: randomPercent(),
    x4: randomPercent(),
    y4: randomPercent(),
    baseBg
  };
}

function gradientPercentToPixel(percentValue, size) {
  return (parseFloat(percentValue) / 100) * size;
}

function drawGradientBackgroundToContext(targetCtx, width, height, gradient) {
  targetCtx.fillStyle = gradient.baseBg;
  targetCtx.fillRect(0, 0, width, height);

  const spots = [
    { color: gradient.color1, x: gradient.x1, y: gradient.y1 },
    { color: gradient.color2, x: gradient.x2, y: gradient.y2 },
    { color: gradient.color3, x: gradient.x3, y: gradient.y3 },
    { color: gradient.color4, x: gradient.x4, y: gradient.y4 }
  ];

  const radius = Math.max(width, height) * 0.45;

  spots.forEach((spot) => {
    if (!spot.color || spot.color === "transparent") {
      return;
    }

    const x = gradientPercentToPixel(spot.x, width);
    const y = gradientPercentToPixel(spot.y, height);

    const radial = targetCtx.createRadialGradient(x, y, 0, x, y, radius);
    radial.addColorStop(0, spot.color);
    radial.addColorStop(1, "transparent");

    targetCtx.fillStyle = radial;
    targetCtx.fillRect(0, 0, width, height);
  });
}

function drawGradientBackground(gradient) {
  drawGradientBackgroundToContext(ctx, canvas.width, canvas.height, gradient);
}

function createDefaultLayer(x = canvas.width / 2, y = canvas.height / 2) {
  return {
    id: `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: `Text ${layerCounter++}`,
    text: "",
    x,
    y,
    fontFamily: "Arial, sans-serif",
    fontSize: 48,
    lineHeight: 1.2,
    textColor: "#ffffff",
    strokeEnabled: false,
    strokeColor: "#000000",
    strokeWidth: 2
  };
}

function getActiveLayer() {
  return textLayers.find((layer) => layer.id === activeLayerId) || null;
}

function setActiveLayer(layerId) {
  activeLayerId = layerId;
  overlaySelected = false;
  syncControlsFromActiveLayer();
  redrawLayersList();
  drawCanvas();
}

function addNewLayer(x = canvas.width / 2, y = canvas.height / 2) {
  const newLayer = createDefaultLayer(x, y);
  textLayers.push(newLayer);
  setActiveLayer(newLayer.id);
}

function ensureActiveLayerExists() {
  if (activeLayerId) {
    return getActiveLayer();
  }

  const newLayer = createDefaultLayer(canvas.width / 2, canvas.height / 2);
  textLayers.push(newLayer);
  activeLayerId = newLayer.id;

  overlaySelected = false;
  syncControlsFromActiveLayer();
  redrawLayersList();

  return newLayer;
}

function deleteActiveLayer() {
  if (!activeLayerId) {
    return;
  }

  textLayers = textLayers.filter((layer) => layer.id !== activeLayerId);

  if (textLayers.length > 0) {
    activeLayerId = textLayers[textLayers.length - 1].id;
  } else {
    activeLayerId = null;
  }

  syncControlsFromActiveLayer();
  redrawLayersList();
  drawCanvas();
}

function syncControlsFromActiveLayer() {
  const activeLayer = getActiveLayer();

  if (!activeLayer) {
    textInput.value = "";
    fontSelect.value = "Arial, sans-serif";
    fontSizeInput.value = 48;
    fontSizeValue.textContent = "48px";

    if (lineHeightInput) {
      lineHeightInput.value = 1.2;
    }

    if (lineHeightValue) {
      lineHeightValue.textContent = "1.2";
    }

    textColorInput.value = "#ffffff";
    strokeEnabledInput.checked = false;
    strokeColorInput.value = "#000000";
    strokeWidthInput.value = 2;
    strokeWidthValue.textContent = "2px";
    toggleStrokeSettingsVisibility();
    return;
  }

  textInput.value = activeLayer.text;
  fontSelect.value = activeLayer.fontFamily;
  fontSizeInput.value = activeLayer.fontSize;
  fontSizeValue.textContent = `${activeLayer.fontSize}px`;

  if (lineHeightInput) {
    lineHeightInput.value = activeLayer.lineHeight ?? 1.2;
  }

  if (lineHeightValue) {
    lineHeightValue.textContent = `${activeLayer.lineHeight ?? 1.2}`;
  }

  textColorInput.value = activeLayer.textColor;
  strokeEnabledInput.checked = activeLayer.strokeEnabled ?? false;
  strokeColorInput.value = activeLayer.strokeColor;
  strokeWidthInput.value = activeLayer.strokeWidth;
  strokeWidthValue.textContent = `${activeLayer.strokeWidth}px`;
  toggleStrokeSettingsVisibility();
}

async function updateActiveLayerFromControls() {
  let activeLayer = getActiveLayer();

  if (!activeLayer) {
    const hasTypedText = textInput.value.trim().length > 0;

    if (!hasTypedText) {
      toggleStrokeSettingsVisibility();
      return;
    }

    activeLayer = ensureActiveLayerExists();
  }

  activeLayer.text = textInput.value;
  activeLayer.fontFamily = fontSelect.value;
  activeLayer.fontSize = Number(fontSizeInput.value);
  activeLayer.lineHeight = Number(lineHeightInput?.value || 1.2);
  activeLayer.textColor = textColorInput.value;
  activeLayer.strokeEnabled = strokeEnabledInput.checked;
  activeLayer.strokeColor = strokeColorInput.value;
  activeLayer.strokeWidth = Number(strokeWidthInput.value);

  toggleStrokeSettingsVisibility();

  await ensureFontLoaded(activeLayer.fontFamily, activeLayer.fontSize);

  redrawLayersList();
  drawCanvas();
}

function redrawLayersList() {
  layersList.innerHTML = "";

  if (textLayers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "layer-item";
    empty.innerHTML = `<span class="layer-name">No layers yet</span>`;
    layersList.append(empty);
    return;
  }

  [...textLayers].reverse().forEach((layer) => {
    const item = document.createElement("div");
    item.className = `layer-item${layer.id === activeLayerId ? " active" : ""}`;

    const name = document.createElement("div");
    name.className = "layer-name";
    name.textContent = layer.text.trim().split("\n")[0] || layer.name;

    const meta = document.createElement("div");
    meta.className = "layer-meta";
    meta.textContent = `${layer.fontSize}px`;

    item.append(name, meta);

    item.addEventListener("click", () => {
      setActiveLayer(layer.id);
    });

    layersList.append(item);
  });
}

function getImageDrawRect() {
  if (!currentImage) {
    return null;
  }

  const imgRatio = currentImage.width / currentImage.height;
  const canvasRatio = canvas.width / canvas.height;

  let drawWidth;
  let drawHeight;
  let offsetX;
  let offsetY;

  if (imgRatio > canvasRatio) {
    drawWidth = canvas.width;
    drawHeight = canvas.width / imgRatio;
    offsetX = 0;
    offsetY = (canvas.height - drawHeight) / 2;
  } else {
    drawHeight = canvas.height;
    drawWidth = canvas.height * imgRatio;
    offsetY = 0;
    offsetX = (canvas.width - drawWidth) / 2;
  }

  return {
    x: offsetX,
    y: offsetY,
    width: drawWidth,
    height: drawHeight
  };
}

function createDefaultOverlayRect(img) {
  const maxWidth = canvas.width * 0.35;
  const maxHeight = canvas.height * 0.35;
  const ratio = img.width / img.height;

  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  return {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height
  };
}

function getLayerTextLines(layer) {
  const rawText = layer.text && layer.text.length ? layer.text : "Text";
  return rawText.split("\n");
}

function getLayerMetrics(targetCtx, layer) {
  const lines = getLayerTextLines(layer);
  const lineHeight = layer.fontSize * (layer.lineHeight || 1.2);

  targetCtx.save();
  targetCtx.font = `${layer.fontSize}px ${layer.fontFamily}`;

  let maxWidth = 0;

  lines.forEach((line) => {
    const width = targetCtx.measureText(line || " ").width;
    if (width > maxWidth) {
      maxWidth = width;
    }
  });

  targetCtx.restore();

  return {
    lines,
    lineHeight,
    width: maxWidth,
    height: lines.length * lineHeight
  };
}

function drawLayerToContext(targetCtx, layer, isActive = false) {
  const { lines, lineHeight, width, height } = getLayerMetrics(targetCtx, layer);

  targetCtx.save();
  targetCtx.font = `${layer.fontSize}px ${layer.fontFamily}`;
  targetCtx.textAlign = "center";
  targetCtx.textBaseline = "middle";
  targetCtx.lineJoin = "round";
  targetCtx.miterLimit = 2;

  lines.forEach((line, index) => {
    const yOffset = (index - (lines.length - 1) / 2) * lineHeight;
    const drawY = layer.y + yOffset;
    const drawLine = line || " ";

    if ((layer.strokeEnabled ?? false) && layer.strokeWidth > 0) {
      targetCtx.lineWidth = layer.strokeWidth;
      targetCtx.strokeStyle = layer.strokeColor;
      targetCtx.strokeText(drawLine, layer.x, drawY);
    }

    targetCtx.fillStyle = layer.textColor;
    targetCtx.fillText(drawLine, layer.x, drawY);
  });

  if (isActive) {
    const padding = 12;

    targetCtx.save();
    targetCtx.setLineDash([8, 5]);
    targetCtx.lineWidth = 2;
    targetCtx.strokeStyle = "#2563eb";
    targetCtx.strokeRect(
      layer.x - width / 2 - padding,
      layer.y - height / 2 - padding,
      width + padding * 2,
      height + padding * 2
    );
    targetCtx.restore();
  }

  targetCtx.restore();
}

function drawLayer(layer, isActive = false) {
  drawLayerToContext(ctx, layer, isActive);
}

function getLayerBounds(layer) {
  const metrics = getLayerMetrics(ctx, layer);
  const padding = 12;

  return {
    x: layer.x - metrics.width / 2 - padding,
    y: layer.y - metrics.height / 2 - padding,
    width: metrics.width + padding * 2,
    height: metrics.height + padding * 2
  };
}

function drawOverlay(showSelection = true) {
  if (!overlayImage || !overlayRect) {
    return;
  }

  ctx.drawImage(overlayImage, overlayRect.x, overlayRect.y, overlayRect.width, overlayRect.height);

  if (showSelection && overlaySelected) {
    ctx.save();
    ctx.setLineDash([8, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#22c55e";
    ctx.strokeRect(overlayRect.x, overlayRect.y, overlayRect.width, overlayRect.height);

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(
      overlayRect.x + overlayRect.width - 6,
      overlayRect.y + overlayRect.height - 6,
      12,
      12
    );
    ctx.restore();
  }
}

function isPointInOverlay(x, y) {
  if (!overlayRect) {
    return false;
  }

  return (
    x >= overlayRect.x &&
    x <= overlayRect.x + overlayRect.width &&
    y >= overlayRect.y &&
    y <= overlayRect.y + overlayRect.height
  );
}

function isPointInOverlayResizeHandle(x, y) {
  if (!overlayRect) {
    return false;
  }

  const handleX = overlayRect.x + overlayRect.width;
  const handleY = overlayRect.y + overlayRect.height;

  return (
    x >= handleX - overlayResizeHandleSize &&
    x <= handleX + overlayResizeHandleSize &&
    y >= handleY - overlayResizeHandleSize &&
    y <= handleY + overlayResizeHandleSize
  );
}

function findLayerAtPoint(x, y) {
  for (let i = textLayers.length - 1; i >= 0; i--) {
    const layer = textLayers[i];
    const box = getLayerBounds(layer);

    if (
      x >= box.x &&
      x <= box.x + box.width &&
      y >= box.y &&
      y <= box.y + box.height
    ) {
      return layer;
    }
  }

  return null;
}

function hasBackground() {
  return (backgroundMode === "upload" && currentImage) || (backgroundMode === "gradient" && gradientBackground);
}

function drawCanvas(showSelection = true) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!hasBackground()) {
    ctx.fillStyle = "#dbe3ee";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    emptyState.style.display = "flex";
    return;
  }

  emptyState.style.display = "none";

  if (backgroundMode === "upload" && currentImage) {
    imageDrawRect = getImageDrawRect();
    ctx.drawImage(
      currentImage,
      imageDrawRect.x,
      imageDrawRect.y,
      imageDrawRect.width,
      imageDrawRect.height
    );
  }

  if (backgroundMode === "gradient" && gradientBackground) {
    drawGradientBackground(gradientBackground);
  }

  drawOverlay(showSelection);

  textLayers.forEach((layer) => {
    drawLayer(layer, showSelection && layer.id === activeLayerId);
  });
}

function renderToCanvas(targetCanvas, showSelection = false) {
  const targetCtx = targetCanvas.getContext("2d");
  const sourceWidth = canvas.width;
  const sourceHeight = canvas.height;

  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

  const scaleX = targetCanvas.width / sourceWidth;
  const scaleY = targetCanvas.height / sourceHeight;

  if (!hasBackground()) {
    targetCtx.fillStyle = "#dbe3ee";
    targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    return;
  }

  if (backgroundMode === "upload" && currentImage) {
    const rect = getImageDrawRect();

    targetCtx.drawImage(
      currentImage,
      rect.x * scaleX,
      rect.y * scaleY,
      rect.width * scaleX,
      rect.height * scaleY
    );
  }

  if (backgroundMode === "gradient" && gradientBackground) {
    drawGradientBackgroundToContext(targetCtx, targetCanvas.width, targetCanvas.height, gradientBackground);
  }

  if (overlayImage && overlayRect) {
    targetCtx.drawImage(
      overlayImage,
      overlayRect.x * scaleX,
      overlayRect.y * scaleY,
      overlayRect.width * scaleX,
      overlayRect.height * scaleY
    );

    if (showSelection && overlaySelected) {
      targetCtx.save();
      targetCtx.setLineDash([8, 5]);
      targetCtx.lineWidth = 2;
      targetCtx.strokeStyle = "#22c55e";
      targetCtx.strokeRect(
        overlayRect.x * scaleX,
        overlayRect.y * scaleY,
        overlayRect.width * scaleX,
        overlayRect.height * scaleY
      );
      targetCtx.restore();
    }
  }

  textLayers.forEach((layer) => {
    drawLayerToContext(
      targetCtx,
      {
        ...layer,
        x: layer.x * scaleX,
        y: layer.y * scaleY,
        fontSize: layer.fontSize * Math.min(scaleX, scaleY),
        strokeWidth: layer.strokeWidth * Math.min(scaleX, scaleY)
      },
      showSelection && layer.id === activeLayerId
    );
  });
}

function redrawSavedVersions() {
  savedWrapper.innerHTML = "";

  savedVersions.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "saved-card";

    const img = document.createElement("img");
    img.className = "saved-thumb";
    img.src = item.dataUrl;
    img.alt = "Saved version";

    const actions = document.createElement("div");
    actions.className = "saved-actions";

    const downloadButton = document.createElement("button");
    downloadButton.className = "saved-download-btn";
    downloadButton.type = "button";
    downloadButton.textContent = "Download";
    downloadButton.addEventListener("click", () => {
      downloadDataUrl(item.dataUrl, item.filename || `saved-image-${index + 1}.png`);
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "saved-delete-btn";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      deleteSavedVersion(index);
    });

    actions.append(downloadButton, deleteButton);
    card.append(img, actions);
    savedWrapper.append(card);
  });
}

function saveVersionsToStorage() {
  localStorage.setItem("savedImageVersions", JSON.stringify(savedVersions));
}

function deleteSavedVersion(index) {
  savedVersions.splice(index, 1);
  saveVersionsToStorage();
  redrawSavedVersions();
}

function getCanvasBlob() {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function saveCurrentVersionToGallery() {
  if (!hasBackground()) {
    return null;
  }

  const { width, height } = getExportSize();
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width;
  exportCanvas.height = height;

  renderToCanvas(exportCanvas, false);

  const blob = await new Promise((resolve) => {
    exportCanvas.toBlob((result) => resolve(result), "image/png");
  });

  if (!blob) {
    return null;
  }

  const dataUrl = await blobToDataUrl(blob);
  const safeName = `${currentImageName || "edited-image"}-${width}x${height}-${Date.now()}.png`;

  const newItem = {
    dataUrl,
    filename: safeName
  };

  savedVersions.unshift(newItem);
  saveVersionsToStorage();
  redrawSavedVersions();

  drawCanvas(true);

  return newItem;
}

function resetEditor() {
  backgroundMode = "upload";
  backgroundSourceSelect.value = "upload";

  currentImage = null;
  currentImageName = "edited-image";
  imageDrawRect = null;

  gradientBackground = null;

  overlayImage = null;
  overlayImageName = "overlay-image";
  overlayRect = null;
  overlaySelected = false;
  isDraggingOverlay = false;
  isResizingOverlay = false;
  overlayStartRect = null;
  overlayResizeStart = null;

  textLayers = [];
  activeLayerId = null;
  layerCounter = 1;

  isDraggingLayer = false;
  imageUpload.value = "";
  overlayImageUpload.value = "";

  textInput.value = "";
  fontSelect.value = "Arial, sans-serif";
  fontSizeInput.value = 48;
  fontSizeValue.textContent = "48px";

  if (lineHeightInput) {
    lineHeightInput.value = 1.2;
  }

  if (lineHeightValue) {
    lineHeightValue.textContent = "1.2";
  }

  textColorInput.value = "#ffffff";
  strokeEnabledInput.checked = false;
  strokeColorInput.value = "#000000";
  strokeWidthInput.value = 2;
  strokeWidthValue.textContent = "2px";

  if (exportWidthInput) exportWidthInput.value = canvas.width;
  if (exportHeightInput) exportHeightInput.value = canvas.height;

  updateBackgroundModeUI();
  toggleStrokeSettingsVisibility();
  syncControlsFromActiveLayer();
  redrawLayersList();
  drawCanvas();
}

function getCanvasCoords(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

backgroundSourceSelect.addEventListener("change", () => {
  backgroundMode = backgroundSourceSelect.value;

  if (backgroundMode === "gradient" && !gradientBackground) {
    gradientBackground = generateGradientObject();
    currentImageName = "gradient-background";
  }

  overlaySelected = false;
  activeLayerId = null;
  updateBackgroundModeUI();
  syncControlsFromActiveLayer();
  redrawLayersList();
  drawCanvas();
});

imageUpload.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const fileReader = new FileReader();

  fileReader.onload = () => {
    const img = new Image();

    img.onload = () => {
      currentImage = img;
      currentImageName = file.name.replace(/\.[^/.]+$/, "") || "edited-image";
      backgroundMode = "upload";
      backgroundSourceSelect.value = "upload";
      updateBackgroundModeUI();

      if (textLayers.length === 0) {
        addNewLayer(canvas.width / 2, canvas.height / 2);
      }

      drawCanvas();
    };

    img.src = fileReader.result;
  };

  fileReader.readAsDataURL(file);
});

overlayImageUpload.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const fileReader = new FileReader();

  fileReader.onload = () => {
    const img = new Image();

    img.onload = () => {
      overlayImage = img;
      overlayImageName = file.name.replace(/\.[^/.]+$/, "") || "overlay-image";
      overlayRect = createDefaultOverlayRect(img);
      overlaySelected = true;
      activeLayerId = null;
      syncControlsFromActiveLayer();
      drawCanvas();
    };

    img.src = fileReader.result;
  };

  fileReader.readAsDataURL(file);
});

generateGradientBtn.addEventListener("click", () => {
  backgroundMode = "gradient";
  backgroundSourceSelect.value = "gradient";
  gradientBackground = generateGradientObject();
  currentImageName = "gradient-background";
  updateBackgroundModeUI();

  if (textLayers.length === 0) {
    addNewLayer(canvas.width / 2, canvas.height / 2);
  }

  drawCanvas();
});

removeOverlayBtn.addEventListener("click", () => {
  overlayImage = null;
  overlayRect = null;
  overlaySelected = false;
  overlayImageUpload.value = "";
  drawCanvas();
});

canvas.addEventListener("click", (event) => {
  if (!hasBackground()) {
    return;
  }

  const { x, y } = getCanvasCoords(event);

  if (backgroundMode === "gradient" && isPointInOverlay(x, y)) {
    overlaySelected = true;
    activeLayerId = null;
    syncControlsFromActiveLayer();
    redrawLayersList();
    drawCanvas();
    return;
  }

  const clickedLayer = findLayerAtPoint(x, y);

  if (clickedLayer) {
    setActiveLayer(clickedLayer.id);
    return;
  }

  overlaySelected = false;
  activeLayerId = null;
  syncControlsFromActiveLayer();
  redrawLayersList();
  drawCanvas();
});

canvas.addEventListener("dblclick", (event) => {
  if (!hasBackground()) {
    return;
  }

  const { x, y } = getCanvasCoords(event);
  const clickedLayer = findLayerAtPoint(x, y);

  if (clickedLayer) {
    setActiveLayer(clickedLayer.id);
    textInput.focus();

    if (typeof textInput.select === "function") {
      textInput.select();
    }
  }
});

canvas.addEventListener("mousedown", (event) => {
  if (!hasBackground()) {
    return;
  }

  const { x, y } = getCanvasCoords(event);

  if (backgroundMode === "gradient" && overlayRect && isPointInOverlayResizeHandle(x, y)) {
    overlaySelected = true;
    activeLayerId = null;
    isResizingOverlay = true;
    overlayResizeStart = { x, y };
    overlayStartRect = { ...overlayRect };
    syncControlsFromActiveLayer();
    redrawLayersList();
    drawCanvas();
    return;
  }

  if (backgroundMode === "gradient" && isPointInOverlay(x, y)) {
    overlaySelected = true;
    activeLayerId = null;
    isDraggingOverlay = true;
    overlayDragOffsetX = x - overlayRect.x;
    overlayDragOffsetY = y - overlayRect.y;
    syncControlsFromActiveLayer();
    redrawLayersList();
    drawCanvas();
    return;
  }

  const clickedLayer = findLayerAtPoint(x, y);

  if (!clickedLayer) {
    return;
  }

  setActiveLayer(clickedLayer.id);
  isDraggingLayer = true;
  dragOffsetX = x - clickedLayer.x;
  dragOffsetY = y - clickedLayer.y;
});

canvas.addEventListener("mousemove", (event) => {
  const { x, y } = getCanvasCoords(event);

  if (backgroundMode === "gradient" && overlayRect) {
    if (isPointInOverlayResizeHandle(x, y)) {
      canvas.style.cursor = "nwse-resize";
    } else if (isPointInOverlay(x, y)) {
      canvas.style.cursor = "move";
    } else {
      canvas.style.cursor = "crosshair";
    }
  } else {
    canvas.style.cursor = "crosshair";
  }

  if (isResizingOverlay && overlayRect && overlayStartRect && overlayResizeStart && overlayImage) {
    const dx = x - overlayResizeStart.x;
    const aspectRatio = overlayImage.width / overlayImage.height;

    let newWidth = Math.max(30, overlayStartRect.width + dx);
    let newHeight = newWidth / aspectRatio;

    if (overlayStartRect.y + newHeight > canvas.height) {
      newHeight = canvas.height - overlayStartRect.y;
      newWidth = newHeight * aspectRatio;
    }

    if (overlayStartRect.x + newWidth > canvas.width) {
      newWidth = canvas.width - overlayStartRect.x;
      newHeight = newWidth / aspectRatio;
    }

    overlayRect.width = newWidth;
    overlayRect.height = newHeight;

    drawCanvas();
    return;
  }

  if (isDraggingOverlay && overlayRect) {
    overlayRect.x = x - overlayDragOffsetX;
    overlayRect.y = y - overlayDragOffsetY;
    drawCanvas();
    return;
  }

  if (!isDraggingLayer) {
    return;
  }

  const activeLayer = getActiveLayer();
  if (!activeLayer) {
    return;
  }

  activeLayer.x = x - dragOffsetX;
  activeLayer.y = y - dragOffsetY;
  drawCanvas();
});

canvas.addEventListener("mouseup", () => {
  isDraggingLayer = false;
  isDraggingOverlay = false;
  isResizingOverlay = false;
  overlayStartRect = null;
  overlayResizeStart = null;
});

canvas.addEventListener("mouseleave", () => {
  isDraggingLayer = false;
  isDraggingOverlay = false;
  isResizingOverlay = false;
  overlayStartRect = null;
  overlayResizeStart = null;
  canvas.style.cursor = "crosshair";
});

textInput.addEventListener("input", () => {
  updateActiveLayerFromControls();
});

fontSelect.addEventListener("change", async () => {
  await updateActiveLayerFromControls();
});

fontSizeInput.addEventListener("input", () => {
  fontSizeValue.textContent = `${fontSizeInput.value}px`;
  updateActiveLayerFromControls();
});

if (lineHeightInput) {
  lineHeightInput.addEventListener("input", () => {
    lineHeightValue.textContent = lineHeightInput.value;
    updateActiveLayerFromControls();
  });
}

textColorInput.addEventListener("input", () => {
  updateActiveLayerFromControls();
});

strokeEnabledInput.addEventListener("change", () => {
  updateActiveLayerFromControls();
});

strokeColorInput.addEventListener("input", () => {
  updateActiveLayerFromControls();
});

strokeWidthInput.addEventListener("input", () => {
  strokeWidthValue.textContent = `${strokeWidthInput.value}px`;
  updateActiveLayerFromControls();
});

addLayerBtn.addEventListener("click", () => {
  addNewLayer(canvas.width / 2, canvas.height / 2);
});

deleteLayerBtn.addEventListener("click", () => {
  deleteActiveLayer();
});

downloadBtn.addEventListener("click", async () => {
  if (!hasBackground()) {
    alert("Choose background first");
    return;
  }

  const savedItem = await saveCurrentVersionToGallery();

  if (!savedItem) {
    alert("Failed to create image");
    return;
  }

  downloadDataUrl(savedItem.dataUrl, savedItem.filename);
});

resetBtn.addEventListener("click", () => {
  resetEditor();
});

updateBackgroundModeUI();
toggleStrokeSettingsVisibility();
redrawSavedVersions();
redrawLayersList();
drawCanvas();