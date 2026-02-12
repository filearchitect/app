#!/bin/bash

# Ask for the new version
CURRENT_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')
echo "Current version: $CURRENT_VERSION"


echo "Enter the new version number:"
read new_version

# Define arrays for filenames, patterns, and replacements
files=("package.json" "src-tauri/Cargo.toml" "src-tauri/tauri.conf.json")
patterns=(
    "\"version\": \".*\""             # For package.json
    "^version = \".*\""              # For src-tauri/Cargo.toml (anchor to the start of the line)
    "\"version\": \".*\""            # For src-tauri/tauri.conf.json
)
replacements=(
    "\"version\": \"$new_version\""  # Replacement for package.json
    "version = \"$new_version\""    # Replacement for src-tauri/Cargo.toml
    "\"version\": \"$new_version\"" # Replacement for src-tauri/tauri.conf.json
)

# Loop through each file and apply its specific replacement
for i in "${!files[@]}"; do
    file="${files[$i]}"
    pattern="${patterns[$i]}"
    replacement="${replacements[$i]}"
    # Escape special characters in the replacement text
    escaped_replacement=$(printf '%s\n' "$replacement" | sed 's/[&/\]/\\&/g')
    # Perform the replacement
    sed -i '' "s/$pattern/$escaped_replacement/g" "$file"
done