// static/js/preferences.js
// Frontend logic for the preference copy interface.

let appSettings = {
    gameFolder: "",
    dllFolder: "",
    accounts: [],
    autoCycle: false,
    prefsRoot: ""
};

const preferenceItemsDataElement = document.getElementById('preference-items-data');
const preferenceItems = preferenceItemsDataElement ? JSON.parse(preferenceItemsDataElement.textContent) : [];

// DOM references
const prefsRootInput = document.getElementById('prefsRoot');
const sourceCharacterSelect = document.getElementById('sourceCharacterSelect');
const preferenceItemsContainer = document.getElementById('preferenceItemsContainer');
const destinationAccountsContainer = document.getElementById('destinationAccountsContainer');
const selectAllTargetsBtn = document.getElementById('selectAllTargets');
const clearAllTargetsBtn = document.getElementById('clearAllTargets');
const copyPrefsBtn = document.getElementById('copyPrefsBtn');
const copyPrefsWithBackupBtn = document.getElementById('copyPrefsWithBackupBtn');
const prefsMessageBox = document.getElementById('prefsMessageBox');

function showMessage(message, type = 'info') {
    prefsMessageBox.textContent = message;
    prefsMessageBox.className = `mt-4 p-4 rounded-lg text-center message-${type}`;
    prefsMessageBox.classList.remove('hidden');
}

function hideMessage() {
    prefsMessageBox.classList.add('hidden');
}

function saveSettingsToLocalStorage() {
    localStorage.setItem('aoLauncherSettings', JSON.stringify(appSettings));
}

function loadSettingsFromLocalStorage() {
    const storedSettings = localStorage.getItem('aoLauncherSettings');
    if (!storedSettings) {
        return;
    }

    try {
        const parsedSettings = JSON.parse(storedSettings);
        appSettings.gameFolder = parsedSettings.gameFolder || "";
        appSettings.dllFolder = parsedSettings.dllFolder || "";
        appSettings.autoCycle = parsedSettings.autoCycle || false;
        appSettings.prefsRoot = parsedSettings.prefsRoot || "";
        if (Array.isArray(parsedSettings.accounts)) {
            parsedSettings.accounts.forEach(account => {
                if (Array.isArray(account.characters)) {
                    account.characters.forEach(character => {
                        if (typeof character.id === 'string') {
                            if (character.id.startsWith('Char')) {
                                const numericPart = character.id.replace(/^Char/, '');
                                const asNumber = Number.parseInt(numericPart, 10);
                                if (!Number.isNaN(asNumber)) {
                                    character.id = asNumber;
                                }
                            } else {
                                const asNumber = Number.parseInt(character.id, 10);
                                if (!Number.isNaN(asNumber)) {
                                    character.id = asNumber;
                                }
                            }
                        }
                    });
                }
            });
            appSettings.accounts = parsedSettings.accounts;
        } else {
            appSettings.accounts = [];
        }
    } catch (error) {
        console.error('Failed to parse stored settings:', error);
        appSettings.accounts = [];
        showMessage('Unable to read stored launcher settings. Configure accounts on the launcher page first.', 'error');
    }
}

function buildSourceOptions() {
    sourceCharacterSelect.innerHTML = '<option value="">Select a character…</option>';
    if (!appSettings.accounts.length) {
        sourceCharacterSelect.disabled = true;
        return;
    }
    sourceCharacterSelect.disabled = false;

    const sortedAccounts = [...appSettings.accounts].sort((a, b) => a.name.localeCompare(b.name));
    sortedAccounts.forEach(account => {
        if (!Array.isArray(account.characters) || !account.characters.length) {
            return;
        }
        const optgroup = document.createElement('optgroup');
        optgroup.label = account.name;

        const sortedChars = [...account.characters].sort((a, b) => {
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameA.localeCompare(nameB);
        });

        sortedChars.forEach(character => {
            const option = document.createElement('option');
            const charId = character.id != null ? String(character.id) : '';
            option.value = `${account.name}::${charId}`;
            option.dataset.accountName = account.name;
            option.dataset.characterId = charId;
            option.textContent = `${character.name || 'Unnamed'} (ID: ${charId || 'unknown'})`;
            optgroup.appendChild(option);
        });

        sourceCharacterSelect.appendChild(optgroup);
    });
}

