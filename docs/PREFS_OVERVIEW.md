# Anarchy Online — Clean Character Prefs: file & folder overview

This document lists every file and folder relevant to copy GUI preferences across player characters, explains what each item is for, and gives a concise recommendation about whether to copy it when creating or restoring a character-specific preference set from a full character preferences folder.

How to read this file:
- Each entry shows the filename or folder, a short purpose/contents note, and a clear "Copy?" recommendation (Copy / Optional / Skip) with a short rationale.

---

## Root files

- `Char.cfg`
  - Purpose: Character-specific configuration (metadata and per-character settings such as name, last-known server/character state). Often used by the client to identify the character.
  - Copy?: Copy — This is a core character file; include it when restoring or moving a character's preferences.

- `Prefs.xml`
  - Purpose: Stores generic interface preferences and many window configurations for GUI components (nanos, raids, wear window, friends list, general window positions, columns and sorting orders). It typically contains layout, window positions, column/sort info and other UI behaviour so copying it preserves the overall UI layout.
  - Copy?: Copy — Important for preserving UI choices and many gameplay/UI toggles. Note: it can include machine-specific settings (audio device, resolution) or cached info; consider reviewing or merging if you only want layout nodes.

- `DisabledTipsMap.xml`
  - Purpose: Tracks which in-game tips/tutorial popups the user has dismissed. Each tip's identifier is recorded so it does not show again.
  - Copy?: Optional — Copy if you want to preserve dismissed tips; safe to skip if not important.

- `IconPositions.bin`
  - Purpose: Binary file holding positions/layout of HUD/hotbar icons and similar UI icon placements.
  - Copy?: Optional — Copy to keep custom icon/hotbar placement. Binary; copy as-is.

- `IgnoreList.bin`
  - Purpose: Binary list of ignored players (social settings).
  - Copy?: Optional — Copy if you want to preserve ignore list. Consider privacy/security if moving between machines.

- `References.bin`
  - Purpose: Binary references store internal pointers used by the client. Exact structure depends on client version.
  - Copy?: Optional — Usually safe to copy when moving a character's prefs, but not strictly required for UI layout alone.

- `TextMacro.bin`
  - Purpose: Binary storage of chat text macros / quick-chat phrases.
  - Copy?: Optional — Copy to keep custom macros.

---

## `Chat/`
Folder purpose: stores chat window and related chat UI configurations.

- `Chat/Windows/Window1/Config.xml` (and Window2/Window3 etc)
  - Purpose: Defines settings for each chat window: placement, dimensions, backgrounds, default channels, text filters and colors. Changing these files alters what messages are shown and how chat windows look.
  - Copy?: Copy — Copy the entire `Chat/` tree to preserve chat window arrangements, channels, filters and colors.

Notes: Copy the entire `Chat/Windows/` tree if you want to fully restore chat window positions/tabs. These are small XML files and safely portable. Do NOT copy chat logs or input history files (e.g. `log.txt`, `inputhistory.xml`) — those are per-character/session.

---

## `Containers/`
Folder purpose: inventory / bank UI layouts and container-specific display settings.

- `Containers/Bank.xml`
  - Purpose: Maintains layout and order of backpacks inside the bank window (how bank slots/backpacks are arranged). It restores the bank's visual arrangement, though it does not contain custom backpack names.
  - Copy?: Copy — Required to restore bank window layout.

- `Containers/Inventory.xml`
  - Purpose: Controls placement and organization of items in the main inventory window: visible sections, sort order and positions.
  - Copy?: Copy — Required to restore inventory layout.

- `Containers/ShortcutBar*.xml`
  - Purpose: Hotbar/shortcut bar positions and contents.
  - Copy?: Optional / Caution — Copy to place hotbars in the same positions. Do not blindly copy hotbar contents between characters of very different professions: nanos/actions bound on source may not exist on target and can produce missing/incorrect shortcuts. Back up target files first and rebind or adapt hotbar contents after copying.

---

## `DockAreas/`
Folder purpose: Docking areas and docked window layouts (where HUD elements and small windows anchor).

Files present:
- `DockArea0.xml` through `DockArea21.xml` (multiple files)
  - Purpose: Each `DockAreaN.xml` defines one dock area's contents and layout (what's docked there, positions, ordering). The numbering corresponds to the client's internal dock slots.
  - Copy?: Copy — These collectively reconstruct where toolbars and windows are attached to the docks. Copy all `DockArea*.xml` for a faithful UI restore.

- `PlanetMapViewConfig.xml`
  - Purpose: Configuration for the planet map view (map UI state, window position, zoom state).
  - Copy?: Copy if you want to preserve map view state; otherwise optional.

- `RollupArea.xml`
  - Purpose: Settings for the roll-up UI area (which modules are expanded/collapsed and their order).
  - Copy?: Copy — Restores rollup behaviour and layout.

