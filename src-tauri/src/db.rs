use libsql::{Builder, Connection, Database};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::{Mutex, RwLock};

#[derive(Clone)]
pub struct DbConfig {
	pub sync_url: Option<String>,
	pub auth_token: Option<String>,
	pub sync_interval: std::time::Duration,
	pub enable_sync: bool, // Future: gate this behind paid feature
}

impl Default for DbConfig {
	fn default() -> Self {
		Self {
			sync_url: None,
			auth_token: None,
			sync_interval: std::time::Duration::from_secs(60),
			enable_sync: true, // TODO: Make this a paid feature in the future
		}
	}
}

pub struct DbState {
	pub db: Arc<Database>,
	pub conn: Arc<Mutex<Connection>>,
	pub config: DbConfig,
}

impl DbState {
	pub async fn new(app: &AppHandle, config: DbConfig) -> Result<Self, libsql::Error> {
		let app_data_dir = app
			.path()
			.app_local_data_dir()
			.expect("Failed to get app data directory");

		std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

		let db_path = app_data_dir.join("paper-trail.db");

		// Build the database with or without sync
		let db = if config.enable_sync {
			if let (Some(sync_url), Some(auth_token)) = (&config.sync_url, &config.auth_token) {
				// Embedded replica with sync
				Builder::new_remote_replica(db_path, sync_url.clone(), auth_token.clone())
					.build()
					.await?
			} else {
				// No sync credentials, fall back to local
				Builder::new_local(db_path).build().await?
			}
		} else {
			// Sync disabled (future: gated behind paid feature)
			Builder::new_local(db_path).build().await?
		};

		// Create a single reusable connection to avoid "database is locked" errors
		let conn = db.connect()?;

		Ok(Self {
			db: Arc::new(db),
			conn: Arc::new(Mutex::new(conn)),
			config,
		})
	}

	pub fn get_connection(&self) -> Arc<Mutex<Connection>> {
		self.conn.clone()
	}

	pub async fn sync(&self) -> Result<(), libsql::Error> {
		if self.config.enable_sync {
			self.db.sync().await?;
		}
		Ok(())
	}
}

pub async fn initialize_db(app: &AppHandle, config: DbConfig) -> Result<(), libsql::Error> {
	let db_state = DbState::new(app, config).await?;

	// Run migrations
	let conn = db_state.get_connection();
	let conn_guard = conn.lock().await;
	let schema_sql = include_str!("../db/seed.sql");

	// Execute the entire schema as a batch
	// This handles PRAGMA statements and other commands that might return rows
	conn_guard.execute_batch(schema_sql).await?;

	drop(conn_guard); // Release lock before managing state

	app.manage(Arc::new(RwLock::new(db_state)));

	Ok(())
}

#[tauri::command]
pub async fn execute_query(
	db_state: State<'_, Arc<RwLock<DbState>>>,
	query: String,
	params: Vec<serde_json::Value>,
) -> Result<Vec<serde_json::Value>, String> {
	let db = db_state.read().await;
	let conn = db.get_connection();
	let conn_guard = conn.lock().await;

	// Convert JSON params to libsql Values
	let libsql_params: Vec<libsql::Value> = params
		.into_iter()
		.map(|v| json_to_libsql_value(v))
		.collect();

	let mut rows = conn_guard
		.query(&query, libsql::params::Params::Positional(libsql_params))
		.await
		.map_err(|e| e.to_string())?;

	let mut results = Vec::new();

	while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
		let mut obj = serde_json::Map::new();

		for i in 0..row.column_count() {
			let col_name = row.column_name(i).unwrap_or("unknown").to_string();
			let value = libsql_value_to_json(row.get_value(i).map_err(|e| e.to_string())?);
			obj.insert(col_name, value);
		}

		results.push(serde_json::Value::Object(obj));
	}

	Ok(results)
}

#[tauri::command]
pub async fn execute_statement(
	db_state: State<'_, Arc<RwLock<DbState>>>,
	query: String,
	params: Vec<serde_json::Value>,
) -> Result<ExecuteResult, String> {
	let db = db_state.read().await;
	let conn = db.get_connection();
	let conn_guard = conn.lock().await;

	let libsql_params: Vec<libsql::Value> = params
		.into_iter()
		.map(|v| json_to_libsql_value(v))
		.collect();

	let result = conn_guard
		.execute(&query, libsql::params::Params::Positional(libsql_params))
		.await
		.map_err(|e| e.to_string())?;

	Ok(ExecuteResult {
		rows_affected: result,
		last_insert_id: conn_guard.last_insert_rowid(),
	})
}

#[tauri::command]
pub async fn sync_database(db_state: State<'_, Arc<RwLock<DbState>>>) -> Result<(), String> {
	let db = db_state.read().await;
	db.sync().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_sync_config(
	db_state: State<'_, Arc<RwLock<DbState>>>,
	sync_url: Option<String>,
	auth_token: Option<String>,
	enable_sync: bool,
) -> Result<(), String> {
	let mut db = db_state.write().await;
	db.config.sync_url = sync_url;
	db.config.auth_token = auth_token;
	db.config.enable_sync = enable_sync;
	Ok(())
}

#[derive(serde::Serialize)]
pub struct ExecuteResult {
	pub rows_affected: u64,
	pub last_insert_id: i64,
}

// Helper functions to convert between JSON and libsql Value types
fn json_to_libsql_value(value: serde_json::Value) -> libsql::Value {
	match value {
		serde_json::Value::Null => libsql::Value::Null,
		serde_json::Value::Bool(b) => libsql::Value::Integer(if b { 1 } else { 0 }),
		serde_json::Value::Number(n) => {
			if let Some(i) = n.as_i64() {
				libsql::Value::Integer(i)
			} else if let Some(f) = n.as_f64() {
				libsql::Value::Real(f)
			} else {
				libsql::Value::Null
			}
		}
		serde_json::Value::String(s) => libsql::Value::Text(s),
		_ => libsql::Value::Null, // Arrays and objects not supported
	}
}

fn libsql_value_to_json(value: libsql::Value) -> serde_json::Value {
	match value {
		libsql::Value::Null => serde_json::Value::Null,
		libsql::Value::Integer(i) => serde_json::Value::Number(i.into()),
		libsql::Value::Real(f) => {
			serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap_or(0.into()))
		}
		libsql::Value::Text(s) => serde_json::Value::String(s),
		libsql::Value::Blob(b) => {
			// Convert blob to base64 string
			serde_json::Value::String(base64::encode(&b))
		}
	}
}

// Add base64 encoding for blob support
mod base64 {
	pub fn encode(input: &[u8]) -> String {
		const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		let mut result = String::new();
		let mut i = 0;

		while i < input.len() {
			let b1 = input[i];
			let b2 = if i + 1 < input.len() { input[i + 1] } else { 0 };
			let b3 = if i + 2 < input.len() { input[i + 2] } else { 0 };

			result.push(CHARS[(b1 >> 2) as usize] as char);
			result.push(CHARS[(((b1 & 0x03) << 4) | (b2 >> 4)) as usize] as char);

			if i + 1 < input.len() {
				result.push(CHARS[(((b2 & 0x0f) << 2) | (b3 >> 6)) as usize] as char);
			} else {
				result.push('=');
			}

			if i + 2 < input.len() {
				result.push(CHARS[(b3 & 0x3f) as usize] as char);
			} else {
				result.push('=');
			}

			i += 3;
		}

		result
	}
}