function renderPreferenceItems() {
    preferenceItemsContainer.innerHTML = '';
    preferenceItems.forEach(item => {
        const wrapper = document.createElement('label');
        wrapper.className = 'flex items-start space-x-3 bg-gray-900/40 rounded-lg p-3 hover:bg-gray-900/60 transition cursor-pointer';
        wrapper.title = item.description;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'preferenceItem';
        checkbox.value = item.id;
        checkbox.className = 'mt-1 accent-[#4dd0d0]';
        checkbox.checked = Boolean(item.recommended);

        const textContainer = document.createElement('div');
        const titleSpan = document.createElement('span');
        titleSpan.className = 'text-sm font-semibold text-blue-100';
        titleSpan.textContent = item.label;

        const badge = document.createElement('span');
        badge.className = `ml-2 inline-block px-2 py-0.5 rounded-full text-[0.65rem] ${item.recommended ? 'bg-emerald-700 text-emerald-200' : 'bg-slate-700 text-slate-200'}`;
        badge.textContent = item.recommended ? 'Recommended' : 'Optional';

        const description = document.createElement('p');
        description.className = 'text-xs text-gray-400 mt-1';
        description.textContent = item.description;

        const titleWrapper = document.createElement('div');
        titleWrapper.className = 'flex items-center flex-wrap';
        titleWrapper.appendChild(titleSpan);
        titleWrapper.appendChild(badge);

        textContainer.appendChild(titleWrapper);
        textContainer.appendChild(description);

        wrapper.appendChild(checkbox);
        wrapper.appendChild(textContainer);

        preferenceItemsContainer.appendChild(wrapper);
    });
}

function renderDestinationCharacters() {
    destinationAccountsContainer.innerHTML = '';

    if (!appSettings.accounts.length) {
        const emptyState = document.createElement('p');
        emptyState.className = 'text-sm text-gray-400 col-span-full';
        emptyState.textContent = 'No characters available. Configure accounts on the launcher page first.';
        destinationAccountsContainer.appendChild(emptyState);
        selectAllTargetsBtn.disabled = true;
        clearAllTargetsBtn.disabled = true;
        copyPrefsBtn.disabled = true;
        copyPrefsWithBackupBtn.disabled = true;
        return;
    }

    selectAllTargetsBtn.disabled = false;
    clearAllTargetsBtn.disabled = false;
    copyPrefsBtn.disabled = false;
    copyPrefsWithBackupBtn.disabled = false;

    const sortedAccounts = [...appSettings.accounts].sort((a, b) => a.name.localeCompare(b.name));
    sortedAccounts.forEach(account => {
        const card = document.createElement('div');
        card.className = 'bg-gray-900/40 rounded-lg p-3';
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between mb-2';

        const title = document.createElement('h3');
        title.className = 'text-sm font-semibold text-blue-200';
        title.textContent = account.name;

        const headerButtons = document.createElement('div');
        headerButtons.className = 'flex gap-2';

        const selectAccountBtn = document.createElement('button');
        selectAccountBtn.type = 'button';
        selectAccountBtn.className = 'text-[0.65rem] uppercase bg-blue-700 hover:bg-blue-800 text-white px-2 py-1 rounded-md account-select-all';
        selectAccountBtn.dataset.accountName = account.name;
        selectAccountBtn.textContent = 'All';

        const clearAccountBtn = document.createElement('button');
        clearAccountBtn.type = 'button';
        clearAccountBtn.className = 'text-[0.65rem] uppercase bg-gray-700 hover:bg-gray-800 text-white px-2 py-1 rounded-md account-select-none';
        clearAccountBtn.dataset.accountName = account.name;
        clearAccountBtn.textContent = 'None';

        headerButtons.appendChild(selectAccountBtn);
        headerButtons.appendChild(clearAccountBtn);

        header.appendChild(title);
        header.appendChild(headerButtons);
        card.appendChild(header);

        const list = document.createElement('div');
        list.className = 'space-y-2';

        const sortedCharacters = Array.isArray(account.characters)
            ? [...account.characters].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            : [];

        if (!sortedCharacters.length) {
            const noChars = document.createElement('p');
            noChars.className = 'text-xs text-gray-500';
            noChars.textContent = 'No characters stored for this account.';
            list.appendChild(noChars);
        } else {
            sortedCharacters.forEach(character => {
                const wrapper = document.createElement('div');
                wrapper.className = 'flex items-center gap-3 bg-gray-950/40 rounded-md p-2 character-target';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'target-character-checkbox accent-[#4dd0d0]';
                const charId = character.id != null ? String(character.id) : '';
                checkbox.dataset.accountName = account.name;
                checkbox.dataset.characterId = charId;

                const info = document.createElement('div');
                info.className = 'flex flex-col';

                const nameLine = document.createElement('span');
                nameLine.className = 'text-sm text-gray-100';
                nameLine.textContent = character.name || 'Unnamed character';

                const idLine = document.createElement('span');
                idLine.className = 'text-[0.65rem] text-gray-400';
                idLine.textContent = `ID: ${charId || 'unknown'}`;

                info.appendChild(nameLine);
                info.appendChild(idLine);

                wrapper.appendChild(checkbox);
                wrapper.appendChild(info);

                list.appendChild(wrapper);
            });
        }

        card.appendChild(list);
        destinationAccountsContainer.appendChild(card);
    });
}

