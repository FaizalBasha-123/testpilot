use axum::{
    extract::Multipart,
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{fs, io::Read, path::PathBuf, process::Command, time::Duration};
use tempfile::TempDir;
use thiserror::Error;
use tracing::{error, info, warn};

// ============================================================================
// Error Types
// ============================================================================

#[derive(Error, Debug)]
enum AppError {
    #[error("Failed to process zip file: {0}")]
    ZipError(String),

    #[error("Scanner execution failed: {0}")]
    ScannerError(String),

    #[error("SonarQube API error: {0}")]
    ApiError(String),

    #[error("Missing required field: {0}")]
    MissingField(String),

    #[error("Internal server error: {0}")]
    InternalError(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::ZipError(msg) => (StatusCode::BAD_REQUEST, format!("Zip Error: {}", msg)),
            AppError::ScannerError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Scanner Error: {}", msg),
            ),
            AppError::ApiError(msg) => (
                StatusCode::BAD_GATEWAY,
                format!("SonarQube API Error: {}", msg),
            ),
            AppError::MissingField(msg) => (
                StatusCode::BAD_REQUEST,
                format!("Missing Field: {}", msg),
            ),
            AppError::InternalError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Internal Error: {}", msg),
            ),
        };

        let body = Json(serde_json::json!({
            "error": message
        }));

        (status, body).into_response()
    }
}

// ============================================================================
// Response Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
struct SonarIssue {
    key: String,
    rule: String,
    severity: String,
    component: String,
    line: Option<u32>,
    message: String,
    #[serde(rename = "type")]
    issue_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct SonarIssuesResponse {
    issues: Vec<SonarIssue>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnalyzeResponse {
    vulnerabilities: Vec<SonarIssue>,
    total_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct ComputeEngineTask {
    status: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ComputeEngineResponse {
    tasks: Vec<ComputeEngineTask>,
}

// ============================================================================
// Main Application Logic
// ============================================================================

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "sonar_backend=info,tower_http=info".into()),
        )
        .init();

    info!("Starting Sonar Backend Service (Rust)");

    // Build our application with routes
    let app = Router::new()
        .route("/", get(root_handler))
        .route("/health", get(health_handler))
        .route("/analyze", post(analyze_handler))
        .layer(
            tower_http::cors::CorsLayer::permissive()
        );

    // Run the server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000")
        .await
        .expect("Failed to bind to port 8000");

    info!("Server listening on 0.0.0.0:8000");

    axum::serve(listener, app)
        .await
        .expect("Server failed to start");
}

async fn root_handler() -> &'static str {
    "ok"
}

async fn health_handler() -> &'static str {
    "ok"
}

async fn analyze_handler(mut multipart: Multipart) -> Result<Json<AnalyzeResponse>, AppError> {
    info!("Received analyze request");

    // Create temporary directory for this job
    let temp_dir = TempDir::new()
        .map_err(|e| AppError::InternalError(format!("Failed to create temp dir: {}", e)))?;

    let temp_path = temp_dir.path().to_path_buf();
    info!("Created temp directory: {:?}", temp_path);

    // Extract zip file from multipart
    let zip_path = extract_zip_from_multipart(&mut multipart, &temp_path).await?;

    // Unzip the file
    let project_dir = unzip_file(&zip_path, &temp_path)?;

    // Generate unique job ID
    let job_id = format!("job_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));

    // Get SonarQube configuration from environment
    let sonarqube_url = std::env::var("SONARQUBE_URL")
        .unwrap_or_else(|_| "http://sonarqube:9000".to_string());
    let sonarqube_token =
        std::env::var("SONARQUBE_TOKEN").unwrap_or_else(|_| "admin".to_string());

    // Run sonar-scanner
    run_sonar_scanner(&project_dir, &job_id, &sonarqube_url, &sonarqube_token)?;

    // Poll for task completion
    poll_for_completion(&job_id, &sonarqube_url, &sonarqube_token).await?;

    // Fetch vulnerabilities
    let vulnerabilities = fetch_vulnerabilities(&job_id, &sonarqube_url, &sonarqube_token).await?;

    let total_count = vulnerabilities.len();
    info!("Analysis complete. Found {} vulnerabilities", total_count);

    // Cleanup happens automatically when temp_dir is dropped
    Ok(Json(AnalyzeResponse {
        vulnerabilities,
        total_count,
    }))
}

async fn extract_zip_from_multipart(
    multipart: &mut Multipart,
    temp_path: &PathBuf,
) -> Result<PathBuf, AppError> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::MissingField(format!("Failed to read multipart field: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "file" || name == "zip" {
            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::ZipError(format!("Failed to read file data: {}", e)))?;

            let zip_path = temp_path.join("upload.zip");
            fs::write(&zip_path, data)
                .map_err(|e| AppError::ZipError(format!("Failed to write zip file: {}", e)))?;

            info!("Saved zip file to {:?}", zip_path);
            return Ok(zip_path);
        }
    }

    Err(AppError::MissingField(
        "No zip file found in multipart request".to_string(),
    ))
}

