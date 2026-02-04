#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to remove empty lines between {{> breadcrumb}} and {{>title}} in HTML files.
"""

import os
import re
import sys

def process_file(filepath):
    """Process a single HTML file."""
    print(f"Processing: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to find {{> breadcrumb}} followed by any number of empty lines then {{>title}}
    # Also handle {{> title}} with space
    pattern = r'(\{\{>\s*breadcrumb\s*\}\})(\n\s*)+(\{\{>\s*title\s*\}\})'
    
    def replace_func(match):
        breadcrumb = match.group(1)
        title = match.group(3)
        # Replace with breadcrumb directly followed by title (one newline between)
        return f'{breadcrumb}\n{title}'
    
    new_content = re.sub(pattern, replace_func, content)
    
    # Also handle case where there might be whitespace before/after
    # More general pattern: breadcrumb, then whitespace lines, then title
    # This also catches cases where there might be other content (but shouldn't)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"  Removed empty lines between breadcrumb and title")
        return True
    else:
        print(f"  No empty lines to remove")
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