function getSelectedSource() {
    const value = sourceCharacterSelect.value;
    if (!value) {
        return null;
    }
    const [accountName, charId] = value.split('::');
    return {
        accountName,
        characterId: charId
    };
}

function updateDestinationAvailability() {
    const source = getSelectedSource();
    const checkboxes = destinationAccountsContainer.querySelectorAll('.target-character-checkbox');
    checkboxes.forEach(checkbox => {
        const wrapper = checkbox.closest('.character-target');
        const isSource = source && checkbox.dataset.accountName === source.accountName && checkbox.dataset.characterId === source.characterId;
        if (isSource) {
            checkbox.checked = false;
            checkbox.disabled = true;
            if (wrapper) {
                wrapper.classList.add('opacity-40');
            }
        } else {
            checkbox.disabled = false;
            if (wrapper) {
                wrapper.classList.remove('opacity-40');
            }
        }
    });
}

function getSelectedPreferenceItems() {
    const checked = preferenceItemsContainer.querySelectorAll('input[name="preferenceItem"]:checked');
    return Array.from(checked).map(input => input.value);
}

function getSelectedTargets() {
    const checked = destinationAccountsContainer.querySelectorAll('.target-character-checkbox:checked');
    return Array.from(checked).map(input => ({
        accountName: input.dataset.accountName,
        characterId: input.dataset.characterId
    }));
}

function handleAccountToggle(event) {
    const accountName = event.target.dataset.accountName;
    if (!accountName) {
        return;
    }

    const checkboxes = destinationAccountsContainer.querySelectorAll(`.target-character-checkbox[data-account-name="${accountName}"]`);
    const shouldSelect = event.target.classList.contains('account-select-all');
    checkboxes.forEach(checkbox => {
        if (!checkbox.disabled) {
            checkbox.checked = shouldSelect;
        }
    });
}

function handleBulkToggle(event, select) {
    event.preventDefault();
    const checkboxes = destinationAccountsContainer.querySelectorAll('.target-character-checkbox');
    checkboxes.forEach(checkbox => {
        if (!checkbox.disabled) {
            checkbox.checked = select;
        }
    });
}

