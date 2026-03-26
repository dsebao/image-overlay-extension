let imageData = null;
let opacity = 50;
let width = 100;
let topOffset = 0; // New top offset variable, default 0px

document.addEventListener('DOMContentLoaded', function() {
  const imageUpload = document.getElementById('imageUpload');
  const imagePreview = document.getElementById('imagePreview');
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue = document.getElementById('opacityValue');
  const widthSlider = document.getElementById('widthSlider');
  const widthValue = document.getElementById('widthValue');
  const topSlider = document.getElementById('topSlider'); // New top slider
  const topValue = document.getElementById('topValue'); // New top value display
  const applyButton = document.getElementById('applyOverlay');
  const removeButton = document.getElementById('removeOverlay');
  const statusDiv = document.getElementById('status');

  // Check if there's an active overlay
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0] && tabs[0].id) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: function() {
          return !!document.getElementById('extension-image-overlay');
        }
      }, (results) => {
        if (results && results[0] && results[0].result) {
          removeButton.disabled = false;
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
              overlay.style.left = '50%';
              overlay.style.transform = 'translateX(-50%)';
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
            overlay.dataset.topOffset = newTopOffset;
            if (overlay) {
              overlay.style.top = (-window.scrollY + newTopOffset) + 'px';
            }
          },
          args: [parseInt(topOffset)]
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
          func: function(imageData, opacity, width, topOffset) {
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
              overlay.style.transform = 'translateX(-50%)';
              overlay.style.zIndex = '9999';
              overlay.style.pointerEvents = 'none';
              overlay.style.backgroundImage = `url(${imageData})`;
              overlay.style.backgroundPosition = 'center top';
              overlay.style.backgroundRepeat = 'no-repeat';
              overlay.style.backgroundSize = '100% auto';
              overlay.style.opacity = opacity;
              overlay.style.top = (-window.scrollY + topOffset) + 'px'; // Apply initial top offset
              overlay.style.transition = 'top 0.1s ease-out';
  
              // Get image dimensions
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
                        const topOffset = overlay.dataset.topOffset;
                        if (overlay) {
                          overlay.style.top = (-window.scrollY + parseInt(topOffset)) + 'px';
                          overlay.style.height = tempImg.naturalHeight + 'px';

                          console.log(overlay.style.top, window.scrollY, topOffset);
                        }
                        rafPending = false;
                      });
                    }
                  };
                  window.addEventListener('scroll', window.__overlayScrollHandler, { passive: true });
                }
              };
  
              document.body.appendChild(overlay);
              console.log("Overlay applied successfully with full image height");
              return true;
            } catch (error) {
              console.error("Error applying overlay:", error);
              return false;
            }
          },
          args: [imageData, opacity / 100, width, topOffset]
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