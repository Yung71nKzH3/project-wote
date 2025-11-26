// --- Configuration & Globals ---
let UNIQUE_NOTE_ID = 'default';
let STORAGE_KEY = 'willowNotesData-default';
const MAX_DEPTH = 15; 
let CURRENT_THEME = localStorage.getItem('appTheme') || 'willow-theme';

const CUSTOM_THEME_VARS = {
    '--main-bg': '#f0fff0',
    '--main-text': '#4B5320',
    '--branch-line': '#A4C639',
    '--note-bg': '#ffffff', 
    '--input-focus': '#ddf'
};

const HELP_DATA = [
    {
        id: 'h1', type: 'markdown', content: '# Welcome to Wote!', children: [
            { id: 'h2', type: 'text', content: 'Checkboxes are now aligned correctly!', children: [] },
            { id: 'h3', type: 'todo', checked: false, content: 'Like this one right here.', children: [] },
            { id: 'h4', type: 'image', content: 'This is the Title of the image', imageUrl: 'https://via.placeholder.com/600x400', children: [], collapsed: false },
            { id: 'h5', type: 'image', content: 'Collapsed Image (Click arrow to expand)', imageUrl: 'https://via.placeholder.com/150', children: [], collapsed: true }
        ]
    }
];

// --- Data & Persistence ---
let notesData = []; 

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function saveNotes() {
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

    if (UNIQUE_NOTE_ID === 'help') {
        const savedHelp = localStorage.getItem(STORAGE_KEY);
        if (savedHelp) {
            notesData = JSON.parse(savedHelp);
        } else {
            notesData = JSON.parse(JSON.stringify(HELP_DATA)); 
            notesData.metadata = { file_id: 'help', created_at: new Date().toISOString() };
            saveNotes(); 
        }
        renderAllNotes();
        return;
    }

    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        notesData = JSON.parse(data);
    } else {
        notesData = []; 
    }
    
    if (!notesData.metadata) {
        notesData.metadata = {
            file_id: UNIQUE_NOTE_ID,
            created_at: new Date().toISOString(),
            last_modified: new Date().toISOString()
        };
    }
    
    if (notesData.length === 0) {
        notesData.push({
            id: generateId(),
            type: 'text',
            content: '', 
            children: [],
            collapsed: false
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
    if (idEl) idEl.textContent = (id === 'help') ? 'Help Manual' : id;
}

// --- Export/Import ---
function handleExport() {
    let fileNameContent = notesData[0] ? notesData[0].content : 'willow-notes';
    let safeFileName = fileNameContent.replace(/[\\/:*?"<>|]/g, '-').trim() || 'willow-notes';
    const content = JSON.stringify(notesData); 
    const blob = new Blob([content], { type: 'application/json' }); 
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileName}.wote`; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.wote') && !file.name.endsWith('.json')) {
        alert("Please select a file with the .wote or .json extension.");
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (Array.isArray(importedData) || importedData.metadata) {
                notesData = importedData;
                saveNotes();
                renderAllNotes();
            } else {
                alert("Invalid Wote file.");
            }
        } catch (err) {
            alert("Corrupted file.");
        }
    };
    reader.readAsText(file);
    event.target.value = null; 
}

// --- Data Utilities ---
function findNoteAndParent(notesArray, id) {
    for (const note of notesArray) {
        if (note.id === id) return { note, parentArray: notesArray };
        if (note.children && note.children.length > 0) {
            const result = findNoteAndParent(note.children, id);
            if (result) return result;
        }
    }
    return null;
}

function findNoteById(notesArray, id) {
    const result = findNoteAndParent(notesArray, id);
    return result ? result.note : null;
}

function updateNoteData(id, updates) {
    const noteObj = findNoteById(notesData, id);
    if (noteObj) {
        Object.assign(noteObj, updates);
        saveNotes();
    }
}

// --- Navigation & Structure Logic ---
function addNewSibling(noteId) {
    const result = findNoteAndParent(notesData, noteId);
    if (!result) return;
    const { note, parentArray } = result;
    const index = parentArray.findIndex(n => n.id === noteId);

    if (index !== -1) {
        const newNote = { 
            id: generateId(), 
            type: note.type || 'text', 
            content: '', 
            children: [],
            collapsed: false
        };
        // Reset image type to text for new lines to avoid confusion
        if (newNote.type === 'image') newNote.type = 'text';

        parentArray.splice(index + 1, 0, newNote);
        saveNotes(); 
        renderAllNotes();
        setTimeout(() => focusNote(newNote.id), 0);
    }
}

function increaseNoteDepth(noteId) {
    const result = findNoteAndParent(notesData, noteId);
    if (!result) return;
    const { note, parentArray } = result;
    const index = parentArray.findIndex(n => n.id === noteId);

    if (index > 0) {
        const previousSibling = parentArray[index - 1];
        previousSibling.collapsed = false; 
        parentArray.splice(index, 1);
        previousSibling.children.push(note);
        saveNotes();
        renderAllNotes();
        setTimeout(() => focusNote(noteId), 0);
    }
}

function decreaseNoteDepth(noteId) {
    const result = findNoteAndParent(notesData, noteId);
    if (!result) return;
    const { note, parentArray } = result;
    
    if (parentArray === notesData) {
        deleteNote(noteId); 
        return;
    } 
    
    let parentNoteId = null;
    let grandParentArray = notesData;
    const parentNote = findParentNoteOfArray(notesData, parentArray);
    
    if (parentNote) {
        const grandParentResult = findNoteAndParent(notesData, parentNote.id);
        if(grandParentResult) grandParentArray = grandParentResult.parentArray;
        
        const indexInParent = parentArray.findIndex(n => n.id === noteId);
        parentArray.splice(indexInParent, 1);
        const parentIndex = grandParentArray.findIndex(n => n.id === parentNote.id);
        grandParentArray.splice(parentIndex + 1, 0, note);
        saveNotes();
        renderAllNotes();
        setTimeout(() => focusNote(noteId), 0);
    }
}

function findParentNoteOfArray(currentArray, targetChildArray) {
    for (const note of currentArray) {
        if (note.children === targetChildArray) return note;
        if (note.children.length > 0) {
            const found = findParentNoteOfArray(note.children, targetChildArray);
            if (found) return found;
        }
    }
    return null;
}

function deleteNote(noteId) {
    const result = findNoteAndParent(notesData, noteId);
    if (!result) return;
    const { note, parentArray } = result;
    const index = parentArray.findIndex(n => n.id === noteId);

    if (parentArray === notesData && index === 0 && parentArray.length === 1) {
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
        const prev = parentArray[index-1] || parentArray[index];
        if (prev) focusNote(prev.id);
        else document.getElementById('note-container').focus();
    }, 0);
}

// --- RENDER LOGIC ---

function focusNote(id) {
    const el = document.querySelector(`[data-id="${id}"] .note-content`);
    if (el) {
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

function getTypeBadge(type) {
    switch (type) {
        case 'markdown': return 'MD';
        case 'todo': return '✓';
        case 'image': return 'IMG';
        default: return ''; 
    }
}

// Helper to validate URL roughly
function isUrl(string) {
    try { return Boolean(new URL(string)); } catch(e){ return false; }
}

function renderNoteContent(note, wrapper) {
    wrapper.innerHTML = '';
    
    // 1. Checkbox (Left side of Flex)
    if (note.type === 'todo') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'note-checkbox';
        checkbox.checked = note.checked || false;
        checkbox.addEventListener('change', (e) => {
            updateNoteData(note.id, { checked: e.target.checked });
            if (e.target.checked) wrapper.classList.add('note-done');
            else wrapper.classList.remove('note-done');
        });
        wrapper.appendChild(checkbox);
        if (note.checked) wrapper.classList.add('note-done');
    }

    // 2. Main Column (Text + Image + URL Input)
    const mainCol = document.createElement('div');
    mainCol.className = 'note-main-column';
    
    // CONTENT BOX (Editable Title/Text)
    const contentBox = document.createElement('div');
    contentBox.className = 'note-content';
    contentBox.setAttribute('contenteditable', 'true'); 
    
    // MARKDOWN LOGIC
    if (note.type === 'markdown') {
        if (note.isEditing) {
            contentBox.textContent = note.content;
            contentBox.focus();
        } else {
            contentBox.setAttribute('contenteditable', 'false');
            contentBox.className += ' markdown-view';
            const raw = note.content || '...';
            contentBox.innerHTML = window.DOMPurify ? DOMPurify.sanitize(marked.parse(raw)) : marked.parse(raw);
            contentBox.addEventListener('click', () => {
                note.isEditing = true;
                renderAllNotes();
                setTimeout(() => focusNote(note.id), 0);
            });
        }
        mainCol.appendChild(contentBox);
    } 
    // IMAGE LOGIC
    else if (note.type === 'image') {
        // Data Migration: If content is a URL and imageUrl is empty, move it
        if (!note.imageUrl && isUrl(note.content)) {
            note.imageUrl = note.content;
            note.content = 'Image';
            saveNotes(); // Persist migration
        }

        // Render Title (Content)
        contentBox.textContent = note.content; 
        mainCol.appendChild(contentBox);

        // Only show Image/Input if not collapsed (Image-specific collapse)
        if (!note.collapsed) {
            // URL Input
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.className = 'url-input';
            urlInput.placeholder = 'Paste Image URL here...';
            urlInput.value = note.imageUrl || '';
            urlInput.addEventListener('change', (e) => {
                updateNoteData(note.id, { imageUrl: e.target.value });
                renderAllNotes(); // Re-render to show image
            });
            mainCol.appendChild(urlInput);

            // Image Preview
            if (note.imageUrl) {
                const img = document.createElement('img');
                img.src = note.imageUrl;
                img.className = 'note-image-preview';
                img.onerror = () => { img.style.display = 'none'; };
                mainCol.appendChild(img);
            }
        }
    } 
    // TEXT/TODO LOGIC
    else {
        contentBox.textContent = note.content;
        mainCol.appendChild(contentBox);
    }

    // Event Listeners for Typing (Title/Content)
    if (contentBox.getAttribute('contenteditable') === 'true') {
        contentBox.addEventListener('keydown', handleKeydown);
        contentBox.addEventListener('input', (e) => {
            updateNoteData(note.id, { content: e.target.innerText });
        });
        if (note.type === 'markdown') {
            contentBox.addEventListener('blur', () => {
                note.isEditing = false;
                renderAllNotes();
            });
        }
    }

    wrapper.appendChild(mainCol);
}

function renderNoteTree(notes, parentEl, depth = 0) {
    if (!notes || notes.length === 0) return;
    const repliesContainer = document.createElement('div');
    repliesContainer.className = 'replies';
    parentEl.appendChild(repliesContainer);

    notes.forEach(note => {
        if (note === notesData.metadata) return;

        const noteEl = document.createElement('div');
        noteEl.className = 'note';
        noteEl.dataset.id = note.id;
        noteEl.dataset.depth = depth;

        // Row Container
        const noteRow = document.createElement('div');
        noteRow.className = 'note-row';

        const wrapper = document.createElement('div');
        wrapper.className = 'note-content-wrapper';
        wrapper.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const types = ['text', 'markdown', 'todo', 'image'];
            const nextType = types[(types.indexOf(note.type || 'text') + 1) % types.length];
            updateNoteData(note.id, { type: nextType });
            renderAllNotes();
        });

        renderNoteContent(note, wrapper);
        noteRow.appendChild(wrapper);

        // Right-Side Controls
        const controls = document.createElement('div');
        controls.className = 'node-controls';

        // Badge
        const badgeTxt = getTypeBadge(note.type);
        if (badgeTxt) {
            const badge = document.createElement('span');
            badge.className = 'type-badge';
            badge.textContent = badgeTxt;
            badge.title = `Type: ${note.type} (Right-click note to change)`;
            controls.appendChild(badge);
        }

        // Toggle (Collapse) - SHOW FOR CHILDREN OR IMAGES
        if ((note.children && note.children.length > 0) || note.type === 'image') {
            const toggle = document.createElement('button');
            toggle.className = 'toggle-btn';
            toggle.innerHTML = note.collapsed ? '&#9664;' : '&#9660;'; 
            toggle.title = note.collapsed ? "Expand" : "Collapse";
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                updateNoteData(note.id, { collapsed: !note.collapsed });
                renderAllNotes();
            });
            controls.appendChild(toggle);
        }

        noteRow.appendChild(controls);
        noteEl.appendChild(noteRow);
        repliesContainer.appendChild(noteEl);

        // Render Children (Hidden if collapsed)
        if (note.children && note.children.length > 0 && !note.collapsed) {
            renderNoteTree(note.children, noteEl, depth + 1);
        }
    });
}

function renderAllNotes() {
    const container = document.getElementById('note-container');
    container.innerHTML = ''; 
    notesData.forEach(rootNote => {
        if (rootNote === notesData.metadata) return; 

        const rootEl = document.createElement('div');
        rootEl.className = 'note root-note'; 
        rootEl.dataset.id = rootNote.id;
        rootEl.dataset.depth = 0;

        const noteRow = document.createElement('div');
        noteRow.className = 'note-row';

        const wrapper = document.createElement('div');
        wrapper.className = 'note-content-wrapper';
        wrapper.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const types = ['text', 'markdown', 'todo', 'image'];
            const nextType = types[(types.indexOf(rootNote.type || 'text') + 1) % types.length];
            updateNoteData(rootNote.id, { type: nextType });
            renderAllNotes();
        });

        renderNoteContent(rootNote, wrapper);
        noteRow.appendChild(wrapper);

        // Controls
        const controls = document.createElement('div');
        controls.className = 'node-controls';
        
        const badgeTxt = getTypeBadge(rootNote.type);
        if (badgeTxt) {
            const badge = document.createElement('span');
            badge.className = 'type-badge';
            badge.textContent = badgeTxt;
            controls.appendChild(badge);
        }

        if ((rootNote.children && rootNote.children.length > 0) || rootNote.type === 'image') {
            const toggle = document.createElement('button');
            toggle.className = 'toggle-btn';
            toggle.innerHTML = rootNote.collapsed ? '&#9664;' : '&#9660;';
            toggle.addEventListener('click', (e) => {
                updateNoteData(rootNote.id, { collapsed: !rootNote.collapsed });
                renderAllNotes();
            });
            controls.appendChild(toggle);
        }

        noteRow.appendChild(controls);
        rootEl.appendChild(noteRow);
        
        container.appendChild(rootEl);
        if (rootNote.children && rootNote.children.length > 0 && !rootNote.collapsed) {
            renderNoteTree(rootNote.children, rootEl, 1);
        }
    });
}

// --- Key Handler ---
function handleArrowNavigation(event, direction) {
    const allNotes = Array.from(document.querySelectorAll('.note-content'));
    const currentIndex = allNotes.findIndex(el => el === event.target);
    if (currentIndex === -1) return;
    let target;
    if (direction === 'down' && currentIndex < allNotes.length - 1) target = allNotes[currentIndex + 1];
    if (direction === 'up' && currentIndex > 0) target = allNotes[currentIndex - 1];
    if (target) {
        event.preventDefault();
        target.focus();
    }
}

function handleKeydown(event) {
    if (event.key === 'ArrowUp' && (event.ctrlKey || event.metaKey)) {
        handleArrowNavigation(event, 'up'); return;
    }
    if (event.key === 'ArrowDown' && (event.ctrlKey || event.metaKey)) {
        handleArrowNavigation(event, 'down'); return;
    }
    if (event.key === 'Enter' && event.shiftKey) return; 
    if (event.key !== 'Enter' && event.key !== 'Tab') return;
    event.preventDefault();
    const currentNoteEl = event.target.closest('.note');
    const noteId = currentNoteEl.dataset.id;
    const currentDepth = parseInt(currentNoteEl.dataset.depth);

    if (event.key === 'Enter') {
        addNewSibling(noteId);
    } else if (event.key === 'Tab') {
        if (event.shiftKey) {
            if (currentDepth >= 0) decreaseNoteDepth(noteId);
        } else {
            if (currentDepth < MAX_DEPTH) increaseNoteDepth(noteId);
        }
    }
}

// --- Init ---
function setupCustomThemeListeners() {
    const themeSelector = document.getElementById('theme-selector');
    const builder = document.getElementById('custom-theme-builder');
    const saveBtn = document.getElementById('save-custom-theme-btn');
    const colorInputs = {
        '--main-bg': document.getElementById('color-bg'),
        '--main-text': document.getElementById('color-text'),
        '--branch-line': document.getElementById('color-line'),
        '--note-bg': document.getElementById('color-note-bg'),
    };

    if (!themeSelector) return;
    
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

    for (const [prop, input] of Object.entries(colorInputs)) {
        if(input) input.addEventListener('input', (e) => {
            document.documentElement.style.setProperty(prop, e.target.value);
            CUSTOM_THEME_VARS[prop] = e.target.value;
        });
    }

    if (saveBtn) saveBtn.addEventListener('click', () => {
        localStorage.setItem('customThemeVars', JSON.stringify(CUSTOM_THEME_VARS));
        alert("Theme saved.");
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadNotes(); 
    const menuBtn = document.getElementById('menu-btn');
    const appMenu = document.getElementById('app-menu');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    setupCustomThemeListeners(); 

    if (menuBtn) menuBtn.addEventListener('click', () => appMenu.style.display = 'block');
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', () => appMenu.style.display = 'none');
    if (exportBtn) exportBtn.addEventListener('click', handleExport);
    if (importBtn) importBtn.addEventListener('click', () => importFile.click());
    if (importFile) importFile.addEventListener('change', handleImport);
});