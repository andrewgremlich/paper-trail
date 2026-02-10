mod db;
mod demo_functions;

use db::{execute_query, execute_statement, initialize_db, sync_database, update_sync_config, DbConfig};
use demo_functions::greet;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("salt.txt");

            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;

            // Initialize Turso database with embedded replica support
            let db_config = DbConfig::default();
            tauri::async_runtime::block_on(async {
                initialize_db(&app.handle(), db_config)
                    .await
                    .expect("Failed to initialize database")
            });

            Ok(())
        })
        .plugin(tauri_plugin_keyring::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            execute_query,
            execute_statement,
            sync_database,
            update_sync_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
