// Global state
let isLoading = false;

// Initialize the app
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, initializing app...");

  // Verify all required elements exist
  const requiredElements = [
    "queryInput",
    "submitBtn",
    "resultsSection",
    "resultMeta",
    "analysisContent",
    "rawDataContent",
    "rawDataSection",
    "analysisSection",
    "errorSection",
  ];

  const missingElements = requiredElements.filter(
    (id) => !document.getElementById(id)
  );
  if (missingElements.length > 0) {
    console.error("Missing required elements:", missingElements);
    return;
  }

  console.log("All required elements found");
  checkServerHealth();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  const queryInput = document.getElementById("queryInput");
  const submitBtn = document.getElementById("submitBtn");

  // Submit on Enter (Ctrl+Enter for new line)
  queryInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      submitQuery();
    }
  });

  // Auto-resize textarea
  queryInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });
}

// Check server health
async function checkServerHealth() {
  const statusDot = document.getElementById("connectionStatus");
  const statusText = document.getElementById("statusText");

  try {
    const response = await fetch("/api/health");
    const data = await response.json();

    if (data.success) {
      statusDot.className = "status-dot connected";
      statusText.textContent = "Connected - Ready to analyze!";
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    statusDot.className = "status-dot error";
    statusText.textContent = "Connection error - Please refresh";
    console.error("Health check failed:", error);
  }
}

// Fill query from example
function fillQuery(element) {
  const queryInput = document.getElementById("queryInput");
  queryInput.value = element.textContent;
  queryInput.focus();

  // Trigger auto-resize
  queryInput.style.height = "auto";
  queryInput.style.height = queryInput.scrollHeight + "px";
}

// Submit query
async function submitQuery() {
  if (isLoading) return;

  const queryInput = document.getElementById("queryInput");
  const query = queryInput.value.trim();

  if (!query) {
    alert("Please enter a query first!");
    queryInput.focus();
    return;
  }

  setLoadingState(true);
  hideResults();
  hideError();

  try {
    const response = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      // Increase timeout for complex queries
      signal: AbortSignal.timeout(60000), // 60 seconds timeout
    });

    const data = await response.json();

    if (data.success) {
      console.log("Query successful:", data);
      showResults(data);
    } else {
      console.error("Query failed:", data);
      showError(data.error || "An error occurred while processing your query");
    }
  } catch (error) {
    console.error("Query failed:", error);

    // Clear loading state first
    setLoadingState(false);

    if (error.name === "AbortError") {
      showError(
        "Request timed out. The query is taking longer than expected. Please try a simpler query or wait and try again."
      );
    } else if (error.message.includes("HTTP error")) {
      showError(`Server error: ${error.message}. Please try again.`);
    } else {
      showError(
        "Network error: Could not connect to server. Please check your connection and try again."
      );
    }
    return; // Don't execute finally block
  } finally {
    setLoadingState(false);
  }
}

// Set loading state
function setLoadingState(loading) {
  isLoading = loading;
  const submitBtn = document.getElementById("submitBtn");
  const submitText = document.getElementById("submitText");
  const loadingSpinner = document.getElementById("loadingSpinner");

  submitBtn.disabled = loading;

  if (loading) {
    submitText.style.display = "none";
    loadingSpinner.style.display = "inline";
  } else {
    submitText.style.display = "inline";
    loadingSpinner.style.display = "none";
  }
}

// Show results
function showResults(data) {
  const resultsSection = document.getElementById("resultsSection");
  const resultMeta = document.getElementById("resultMeta");
  const analysisContent = document.getElementById("analysisContent");
  const rawDataSection = document.getElementById("rawDataSection");
  const rawDataContent = document.getElementById("rawDataContent");
  const analysisSection = document.getElementById("analysisSection");

  // Check if all elements exist
  if (!resultsSection || !resultMeta || !analysisContent || !rawDataContent) {
    console.error("Required DOM elements not found");
    showError(
      "Interface error: Could not display results. Please refresh the page."
    );
    return;
  }

  // Update metadata
  resultMeta.innerHTML = `
        <div>📊 ${data.resultCount} records found</div>
        <div>⏱️ ${new Date(data.executionTime).toLocaleTimeString()}</div>
    `;

  // Always show raw data first
  if (data.rawResults && data.rawResults.length > 0) {
    rawDataContent.textContent = JSON.stringify(data.rawResults, null, 2);
    rawDataSection.style.display = "block";
  } else {
    rawDataContent.textContent = "No raw data available";
    rawDataSection.style.display = "block";
  }

  // Show analysis below raw data
  if (data.analysis) {
    analysisContent.innerHTML = formatAnalysis(data.analysis);
    analysisSection.style.display = "block";
  } else {
    analysisContent.innerHTML = "<p>Analysis not available</p>";
    analysisSection.style.display = "block";
  }

  // Show results section
  resultsSection.style.display = "block";

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Format analysis text
function formatAnalysis(analysis) {
  // Convert analysis text to HTML with better formatting
  return analysis
    .split("\n")
    .map((line) => {
      line = line.trim();
      if (!line) return "<br>";

      // Bold lines that look like headers (start with caps, short)
      if (line.length < 100 && /^[A-Z]/.test(line) && !line.endsWith(".")) {
        return `<p><strong>${escapeHtml(line)}</strong></p>`;
      }

      // Regular paragraphs
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("");
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Show error
function showError(message) {
  const errorSection = document.getElementById("errorSection");
  const errorMessage = document.getElementById("errorMessage");

  errorMessage.textContent = message;
  errorSection.style.display = "block";

  // Scroll to error
  errorSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Hide results
function hideResults() {
  document.getElementById("resultsSection").style.display = "none";
}

// Hide error
function hideError() {
  document.getElementById("errorSection").style.display = "none";
}

// Clear error
function clearError() {
  hideError();
  document.getElementById("queryInput").focus();
}

// Utility: Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
