const gallery = document.getElementById("gallery");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const clearBtn = document.getElementById("clearBtn");
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const uploadStatus = document.getElementById("uploadStatus");

let isSearchMode = false;

// Load memes on page load
loadMemes();

// Search
searchBtn.addEventListener("click", () => doSearch());
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});
clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  clearBtn.style.display = "none";
  isSearchMode = false;
  loadMemes();
});

async function doSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  gallery.innerHTML = '<p class="empty-state">Searching...</p>';
  clearBtn.style.display = "block";
  isSearchMode = true;

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const results = await res.json();
    renderMemes(results, true);
  } catch (err) {
    gallery.innerHTML = '<p class="empty-state">Search failed. Try again.</p>';
  }
}

async function loadMemes() {
  try {
    const res = await fetch("/api/memes");
    const memes = await res.json();
    renderMemes(memes, false);
  } catch (err) {
    gallery.innerHTML = '<p class="empty-state">Failed to load memes.</p>';
  }
}

function renderMemes(memes, showSimilarity) {
  if (memes.length === 0) {
    gallery.innerHTML = "";
    emptyState.style.display = "block";
    if (isSearchMode) {
      emptyState.textContent = "No results found.";
    } else {
      emptyState.textContent = "No memes yet. Upload some to get started!";
    }
    return;
  }

  emptyState.style.display = "none";
  gallery.innerHTML = memes
    .map((meme) => {
      const similarity = showSimilarity && meme.similarity != null
        ? `<span class="similarity">${Math.round(meme.similarity * 100)}% match</span>`
        : "";

      return `
        <div class="meme-card" data-id="${meme.id}">
          <img src="/uploads/${meme.filename}" alt="${escapeHtml(meme.original_name)}" loading="lazy">
          <div class="info">
            <button class="delete-btn" onclick="deleteMeme(${meme.id})" title="Delete">x</button>
            <div class="name">${escapeHtml(meme.original_name)}</div>
            <div class="description">${escapeHtml(meme.description)}</div>
            ${similarity}
          </div>
        </div>
      `;
    })
    .join("");
}

// Upload - drag & drop
uploadArea.addEventListener("click", () => fileInput.click());
browseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
  if (files.length > 0) {
    uploadFiles(files);
  }
});

fileInput.addEventListener("change", () => {
  const files = [...fileInput.files].filter((f) => f.type.startsWith("image/"));
  if (files.length > 0) {
    uploadFiles(files);
  }
});

async function uploadFiles(files) {
  uploadStatus.style.display = "flex";
  uploadArea.style.display = "none";

  const statusText = uploadStatus.querySelector("span") || uploadStatus;

  for (let i = 0; i < files.length; i++) {
    statusText.textContent = `Uploading ${i + 1} of ${files.length}: ${files[i].name}`;

    const formData = new FormData();
    formData.append("image", files[i]);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        console.error(`Failed to upload ${files[i].name}: ${err.error}`);
      }
    } catch (err) {
      console.error(`Failed to upload ${files[i].name}: ${err.message}`);
    }

    // Refresh gallery after each upload
    if (!isSearchMode) {
      await loadMemes();
    }
  }

  uploadStatus.style.display = "none";
  uploadArea.style.display = "block";
  fileInput.value = "";
}

async function deleteMeme(id) {
  if (!confirm("Delete this meme?")) return;

  try {
    await fetch(`/api/memes/${id}`, { method: "DELETE" });
    if (isSearchMode) {
      doSearch();
    } else {
      loadMemes();
    }
  } catch (err) {
    alert("Delete failed");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
