// Front Matter 10.13 uses mismatched theme colors for Data selects and leaves
// native options unstyled. Set both colors so filenames remain readable.
const styleId = 'frontmatter-data-select-colors'
const style = document.getElementById(styleId) || document.createElement('style')
style.id = styleId
style.textContent = `
    .news-image-search {
        margin-bottom: 0.4rem;
    }

    .news-image-search label,
    .news-image-search input {
        display: block;
        width: 100%;
    }

    .news-image-search input {
        box-sizing: border-box;
        margin-top: 0.25rem;
        padding: 0.35rem 0.5rem;
        color: var(--vscode-input-foreground, #333333);
        background: var(--vscode-input-background, #ffffff);
        border: 1px solid var(--vscode-input-border, #888888);
        border-radius: 2px;
    }

    .news-image-search input:focus {
        outline: 1px solid var(--vscode-focusBorder, #007acc);
    }

    .news-image-search input::placeholder {
        color: var(--vscode-input-placeholderForeground, #666666);
    }

    .autoform .autoform__select_field select,
    .autoform .autoform__select_field select option,
    .autoform .autoform__select_field select optgroup,
    .gallery-school-select,
    .gallery-school-select option,
    .gallery-school-select optgroup,
    .gallery-year-select,
    .gallery-year-select option,
    .gallery-year-select optgroup {
        color: var(--vscode-dropdown-foreground, #333333);
        background-color: var(--vscode-dropdown-background, #ffffff);
    }

    .autoform .autoform__select_field select option,
    .autoform .autoform__select_field select optgroup,
    .gallery-school-select option,
    .gallery-school-select optgroup,
    .gallery-year-select option,
    .gallery-year-select optgroup {
        background-color: var(--vscode-dropdown-listBackground, var(--vscode-dropdown-background, #ffffff));
    }

    .autoform .autoform__select_field select,
    .gallery-school-select,
    .gallery-year-select {
        color-scheme: light;
    }

    .gallery-select-field {
        display: inline-block;
        margin: 0 0.75rem 0.9rem 0;
        vertical-align: top;
    }

    .gallery-select-field label {
        display: block;
        margin-bottom: 0.3rem;
        font-weight: 600;
    }

    .gallery-school-select,
    .gallery-year-select {
        width: 100%;
        min-width: 9rem;
        padding: 0.25rem 0.4rem;
        border-radius: 2px;
    }

    body.vscode-dark .autoform .autoform__select_field select,
    body.vscode-dark .gallery-school-select,
    body.vscode-dark .gallery-year-select,
    body.vscode-high-contrast .autoform .autoform__select_field select,
    body.vscode-high-contrast .gallery-school-select,
    body.vscode-high-contrast .gallery-year-select {
        color-scheme: dark;
    }
`
if (!style.isConnected) document.head.appendChild(style)
