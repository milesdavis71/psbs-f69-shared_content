#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to verify that all HTML files have the required changes:
1. Frontmatter contains 'page:' and 'dataFile: 5b_kozzeteteli_lista'
2. File contains '{{> breadcrumb}}' before '{{>title}}'
"""

import os
import re
import sys

def check_file(filepath):
    """Check a single HTML file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    filename = os.path.basename(filepath)
    page_name = os.path.splitext(filename)[0]
    
    issues = []
    
    # 1. Check frontmatter for page
    page_match = re.search(r'^page:\s*' + re.escape(page_name), content, re.MULTILINE)
    if not page_match:
        issues.append(f"Missing or incorrect 'page:' frontmatter (expected: {page_name})")
    
    # 2. Check frontmatter for dataFile
    datafile_match = re.search(r'^dataFile:\s*5b_kozzeteteli_lista', content, re.MULTILINE)
    if not datafile_match:
        issues.append("Missing or incorrect 'dataFile:' frontmatter (expected: 5b_kozzeteteli_lista)")
    
    # 3. Check breadcrumb before title
    # Find positions of breadcrumb and title
    breadcrumb_pattern = r'\{\{>\s*breadcrumb\s*\}\}'
    title_pattern = r'\{\{>\s*title\s*\}\}'
    
    breadcrumb_match = re.search(breadcrumb_pattern, content)
    title_match = re.search(title_pattern, content)
    
    if not breadcrumb_match:
        issues.append("Missing '{{> breadcrumb}}'")
    if not title_match:
        issues.append("Missing '{{> title}}'")
    
    if breadcrumb_match and title_match:
        # Check if breadcrumb comes before title
        if breadcrumb_match.start() > title_match.start():
            issues.append("'{{> breadcrumb}}' appears after '{{> title}}'")
        # Check if there's excessive empty lines between them
        # Get the text between breadcrumb and title
        between = content[breadcrumb_match.end():title_match.start()]
        empty_line_count = between.count('\n')
        if empty_line_count > 2:  # Allow for 1 newline and maybe some whitespace
            issues.append(f"Too many empty lines between breadcrumb and title ({empty_line_count - 1} empty lines)")
    
    return issues

def main():
    target_dir = os.path.join('src', 'pages', 'bs', 'kozzeteteli_lista')
    
    if not os.path.exists(target_dir):
        print(f"Error: Directory {target_dir} does not exist")
        sys.exit(1)
    
    files_checked = 0
    files_with_issues = 0
    
    print("Verifying changes in all HTML files...")
    print("=" * 60)
    
    for filename in sorted(os.listdir(target_dir)):
        if filename.endswith('.html'):
            filepath = os.path.join(target_dir, filename)
            files_checked += 1
            
            issues = check_file(filepath)
            
            if issues:
                files_with_issues += 1
                print(f"\n{filename}:")
                for issue in issues:
                    print(f"  - {issue}")
            else:
                print(f"{filename}: OK")
    
    print("\n" + "=" * 60)
    print(f"Summary:")
    print(f"  Files checked: {files_checked}")
    print(f"  Files with issues: {files_with_issues}")
    
    if files_with_issues == 0:
        print("All files meet the requirements!")
        return 0
    else:
        return 1

if __name__ == '__main__':
    sys.exit(main())