async function handleCopyRequest(withBackup) {
    hideMessage();

    const prefsRoot = prefsRootInput.value.trim();
    if (!prefsRoot) {
        showMessage('Please provide the preferences root folder path.', 'warning');
        return;
    }

    const source = getSelectedSource();
    if (!source || !source.accountName || !source.characterId) {
        showMessage('Select a source character to copy from.', 'warning');
        return;
    }

    const selectedItems = getSelectedPreferenceItems();
    if (!selectedItems.length) {
        showMessage('Select at least one preference item to copy.', 'warning');
        return;
    }

    const targets = getSelectedTargets();
    if (!targets.length) {
        showMessage('Select at least one destination character.', 'warning');
        return;
    }

    const payload = {
        prefsRoot,
        sourceAccount: source.accountName,
        sourceCharacterId: source.characterId,
        selectedItems,
        targets,
        backup: withBackup
    };

    copyPrefsBtn.disabled = true;
    copyPrefsWithBackupBtn.disabled = true;
    copyPrefsBtn.textContent = 'Copying…';
    copyPrefsWithBackupBtn.textContent = withBackup ? 'Copying…' : 'Copy with Backup';

    try {
        const response = await fetch('/copy_preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const successfulTargets = Array.isArray(result.results)
            ? result.results.filter(entry => Array.isArray(entry.copied) && entry.copied.length).length
            : 0;

        if (response.status === 200) {
            showMessage(`${result.message} Copied to ${successfulTargets} character(s).`, 'success');
        } else if (response.status === 207) {
            showMessage(`${result.message} Check console for detailed results.`, 'warning');
        } else {
            showMessage(result.message || 'Failed to copy preferences.', 'error');
        }

        console.group('Preference copy results');
        console.log('Payload', payload);
        console.table(result.results || []);
        console.groupEnd();
    } catch (error) {
        console.error('Failed to copy preferences:', error);
        showMessage(`Failed to copy preferences: ${error.message}`, 'error');
    } finally {
        copyPrefsBtn.disabled = false;
        copyPrefsWithBackupBtn.disabled = false;
        copyPrefsBtn.textContent = 'Copy Preferences';
        copyPrefsWithBackupBtn.textContent = 'Copy with Backup';
    }
}

function initEventListeners() {
    prefsRootInput.addEventListener('change', () => {
        appSettings.prefsRoot = prefsRootInput.value.trim();
        saveSettingsToLocalStorage();
    });
    prefsRootInput.addEventListener('blur', () => {
        appSettings.prefsRoot = prefsRootInput.value.trim();
        saveSettingsToLocalStorage();
    });

    sourceCharacterSelect.addEventListener('change', updateDestinationAvailability);

    destinationAccountsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('account-select-all') || event.target.classList.contains('account-select-none')) {
            event.preventDefault();
            handleAccountToggle(event);
        }
    });

    selectAllTargetsBtn.addEventListener('click', (event) => handleBulkToggle(event, true));
    clearAllTargetsBtn.addEventListener('click', (event) => handleBulkToggle(event, false));

    copyPrefsBtn.addEventListener('click', (event) => {
        event.preventDefault();
        handleCopyRequest(false);
    });

    copyPrefsWithBackupBtn.addEventListener('click', (event) => {
        event.preventDefault();
        handleCopyRequest(true);
    });
}

function initialise() {
    loadSettingsFromLocalStorage();
    prefsRootInput.value = appSettings.prefsRoot || '';
    buildSourceOptions();
    renderPreferenceItems();
    renderDestinationCharacters();
    updateDestinationAvailability();
    initEventListeners();

    if (!appSettings.accounts.length) {
        showMessage('No accounts configured. Visit the launcher page to add characters before using this tool.', 'info');
    }
}

document.addEventListener('DOMContentLoaded', initialise);
