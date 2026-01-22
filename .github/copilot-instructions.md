# Copilot Instructions for PSBS Shared Content Project

## Project Overview

Static school website generator built with **Gulp + Panini (Handlebars)** for two Hungarian elementary schools (Bálint Sándor and other location). The project generates separate HTML sites from shared content using school-specific data configuration.

## Architecture & Data Flow

### Key Components

- **Gulp Build System** ([gulpfile.babel.js](gulpfile.babel.js#L1)): Orchestrates the entire build pipeline
- **Panini Templating Engine**: Handlebars-based static site generator (src/pages → dist)
- **Multi-School Setup**: Two separate school sites (school1/school2) share partials but use different data
- **Dynamic SCSS Variables**: School-specific colors loaded from data files into `_dynamic-colors.scss`

### Data Structure Patterns

```
src/data/
├── global.yml           # Shared content (descriptions, addresses, etc.)
├── common.yml           # Shared metadata (calendar dates, programs)
└── school{1,2}/
    └── *.yml            # School-specific colors, school names
```

**Critical Flow**: Page files reference data via Handlebars syntax → Panini merges with partials/layouts → HTML generated to dist/

### Pages & Layout System

- **Pages**: `src/pages/school{1,2}/**/*.html` (thin frontmatter + partial includes)
- **Layouts**: Choose via frontmatter `layout: default_bs` (supports: `default.html`, `default_bs.html`, `two_columns_ps.html`, `two_columns_bs.html`)
- **Partials**: `src/partials/*.html` (reusable components, included with `{{> partial-name}}`)
- **Frontmatter**: YAML metadata (layout, title, custom variables) at page top

## Critical Developer Workflows

### Starting Development

```bash
npm install            # Install dependencies
npm start             # Run Gulp (watch + BrowserSync on :8000)
```

### Build for Production

```bash
npm run build         # Creates optimized dist/ folder
```

### Dynamic School Configuration

Build system loads school-specific data via `--school` flag or defaults to 'iskola1':

- Reads `src/data/{school}.yml` during Sass compilation
- Generates `src/assets/scss/_dynamic-colors.scss` with `$varname` variables
- Colors and school details then available in CSS/HTML

## Project Conventions & Patterns

### Handlebars Helpers

- `{{concat arg1 arg2 arg3}}` (src/helpers/concat.js): Concatenate values
- `{{divide a b}}` (src/helpers/divide.js): Integer division for column layouts

### Common Partial Naming

Prefixes indicate scope:

- `common-*`: Shared content between schools (descriptions, callout boxes)
- `md-*`: Metadata sections
- `bs-` or `ps-`: School-specific variants (bs=Bálint Sándor, ps=other school)

### Asset Organization

```
src/assets/
├── scss/
│   ├── app.scss (entry point)
│   └── _dynamic-colors.scss (auto-generated)
├── js/app.js (webpack entry)
├── img/ (auto-compressed on build)
└── [other assets] → copied as-is to dist/assets/
```

## Build Pipeline Details

1. **Clean**: Remove dist/ folder
2. **Parallel**: Pages (Panini), JS (webpack), Images (imagemin), Assets (copy)
3. **Sass**: Compile with PostCSS autoprefixer
4. **StyleGuide**: Generate from src/styleguide/index.md

**Important**: Sass runs AFTER pages (for UnCSS integration if needed)

### Key Files to Edit

- **Add content**: Create `.html` files in `src/pages/school{1,2}/` with frontmatter
- **Reuse components**: Add to `src/partials/`
- **Update shared data**: Edit `src/data/global.yml` or `src/data/common.yml`
- **School-specific data**: Edit `src/data/school{1,2}/*.yml`

## Integration Points & External Dependencies

- **Foundation 6**: CSS/JS framework (src/assets/scss via node_modules)
- **Motion-UI**: Animation library
- **jQuery**: DOM manipulation
- **PDFjs-dist**: PDF viewing (imported in JS)
- **BrowserSync**: Live reload on file changes

## Configuration Files

- [config.yml](config.yml): Gulp paths, UnCSS options, dev server port (8000)
- [package.json](package.json): Dependencies, scripts, main entry
- [.prettierrc](.prettierrc): Code formatting rules
- [.babelrc](.babelrc): Babel transpilation config
