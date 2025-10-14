// --- Configuration & Globals ---
let UNIQUE_NOTE_ID = 'default';
let STORAGE_KEY = 'willowNotesData-default';
const MAX_DEPTH = 5; 
let CURRENT_THEME = localStorage.getItem('appTheme') || 'willow-theme';

// The key CSS variables that can be customized
const CUSTOM_THEME_VARS = {
    '--main-bg': '#f0fff0',
    '--main-text': '#4B5320',
    '--branch-line': '#A4C639',
    '--note-bg': '#fff',
    '--input-focus': '#ddf'
};

// --- Data & Persistence ---
let notesData = []; // This will hold the note array, including the notesData.metadata property

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function saveNotes() {
    // Update the last_modified timestamp on every save operation
    if (notesData.metadata) {
        notesData.metadata.last_modified = new Date().toISOString();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesData));
}

function loadThemeCustomizations() {
    const customVars = localStorage.getItem('customThemeVars');
    if (customVars) {
        Object.assign(CUSTOM_THEME_VARS, JSON.parse(customVars));
    }
    applyTheme(CURRENT_THEME);
}

function applyTheme(themeName) {
    const root = document.documentElement; 
    
    document.body.className = themeName;
    
    if (themeName === 'custom-theme') {
        for (const [key, value] of Object.entries(CUSTOM_THEME_VARS)) {
            root.style.setProperty(key, value);
        }
    } else {
        root.style.cssText = ''; 
    }
}

function loadNotes() {
    handleURLAndStorage(); 
    loadThemeCustomizations(); 

    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        notesData = JSON.parse(data);
    } else {
        notesData = []; 
    }
    
    // Ensure metadata and a root note always exist
    if (!notesData.metadata) {
        const now = new Date().toISOString();
        notesData.metadata = {
            file_id: UNIQUE_NOTE_ID,
            created_at: now,
            last_modified: now
        };
    }
    
    if (notesData.length === 0) {
        notesData.push({
            id: generateId(),
            content: '', 
            children: []
        });
        saveNotes();
    }

    renderAllNotes();
}

function handleURLAndStorage() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    
    if (!id) {
        id = generateId();
        params.set('id', id);
        window.location.search = params.toString(); 
        return; 
    }
    
    UNIQUE_NOTE_ID = id;
    STORAGE_KEY = 'willowNotesData-' + id;
    
    const idEl = document.getElementById('current-note-id');
    if (idEl) idEl.textContent = id;
}


// --- Import/Export Logic (.WOTE JSON) ---

function exportToTxt(notes) {
    let txtContent = '';

    // 1. Print Metadata at the top
    if (notes.metadata) {
        const created = new Date(notes.metadata.created_at).toLocaleString();
        const modified = new Date(notes.metadata.last_modified).toLocaleString();
        
        txtContent += `// METADATA: File ID: ${notes.metadata.file_id}\n`;
        txtContent += `// TIMESTAMP: Created: ${created}, Last Modified: ${modified}\n\n`;
    }

    // 2. Traversal logic (only for the content array)
    function traverse(notesArray, depth) {
        const indent = '\t'.repeat(depth);
        notesArray.forEach(note => {
            
            // Do NOT print timestamps on every note anymore
            
            txtContent += indent + note.content + '\n';
            
            if (note.children && note.children.length > 0) {
                traverse(note.children, depth + 1);
            }
        });
    }

    // Filter out the metadata property before traversing content
    traverse(notes.filter(n => !n.metadata), 0); 
    return txtContent.trim();
}

