use libsql::{Builder, Connection, Database};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::{Mutex, RwLock};

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct DbConfig {
	pub sync_url: Option<String>,
	pub auth_token: Option<String>,
	#[serde(skip)]
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

const SYNC_CONFIG_FILE: &str = "sync-config.json";

pub fn load_config(app_data_dir: &PathBuf) -> DbConfig {
	let config_path = app_data_dir.join(SYNC_CONFIG_FILE);
	match std::fs::read_to_string(&config_path) {
		Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
		Err(_) => DbConfig::default(),
	}
}

fn save_config(app_data_dir: &PathBuf, config: &DbConfig) -> Result<(), String> {
	let config_path = app_data_dir.join(SYNC_CONFIG_FILE);
	let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
	std::fs::write(&config_path, json).map_err(|e| e.to_string())
}

pub struct DbState {
	pub db: Arc<Database>,
	pub conn: Arc<Mutex<Connection>>,
	pub config: DbConfig,
	pub app_data_dir: PathBuf,
}

const DB_FILE: &str = "paper-trail.db";
const DB_BACKUP_FILE: &str = "paper-trail.db.local-backup";

async fn build_database(app_data_dir: &PathBuf, config: &DbConfig) -> Result<Database, libsql::Error> {
	let db_path = app_data_dir.join(DB_FILE);

	if config.enable_sync {
		if let (Some(sync_url), Some(auth_token)) = (&config.sync_url, &config.auth_token) {
			match Builder::new_remote_replica(&db_path, sync_url.clone(), auth_token.clone())
				.build()
				.await
			{
				Ok(db) => Ok(db),
				Err(e) if e.to_string().contains("wal_index") => {
					// Local DB exists without WAL index — transition to replica mode
					// Back up the old file, then create a fresh replica
					let backup_path = app_data_dir.join(DB_BACKUP_FILE);
					std::fs::rename(&db_path, &backup_path)
						.map_err(|io_err| libsql::Error::SqliteFailure(io_err.raw_os_error().unwrap_or(1), io_err.to_string()))?;
					// Remove stale WAL/SHM files if present
					let _ = std::fs::remove_file(app_data_dir.join("paper-trail.db-shm"));
					let _ = std::fs::remove_file(app_data_dir.join("paper-trail.db-wal"));

					Builder::new_remote_replica(&db_path, sync_url.clone(), auth_token.clone())
						.build()
						.await
				}
				Err(e) => Err(e),
			}
		} else {
			Builder::new_local(db_path).build().await
		}
	} else {
		Builder::new_local(db_path).build().await
	}
}

/// Migrate data from local backup to new replica after transitioning.
/// Opens the backup as a local DB, reads all rows, inserts into new connection.
async fn migrate_from_local_backup(
	app_data_dir: &PathBuf,
	new_conn: &Connection,
) -> Result<(), String> {
	let backup_path = app_data_dir.join(DB_BACKUP_FILE);
	if !backup_path.exists() {
		return Ok(());
	}

	let old_db = Builder::new_local(&backup_path)
		.build()
		.await
		.map_err(|e| format!("Failed to open backup: {e}"))?;
	let old_conn = old_db.connect().map_err(|e| format!("Failed to connect to backup: {e}"))?;

	// Tables in dependency order (parents first)
	let tables = [
		("user_profile", "id, uuid, displayName, email, createdAt, updatedAt"),
		("projects", "id, active, name, customerId, rate_in_cents, description, createdAt, updatedAt, userId"),
		("timesheets", "id, projectId, invoiceId, name, description, active, createdAt, updatedAt, userId"),
		("timesheet_entries", "id, timesheetId, date, minutes, description, amount, createdAt, updatedAt, userId"),
		("transactions", "id, projectId, date, description, amount, filePath, createdAt, updatedAt, userId"),
		("schema_migrations", "version"),
	];

	for (table, columns) in &tables {
		let col_list: Vec<&str> = columns.split(", ").collect();
		let placeholders: Vec<String> = (1..=col_list.len()).map(|i| format!("${i}")).collect();

		let select_sql = format!("SELECT {columns} FROM {table}");
		let insert_sql = format!(
			"INSERT OR IGNORE INTO {table} ({columns}) VALUES ({})",
			placeholders.join(", ")
		);

		let mut rows = old_conn
			.query(&select_sql, libsql::params::Params::None)
			.await
			.map_err(|e| format!("Failed to read {table} from backup: {e}"))?;

		while let Some(row) = rows.next().await.map_err(|e| format!("Row read error: {e}"))? {
			let mut params: Vec<libsql::Value> = Vec::new();
			for i in 0..col_list.len() {
				let val = row.get_value(i as i32).map_err(|e| format!("Value error: {e}"))?;
				params.push(val);
			}
			new_conn
				.execute(&insert_sql, libsql::params::Params::Positional(params))
				.await
				.map_err(|e| format!("Failed to insert into {table}: {e}"))?;
		}
	}

	// Clean up backup
	let _ = std::fs::remove_file(&backup_path);

	Ok(())
}

impl DbState {
	pub async fn new(app_data_dir: PathBuf, config: DbConfig) -> Result<Self, libsql::Error> {
		std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

		let db = build_database(&app_data_dir, &config).await?;
		let conn = db.connect()?;

		Ok(Self {
			db: Arc::new(db),
			conn: Arc::new(Mutex::new(conn)),
			config,
			app_data_dir,
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

pub async fn initialize_db(app: &AppHandle) -> Result<(), libsql::Error> {
	let app_data_dir = app
		.path()
		.app_local_data_dir()
		.expect("Failed to get app data directory");

	let config = load_config(&app_data_dir);
	let db_state = DbState::new(app_data_dir.clone(), config).await?;

	// Run migrations
	let conn = db_state.get_connection();
	let conn_guard = conn.lock().await;
	let schema_sql = include_str!("../db/seed.sql");

	// Execute the entire schema as a batch
	// This handles PRAGMA statements and other commands that might return rows
	conn_guard.execute_batch(schema_sql).await?;

	// Migrate data from local backup if transitioning from local to replica
	migrate_from_local_backup(&app_data_dir, &conn_guard)
		.await
		.unwrap_or_else(|e| eprintln!("Migration from local backup failed: {e}"));

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
	let mut state = db_state.write().await;

	let new_config = DbConfig {
		sync_url,
		auth_token,
		enable_sync,
		..state.config.clone()
	};

	// Persist config to disk
	save_config(&state.app_data_dir, &new_config)?;

	// Rebuild database connection with new config
	let app_data_dir = state.app_data_dir.clone();
	let db = build_database(&app_data_dir, &new_config)
		.await
		.map_err(|e| e.to_string())?;

	let conn = db.connect().map_err(|e| e.to_string())?;

	// Run schema on the new connection
	let schema_sql = include_str!("../db/seed.sql");
	conn.execute_batch(schema_sql)
		.await
		.map_err(|e| e.to_string())?;

	// Migrate data from local backup if transitioning from local to replica
	migrate_from_local_backup(&app_data_dir, &conn).await?;

	// Replace state
	state.db = Arc::new(db);
	state.conn = Arc::new(Mutex::new(conn));
	state.config = new_config;

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
