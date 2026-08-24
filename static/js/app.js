(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Static config that mirrors the backend catalog structure
  // ---------------------------------------------------------------------
  const SIZE_OPTIONS = {
    shirt: ["S", "M", "L", "XL"],
    pants: ["28", "30", "32", "34", "36"],
    shoes: ["40", "41", "42", "43", "44"],
    bag: ["One Size"],
    watch: ["One Size"],
  };

  const TAB_LABELS = {
    closest_match: "Closest Match",
    best_value: "Best Value",
    best_price: "Best Price",
  };

  const STEP_LABELS = {
    landing: "",
    upload: "Step 1 — Upload",
    sizes: "Step 2 — Sizes",
    budget: "Step 3 — Budget",
    analyze: "Analyzing",
    results: "Your options",
  };

  // Navigation history for back button
  const navHistory = [];

  // ---------------------------------------------------------------------
  // App state
  // ---------------------------------------------------------------------
  const state = {
    referenceImageSrc: "",
    detectedItems: [],       // [{category, label, icon}]
    selected: new Set(),     // category keys
    sizes: {},               // {category: size}
    budgetMin: 50,
    budgetMax: 600,
    budget: 600,             // Used for API calls (max budget)
    source: "all",           // 'all' | 'online' | 'qatar'
    results: null,           // last /api/recommend or /api/recalculate payload ({tabs, any_in_budget, message})
    activeTab: "closest_match",
    currentScreen: "landing",
    itemBudgets: {},         // Individual item budgets {category: amount}
    advancedOpen: false,
    advancedEntered: false,  // Track if user has entered any advanced values
  };

  // ---------------------------------------------------------------------
  // Screen navigation
  // ---------------------------------------------------------------------
  function showScreen(name, addToHistory = true) {
    // Don't add to history if it's the same screen or if we're going back
    if (addToHistory && state.currentScreen !== name) {
      navHistory.push(state.currentScreen);
    }
    
    state.currentScreen = name;
    
    document.querySelectorAll(".screen").forEach((el) => {
      el.classList.toggle("active", el.dataset.screen === name);
    });
    
    document.getElementById("step-indicator").textContent = STEP_LABELS[name] || "";
    
    const refThumb = document.getElementById("topbar-ref-thumb");
    const showRef = state.referenceImageSrc && name !== "landing" && name !== "upload";
    refThumb.classList.toggle("hidden", !showRef);
    
    // Update back button visibility
    updateBackButton();
    
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateBackButton() {
    const backBtn = document.getElementById("back-btn");
    // Show back button on all screens except landing
    if (state.currentScreen === "landing" || navHistory.length === 0) {
      backBtn.classList.add("hidden");
    } else {
      backBtn.classList.remove("hidden");
    }
  }

  function goBack() {
    if (navHistory.length === 0) {
      // If no history, go to landing
      showScreen("landing", false);
      return;
    }
    
    const previousScreen = navHistory.pop();
    
    // Don't allow going back to analyze screen (it's transient)
    if (previousScreen === "analyze") {
      // Try to go back one more step
      if (navHistory.length > 0) {
        const prev = navHistory.pop();
        showScreen(prev, false);
      } else {
        showScreen("landing", false);
      }
      return;
    }
    
    // If going back to upload, reset the detection stage
    if (previousScreen === "upload") {
      // Reset the upload/detect view
      document.getElementById("upload-stage").classList.remove("hidden");
      document.getElementById("detect-stage").classList.add("hidden");
      document.getElementById("file-input").value = "";
      // Clear selected items
      state.selected = new Set();
      state.detectedItems = [];
      document.getElementById("cta-continue-to-sizes").disabled = true;
    }
    
    showScreen(previousScreen, false);
  }

  // Handle back button click
  document.getElementById("back-btn").addEventListener("click", goBack);

  // Also handle browser back button
  window.addEventListener("popstate", () => {
    goBack();
  });

  // ---------------------------------------------------------------------
  // Screen navigation helpers
  // ---------------------------------------------------------------------
  function navigateToScreen(screenName) {
    // If we're on a screen and navigating forward, clear any future history
    // that might exist from using browser back button
    showScreen(screenName, true);
    // Push state for browser back button
    window.history.pushState({ screen: screenName }, "");
  }

  document.querySelector('[data-nav="landing"]').addEventListener("click", () => {
    resetFlow();
    // Clear history when going to landing
    navHistory.length = 0;
    showScreen("landing", false);
    window.history.pushState({ screen: "landing" }, "");
  });

  function resetFlow() {
    state.referenceImageSrc = "";
    state.detectedItems = [];
    state.selected = new Set();
    state.sizes = {};
    state.budgetMin = 50;
    state.budgetMax = 600;
    state.budget = 600;
    state.source = "all";
    state.results = null;
    state.activeTab = "closest_match";
    state.itemBudgets = {};
    state.advancedOpen = false;
    state.advancedEntered = false;
    
    document.getElementById("file-input").value = "";
    document.getElementById("upload-stage").classList.remove("hidden");
    document.getElementById("detect-stage").classList.add("hidden");
    document.getElementById("topbar-ref-thumb").classList.add("hidden");
    
    // Reset budget inputs if they exist
    if (document.getElementById("budget-min")) {
      document.getElementById("budget-min").value = 50;
      document.getElementById("budget-max").value = 600;
    }
    if (document.getElementById("budget-min-2")) {
      document.getElementById("budget-min-2").value = 50;
      document.getElementById("budget-max-2").value = 600;
    }
    
    // Reset advanced section
    const advancedSection = document.getElementById("advanced-section");
    const icon = document.querySelector(".advanced-toggle-icon");
    if (advancedSection) advancedSection.classList.add("hidden");
    if (icon) icon.classList.remove("open");
    
    // Reset summary
    const summary = document.getElementById("advanced-summary");
    if (summary) summary.textContent = "Not entered";
    if (summary) summary.className = "advanced-summary not-entered";
    
    document.querySelectorAll("#source-group .chip").forEach((c) => c.classList.remove("chip--active"));
    document.querySelector('#source-group .chip[data-value="all"]').classList.add("chip--active");
    document.querySelectorAll(".result-tab").forEach((t) => t.classList.remove("result-tab--active"));
    document.querySelector('.result-tab[data-tab="closest_match"]').classList.add("result-tab--active");
    
    // Reset button text
    const findBtn = document.getElementById("cta-find-options");
    if (findBtn) findBtn.textContent = "Analyze & Find Options";
    
    // Clear history
    navHistory.length = 0;
  }

  // ---------------------------------------------------------------------
  // SCREEN 1 — Landing
  // ---------------------------------------------------------------------
  document.getElementById("cta-upload").addEventListener("click", () => {
    navigateToScreen("upload");
  });

  // ---------------------------------------------------------------------
  // SCREEN 2 — Upload + Detect + Select
  // ---------------------------------------------------------------------
  const fileInput = document.getElementById("file-input");
  const dropzone = document.getElementById("dropzone");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      // Set current screen to upload before starting detection
      state.currentScreen = "upload";
      beginDetection(e.target.result);
    };
    reader.readAsDataURL(file);
  });

  ["dragover", "dragenter"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "var(--accent)";
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "";
    })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      state.currentScreen = "upload";
      beginDetection(ev.target.result);
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("use-demo-image").addEventListener("click", () => {
    // Push upload to history before starting detection
    // This ensures back button goes back to upload page
    if (state.currentScreen !== "upload") {
      // If we're on landing, push upload to history
      navHistory.push("upload");
      state.currentScreen = "upload";
    }
    beginDetection("/static/images/reference_image.jfif");
  });

  function beginDetection(imageSrc) {
    state.referenceImageSrc = imageSrc;
    document.getElementById("uploaded-preview").src = imageSrc;
    const refThumb = document.getElementById("topbar-ref-thumb");
    refThumb.src = imageSrc;
    document.getElementById("upload-stage").classList.add("hidden");
    document.getElementById("detect-stage").classList.remove("hidden");

    // Update the step indicator to show we're still in upload/detect
    document.getElementById("step-indicator").textContent = STEP_LABELS.upload;

    fetch("/api/analyze", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        state.detectedItems = data.items;
        state.selected = new Set();
        renderItemList(data.items, data.confident);
      })
      .catch(() => {
        // graceful fallback so the demo never dead-ends
        const fallback = [
          { category: "shirt", label: "Shirt", icon: "👕" },
          { category: "pants", label: "Pants", icon: "👖" },
        ];
        renderItemList(fallback, false);
      });
    
    // Update back button visibility
    updateBackButton();
  }

  function renderItemList(items, confident) {
    const list = document.getElementById("item-list");
    list.innerHTML = "";
    document.getElementById("low-confidence-note").classList.toggle("hidden", confident);

    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "item-row";
      li.dataset.category = item.category;
      li.innerHTML = `
        <span class="item-row__check">✓</span>
        <span class="item-row__icon">${item.icon}</span>
        <span class="item-row__label">${item.label}</span>
      `;
      li.addEventListener("click", () => {
        if (state.selected.has(item.category)) {
          state.selected.delete(item.category);
          li.classList.remove("selected");
        } else {
          state.selected.add(item.category);
          li.classList.add("selected");
        }
        document.getElementById("cta-continue-to-sizes").disabled = state.selected.size === 0;
      });
      list.appendChild(li);
    });
  }

  document.getElementById("cta-continue-to-sizes").addEventListener("click", () => {
    buildSizeScreen();
    navigateToScreen("sizes");
  });

  // ---------------------------------------------------------------------
  // SCREEN 3 — Sizes
  // ---------------------------------------------------------------------
  function buildSizeScreen() {
    const container = document.getElementById("size-groups");
    container.innerHTML = "";
    state.sizes = {};

    state.detectedItems
      .filter((item) => state.selected.has(item.category))
      .forEach((item) => {
        const options = SIZE_OPTIONS[item.category] || ["One Size"];
        const group = document.createElement("div");
        group.className = "size-group";
        group.innerHTML = `<p class="size-group__label">${item.label}</p>
          <div class="size-options" data-category="${item.category}"></div>`;
        container.appendChild(group);

        const optWrap = group.querySelector(".size-options");
        options.forEach((size) => {
          const pill = document.createElement("button");
          pill.className = "size-pill";
          pill.type = "button";
          pill.textContent = size;
          pill.addEventListener("click", () => {
            optWrap.querySelectorAll(".size-pill").forEach((p) => p.classList.remove("selected"));
            pill.classList.add("selected");
            state.sizes[item.category] = size;
            checkSizesComplete();
          });
          optWrap.appendChild(pill);
        });

        // auto-select single "One Size" categories
        if (options.length === 1) {
          optWrap.firstChild.classList.add("selected");
          state.sizes[item.category] = options[0];
        }
      });

    checkSizesComplete();
  }

  function checkSizesComplete() {
    const allSet = [...state.selected].every((cat) => state.sizes[cat]);
    document.getElementById("cta-sizes-continue").disabled = !allSet;
  }

  document.getElementById("cta-sizes-continue").addEventListener("click", () => {
    navigateToScreen("budget");
  });

  // ---------------------------------------------------------------------
  // SCREEN 4 — Budget + Shopping Source
  // ---------------------------------------------------------------------
  const budgetMinInput = document.getElementById("budget-min");
  const budgetMaxInput = document.getElementById("budget-max");

  // Set initial values
  state.budgetMin = 50;
  state.budgetMax = 600;
  state.itemBudgets = {};

  // Update state when inputs change
  budgetMinInput.addEventListener("input", () => {
    let minVal = parseInt(budgetMinInput.value, 10) || 0;
    let maxVal = parseInt(budgetMaxInput.value, 10) || 0;
    
    // Ensure min doesn't exceed max
    if (minVal > maxVal && maxVal > 0) {
      budgetMinInput.value = maxVal;
      minVal = maxVal;
    }
    
    state.budgetMin = minVal;
    state.budgetMax = maxVal;
    updateAdvancedConstraints();
    updateAnalyzeButton();
    updateAdvancedSummary();
  });

  budgetMaxInput.addEventListener("input", () => {
    let minVal = parseInt(budgetMinInput.value, 10) || 0;
    let maxVal = parseInt(budgetMaxInput.value, 10) || 0;
    
    // Ensure max doesn't go below min
    if (maxVal < minVal && minVal > 0) {
      budgetMaxInput.value = minVal;
      maxVal = minVal;
    }
    
    state.budgetMin = minVal;
    state.budgetMax = maxVal;
    updateAdvancedConstraints();
    updateAnalyzeButton();
    updateAdvancedSummary();
  });

  function updateAnalyzeButton() {
    const btn = document.getElementById("cta-find-options");
    btn.textContent = `Analyze & Find Options`;
  }

  function updateAdvancedSummary() {
    const summary = document.getElementById("advanced-summary");
    const total = Object.values(state.itemBudgets).reduce((sum, val) => sum + val, 0);
    const itemCount = Object.keys(state.itemBudgets).length;
    
    if (state.advancedEntered && itemCount > 0 && total > 0) {
      summary.textContent = `${itemCount} items · ${total} QAR allocated`;
      summary.className = "advanced-summary";
    } else if (state.advancedEntered && itemCount > 0) {
      summary.textContent = `${itemCount} items · 0 QAR allocated`;
      summary.className = "advanced-summary";
    } else {
      summary.textContent = "Not entered";
      summary.className = "advanced-summary not-entered";
    }
  }

  // Budget preset buttons
  document.querySelectorAll(".budget-preset").forEach((preset) => {
    preset.addEventListener("click", () => {
      const min = parseInt(preset.dataset.min, 10);
      const max = parseInt(preset.dataset.max, 10);
      budgetMinInput.value = min;
      budgetMaxInput.value = max;
      state.budgetMin = min;
      state.budgetMax = max;
      updateAdvancedConstraints();
      updateAnalyzeButton();
      updateAdvancedSummary();
      // Reset item budgets when preset changes
      resetItemBudgets();
    });
  });

  // ---------------------------------------------------------------------
  // ADVANCED SECTION
  // ---------------------------------------------------------------------
  function buildAdvancedSection() {
    const container = document.getElementById("advanced-items");
    container.innerHTML = "";
    state.itemBudgets = {};
    
    const selectedItems = state.detectedItems
      .filter(item => state.selected.has(item.category));
    
    if (selectedItems.length === 0) {
      container.innerHTML = '<p style="color: var(--ink-faint); font-size: 14px;">No items selected</p>';
      return;
    }
    
    // Don't auto-fill budgets - leave them empty
    selectedItems.forEach((item) => {
      state.itemBudgets[item.category] = 0;
      
      const div = document.createElement("div");
      div.className = "advanced-item";
      div.innerHTML = `
        <span class="advanced-item__icon">${item.icon}</span>
        <span class="advanced-item__label">${item.label}</span>
        <div class="advanced-item__input-group">
          <span class="budget-currency">QAR</span>
          <input type="number" class="advanced-item__input" 
                 data-category="${item.category}" 
                 value="" 
                 placeholder="0"
                 min="0" 
                 max="${state.budgetMax}"
                 step="5">
          <span class="advanced-item__constraint">(max ${state.budgetMax} QAR)</span>
        </div>
      `;
      container.appendChild(div);
      
      // Add input listener
      const input = div.querySelector('.advanced-item__input');
      input.addEventListener('input', () => {
        const val = parseInt(input.value, 10) || 0;
        const maxAllowed = state.budgetMax;
        const minAllowed = 0;
        
        // Track that user has entered values
        if (input.value !== '' && input.value !== '0') {
          state.advancedEntered = true;
        } else {
          // Check if any other inputs have values
          const hasValues = document.querySelectorAll('.advanced-item__input').some(inp => 
            inp.value !== '' && inp.value !== '0'
          );
          state.advancedEntered = hasValues;
        }
        
        // Constrain to min/max
        if (val > maxAllowed) {
          input.value = maxAllowed;
          state.itemBudgets[item.category] = maxAllowed;
        } else if (val < minAllowed) {
          input.value = '';
          state.itemBudgets[item.category] = 0;
        } else {
          state.itemBudgets[item.category] = val;
        }
        
        updateAdvancedTotal();
        validateBudget();
        updateAdvancedSummary();
      });
      
      // Add blur handler to clean up empty values
      input.addEventListener('blur', () => {
        if (input.value === '') {
          input.value = '';
          state.itemBudgets[item.category] = 0;
          updateAdvancedTotal();
          validateBudget();
          updateAdvancedSummary();
        }
      });
    });
    
    updateAdvancedTotal();
    validateBudget();
    updateAdvancedSummary();
  }

  function updateAdvancedConstraints() {
    // Update max constraints on all advanced inputs
    document.querySelectorAll('.advanced-item__input').forEach(input => {
      const currentVal = parseInt(input.value, 10) || 0;
      const maxVal = state.budgetMax;
      const minVal = 0;
      
      // Update the constraint text
      const constraintSpan = input.closest('.advanced-item__input-group').querySelector('.advanced-item__constraint');
      if (constraintSpan) {
        constraintSpan.textContent = `(max ${maxVal} QAR)`;
      }
      
      // Update input max attribute
      input.max = maxVal;
      input.min = minVal;
      
      // Constrain current value
      if (currentVal > maxVal) {
        input.value = maxVal;
        const category = input.dataset.category;
        if (category && state.itemBudgets[category] !== undefined) {
          state.itemBudgets[category] = maxVal;
        }
      }
    });
    
    updateAdvancedTotal();
    validateBudget();
    updateAdvancedSummary();
  }

  function updateAdvancedTotal() {
    const total = Object.values(state.itemBudgets).reduce((sum, val) => sum + val, 0);
    const totalEl = document.getElementById("advanced-total-value");
    const minBudget = state.budgetMin;
    const maxBudget = state.budgetMax;
    
    totalEl.textContent = `${total} QAR`;
    totalEl.className = 'advanced-total-value';
    
    if (total > maxBudget) {
      totalEl.classList.add('over-budget');
    } else if (total < minBudget && total > 0) {
      totalEl.classList.add('under-budget');
    } else if (total >= minBudget && total <= maxBudget && total > 0) {
      totalEl.classList.add('within-budget');
    }
  }

  function validateBudget() {
    const total = Object.values(state.itemBudgets).reduce((sum, val) => sum + val, 0);
    const minBudget = state.budgetMin;
    const maxBudget = state.budgetMax;
    const warningEl = document.getElementById("advanced-warning");
    const warningText = document.getElementById("advanced-warning-text");
    
    // Check if any values have been entered
    const hasValues = document.querySelectorAll('.advanced-item__input').some(inp => 
      inp.value !== '' && inp.value !== '0'
    );
    
    // Hide warning by default
    warningEl.classList.add("hidden");
    
    if (hasValues) {
      if (total > maxBudget) {
        // Over budget - warning only, not blocking
        warningEl.classList.remove("hidden");
        warningText.textContent = `⚠️ Total allocated (${total} QAR) exceeds maximum budget (${maxBudget} QAR). Consider reducing some item budgets.`;
      } else if (total < minBudget && total > 0) {
        // Under budget - warning only, not blocking
        warningEl.classList.remove("hidden");
        warningText.textContent = `⚠️ Total allocated (${total} QAR) is below minimum budget (${minBudget} QAR). Consider increasing some item budgets.`;
      }
    }
  }

  function resetItemBudgets() {
    const inputs = document.querySelectorAll('.advanced-item__input');
    
    inputs.forEach(input => {
      const category = input.dataset.category;
      input.value = '';
      if (category && state.itemBudgets[category] !== undefined) {
        state.itemBudgets[category] = 0;
      }
    });
    
    state.advancedEntered = false;
    updateAdvancedTotal();
    validateBudget();
    updateAdvancedSummary();
  }

  function distributeEvenly() {
    const inputs = document.querySelectorAll('.advanced-item__input');
    const selectedItems = state.detectedItems.filter(item => state.selected.has(item.category));
    const totalBudget = state.budgetMax;
    const evenAmount = Math.floor(totalBudget / Math.max(selectedItems.length, 1));
    let remainder = totalBudget - (evenAmount * selectedItems.length);
    
    inputs.forEach((input, index) => {
      const category = input.dataset.category;
      let val = evenAmount;
      // Distribute remainder
      if (index < remainder) {
        val += 1;
      }
      input.value = val;
      if (category && state.itemBudgets[category] !== undefined) {
        state.itemBudgets[category] = val;
      }
    });
    
    state.advancedEntered = true;
    updateAdvancedTotal();
    validateBudget();
    updateAdvancedSummary();
  }

  // Advanced toggle
  document.getElementById("advanced-toggle").addEventListener("click", () => {
    state.advancedOpen = !state.advancedOpen;
    const section = document.getElementById("advanced-section");
    const icon = document.querySelector(".advanced-toggle-icon");
    
    if (state.advancedOpen) {
      section.classList.remove("hidden");
      icon.classList.add("open");
      buildAdvancedSection();
    } else {
      section.classList.add("hidden");
      icon.classList.remove("open");
      // Hide warning
      document.getElementById("advanced-warning").classList.add("hidden");
    }
  });

  // Distribute evenly button
  document.getElementById("advanced-distribute").addEventListener("click", distributeEvenly);

  // Reset all button
  document.getElementById("advanced-reset").addEventListener("click", resetItemBudgets);

  // ---------------------------------------------------------------------
  // Keep the source selector as is
  // ---------------------------------------------------------------------
  document.querySelectorAll("#source-group .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#source-group .chip").forEach((c) => c.classList.remove("chip--active"));
      chip.classList.add("chip--active");
      state.source = chip.dataset.value;
    });
  });

  document.getElementById("cta-find-options").addEventListener("click", () => {
    // Always use the max budget as the primary constraint
    // Advanced budgets are just for guidance
    state.budget = state.budgetMax;
    
    navigateToScreen("analyze");
    runAnalyzeAnimation(fetchRecommendations);
  });

  // ---------------------------------------------------------------------
  // SCREEN 5 — Analyze (simulated locally, no external AI calls)
  // ---------------------------------------------------------------------
  function runAnalyzeAnimation(onComplete) {
    const items = document.querySelectorAll("#analyze-checklist li");
    items.forEach((li) => li.classList.remove("done"));
    items.forEach((li) => {
      const delay = parseInt(li.dataset.delay, 10);
      setTimeout(() => li.classList.add("done"), delay);
    });
    const totalDelay = Math.max(...Array.from(items).map((li) => parseInt(li.dataset.delay, 10))) + 500;
    setTimeout(onComplete, totalDelay);
  }

  function fetchRecommendations() {
    const body = {
      items: [...state.selected],
      sizes: state.sizes,
      budget: state.budget,
      source: state.source,
    };
    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          alert(data.error);
          navigateToScreen("budget");
          return;
        }
        state.results = data;
        state.activeTab = "closest_match";
        document.querySelectorAll(".result-tab").forEach((t) =>
          t.classList.toggle("result-tab--active", t.dataset.tab === "closest_match")
        );
        renderResults();
        navigateToScreen("results");
        // sync the second budget inputs
        document.getElementById("budget-min-2").value = state.budgetMin;
        document.getElementById("budget-max-2").value = state.budgetMax;
      });
  }

  // ---------------------------------------------------------------------
  // SCREEN 6 — Results
  // ---------------------------------------------------------------------
  function renderResults() {
    renderSummaryStrip();
    renderRecalcBanner();
    renderResultCards(state.results.tabs[state.activeTab]);
  }

  function renderRecalcBanner() {
    const banner = document.getElementById("recalc-banner");
    if (state.results.message) {
      banner.textContent = state.results.message;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  function renderSummaryStrip() {
    const strip = document.getElementById("summary-strip");
    const labels = state.detectedItems
      .filter((i) => state.selected.has(i.category))
      .map((i) => i.label);
    const sizesText = [...state.selected]
      .map((cat) => `${capitalize(cat)}: <strong>${state.sizes[cat]}</strong>`)
      .join(" &nbsp;·&nbsp; ");

    strip.innerHTML = `
      <span>${labels.join(" + ")}</span>
      <span>${sizesText}</span>
      <span>Budget: <strong>${state.budget} QAR</strong></span>
    `;
  }

  document.querySelectorAll(".result-tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      document.querySelectorAll(".result-tab").forEach((t) => t.classList.remove("result-tab--active"));
      tabBtn.classList.add("result-tab--active");
      state.activeTab = tabBtn.dataset.tab;
      renderResultCards(state.results.tabs[state.activeTab]);
    });
  });

  function renderResultCards(results) {
    const wrap = document.getElementById("result-cards");
    wrap.innerHTML = "";

    results.forEach((res) => {
      const isHero = res.rank === 1;
      const card = document.createElement("div");
      card.className = "result-card" + (isHero ? " result-card--hero" : "");

      const itemLines = res.items
        .map(
          (p) => `
        <div class="item-line" data-product-id="${p.id}">
          <img src="${p.image}" alt="${p.name}" loading="lazy">
          <div>
            <div class="item-line__name">${p.name}</div>
            <div class="item-line__meta">${p.retailer} · ${p.color}</div>
          </div>
        </div>`
        )
        .join("");

      card.innerHTML = `
        <div class="result-card__badge"><span class="rank-badge">#${res.rank}</span>${res.visual_match}% Visual Match</div>
        ${itemLines}
        <hr class="result-card__divider">
        <div class="result-card__total">
          <span class="result-card__total-label">Total</span>
          <span class="result-card__total-value">${res.total_price} ${res.currency}</span>
        </div>
        ${res.over_budget ? `<div class="result-card__over">Closest option — above your ${state.budget} QAR budget</div>` : ""}
        <button class="btn btn--primary view-products-btn">View Products</button>
      `;

      card.querySelector(".view-products-btn").addEventListener("click", () => openComboModal(res));
      card.querySelectorAll(".item-line").forEach((line) => {
        line.addEventListener("click", () => {
          const product = res.items.find((p) => p.id === line.dataset.productId);
          openComboModal(res, product.id);
        });
      });

      wrap.appendChild(card);
    });
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // recalculate - Updated for min/max inputs
  const budgetMinInput2 = document.getElementById("budget-min-2");
  const budgetMaxInput2 = document.getElementById("budget-max-2");

  // Set initial values from state
  budgetMinInput2.value = state.budgetMin || 50;
  budgetMaxInput2.value = state.budgetMax || 600;

  budgetMinInput2.addEventListener("input", () => {
    let minVal = parseInt(budgetMinInput2.value, 10) || 0;
    let maxVal = parseInt(budgetMaxInput2.value, 10) || 0;
    if (minVal > maxVal && maxVal > 0) {
      budgetMinInput2.value = maxVal;
      minVal = maxVal;
    }
    state.budgetMin = minVal;
    state.budgetMax = maxVal;
  });

  budgetMaxInput2.addEventListener("input", () => {
    let minVal = parseInt(budgetMinInput2.value, 10) || 0;
    let maxVal = parseInt(budgetMaxInput2.value, 10) || 0;
    if (maxVal < minVal && minVal > 0) {
      budgetMaxInput2.value = minVal;
      maxVal = minVal;
    }
    state.budgetMin = minVal;
    state.budgetMax = maxVal;
  });

  document.getElementById("cta-recalculate").addEventListener("click", () => {
    const newBudget = state.budgetMax; // Use max as the budget limit
    const oldBudget = state.budget; // Store the previous budget for comparison
    
    const body = {
      items: [...state.selected],
      sizes: state.sizes,
      old_budget: oldBudget,
      new_budget: newBudget,
      source: state.source,
    };
    
    fetch("/api/recalculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          alert(data.error);
          return;
        }
        state.budget = newBudget;
        state.results = data;
        renderResults();
      });
  });

  // shop online / shop in store toggle
  document.querySelectorAll("#mode-toggle .mode-toggle__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#mode-toggle .mode-toggle__btn").forEach((b) => b.classList.remove("mode-toggle__btn--active"));
      btn.classList.add("mode-toggle__btn--active");
      const mode = btn.dataset.mode;
      document.getElementById("results-online").classList.toggle("hidden", mode !== "online");
      document.getElementById("results-store").classList.toggle("hidden", mode !== "store");
      if (mode === "store") loadMalls();
    });
  });

  let mallsLoaded = false;
  function loadMalls() {
    if (mallsLoaded) return;
    fetch("/api/malls")
      .then((r) => r.json())
      .then((malls) => {
        const list = document.getElementById("mall-list");
        list.innerHTML = malls
          .map(
            (m) => `
          <div class="mall-card">
            <div class="mall-card__name">${m.name}</div>
            <div class="mall-card__retailers">${m.retailers.join(" · ")}</div>
          </div>`
          )
          .join("");
        mallsLoaded = true;
      });
  }

  document.getElementById("cta-start-over").addEventListener("click", () => {
    resetFlow();
    navHistory.length = 0;
    showScreen("landing", false);
  });

  // ---------------------------------------------------------------------
  // Product detail modal
  // ---------------------------------------------------------------------
  const modalOverlay = document.getElementById("product-modal");
  document.getElementById("modal-close").addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  function closeModal() {
    modalOverlay.classList.add("hidden");
  }

  function openComboModal(res, focusProductId) {
    const content = document.getElementById("modal-content");
    const items = focusProductId ? res.items.filter((p) => p.id === focusProductId).concat(res.items.filter((p) => p.id !== focusProductId)) : res.items;

    content.innerHTML = items
      .map(
        (p, idx) => `
      <div>
        <img src="${p.image}" alt="${p.name}">
        <div class="modal__body">
          <div class="modal__retailer">${p.retailer}</div>
          <h3 class="modal__name">${p.name}</h3>
          <div class="modal__specs">
            <div><div class="modal__spec-label">Size</div><div class="modal__spec-value">${state.sizes[p.category] || "—"}</div></div>
            <div><div class="modal__spec-label">Color</div><div class="modal__spec-value">${p.color}</div></div>
            <div><div class="modal__spec-label">Visual Match</div><div class="modal__spec-value">${p.visual_match}%</div></div>
            <div><div class="modal__spec-label">Category</div><div class="modal__spec-value">${p.category_label}</div></div>
          </div>
          <div class="modal__price">${p.price} ${p.currency}</div>
          <a class="btn btn--primary" href="${p.product_url}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;">View Product</a>
        </div>
      </div>
      ${idx < items.length - 1 ? '<hr class="result-card__divider" style="margin:0 28px;">' : ""}
    `
      )
      .join("");

    modalOverlay.classList.remove("hidden");
  }

  // Initialize back button and update analyze button
  updateBackButton();
  updateAnalyzeButton();
  updateAdvancedSummary();
})();