fn unzip_file(zip_path: &PathBuf, temp_path: &PathBuf) -> Result<PathBuf, AppError> {
    let file = fs::File::open(zip_path)
        .map_err(|e| AppError::ZipError(format!("Failed to open zip file: {}", e)))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| AppError::ZipError(format!("Failed to read zip archive: {}", e)))?;

    let extract_path = temp_path.join("project");
    fs::create_dir_all(&extract_path)
        .map_err(|e| AppError::ZipError(format!("Failed to create extract directory: {}", e)))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| AppError::ZipError(format!("Failed to access zip entry: {}", e)))?;

        let outpath = match file.enclosed_name() {
            Some(path) => extract_path.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| {
                AppError::ZipError(format!("Failed to create directory: {}", e))
            })?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| {
                        AppError::ZipError(format!("Failed to create parent directory: {}", e))
                    })?;
                }
            }
            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| AppError::ZipError(format!("Failed to create output file: {}", e)))?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| {
                AppError::ZipError(format!("Failed to extract file contents: {}", e))
            })?;
        }

        // Set permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = file.unix_mode() {
                fs::set_permissions(&outpath, fs::Permissions::from_mode(mode))
                    .map_err(|e| AppError::ZipError(format!("Failed to set permissions: {}", e)))?;
            }
        }
    }

    info!("Extracted project to {:?}", extract_path);
    Ok(extract_path)
}

fn run_sonar_scanner(
    project_dir: &PathBuf,
    job_id: &str,
    sonarqube_url: &str,
    sonarqube_token: &str,
) -> Result<(), AppError> {
    info!("Running sonar-scanner for job: {}", job_id);

    let output = Command::new("sonar-scanner")
        .arg(format!("-Dsonar.projectKey={}", job_id))
        .arg(format!("-Dsonar.host.url={}", sonarqube_url))
        .arg(format!("-Dsonar.login={}", sonarqube_token))
        .arg("-Dsonar.sources=.")
        .current_dir(project_dir)
        .output()
        .map_err(|e| AppError::ScannerError(format!("Failed to execute sonar-scanner: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        error!("Scanner stderr: {}", stderr);
        error!("Scanner stdout: {}", stdout);
        return Err(AppError::ScannerError(format!(
            "Scanner exited with status: {}. Stderr: {}",
            output.status, stderr
        )));
    }

    info!("Scanner completed successfully");
    Ok(())
}

async fn poll_for_completion(
    job_id: &str,
    sonarqube_url: &str,
    sonarqube_token: &str,
) -> Result<(), AppError> {
    info!("Polling for task completion for job: {}", job_id);

    let client = reqwest::Client::new();
    let poll_url = format!("{}/api/ce/activity", sonarqube_url);
    let max_attempts = 60; // 5 minutes max (60 * 5 seconds)
    let poll_interval = Duration::from_secs(5);

    for attempt in 1..=max_attempts {
        tokio::time::sleep(poll_interval).await;

        let response = client
            .get(&poll_url)
            .query(&[("component", job_id)])
            .basic_auth("admin", Some(sonarqube_token))
            .send()
            .await
            .map_err(|e| AppError::ApiError(format!("Failed to poll task status: {}", e)))?;

        if !response.status().is_success() {
            warn!("Poll attempt {} failed with status: {}", attempt, response.status());
            continue;
        }

        let ce_response: ComputeEngineResponse = response
            .json()
            .await
            .map_err(|e| AppError::ApiError(format!("Failed to parse CE response: {}", e)))?;

        if let Some(task) = ce_response.tasks.first() {
            info!("Task status: {}", task.status);
            match task.status.as_str() {
                "SUCCESS" => {
                    info!("Task completed successfully");
                    return Ok(());
                }
                "FAILED" => {
                    return Err(AppError::ApiError(
                        "SonarQube analysis task failed".to_string(),
                    ));
                }
                "CANCELED" => {
                    return Err(AppError::ApiError(
                        "SonarQube analysis task was canceled".to_string(),
                    ));
                }
                _ => {
                    // Still processing
                    info!("Task still processing (attempt {}/{})", attempt, max_attempts);
                }
            }
        }
    }

    Err(AppError::ApiError(
        "Task polling timeout - analysis took too long".to_string(),
    ))
}

async fn fetch_vulnerabilities(
    job_id: &str,
    sonarqube_url: &str,
    sonarqube_token: &str,
) -> Result<Vec<SonarIssue>, AppError> {
    info!("Fetching vulnerabilities for job: {}", job_id);

    let client = reqwest::Client::new();
    let issues_url = format!("{}/api/issues/search", sonarqube_url);

    let response = client
        .get(&issues_url)
        .query(&[
            ("componentKeys", job_id),
            ("types", "VULNERABILITY,SECURITY_HOTSPOT"),
            ("ps", "500"), // Page size
        ])
        .basic_auth("admin", Some(sonarqube_token))
        .send()
        .await
        .map_err(|e| AppError::ApiError(format!("Failed to fetch issues: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::ApiError(format!(
            "Failed to fetch issues. Status: {}, Body: {}",
            status, body
        )));
    }

    let issues_response: SonarIssuesResponse = response
        .json()
        .await
        .map_err(|e| AppError::ApiError(format!("Failed to parse issues response: {}", e)))?;

    info!("Found {} issues", issues_response.issues.len());
    Ok(issues_response.issues)
}

// Add uuid dependency
mod uuid {
    use std::fmt;

    pub struct Uuid([u8; 16]);

    impl Uuid {
        pub fn new_v4() -> Self {
            use std::time::{SystemTime, UNIX_EPOCH};
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let mut bytes = [0u8; 16];
            bytes[0..8].copy_from_slice(&nanos.to_le_bytes()[0..8]);
            bytes[8..16].copy_from_slice(&nanos.to_le_bytes()[0..8]);
            
            // Set version and variant bits for UUID v4
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            
            Uuid(bytes)
        }
    }

    impl fmt::Display for Uuid {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(
                f,
                "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
                self.0[0], self.0[1], self.0[2], self.0[3],
                self.0[4], self.0[5],
                self.0[6], self.0[7],
                self.0[8], self.0[9],
                self.0[10], self.0[11], self.0[12], self.0[13], self.0[14], self.0[15]
            )
        }
    }
}
