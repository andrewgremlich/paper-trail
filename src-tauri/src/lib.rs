mod demo_functions;

use demo_functions::greet;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "First simple seed for paper trail",
        kind: MigrationKind::Up,
        sql: include_str!("../db/seed.sql"),
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("salt.txt");

            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;

            Ok(())
        })
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:paper-trail.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