Notes: Dock areas and rollup config are key to restoring window placement. Copying the entire `DockAreas/` folder is recommended if the goal is to restore UI layout.

---

## Prefs folder location (Windows)

Where the client stores per-account and per-character preference folders on Windows:

- Base path:
  - C:\Users\<username>\AppData\Local\Funcom\Anarchy Online\

- Inside that folder you will typically see one or more installation/profile folders with non-obvious names (example):
  - C:\Users\<username>\AppData\Local\Funcom\Anarchy Online\9486bac5

- Inside a profile folder there is the game data tree and a Prefs folder:
  - C:\Users\<username>\AppData\Local\Funcom\Anarchy Online\<profile-id>\Anarchy Online\Prefs\<accountname>\

- Per-character folders live under the account Prefs folder, for example:
  - C:\Users\<username>\AppData\Local\Funcom\Anarchy Online\<profile-id>\Anarchy Online\Prefs\<accountname>\Char1978257

Notes:
- There may be multiple profile-id folders if you have more than one installation/profile.
- Always close Anarchy Online before copying or editing files in these folders so the client does not overwrite your changes.
- Make a backup of any target Prefs folder before overwriting.

---

## Practical copy rules / glob patterns
Use these patterns to instruct a code assistant to copy only the recommended items from a larger character prefs folder. Adjust `include` / `optional` as needed.

Recommended copy (essential for UI/character prefs restore):
- `Char.cfg`
- `Prefs.xml`
- `Chat/**`  (the entire Chat folder to preserve channels, filters, colors, and window configs)
- `Containers/Bank.xml`
- `Containers/Inventory.xml`
- `Containers/ShortcutBar*.xml` (hotbar positions/contents — see caution above)
- `DockAreas/DockArea*.xml`
- `DockAreas/PlanetMapViewConfig.xml`
- `DockAreas/RollupArea.xml`

Optional (copy if you want social lists, macros, icon positions and other extras):
- `DisabledTipsMap.xml`
- `*.bin` (IconPositions.bin, IgnoreList.bin, References.bin, TextMacro.bin)
- Any additional container or plugin files not listed above

A practical set of globs for automated copy (shell-style):
- Include globs:
  - `Char.cfg`
  - `Prefs.xml`
  - `Chat/**`
  - `Containers/Bank.xml`
  - `Containers/Inventory.xml`
  - `Containers/ShortcutBar*.xml`
  - `DockAreas/DockArea*.xml`
  - `DockAreas/PlanetMapViewConfig.xml`
  - `DockAreas/RollupArea.xml`
- Optional globs (copy only if `--include-optional` or user confirms):
  - `*.bin`
  - `DisabledTipsMap.xml`

Important operational notes:
- Always close Anarchy Online before copying or overwriting preference files so the client does not overwrite your changes on exit.
- Make a backup of the target character’s preferences before copying — restore is trivial if something goes wrong.
- Binary files (`*.bin`) differ by client version. Copy them as opaque blobs in binary mode; prefer preserving timestamps and permissions when possible.
- Be cautious copying ShortcutBar/hotbar contents between characters of different professions; rebind or adapt hotbar contents after copying.
- Avoid copying logs or input history (`log.txt`, `inputhistory.xml`) — those are session-specific and personal.

---

## Edge cases & notes
- Binary files (`*.bin`) differ by client version. They are usually opaque and should be copied as blobs. If the client versions differ between source and target machines, you may see unexpected behaviour — keep backups.
- `Prefs.xml` sometimes contains machine-specific settings (audio devices, full-screen resolution) and server-specific cached info. If you want strictly UI layout, consider reviewing `Prefs.xml` or merging only UI-relevant nodes.
- If the source full prefs folder contains additional files not listed here (skin packs, plugin folders, versioned backups), verify whether they are per-character before copying.
- When automating: prefer a two-step copy (essentials first, optional binaries after confirmation).

---

## Quick example instruction for a code assistant
Copy only the essential UI/character prefs files from <source-folder> into <destination-folder>:

1. Close Anarchy Online.
2. Backup the destination character folder.
3. Copy these paths (required):
   - `Char.cfg`
   - `Prefs.xml`
   - `Chat/**`
   - `Containers/Bank.xml`
   - `Containers/Inventory.xml`
   - `Containers/ShortcutBar*.xml` (confirm hotbar contents as needed)
   - `DockAreas/DockArea*.xml`
   - `DockAreas/PlanetMapViewConfig.xml`
   - `DockAreas/RollupArea.xml`
4. Ask user whether to copy optional binaries: `*.bin`, `DisabledTipsMap.xml`.
5. Copy all files in binary mode and preserve timestamps if possible.
