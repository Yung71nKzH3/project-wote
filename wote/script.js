// The key to store data in the browser's local storage
const STORAGE_KEY = 'willowNotesData';

// Global array to hold all notes in the nested (tree) structure
let notesData = [];

// --- Helper: Load Data from Local Storage ---
function loadNotes() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        notesData = JSON.parse(data);
    } else {
        // Start with an empty array if no data is found
        notesData = []; 
    }
    renderAllNotes();
}

// --- Helper: Save Data to Local Storage ---
function saveNotes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesData));
}

// --- Helper: Generate Unique ID ---
// Essential for tracking which note is which, especially for replies
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Recursively creates the HTML elements for the notes.
 * @param {Array} notes - The array of note objects (could be root or children).
 * @param {HTMLElement} parentEl - The HTML element to append the notes to.
 */
function renderNoteTree(notes, parentEl) {
    if (!notes || notes.length === 0) return;

    // Create a container for the replies, which will apply the nesting CSS
    const repliesContainer = document.createElement('div');
    repliesContainer.className = 'replies';
    parentEl.appendChild(repliesContainer);

    notes.forEach(note => {
        // 1. Create the container for the single note
        const noteEl = document.createElement('div');
        noteEl.className = 'note';
        noteEl.dataset.id = note.id; // Store the ID for event handling

        // 2. Add the note content
        const contentEl = document.createElement('div');
        contentEl.className = 'note-content';
        contentEl.textContent = note.content;
        noteEl.appendChild(contentEl);

        // 3. Add the 'Reply' button
        const replyBtn = document.createElement('span');
        replyBtn.className = 'reply-button';
        replyBtn.textContent = 'Reply';
        // The event listener is attached dynamically
        replyBtn.addEventListener('click', () => showReplyForm(note.id, noteEl));
        noteEl.appendChild(replyBtn);

        // 4. Append the note element to the current replies container
        repliesContainer.appendChild(noteEl);

        // 5. Recursively render the children notes
        if (note.children && note.children.length > 0) {
            renderNoteTree(note.children, noteEl);
        }
    });
}

// --- Main Render Function ---
function renderAllNotes() {
    const container = document.getElementById('note-container');
    container.innerHTML = ''; // Clear existing content before re-rendering
    
    // The main container for all root notes doesn't use the 'replies' class
    // to avoid the border-left on the top level.
    notesData.forEach(rootNote => {
        const rootEl = document.createElement('div');
        rootEl.className = 'note';
        rootEl.dataset.id = rootNote.id;
        
        const contentEl = document.createElement('div');
        contentEl.className = 'note-content';
        contentEl.textContent = rootNote.content;
        rootEl.appendChild(contentEl);

        const replyBtn = document.createElement('span');
        replyBtn.className = 'reply-button';
        replyBtn.textContent = 'Reply';
        replyBtn.addEventListener('click', () => showReplyForm(rootNote.id, rootEl));
        rootEl.appendChild(replyBtn);

        container.appendChild(rootEl);
        
        // Render the children of the root note
        if (rootNote.children && rootNote.children.length > 0) {
            renderNoteTree(rootNote.children, rootEl);
        }
    });
}

// --- Function to add a new note (root or reply) ---
function addNewNote(parentId, content) {
    const newNote = {
        id: generateId(),
        content: content.trim(),
        children: []
    };

    if (!content.trim()) return; // Don't add empty notes

    if (parentId === 'root') {
        notesData.push(newNote);
    } else {
        // Find the parent note using a deep search function (you will implement this next)
        const parentNote = findNoteById(notesData, parentId);
        if (parentNote) {
            parentNote.children.push(newNote);
        }
    }

    saveNotes();
    renderAllNotes();
}

/**
 * Utility to recursively find a note object by its ID in the tree structure.
 * This is crucial for adding replies.
 */
function findNoteById(notesArray, id) {
    for (const note of notesArray) {
        if (note.id === id) {
            return note;
        }
        // Check children recursively
        if (note.children && note.children.length > 0) {
            const found = findNoteById(note.children, id);
            if (found) {
                return found;
            }
        }
    }
    return null;
}

// --- Function to display the reply form ---
function showReplyForm(parentId, targetEl) {
    // Check if a reply form already exists for this note
    if (targetEl.querySelector('.reply-form')) return;

    const formEl = document.createElement('div');
    formEl.className = 'reply-form';
    formEl.innerHTML = `
        <textarea placeholder="Write your reply..." rows="2"></textarea>
        <button class="save-button">Save Note</button>
        <button class="cancel-button">Cancel</button>
    `;
    
    // Insert the form right after the note content/button area
    targetEl.appendChild(formEl); 

    const textarea = formEl.querySelector('textarea');
    const saveBtn = formEl.querySelector('.save-button');
    const cancelBtn = formEl.querySelector('.cancel-button');

    saveBtn.addEventListener('click', () => {
        addNewNote(parentId, textarea.value);
        targetEl.removeChild(formEl); // Remove form after saving
    });
    
    cancelBtn.addEventListener('click', () => {
        targetEl.removeChild(formEl); // Remove form on cancel
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load any existing notes on page load
    loadNotes();

    // 2. Set up the event listener for adding a root note
    const rootBtn = document.getElementById('add-root-note-btn');
    const mainInput = document.getElementById('main-input');

    rootBtn.addEventListener('click', () => {
        addNewNote('root', mainInput.value);
        mainInput.value = ''; // Clear the input after adding
    });
});