function handleExport() {
    // Filename logic
    let fileNameContent = notesData[0] ? notesData[0].content : 'willow-notes';
    let safeFileName = fileNameContent
        .replace(/[\\/:*?"<>|]/g, '-') 
        .trim();
        
    if (!safeFileName) {
        safeFileName = 'willow-notes';
    }

    // CRITICAL: Export the JSON structure directly
    const content = JSON.stringify(notesData); 
    const blob = new Blob([content], { type: 'application/json' }); 
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileName}.wote`; // CRITICAL: Use .wote extension
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// CRITICAL: Simple import function using JSON.parse
function importFromTxt(jsonString) { 
    try {
        const importedData = JSON.parse(jsonString);
        
        // Ensure imported data is valid (an array with a metadata property)
        if (Array.isArray(importedData) || importedData.metadata) {
            // Overwrite current data and re-render
            notesData = importedData;
            saveNotes();
            renderAllNotes();
        } else {
            alert("Error: Imported file does not contain a valid Willow Note structure.");
        }
    } catch (e) {
        alert("Error: The file could not be read. It might be corrupted or not a valid .wote file.");
    }
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    // CRITICAL: Check file extension
    if (!file.name.endsWith('.wote') && !file.name.endsWith('.json')) {
        alert("Please select a file with the .wote or .json extension.");
        event.target.value = null; 
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        importFromTxt(e.target.result);
    };
    reader.readAsText(file);
    event.target.value = null; 
}


// --- Data Manipulation Utilities (Keyboard Logic) ---

function saveCurrentNote() {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.classList.contains('note-content')) {
        const noteId = activeEl.closest('.note').dataset.id;
        updateNoteContent(noteId, activeEl.textContent);
    }
}

function findNoteAndParent(notesArray, id) {
    for (const note of notesArray) {
        if (note.id === id) {
            return { note, parentArray: notesArray };
        }
        if (note.children && note.children.length > 0) {
            const result = findNoteAndParent(note.children, id);
            if (result) {
                return result;
            }
        }
    }
    return null;
}

function findNoteById(notesArray, id) {
    const result = findNoteAndParent(notesArray, id);
    return result ? result.note : null;
}

function updateNoteContent(id, content) {
    const noteObj = findNoteById(notesData, id);
    if (noteObj) {
        noteObj.content = content.trim();
        saveNotes(); // Saves modification time
    }
}

function addNewSibling(noteId) {
    saveCurrentNote(); 
    const result = findNoteAndParent(notesData, noteId);
    if (!result) return;

    const { note, parentArray } = result;
    const index = parentArray.findIndex(n => n.id === noteId);

    if (index !== -1) {
        const newNote = { 
            id: generateId(), 
            content: '', 
            children: []
        };
        parentArray.splice(index + 1, 0, newNote);
        saveNotes(); 
        renderAllNotes();
        
        setTimeout(() => {
            const newEl = document.querySelector(`[data-id="${newNote.id}"] .note-content`);
            if (newEl) newEl.focus();
        }, 0);
    }
}

function increaseNoteDepth(noteId) {
    saveCurrentNote(); 
    const result = findNoteAndParent(notesData, noteId);
    if (!result) return;
    
    const { note, parentArray } = result;
    const index = parentArray.findIndex(n => n.id === noteId);

    if (index > 0) {
        const previousSibling = parentArray[index - 1];
        parentArray.splice(index, 1);
        previousSibling.children.push(note);
        
        saveNotes();
        renderAllNotes();
        
        setTimeout(() => {
            const newEl = document.querySelector(`[data-id="${noteId}"] .note-content`);
            if (newEl) newEl.focus();
        }, 0);
    }
}

function decreaseNoteDepth(noteId) {
    saveCurrentNote(); 
    const noteResult = findNoteAndParent(notesData, noteId);
    if (!noteResult) return;
    
    const { note, parentArray } = noteResult;
    
    if (parentArray === notesData) {
        deleteNote(noteId); 
        return;
    } 
    
    let parentNoteId = null;
    let containerArray = notesData; 
    
    const rootParent = notesData.find(rootNote => rootNote.children === parentArray);

    if (rootParent) {
        parentNoteId = rootParent.id;
        containerArray = notesData;
    } else {
        let found = false;
        function findGrandparent(arr) {
            for (const n of arr) {
                if (n.children === parentArray) {
                    containerArray = arr; 
                    parentNoteId = n.id;
                    found = true;
                    return;
                }
                if (n.children.length > 0) {
                    findGrandparent(n.children);
                }
                if (found) return;
            }
        }
        findGrandparent(notesData);
        if (!found) return; 
    }
    
    const indexInParent = parentArray.findIndex(n => n.id === noteId);
    parentArray.splice(indexInParent, 1);
    
    const parentIndexInGrandparent = containerArray.findIndex(n => n.id === parentNoteId);
    containerArray.splice(parentIndexInGrandparent + 1, 0, note);

    saveNotes();
    renderAllNotes();
    
    setTimeout(() => {
        const newEl = document.querySelector(`[data-id="${noteId}"] .note-content`);
        if (newEl) newEl.focus();
    }, 0);
}


function deleteNote(noteId) {
    const result = findNoteAndParent(notesData, noteId);
    if (!result) return;
    
    const { note, parentArray } = result;
    const index = parentArray.findIndex(n => n.id === noteId);

    if (parentArray === notesData && index === 0) {
        note.content = ''; 
        saveNotes();
        renderAllNotes();
        return; 
    } 
    
    if (index !== -1) {
        const children = note.children; 
        parentArray.splice(index, 1);
        
        if (children && children.length > 0) {
            parentArray.splice(index, 0, ...children);
        }
    }
    
    saveNotes();
    renderAllNotes();

    setTimeout(() => {
        const focusNote = parentArray[index] || parentArray[index - 1]; 
        if (focusNote) {
            document.querySelector(`[data-id="${focusNote.id}"] .note-content`).focus();
        } else {
             document.getElementById('note-container').focus();
        }
    }, 0);
}


// --- RENDER FUNCTIONS ---
function renderNoteTree(notes, parentEl, depth = 0) {
    if (!notes || notes.length === 0) return;
    const repliesContainer = document.createElement('div');
    repliesContainer.className = 'replies';
    parentEl.appendChild(repliesContainer);
    notes.forEach(note => {
        // Skip rendering the metadata property
        if (note === notesData.metadata) return; 

        const noteEl = document.createElement('div');
        noteEl.className = 'note';
        noteEl.dataset.id = note.id; 
        noteEl.dataset.depth = depth;
        const contentEl = document.createElement('div');
        contentEl.className = 'note-content';
        contentEl.setAttribute('contenteditable', 'true');
        contentEl.textContent = note.content;
        contentEl.addEventListener('keydown', handleKeydown);
        contentEl.addEventListener('blur', (e) => updateNoteContent(note.id, e.target.textContent));
        noteEl.appendChild(contentEl);
        repliesContainer.appendChild(noteEl);
        if (note.children && note.children.length > 0) {
            renderNoteTree(note.children, noteEl, depth + 1);
        }
    });
}

function renderAllNotes() {
    const container = document.getElementById('note-container');
    container.innerHTML = ''; 
    notesData.forEach(rootNote => {
        // Skip rendering the metadata property
        if (rootNote === notesData.metadata) return; 

        const rootEl = document.createElement('div');
        rootEl.className = 'note root-note'; 
        rootEl.dataset.id = rootNote.id;
        rootEl.dataset.depth = 0;
        const contentEl = document.createElement('div');
        contentEl.className = 'note-content';
        contentEl.setAttribute('contenteditable', 'true');
        contentEl.textContent = rootNote.content;
        contentEl.addEventListener('keydown', handleKeydown);
        contentEl.addEventListener('blur', (e) => updateNoteContent(rootNote.id, e.target.textContent));
        rootEl.appendChild(contentEl);
        container.appendChild(rootEl);
        if (rootNote.children && rootNote.children.length > 0) {
            renderNoteTree(rootNote.children, rootEl, 1);
        }
    });
}

// --- KEYBOARD INTERACTION HANDLER ---

function handleArrowNavigation(event, direction) {
    saveCurrentNote(); 
    
    let targetNoteEl;
    const allNotes = Array.from(document.querySelectorAll('.note-content'));
    const currentIndex = allNotes.findIndex(el => el === event.target);

    if (currentIndex === -1) return;

    if (direction === 'down') {
        if (currentIndex < allNotes.length - 1) {
            targetNoteEl = allNotes[currentIndex + 1];
        }
    } else if (direction === 'up') {
        if (currentIndex > 0) {
            targetNoteEl = allNotes[currentIndex - 1];
        }
    }

    if (targetNoteEl) {
        event.preventDefault();
        targetNoteEl.focus();
        
        if (window.getSelection && document.createRange) {
            const range = document.createRange();
            range.selectNodeContents(targetNoteEl);
            range.collapse(false); 
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
}


function handleKeydown(event) {
    // Handle Ctrl + Arrow Key Traversal
    if (event.key === 'ArrowUp' && (event.ctrlKey || event.metaKey)) {
        handleArrowNavigation(event, 'up');
        return;
    }
    if (event.key === 'ArrowDown' && (event.ctrlKey || event.metaKey)) {
        handleArrowNavigation(event, 'down');
        return;
    }

    // Escape key closes menu
    if (event.key === 'Escape') {
        const appMenu = document.getElementById('app-menu');
        if (appMenu) appMenu.style.display = 'none';
        return;
    }
    
    if (event.key !== 'Enter' && event.key !== 'Tab') return;
    
    event.preventDefault(); 
    
    const currentNoteEl = event.target.closest('.note');
    const noteId = currentNoteEl.dataset.id;
    let currentDepth = parseInt(currentNoteEl.dataset.depth);

    // 1. ENTER KEY
    if (event.key === 'Enter' && !event.shiftKey) {
        addNewSibling(noteId);
    } 
    
    // 2. TAB KEY
    else if (event.key === 'Tab') {
        if (event.shiftKey) {
            if (currentDepth >= 0) { 
                 decreaseNoteDepth(noteId);
            }
        } else {
            if (currentDepth < MAX_DEPTH) {
                increaseNoteDepth(noteId);
            }
        }
    }
}


// --- INITIALIZATION & Event Listeners ---

function setupCustomThemeListeners() {
    const themeSelector = document.getElementById('theme-selector');
    const builder = document.getElementById('custom-theme-builder');
    const saveBtn = document.getElementById('save-custom-theme-btn');
    const colorInputs = {
        '--main-bg': document.getElementById('color-bg'),
        '--main-text': document.getElementById('color-text'),
        '--branch-line': document.getElementById('color-line'),
    };

    if (!themeSelector) return;
    
    // Show/Hide Customizer on selection change
    themeSelector.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        const isCustom = newTheme === 'custom-theme';
        
        localStorage.setItem('appTheme', newTheme); 
        CURRENT_THEME = newTheme;
        applyTheme(newTheme);
        
        if (builder) builder.style.display = isCustom ? 'block' : 'none';
        
        if (isCustom) {
            for (const [prop, input] of Object.entries(colorInputs)) {
                if(input) input.value = CUSTOM_THEME_VARS[prop];
            }
        }
    });
    
    themeSelector.value = CURRENT_THEME;
    if (builder) builder.style.display = (CURRENT_THEME === 'custom-theme') ? 'block' : 'none';

    // Live color application during customization
    for (const [prop, input] of Object.entries(colorInputs)) {
        if(input) input.addEventListener('input', (e) => {
            document.documentElement.style.setProperty(prop, e.target.value);
            CUSTOM_THEME_VARS[prop] = e.target.value;
        });
    }

    // Save button logic
    if (saveBtn) saveBtn.addEventListener('click', () => {
        localStorage.setItem('customThemeVars', JSON.stringify(CUSTOM_THEME_VARS));
        alert("Custom theme saved! It will persist across sessions.");
    });
}


document.addEventListener('DOMContentLoaded', () => {
    loadNotes(); 
    
    // Menu Logic
    const menuBtn = document.getElementById('menu-btn');
    const appMenu = document.getElementById('app-menu');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    
    setupCustomThemeListeners(); 

    if (menuBtn && appMenu && closeMenuBtn) {
        menuBtn.addEventListener('click', () => {
            appMenu.style.display = 'block';
        });
        closeMenuBtn.addEventListener('click', () => {
            appMenu.style.display = 'none';
        });
    }

    // Data Transfer Listeners
    if (exportBtn) exportBtn.addEventListener('click', handleExport);
    // Note: The import button now accepts any file, but the handler checks for .wote
    if (importBtn && importFile) importBtn.addEventListener('click', () => importFile.click());
    if (importFile) importFile.addEventListener('change', handleImport);
});