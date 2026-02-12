#!/bin/bash

# Ask for the version number
echo "Enter the version number for the migration (e.g. 0.1.8):"
read version

# Ask for the migration description
echo "Enter a brief description of the migration:"
read description

# Add the migration to the get_migrations function in src-tauri/src/migrations/mod.rs
sed -i '' "/let mut migrations = HashMap::new();/a\\
        migrations.insert(\\
            \"$version\".to_string(),\\
            Migration {\\
                version: \"$version\".to_string(),\\
                description: \"$description\".to_string(),\\
            },\\
        );" src-tauri/src/migrations/mod.rs

# Add the migration case to the run_migration function
sed -i '' "/match version {/a\\
            \"$version\" => {\\
                // TODO: Implement migration for version $version\\
                Ok(())\\
            }," src-tauri/src/migrations/mod.rs

echo "Migration for version $version has been created!"
echo "Please implement the migration logic in the run_migration function in src-tauri/src/migrations/mod.rs" 