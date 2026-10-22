// Front Matter 10.13 uses mismatched theme colors for Data selects and leaves
// native options unstyled. Set both colors so filenames remain readable.
const styleId = 'frontmatter-data-select-colors'
const style = document.getElementById(styleId) || document.createElement('style')
style.id = styleId
style.textContent = `
    .autoform .autoform__select_field select,
    .autoform .autoform__select_field select option,
    .autoform .autoform__select_field select optgroup {
        color: var(--vscode-dropdown-foreground, #333333);
        background-color: var(--vscode-dropdown-background, #ffffff);
    }

    .autoform .autoform__select_field select option,
    .autoform .autoform__select_field select optgroup {
        background-color: var(--vscode-dropdown-listBackground, var(--vscode-dropdown-background, #ffffff));
    }

    .autoform .autoform__select_field select {
        color-scheme: light;
    }

    body.vscode-dark .autoform .autoform__select_field select,
    body.vscode-high-contrast .autoform .autoform__select_field select {
        color-scheme: dark;
    }
`
if (!style.isConnected) document.head.appendChild(style)
