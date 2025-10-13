// --- Configuration ---
const STORAGE_KEY = 'willowNotesData';
const MAX_DEPTH = 5; 

// --- Data & Persistence ---
let notesData = [];

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function loadNotes() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        notesData = JSON.parse(data);
    } else {
        notesData = []; 
    }
    
    // MINIMALIST FIX: Ensure a root note always exists
    if (notesData.length === 0) {
        notesData.push({
            id: generateId(),
            content: 'Start your Willow Notes here...', // Default initial text
            children: []
        });
        saveNotes();
    }

    renderAllNotes();
}

function saveNotes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesData));
}

// --- Data Manipulation Utilities (No changes needed here) ---

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
        saveNotes();
    }
}

// NOTE: addNewNote is simplified as it is now only used internally by addNewSibling
function addNewNote(parentId, content) {
    // This function is no longer needed for root nodes, but kept for future proofing
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

/**
 * ENTER key logic: Creates a new sibling note and focuses it.
 */
function addNewSibling(noteId) {
    const result = findNoteAndParent(notesData, noteId);
    if (!result) return;

    const { note, parentArray } = result;
    const index = parentArray.findIndex(n => n.id === noteId);

    if (index !== -1) {
        const newNote = { id: generateId(), content: '', children: [] };
        
        // Add the new note *after* the current note.
        parentArray.splice(index + 1, 0, newNote);
        saveNotes();
        renderAllNotes();
        
        setTimeout(() => {
            const newEl = document.querySelector(`[data-id="${newNote.id}"] .note-content`);
            if (newEl) newEl.focus();
        }, 0);
    }
}

/**
 * TAB key logic: Makes the current note a child of the PREVIOUS sibling.
 */
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

/**
 * SHIFT+TAB key logic: Makes the current note a sibling of its parent (moves up a level).
 */
function decreaseNoteDepth(noteId) {
    const noteResult = findNoteAndParent(notesData, noteId);
    if (!noteResult) return;
    
    const { note, parentArray } = noteResult;
    
    // FIXED: Prevent decreasing the depth of the initial/root note(s)
    if (parentArray === notesData && notesData.findIndex(n => n.id === noteId) !== -1) return;

    // Find the ID of the note's immediate parent
    let parentNoteId = null;
    let grandParentArray = notesData; 
    
    // Find the note object that contains parentArray (the parent note)
    const parentOfCurrentNote = notesData.find(rootNote => rootNote.children.includes(note)) || 
                               notesData.flatMap(root => root.children).find(child => child.children.includes(note));

    // Refined logic for finding the grandparent array
    let parentNote = findNoteById(notesData, parentArray[0].id);

    if (parentArray === notesData) return; // Already checked, but safer
    
    // Find the parent note's container (the grandparent array)
    const parentNoteInfo = findNoteAndParent(notesData, parentArray.find(n => n.id !== noteId).id); 
    
    let containerArray = notesData;
    if (parentNoteInfo) {
        containerArray = parentNoteInfo.parentArray;
        parentNoteId = parentNoteInfo.note.id;
    } else {
        // Must be a child of a root node (Depth 1)
        const rootParent = notesData.find(n => n.children === parentArray);
        if (!rootParent) return; // Should not happen
        parentNoteId = rootParent.id;
        containerArray = notesData;
    }
    
    const indexInParent = parentArray.findIndex(n => n.id === noteId);
    
    // 1. Remove the note from its current parent's array
    parentArray.splice(indexInParent, 1);
    
    // 2. Insert the note into the grandparent's array, immediately after its former parent
    const parentIndexInGrandparent = containerArray.findIndex(n => n.id === parentNoteId);
    containerArray.splice(parentIndexInGrandparent + 1, 0, note);

    saveNotes();
    renderAllNotes();
    
    setTimeout(() => {
        const newEl = document.querySelector(`[data-id="${noteId}"] .note-content`);
        if (newEl) newEl.focus();
    }, 0);
}

// --- RENDER FUNCTIONS (No changes needed here) ---

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

// --- KEYBOARD INTERACTION HANDLER (No change needed here) ---

function handleKeydown(event) {
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
            // SHIFT + TAB: Decrease Indentation
            if (currentDepth > 0) {
                 decreaseNoteDepth(noteId);
            }
        } else {
            // TAB: Increase Indentation
            if (currentDepth < MAX_DEPTH) {
                increaseNoteDepth(noteId);
            }
        }
    }
}


// --- INITIALIZATION (Simplified) ---

document.addEventListener('DOMContentLoaded', () => {
    // Only loads the notes (and ensures the root note exists)
    loadNotes(); 
    
    // Remove the previous rootBtn/mainInput listeners here as they are gone from HTML
});