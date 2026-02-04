#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to update frontmatter and add breadcrumb to HTML files in bs/kozzeteteli_lista folder.
Requirements:
1. Add page and dataFile to frontmatter
2. Insert {{> breadcrumb}} above {{>title}}
"""

import os
import re
import sys

def process_file(filepath):
    """Process a single HTML file."""
    print(f"Processing: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract filename without extension
    filename = os.path.basename(filepath)
    page_name = os.path.splitext(filename)[0]
    
    # 1. Update frontmatter
    # Find frontmatter (between --- and ---)
    frontmatter_pattern = r'^---\n(.*?)\n---'
    match = re.search(frontmatter_pattern, content, re.DOTALL | re.MULTILINE)
    
    if not match:
        print(f"  Warning: No frontmatter found in {filepath}")
        return False
    
    frontmatter = match.group(1)
    
    # Check if page already exists
    if not re.search(r'^page:', frontmatter, re.MULTILINE):
        # Add page after title or at the end of frontmatter
        if re.search(r'^title:', frontmatter, re.MULTILINE):
            # Insert after title line
            frontmatter = re.sub(
                r'^(title:.*)$',
                r'\1\npage: ' + page_name,
                frontmatter,
                flags=re.MULTILINE
            )
        else:
            # Add at the end
            frontmatter = frontmatter + '\npage: ' + page_name
    
    # Check if dataFile already exists
    if not re.search(r'^dataFile:', frontmatter, re.MULTILINE):
        # Add dataFile after page or at the end
        if re.search(r'^page:', frontmatter, re.MULTILINE):
            # Insert after page line
            frontmatter = re.sub(
                r'^(page:.*)$',
                r'\1\ndataFile: 5b_kozzeteteli_lista',
                frontmatter,
                flags=re.MULTILINE
            )
        else:
            # Add at the end
            frontmatter = frontmatter + '\ndataFile: 5b_kozzeteteli_lista'
    
    # Replace frontmatter in content
    new_content = re.sub(
        frontmatter_pattern,
        '---\n' + frontmatter + '\n---',
        content,
        count=1,
        flags=re.DOTALL | re.MULTILINE
    )
    
    # 2. Add breadcrumb above {{>title}} or {{> title}}
    # Find {{>title}} or {{> title}} pattern (could be with whitespace)
    title_pattern = r'(\s*)\{\{>\s*title\s*\}\}'
    title_match = re.search(title_pattern, new_content)
    
    if title_match:
        whitespace = title_match.group(1)
        title_line = title_match.group(0)
        # Check if breadcrumb already exists right before title
        # Look for breadcrumb followed by optional whitespace then title
        breadcrumb_pattern = r'\{\{>\s*breadcrumb\s*\}\}\s*' + re.escape(title_line)
        if not re.search(breadcrumb_pattern, new_content):
            # Insert breadcrumb directly above title (no empty line)
            new_content = re.sub(
                title_pattern,
                whitespace + '{{> breadcrumb}}\n' + whitespace + '{{>title}}',
                new_content,
                count=1
            )
            print(f"  Added breadcrumb before title")
    else:
        print(f"  Warning: {{>title}} not found in {filepath}")
    
    # Write back if changes were made
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"  Updated successfully")
        return True
    else:
        print(f"  No changes needed")
        return False

def main():
    target_dir = os.path.join('src', 'pages', 'bs', 'kozzeteteli_lista')
    
    if not os.path.exists(target_dir):
        print(f"Error: Directory {target_dir} does not exist")
        sys.exit(1)
    
    files_processed = 0
    files_updated = 0
    
    for filename in os.listdir(target_dir):
        if filename.endswith('.html'):
            filepath = os.path.join(target_dir, filename)
            files_processed += 1
            if process_file(filepath):
                files_updated += 1
    
    print(f"\nSummary:")
    print(f"  Files processed: {files_processed}")
    print(f"  Files updated: {files_updated}")

if __name__ == '__main__':
    main()