let imageData = null;
let opacity = 50;
let width = 500; // pixels
let originalWidth = 500; // Store original width for reset
let topOffset = 0;
let leftOffset = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragEnabled = true;
let retinaMode = false;

document.addEventListener('DOMContentLoaded', function() {
  const imageUpload = document.getElementById('imageUpload');
  const imagePreview = document.getElementById('imagePreview');
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue = document.getElementById('opacityValue');
  const widthSlider = document.getElementById('widthSlider');
  const widthValue = document.getElementById('widthValue');
  const resetWidthBtn = document.getElementById('resetWidth');
  const topSlider = document.getElementById('topSlider');
  const topValue = document.getElementById('topValue');
  const dragToggle = document.getElementById('dragToggle');
  const retinaToggle = document.getElementById('retinaToggle');
  const applyButton = document.getElementById('applyOverlay');
  const removeButton = document.getElementById('removeOverlay');
  const statusDiv = document.getElementById('status');

  // Check if there's an active overlay and sync toggle state
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0] && tabs[0].id) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: function() {
          const overlay = document.getElementById('extension-image-overlay');
          if (overlay) {
            return {
              exists: true,
              dragEnabled: overlay.style.pointerEvents === 'auto',
              topOffset: parseInt(overlay.dataset.topOffset) || 0,
              retinaMode: overlay.dataset.retinaMode === 'true',
              requestedWidth: parseInt(overlay.dataset.requestedWidth) || 500,
              naturalWidth: parseInt(overlay.dataset.naturalWidth) || 500,
              opacity: parseFloat(overlay.style.opacity) || 0.5
            };
          }
          return { exists: false };
        }
      }, (results) => {
        if (results && results[0] && results[0].result) {
          const result = results[0].result;
          if (result.exists) {
            removeButton.disabled = false;
            dragEnabled = result.dragEnabled;
            dragToggle.checked = dragEnabled;
            
            // Sync width values
            if (result.requestedWidth !== undefined) {
              width = result.requestedWidth;
              widthSlider.value = result.requestedWidth;
              widthValue.value = result.requestedWidth;
              // Expand slider max if needed
              widthSlider.max = Math.max(parseInt(widthSlider.max), result.requestedWidth);
            }
            
            // Sync original width
            if (result.naturalWidth !== undefined) {
              originalWidth = retinaMode ? Math.round(result.naturalWidth / 2) : result.naturalWidth;
            }
            
            // Sync opacity
            if (result.opacity !== undefined) {
              opacity = Math.round(result.opacity * 100);
              opacitySlider.value = opacity;
              opacityValue.value = opacity;
            }
            
            // Sync top offset value
            if (result.topOffset !== undefined) {
              topOffset = result.topOffset;
              topSlider.value = result.topOffset;
              topValue.value = result.topOffset;
              // Adjust slider range if needed
              topSlider.min = Math.min(parseInt(topSlider.min), result.topOffset);
              topSlider.max = Math.max(parseInt(topSlider.max), result.topOffset);
            }
            
            // Sync retina mode
            if (result.retinaMode !== undefined) {
              retinaMode = result.retinaMode;
              retinaToggle.checked = retinaMode;
            }
          }
        }
      });
    }
  });

  // Handle image upload
  imageUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        imageData = event.target.result;
        imagePreview.src = imageData;
        imagePreview.style.display = 'block';
        applyButton.disabled = false;
        statusDiv.textContent = "Image loaded successfully";

        // Once the preview has decoded, sync the width slider to the image's natural width
        imagePreview.onload = function() {
          const naturalWidth = imagePreview.naturalWidth;
          // If retina mode is enabled, set width to 50% of natural width
          width = retinaMode ? Math.round(naturalWidth / 2) : naturalWidth;
          originalWidth = width; // Save original width for reset
          // Expand the slider max if the image is wider than the current ceiling
          widthSlider.max = Math.max(parseInt(widthSlider.max), naturalWidth);
          widthSlider.value = width;
          widthValue.value = width;
        };
      };
      reader.readAsDataURL(file);
    }
  });

  // Sync number inputs → sliders
  opacityValue.addEventListener('input', function() {
    const val = Math.min(100, Math.max(1, parseInt(this.value) || 1));
    opacity = val;
    opacitySlider.value = val;
    opacitySlider.dispatchEvent(new Event('input'));
  });

  widthValue.addEventListener('input', function() {
    const val = Math.max(1, parseInt(this.value) || 1);
    width = val;
    widthSlider.max = Math.max(parseInt(widthSlider.max), val);
    widthSlider.value = val;
    widthSlider.dispatchEvent(new Event('input'));
  });

  // Reset width to original
  resetWidthBtn.addEventListener('click', function() {
    width = originalWidth;
    widthSlider.value = originalWidth;
    widthValue.value = originalWidth;
    widthSlider.dispatchEvent(new Event('input'));
  });

  topValue.addEventListener('input', function() {
    const val = parseInt(this.value) || 0;
    topOffset = val;
    topSlider.min = Math.min(parseInt(topSlider.min), val);
    topSlider.max = Math.max(parseInt(topSlider.max), val);
    topSlider.value = val;
    topSlider.dispatchEvent(new Event('input'));
  });

  // Handle opacity slider
  opacitySlider.addEventListener('input', function() {
    opacity = this.value;
    opacityValue.value = opacity;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: function(newOpacity) {
            const overlay = document.getElementById('extension-image-overlay');
            if (overlay) {
              overlay.style.opacity = newOpacity;
            }
          },
          args: [opacity / 100]
        });
      }
    });
  });

  // Handle width slider
  widthSlider.addEventListener('input', function() {
    width = this.value;
    widthValue.value = width;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: function(newWidthPx, retinaMode) {
            const overlay = document.getElementById('extension-image-overlay');
            if (overlay) {
              // In retina mode, use exact width; otherwise scale for device pixel ratio
              let effectiveWidth = newWidthPx;
              
              if (!retinaMode) {
                const devicePixelRatio = window.devicePixelRatio || 1;
                if (devicePixelRatio > 1) {
                  effectiveWidth = newWidthPx * Math.min(devicePixelRatio, 2);
                }
              }
              
              overlay.style.width = effectiveWidth + 'px';
              
              // Maintain aspect ratio by getting stored height ratio
              const naturalWidth = parseFloat(overlay.dataset.naturalWidth);
              const naturalHeight = parseFloat(overlay.dataset.naturalHeight);
              
              if (naturalWidth && naturalHeight) {
                const aspectRatio = naturalHeight / naturalWidth;
                const calculatedHeight = effectiveWidth * aspectRatio;
                overlay.style.height = calculatedHeight + 'px';
              }
              
              console.log('Width updated to:', effectiveWidth + 'px', 'Retina mode:', retinaMode);
              
              // Only reset to center if not manually positioned
              const leftOffset = parseInt(overlay.dataset.leftOffset) || 0;
              if (leftOffset === 0) {
                overlay.style.left = '50%';
                overlay.style.transform = 'translateX(-50%)';
              }
            }
          },
          args: [parseInt(width), retinaMode]
        });
      }
    });
  });

  // Handle top slider
  topSlider.addEventListener('input', function() {
    topOffset = this.value;
    topValue.value = topOffset;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: function(newTopOffset) {
            const overlay = document.getElementById('extension-image-overlay');
            if (overlay) {
              overlay.dataset.topOffset = newTopOffset;
              overlay.style.top = (-window.scrollY + newTopOffset) + 'px';
            }
          },
          args: [parseInt(topOffset)]
        });
      }
    });
  });

  // Handle drag toggle
  dragToggle.addEventListener('change', function() {
    dragEnabled = this.checked;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: function(enabled) {
            const overlay = document.getElementById('extension-image-overlay');
            if (overlay) {
              overlay.style.pointerEvents = enabled ? 'auto' : 'none';
              overlay.style.cursor = enabled ? 'move' : 'default';
              overlay.dataset.dragEnabled = enabled;
            }
          },
          args: [dragEnabled]
        });
      }
    });
  });

  // Handle retina mode toggle
  retinaToggle.addEventListener('change', function() {
    retinaMode = this.checked;
    
    // If an image is already loaded, adjust the width
    if (imagePreview.src && imagePreview.naturalWidth) {
      const naturalWidth = imagePreview.naturalWidth;
      width = retinaMode ? Math.round(naturalWidth / 2) : naturalWidth;
      originalWidth = width; // Update original width when retina mode changes
      widthSlider.value = width;
      widthValue.value = width;
      
      // Update overlay if it exists
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].id) {
          chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            func: function(newWidthPx, retinaMode) {
              const overlay = document.getElementById('extension-image-overlay');
              if (overlay) {
                overlay.dataset.retinaMode = retinaMode;
                
                const naturalWidth = parseFloat(overlay.dataset.naturalWidth);
                const naturalHeight = parseFloat(overlay.dataset.naturalHeight);
                
                // Calculate final width based on retina mode
                let finalWidth = newWidthPx;
                
                if (naturalWidth && naturalHeight) {
                  const aspectRatio = naturalHeight / naturalWidth;
                  const calculatedHeight = finalWidth * aspectRatio;
                  
                  overlay.style.width = finalWidth + 'px';
                  overlay.style.height = calculatedHeight + 'px';
                  
                  // Reset to center if not manually positioned
                  const leftOffset = parseInt(overlay.dataset.leftOffset) || 0;
                  if (leftOffset === 0) {
                    overlay.style.left = '50%';
                    overlay.style.transform = 'translateX(-50%)';
                  }
                }
              }
            },
            args: [parseInt(width), retinaMode]
          });
        }
      });
    }
  });

  // Apply overlay button
  applyButton.addEventListener('click', function() {
    statusDiv.textContent = "Applying overlay...";
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: function(imageData, opacity, widthPx, topOffset, dragEnabled, retinaMode) {
            return new Promise((resolve) => {
              try {
              // Remove any existing overlay
              const existingOverlay = document.getElementById('extension-image-overlay');
              if (existingOverlay) {
                existingOverlay.parentNode.removeChild(existingOverlay);
              }

              // Create temporary image to get natural dimensions
              const tempImg = new Image();
              tempImg.src = imageData;

              tempImg.onload = function() {
                // Calculate dimensions based on retina mode
                let effectiveWidth = widthPx;
                
                // In retina mode, use exact width; otherwise scale for device pixel ratio
                if (!retinaMode) {
                  const devicePixelRatio = window.devicePixelRatio || 1;
                  if (devicePixelRatio > 1) {
                    effectiveWidth = widthPx * Math.min(devicePixelRatio, 2);
                  }
                }
                
                // Calculate height maintaining aspect ratio
                const aspectRatio = tempImg.naturalHeight / tempImg.naturalWidth;
                const calculatedHeight = effectiveWidth * aspectRatio;
                
                // Calculate initial position based on current scroll position
                // If topOffset is at default (0), position relative to current viewport
                // Otherwise use the specified topOffset
                const currentScrollY = window.scrollY;
                const initialTopOffset = topOffset === 0 ? currentScrollY : topOffset;
                
                console.log('Creating overlay:', 'Requested:', widthPx + 'px', 'Effective:', effectiveWidth + 'px', 'Height:', calculatedHeight + 'px', 'Retina mode:', retinaMode, 'ScrollY:', currentScrollY, 'Initial offset:', initialTopOffset);
                
                // Create overlay div
                const overlay = document.createElement('div');
                overlay.id = 'extension-image-overlay';
                overlay.style.position = 'fixed';
                overlay.style.width = effectiveWidth + 'px';
                overlay.style.height = calculatedHeight + 'px';
                overlay.style.left = '50%';
                overlay.style.transform = 'translateX(-50%)';
                overlay.style.top = (-currentScrollY + initialTopOffset) + 'px';
                overlay.style.zIndex = '9999';
                overlay.style.backgroundImage = `url(${imageData})`;
                overlay.style.backgroundPosition = 'center top';
                overlay.style.backgroundRepeat = 'no-repeat';
                overlay.style.backgroundSize = '100% 100%';
                overlay.style.opacity = opacity;
                overlay.style.transition = 'none';
                overlay.style.userSelect = 'none';
                overlay.style.pointerEvents = dragEnabled ? 'auto' : 'none';
                overlay.style.cursor = dragEnabled ? 'move' : 'default';
                
                // Store dimension data for later use
                overlay.dataset.topOffset = initialTopOffset;
                overlay.dataset.leftOffset = '0';
                overlay.dataset.requestedWidth = widthPx;
                overlay.dataset.effectiveWidth = effectiveWidth;
                overlay.dataset.naturalWidth = tempImg.naturalWidth;
                overlay.dataset.naturalHeight = tempImg.naturalHeight;
                overlay.dataset.retinaMode = retinaMode;
                overlay.dataset.dragEnabled = dragEnabled;

                // Drag functionality — always attached; respects dragEnabled at runtime
                let localIsDragging = false;
                let dragStartX = 0;
                let dragStartY = 0;
                let startLeft = 0;
                let startTop = 0;

                const handleMouseDown = (e) => {
                  if (overlay.dataset.dragEnabled === 'false') return;
                  localIsDragging = true;
                  dragStartX = e.clientX;
                  dragStartY = e.clientY;

                  const rect = overlay.getBoundingClientRect();
                  startLeft = rect.left;
                  startTop = rect.top;

                  overlay.style.transition = 'none';
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                  e.preventDefault();
                };

                const handleMouseMove = (e) => {
                  if (!localIsDragging) return;

                  const deltaX = e.clientX - dragStartX;
                  const deltaY = e.clientY - dragStartY;

                  const newLeft = startLeft + deltaX;
                  const newTop = startTop + deltaY;

                  overlay.style.left = newLeft + 'px';
                  overlay.style.top = newTop + 'px';
                  overlay.style.transform = 'none';

                  overlay.dataset.leftOffset = newLeft;
                  overlay.dataset.topOffset = newTop + window.scrollY;
                };

                const handleMouseUp = () => {
                  localIsDragging = false;
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };

                overlay.addEventListener('mousedown', handleMouseDown);
                
                // Scroll handler
                let rafPending = false;
                
                if (!window.__overlayScrollHandler) {
                  window.__overlayScrollHandler = function() {
                    if (!rafPending) {
                      rafPending = true;
                      requestAnimationFrame(() => {
                        const overlay = document.getElementById('extension-image-overlay');
                        if (overlay) {
                          const topOffset = parseInt(overlay.dataset.topOffset) || 0;
                          const leftOffset = parseInt(overlay.dataset.leftOffset) || 0;
                          
                          if (leftOffset === 0) {
                            overlay.style.left = '50%';
                            overlay.style.transform = 'translateX(-50%)';
                          } else {
                            overlay.style.left = leftOffset + 'px';
                            overlay.style.transform = 'none';
                          }
                          
                          overlay.style.top = (-window.scrollY + topOffset) + 'px';
                        }
                        rafPending = false;
                      });
                    }
                  };
                  window.addEventListener('scroll', window.__overlayScrollHandler, { passive: true });
                }
                
                document.body.appendChild(overlay);
                console.log("Overlay applied successfully with retina mode:", retinaMode);
                resolve(true);
              };

              tempImg.onerror = function() {
                console.error('Failed to load image for overlay creation');
                resolve(false);
              };
              } catch (error) {
                console.error("Error applying overlay:", error);
                resolve(false);
              }
            });
          },
          args: [imageData, opacity / 100, parseInt(width), topOffset, dragToggle.checked, retinaMode]
        }, (results) => {
          if (results && results[0] && results[0].result) {
            removeButton.disabled = false;
            statusDiv.textContent = "Overlay applied successfully!";
          } else {
            statusDiv.textContent = "Error applying overlay. Check console for details.";
          }
        });
      } else {
        statusDiv.textContent = "Cannot access current tab";
      }
    });
  });

  // Remove overlay button
  removeButton.addEventListener('click', function() {
    statusDiv.textContent = "Removing overlay...";
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: function() {
            try {
              const existingOverlay = document.getElementById('extension-image-overlay');
              if (existingOverlay) {
                existingOverlay.parentNode.removeChild(existingOverlay);
                if (window.__overlayScrollHandler) {
                  window.removeEventListener('scroll', window.__overlayScrollHandler);
                  window.__overlayScrollHandler = null;
                }
                console.log("Overlay removed successfully");
                return true;
              }
              return false;
            } catch (error) {
              console.error("Error removing overlay:", error);
              return false;
            }
          }
        }, (results) => {
          if (results && results[0] && results[0].result) {
            removeButton.disabled = true;
            statusDiv.textContent = "Overlay removed successfully!";
          } else {
            statusDiv.textContent = "Error removing overlay. No overlay found.";
          }
        });
      }
    });
  });
});