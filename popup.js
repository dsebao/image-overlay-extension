let imageData = null;
let opacity = 50;
let width = 100;
let topOffset = 0;
let leftOffset = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragEnabled = true;

document.addEventListener('DOMContentLoaded', function() {
  const imageUpload = document.getElementById('imageUpload');
  const imagePreview = document.getElementById('imagePreview');
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue = document.getElementById('opacityValue');
  const widthSlider = document.getElementById('widthSlider');
  const widthValue = document.getElementById('widthValue');
  const topSlider = document.getElementById('topSlider');
  const topValue = document.getElementById('topValue');
  const dragToggle = document.getElementById('dragToggle');
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
              dragEnabled: overlay.style.pointerEvents === 'auto'
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
      };
      reader.readAsDataURL(file);
    }
  });

  // Handle opacity slider
  opacitySlider.addEventListener('input', function() {
    opacity = this.value;
    opacityValue.textContent = opacity + '%';
    
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
    widthValue.textContent = width + '%';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: function(newWidth) {
            const overlay = document.getElementById('extension-image-overlay');
            if (overlay) {
              overlay.style.width = newWidth + '%';
              
              const leftOffset = parseInt(overlay.dataset.leftOffset) || 0;
              if (leftOffset === 0) {
                overlay.style.left = '50%';
                overlay.style.transform = 'translateX(-50%)';
              }
            }
          },
          args: [width]
        });
      }
    });
  });

  // Handle top slider
  topSlider.addEventListener('input', function() {
    topOffset = this.value;
    topValue.textContent = topOffset + 'px';
    
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

  // Apply overlay button
  applyButton.addEventListener('click', function() {
    statusDiv.textContent = "Applying overlay...";
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: function(imageData, opacity, width, topOffset, dragEnabled) {
            try {
              // Remove any existing overlay
              const existingOverlay = document.getElementById('extension-image-overlay');
              if (existingOverlay) {
                existingOverlay.parentNode.removeChild(existingOverlay);
              }
              
              // Create overlay div
              const overlay = document.createElement('div');
              overlay.id = 'extension-image-overlay';
              overlay.style.position = 'fixed';
              overlay.style.width = width + '%';
              overlay.style.left = '50%';
              overlay.dataset.topOffset = topOffset;
              overlay.dataset.leftOffset = '0';
              overlay.style.transform = 'translateX(-50%)';
              overlay.style.zIndex = '9999';
              overlay.style.pointerEvents = dragEnabled ? 'auto' : 'none';
              overlay.style.cursor = dragEnabled ? 'move' : 'default';
              overlay.style.backgroundImage = `url(${imageData})`;
              overlay.style.backgroundPosition = 'center top';
              overlay.style.backgroundRepeat = 'no-repeat';
              overlay.style.backgroundSize = '100% auto';
              overlay.style.opacity = opacity;
              overlay.style.top = (-window.scrollY + topOffset) + 'px';
              overlay.style.transition = 'none';
              overlay.style.userSelect = 'none';

              // Drag functionality - only add if enabled
              if (dragEnabled) {
                let localIsDragging = false;
                let dragStartX = 0;
                let dragStartY = 0;
                let startLeft = 0;
                let startTop = 0;

                const handleMouseDown = (e) => {
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
              }
  
              // Get image dimensions and set up scroll handler
              const tempImg = new Image();
              tempImg.src = imageData;
              
              tempImg.onload = function() {
                overlay.style.height = tempImg.naturalHeight + 'px';
                
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
              };
  
              document.body.appendChild(overlay);
              console.log("Overlay applied successfully");
              return true;
            } catch (error) {
              console.error("Error applying overlay:", error);
              return false;
            }
          },
          args: [imageData, opacity / 100, width, topOffset, dragToggle.checked]
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

document.addEventListener('DOMContentLoaded', function() {
  const imageUpload = document.getElementById('imageUpload');
  const imagePreview = document.getElementById('imagePreview');
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue = document.getElementById('opacityValue');
  const widthSlider = document.getElementById('widthSlider');
  const widthValue = document.getElementById('widthValue');
  const dragToggle = document.getElementById('dragToggle'); // Drag toggle checkbox
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
              dragEnabled: overlay.style.pointerEvents === 'auto'
            };
          }
          return { exists: false };
        }
      }, (results) => {
        if (results && results[0] && results[0].result) {
          const result = results[0].result;
          if (result.exists) {
            removeButton.disabled = false;
            // Sync the toggle state with the actual overlay state
            dragEnabled = result.dragEnabled;
            dragToggle.checked = dragEnabled;
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
      };
      reader.readAsDataURL(file);
    }
  });

  // Handle opacity slider
  opacitySlider.addEventListener('input', function() {
    opacity = this.value;
    opacityValue.textContent = opacity + '%';
    
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
    widthValue.textContent = width + '%';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: function(newWidth) {
            const overlay = document.getElementById('extension-image-overlay');
            if (overlay) {
              overlay.style.width = newWidth + '%';
              
              // Only reset to center if not manually positioned
              const leftOffset = parseInt(overlay.dataset.leftOffset) || 0;
              if (leftOffset === 0) {
                overlay.style.left = '50%';
                overlay.style.transform = 'translateX(-50%)';
              }
            }
          },
          args: [width]
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
              
              // Set cursor with proper force
              if (enabled) {
                overlay.style.cursor = 'move';
                overlay.setAttribute('style', overlay.getAttribute('style') + '; cursor: move !important;');
              } else {
                overlay.style.cursor = 'default';
                // Remove any previous !important cursor and set default
                let style = overlay.getAttribute('style') || '';
                style = style.replace(/;\s*cursor:\s*move\s*!important/g, '');
                overlay.setAttribute('style', style + '; cursor: default;');
              }
              
              // Store the drag enabled state on the overlay for reference
              overlay.dataset.dragEnabled = enabled;
              
              console.log('Drag toggle changed:', enabled ? 'enabled' : 'disabled');
            }
          },
          args: [dragEnabled]
        });
      }
    });
  });

  // Apply overlay button
  applyButton.addEventListener('click', function() {
    statusDiv.textContent = "Applying overlay...";
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: function(imageData, opacity, width, topOffset, dragEnabled) {
            try {
              // Remove any existing overlay
              const existingOverlay = document.getElementById('extension-image-overlay');
              if (existingOverlay) {
                existingOverlay.parentNode.removeChild(existingOverlay);
              }
              
              // Create overlay div
              const overlay = document.createElement('div');
              overlay.id = 'extension-image-overlay';
              overlay.style.position = 'fixed';
              overlay.style.width = width + '%';
              overlay.style.left = '50%';
              overlay.dataset.topOffset = topOffset;
              overlay.dataset.leftOffset = '0'; // Initialize left offset
              overlay.style.transform = 'translateX(-50%)';
              overlay.style.zIndex = '9999';
              overlay.style.pointerEvents = dragEnabled ? 'auto' : 'none'; // Enable drag or ignore layer
              // Set cursor using setAttribute to ensure it's applied
              if (dragEnabled) {
                overlay.style.cursor = 'move';
                overlay.setAttribute('style', overlay.getAttribute('style') + '; cursor: move !important;');
              } else {
                overlay.style.cursor = 'default';
              }
              overlay.style.backgroundImage = `url(${imageData})`;
              overlay.style.backgroundPosition = 'center top';
              overlay.style.backgroundRepeat = 'no-repeat';
              overlay.style.backgroundSize = '100% auto';
              overlay.style.opacity = opacity;
              overlay.style.top = (-window.scrollY + topOffset) + 'px'; // Apply initial top offset
              overlay.style.transition = 'none'; // Remove transition for smooth dragging
              overlay.style.userSelect = 'none'; // Prevent text selection during drag

              // Drag functionality - only add if enabled
              if (dragEnabled) {
                let localIsDragging = false;
                let dragStartX = 0;
                let dragStartY = 0;
                let startLeft = 0;
                let startTop = 0;

                const handleMouseDown = (e) => {
                  localIsDragging = true;
                  isDragging = true; // Update global state for scroll handler
                  dragStartX = e.clientX;
                  dragStartY = e.clientY;
                  
                  // Get current position
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
                  overlay.style.transform = 'none'; // Remove transform when dragging
                  
                  // Update stored offsets
                  overlay.dataset.leftOffset = newLeft;
                  overlay.dataset.topOffset = newTop + window.scrollY; // Account for scroll
                };

                const handleMouseUp = () => {
                  localIsDragging = false;
                  isDragging = false; // Update global state for scroll handler
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };

                overlay.addEventListener('mousedown', handleMouseDown);
              }
  
              // Get image dimensions
              const tempImg = new Image();
              tempImg.src = imageData;
              
              tempImg.onload = function() {
                overlay.style.height = tempImg.naturalHeight + 'px';
                
                let rafPending = false;
                let isDragging = false; // Track dragging state for scroll handler
                
                // Store reference to isDragging for scroll handler
                if (dragEnabled) {
                  overlay.addEventListener('mousedown', () => { isDragging = true; });
                  document.addEventListener('mouseup', () => { isDragging = false; });
                }
                
                if (!window.__overlayScrollHandler) {
                  window.__overlayScrollHandler = function() {
                    if (!rafPending && !isDragging) {
                      rafPending = true;
                      requestAnimationFrame(() => {
                        const overlay = document.getElementById('extension-image-overlay');
                        if (overlay && !isDragging) {
                          const topOffset = parseInt(overlay.dataset.topOffset) || 0;
                          const leftOffset = parseInt(overlay.dataset.leftOffset) || 0;
                          
                          // Handle positioning based on whether image was manually positioned
                          if (leftOffset === 0) {
                            // Use centered positioning
                            overlay.style.left = '50%';
                            overlay.style.transform = 'translateX(-50%)';
                          } else {
                            // Use manual positioning - maintain left position
                            overlay.style.left = leftOffset + 'px';
                            overlay.style.transform = 'none';
                          }
                          
                          // Always update top position relative to scroll
                          overlay.style.top = (-window.scrollY + topOffset) + 'px';
                          overlay.style.height = tempImg.naturalHeight + 'px';
                        }
                        rafPending = false;
                      });
                    }
                  };
                  window.addEventListener('scroll', window.__overlayScrollHandler, { passive: true });
                }
              };
  
              document.body.appendChild(overlay);
              console.log("Overlay applied successfully with drag functionality");
              return true;
            } catch (error) {
              console.error("Error applying overlay:", error);
              return false;
            }
          },
          args: [imageData, opacity / 100, width, topOffset, dragToggle.checked]
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