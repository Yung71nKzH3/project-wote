// --- Configuration ---
let UNIQUE_NOTE_ID = 'default';
let STORAGE_KEY = 'willowNotesData-default';
const MAX_DEPTH = 5; 

// --- Data & Persistence ---
let notesData = [];

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function saveNotes() {
    // Saves data under the unique key
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesData));
}

function loadNotes() {
    // 1. Check URL for unique ID and set storage key
    handleURLAndStorage(); 
    
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        notesData = JSON.parse(data);
    } else {
        notesData = []; 
    }
    
    // Ensure a root note always exists
    if (notesData.length === 0) {
        notesData.push({
            id: generateId(),
            content: 'Start your Willow Notes here...',
            children: []
        });
        saveNotes();
    }

    renderAllNotes();
}

/**
 * Ensures each window has a unique ID in the URL for isolated localStorage.
 */
function handleURLAndStorage() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    
    if (!id) {
        // No ID found, generate one and reload/redirect
        id = generateId();
        params.set('id', id);
        // Use history.replaceState to change URL without a full page reload if supported, 
        // but a full redirect is safer for this logic:
        window.location.search = params.toString(); 
        return; 
    }
    
    UNIQUE_NOTE_ID = id;
    STORAGE_KEY = 'willowNotesData-' + id;
    document.getElementById('current-note-id').textContent = id;
    
    // Theme settings are stored separately in cache (sessionStorage)
    const theme = sessionStorage.getItem('theme') || 'willow';
    // This is where you would apply your 'theme' CSS class to the body element
    document.body.className = theme; 
}


// --- Import/Export Logic ---

/**
 * Converts the notesData tree into the tab-indented TXT string.
 */
function exportToTxt(notes) {
    let txtContent = '';

    function traverse(notesArray, depth) {
        const indent = '\t'.repeat(depth);
        notesArray.forEach(note => {
            txtContent += indent + note.content + '\n';
            if (note.children.length > 0) {
                traverse(note.children, depth + 1);
            }
        });
    }

    traverse(notes, 0);
    return txtContent.trim();
}

/**
 * Downloads the notes as a TXT file.
 */
function handleExport() {
    const content = exportToTxt(notesData);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element for download
    const a = document.createElement('a');
    a.href = url;
    a.download = `willow-notes-${UNIQUE_NOTE_ID}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Converts the tab-indented TXT string back into the notesData tree.
 * Uses a parent stack to manage nesting based on indentation.
 */
function importFromTxt(txt) {
    const lines = txt.split('\n').filter(line => line.trim() !== '');
    const newNotesData = [];
    
    // Stack of parent objects. Index 0 holds the array for current depth 0.
    const parentStack = [{ children: newNotesData, depth: -1 }]; 

    lines.forEach(line => {
        // Calculate depth based on tabs (\t)
        const depth = line.search(/[^\t]/);
        const content = line.trim();

        if (content === '') return; // Skip empty lines after trim

        const newNote = { id: generateId(), content: content, children: [] };

        // 1. Move up the stack until we find the correct parent depth
        while (parentStack.length > 1 && parentStack[parentStack.length - 1].depth >= depth) {
            parentStack.pop();
        }
        
        // 2. The new note's parent is the last element in the stack
        const parent = parentStack[parentStack.length - 1];
        parent.children.push(newNote);

        // 3. Push the new note onto the stack to potentially become a parent itself
        parentStack.push({ children: newNote.children, depth: depth });
    });
    
    // Overwrite current data and re-render
    notesData = newNotesData;
    saveNotes();
    renderAllNotes();
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        importFromTxt(e.target.result);
        alert("Notes imported successfully! Current notes replaced.");
    };
    reader.readAsText(file);
    // Clear the file input so the user can select the same file again if needed
    event.target.value = null; 
}


// --- Data Manipulation Utilities (Unchanged from previous successful version) ---

function findNoteAndParent(notesArray, id) {
    // ... (keep previous function)
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
        saveNotes();
    }
}

function addNewNote(parentId, content) {
    const newNote = { id: generateId(), content: content.trim(), children: [] };
    if (parentId === 'root') {
        notesData.push(newNote);
    } else {
        const parentNote = findNoteById(notesData, parentId);
        if (parentNote) parentNote.children.push(newNote);
    }
    saveNotes();
    renderAllNotes();
}

function addNewSibling(noteId) {
    const result = findNoteAndParent(notesData, noteId);
    if (!result) return;
    const { note, parentArray } = result;
    const index = parentArray.findIndex(n => n.id === noteId);

    if (index !== -1) {
        const newNote = { id: generateId(), content: '', children: [] };
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
    const noteResult = findNoteAndParent(notesData, noteId);
    if (!noteResult) return;
    const { note, parentArray } = noteResult;
    if (parentArray === notesData && notesData.findIndex(n => n.id === noteId) !== -1) return;

    let parentNoteId = null;
    let containerArray = notesData; 
    
    const parentNoteInfo = findNoteAndParent(notesData, parentArray.find(n => n.id !== noteId).id); 
    
    if (parentNoteInfo) {
        containerArray = parentNoteInfo.parentArray;
        parentNoteId = parentNoteInfo.note.id;
    } else {
        const rootParent = notesData.find(n => n.children === parentArray);
        if (!rootParent) return;
        parentNoteId = rootParent.id;
        containerArray = notesData;
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

// --- RENDER FUNCTIONS (Unchanged) ---
// ... (Keep renderNoteTree and renderAllNotes as they were) ...

function renderNoteTree(notes, parentEl, depth = 0) {
    if (!notes || notes.length === 0) return;
    const repliesContainer = document.createElement('div');
    repliesContainer.className = 'replies';
    parentEl.appendChild(repliesContainer);
    notes.forEach(note => {
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

// --- KEYBOARD INTERACTION HANDLER (Unchanged) ---
// ... (Keep handleKeydown as it was) ...

function handleKeydown(event) {
    if (event.key !== 'Enter' && event.key !== 'Tab') return;
    event.preventDefault(); 
    const currentNoteEl = event.target.closest('.note');
    const noteId = currentNoteEl.dataset.id;
    let currentDepth = parseInt(currentNoteEl.dataset.depth);

    if (event.key === 'Enter' && !event.shiftKey) {
        addNewSibling(noteId);
    } 
    else if (event.key === 'Tab') {
        if (event.shiftKey) {
            if (currentDepth > 0) {
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

document.addEventListener('DOMContentLoaded', () => {
    loadNotes(); 
    
    // Menu Logic
    const menuBtn = document.getElementById('menu-btn');
    const appMenu = document.getElementById('app-menu');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    // const themeSelector = document.getElementById('theme-selector'); // For future theme updates

    menuBtn.addEventListener('click', () => {
        appMenu.style.display = 'block';
    });
    closeMenuBtn.addEventListener('click', () => {
        appMenu.style.display = 'none';
    });

    // Data Transfer Listeners
    exportBtn.addEventListener('click', handleExport);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleImport);
    
    // // Theme Listener (Future implementation)
    // themeSelector.addEventListener('change', (e) => {
    //     const theme = e.target.value;
    //     sessionStorage.setItem('theme', theme);
    //     document.body.className = theme;
    // });
});